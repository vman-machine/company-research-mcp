/**
 * MCP server factory. Registers the tools, the two MCP App views, and a prompt.
 * A new instance is created per HTTP request (stateless Streamable HTTP), so
 * everything here must be cheap; state lives in the ResearchRepository.
 */
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { DepthSchema, ProfileInputSchema, PurposeKeySchema, ReportSchema, type Profile } from "./schemas.js";
import { ResearchRepository, shortId, slugify } from "./store.js";
import { buildResearchBrief, playbookSummary, profileSummary, textOnboarding } from "./playbooks.js";
import { PURPOSES } from "../shared/purposes.js";
import { UI_HTML } from "../generated/ui.js";

export const SERVER_NAME = "Company Research";
export const SERVER_VERSION = "0.1.0";

export const UI_URIS = {
  onboarding: "ui://company-research/onboarding.html",
  report: "ui://company-research/report.html",
} as const;

export const TOOL_CATALOG: { name: string; title: string; ui: boolean }[] = [
  { name: "profile_get", title: "Load the active research profile and its playbook", ui: false },
  { name: "onboarding_start", title: "Interactive onboarding: who you are and why you research companies", ui: true },
  { name: "profile_save", title: "Save or update a research profile", ui: false },
  { name: "profile_delete", title: "Delete a research profile", ui: false },
  { name: "research_brief", title: "Tailored deep-research protocol for a specific company", ui: false },
  { name: "report_render", title: "Render the interactive research report", ui: true },
  { name: "report_list", title: "List saved reports", ui: false },
  { name: "report_open", title: "Reopen a saved report", ui: true },
];

export const SERVER_INSTRUCTIONS = `Company Research: purpose-tailored deep research on companies with an interactive report.

Workflow for any request to research, evaluate, profile or compare a company:
1. Call \`profile_get\` first. It returns the user's research profile (who they are, why they research companies) and how research should be tailored.
2. If there is no profile, call \`onboarding_start\` to open the interactive setup form and wait for the user to finish it (it saves via \`profile_save\`). If the form cannot render, ask the questions it lists in conversation and call \`profile_save\` yourself.
3. For each company, call \`research_brief\` with the company name. Follow the returned protocol closely: it sets the depth (deep by default), the questions to answer, the search plan, the verification rules and the exact report sections to produce. If it lists clarifying questions, ask them in one message before researching.
4. Do the research with web search and page fetches. Deep means 25-40+ searches, primary sources read directly, every key number triangulated and dated.
5. Call \`report_render\` once with the complete structured report, citing sources by id. Then reply with a 3-5 line summary and offer the follow-ups. Never paste the full report into chat.

Use \`report_list\` and \`report_open\` to find and reopen earlier reports.`;

type ToolResult = CallToolResult;

const text = (t: string): ToolResult["content"] => [{ type: "text", text: t }];

function describeProfiles(profiles: Profile[], activeId: string | null) {
  return profiles.map((p) => ({
    id: p.id,
    label: p.label,
    purpose: p.purpose,
    purposeLabel: PURPOSES[p.purpose].label,
    userName: p.user.name,
    updatedAt: p.updatedAt,
    active: p.id === activeId,
  }));
}

export function createServer(repo: ResearchRepository): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions: SERVER_INSTRUCTIONS });

  // ---------------------------------------------------------------------
  // Profiles
  // ---------------------------------------------------------------------

  server.registerTool(
    "profile_get",
    {
      title: "Get research profile",
      description:
        "Call this first in any company research conversation. Returns the user's active research profile (who they are, why they research companies, preferences) plus a summary of how research is tailored. If no profile exists, it says so: then call onboarding_start.",
      inputSchema: z.object({
        profileId: z.string().optional().describe("A specific profile id. Defaults to the active profile."),
        setActive: z.boolean().optional().describe("If true, make the given profile the active one."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ profileId, setActive }): Promise<ToolResult> => {
      const profiles = await repo.listProfiles();
      let profile: Profile | null = profileId ? await repo.getProfile(profileId) : await repo.getActiveProfile();
      if (profileId && !profile) {
        return { isError: true, content: text(`No profile with id "${profileId}". Known profiles: ${profiles.map((p) => p.id).join(", ") || "none"}.`) };
      }
      if (profile && setActive) await repo.setActiveProfile(profile.id);
      const activeId = await repo.getActiveProfileId();
      if (!profile) {
        return {
          content: text(
            "No research profile is saved yet. Call `onboarding_start` to open the interactive setup form (the user fills in who they are and why they research companies). If the form cannot be shown, collect the details in conversation and call `profile_save`.",
          ),
          structuredContent: { hasProfile: false, profiles: [] },
        };
      }
      const md = [profileSummary(profile), "", playbookSummary(profile)];
      if (profiles.length > 1) md.push("", `Other profiles: ${profiles.filter((p) => p.id !== profile!.id).map((p) => `${p.label} (id ${p.id})`).join("; ")}. Pass profileId to research_brief to use one of them.`);
      md.push("", "Next step: call `research_brief` with the company name the user wants researched.");
      return {
        content: text(md.join("\n")),
        structuredContent: { hasProfile: true, profile, activeProfileId: activeId, profiles: describeProfiles(profiles, activeId), playbook: playbookSummary(profile) },
      };
    },
  );

  registerAppTool(
    server,
    "onboarding_start",
    {
      title: "Set up research profile",
      description:
        "Opens the interactive onboarding form where the user describes themselves, why they research companies (sales, job search, investing, partnerships, competitive intel, vendor due diligence, journalism, other), purpose-specific details, and research preferences. Use when no profile exists, when the user wants to change their profile, or to add a profile for another purpose. The form saves through profile_save and tells you when done. Text-only hosts get the questions to ask instead.",
      inputSchema: z.object({
        purpose: PurposeKeySchema.optional().describe("Pre-select a purpose if the user already said why they research companies"),
        profileId: z.string().optional().describe("Edit an existing profile instead of creating a new one"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { ui: { resourceUri: UI_URIS.onboarding } },
    },
    async ({ purpose, profileId }): Promise<ToolResult> => {
      const profiles = await repo.listProfiles();
      const activeId = await repo.getActiveProfileId();
      const editing = profileId ? await repo.getProfile(profileId) : null;
      if (profileId && !editing) {
        return { isError: true, content: text(`No profile with id "${profileId}".`) };
      }
      const mode = editing ? "edit" : "create";
      const note = editing
        ? `Onboarding form opened to edit profile "${editing.label}".`
        : `Onboarding form opened to create a ${profiles.length ? "new" : "first"} profile.`;
      return {
        content: text(
          [
            note,
            "If the form is visible to the user, wait for them to complete it. It saves the profile itself and will report back; do not ask the same questions in chat.",
            "",
            textOnboarding(purpose ?? editing?.purpose),
          ].join("\n"),
        ),
        structuredContent: {
          mode,
          purposeHint: purpose ?? editing?.purpose,
          profile: editing,
          activeProfileId: activeId,
          profiles: describeProfiles(profiles, activeId),
        },
      };
    },
  );

  server.registerTool(
    "profile_save",
    {
      title: "Save research profile",
      description:
        "Create or update a research profile: who the user is, why they research companies, purpose-specific details and preferences. Called by the onboarding form, or by you after collecting the details in conversation. Pass an existing id to update. The saved profile becomes active unless makeActive is false.",
      inputSchema: ProfileInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (input): Promise<ToolResult> => {
      const now = new Date().toISOString();
      const existing = input.id ? await repo.getProfile(slugify(input.id)) : null;
      const id = existing ? existing.id : `${slugify(input.label ?? `${input.purpose}-${input.user.name}`)}-${shortId().slice(0, 4)}`;
      const label = input.label?.trim() || existing?.label || `${PURPOSES[input.purpose].label} for ${input.user.name}`;
      const profile: Profile = {
        id,
        label,
        user: input.user,
        purpose: input.purpose,
        purposeDetails: input.purposeDetails ?? {},
        preferences: input.preferences,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await repo.saveProfile(profile, input.makeActive ?? true);
      const playbook = playbookSummary(profile);
      return {
        content: text(
          [
            `${existing ? "Updated" : "Saved"} profile "${label}" (id ${id})${input.makeActive === false ? "" : " and made it the active profile"}.`,
            "",
            profileSummary(profile),
            "",
            playbook,
          ].join("\n"),
        ),
        structuredContent: { profile, playbook, created: !existing },
      };
    },
  );

  server.registerTool(
    "profile_delete",
    {
      title: "Delete research profile",
      description: "Delete a saved research profile by id. Ask the user to confirm first.",
      inputSchema: z.object({ profileId: z.string() }),
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ profileId }): Promise<ToolResult> => {
      const ok = await repo.deleteProfile(profileId);
      return ok
        ? { content: text(`Deleted profile ${profileId}.`), structuredContent: { deleted: true, profileId } }
        : { isError: true, content: text(`No profile with id "${profileId}".`) };
    },
  );

  // ---------------------------------------------------------------------
  // Research
  // ---------------------------------------------------------------------

  server.registerTool(
    "research_brief",
    {
      title: "Get research brief",
      description:
        "Call before researching a specific company. Returns the deep-research protocol tailored to the user's profile and this company: goal, clarifying questions (ask them first if any), research focus, search plan, source checklist, verification rules, depth budget, and the exact report sections and fit criteria to produce for report_render. Follow it closely.",
      inputSchema: z.object({
        company: z.string().min(1).describe("Company name as the user gave it"),
        website: z.string().optional().describe("Website if known, to disambiguate"),
        context: z.string().optional().describe("What the user said about why they are looking at this company now, e.g. 'they just raised a Series C', 'I have a second interview on Friday'"),
        profileId: z.string().optional().describe("Use a specific profile instead of the active one"),
        depth: DepthSchema.optional().describe("Override the profile's depth for this run"),
        isPublic: z.boolean().optional().describe("Whether the company is publicly listed, if already known"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ company, website, context, profileId, depth, isPublic }): Promise<ToolResult> => {
      const profile = profileId ? await repo.getProfile(profileId) : await repo.getActiveProfile();
      if (profileId && !profile) {
        return { isError: true, content: text(`No profile with id "${profileId}".`) };
      }
      const brief = buildResearchBrief(profile, { company, website, context, depth, isPublic });
      const { markdown, ...structured } = brief;
      return {
        content: text(markdown),
        structuredContent: { ...structured, profileId: profile?.id ?? null },
      };
    },
  );

  registerAppTool(
    server,
    "report_render",
    {
      title: "Render research report",
      description:
        "Render the finished research as an interactive report and save it. Call once, after research is complete, with the full structured report following the blueprint from research_brief: company facts, purpose-tailored summary, fit scorecard, metrics, timeline of signals, financials, people, competitors, risks, purpose sections, follow-ups and numbered sources. Every important claim should carry sourceIds.",
      inputSchema: ReportSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      _meta: { ui: { resourceUri: UI_URIS.report } },
    },
    async (report): Promise<ToolResult> => {
      const id = `${slugify(report.company.name)}-${shortId()}`;
      const saved = await repo.saveReport(id, report);
      const meta = PURPOSES[report.meta.purpose];
      const lines = [
        `Interactive report rendered and saved (report id: ${id}).`,
        `Headline: ${report.summary.headline}`,
        report.fit ? `${meta.fitLabel}: ${Math.round(report.fit.score)}/100, ${report.fit.label}.` : "",
        `Sources: ${report.sources.length}. Confidence: ${report.meta.overallConfidence}.`,
        "",
        "Now reply to the user with a 3-5 line summary (headline, verdict, the two most important findings, suggested next step) and offer the follow-ups. Do not repeat the report content; the interactive report shows it.",
      ].filter((l) => l !== "");
      return {
        content: text(lines.join("\n")),
        structuredContent: {
          reportId: id,
          savedAt: saved.savedAt,
          company: report.company.name,
          headline: report.summary.headline,
          fitScore: report.fit?.score ?? null,
          fitLabel: meta.fitLabel,
          tabLabel: meta.tabLabel,
        },
      };
    },
  );

  server.registerTool(
    "report_list",
    {
      title: "List saved reports",
      description: "List previously rendered research reports (newest first) with ids, so one can be reopened with report_open.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(60).optional().describe("Max results, default 20") }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ limit }): Promise<ToolResult> => {
      const reports = (await repo.listReports()).slice(0, limit ?? 20);
      if (!reports.length) return { content: text("No saved reports yet."), structuredContent: { reports: [] } };
      return {
        content: text(reports.map((r) => `- ${r.company} (${r.purposeLabel}) - ${r.headline} [id: ${r.id}, ${r.researchedAt.slice(0, 10)}]`).join("\n")),
        structuredContent: { reports },
      };
    },
  );

  registerAppTool(
    server,
    "report_open",
    {
      title: "Open saved report",
      description: "Reopen a saved research report in the interactive viewer by id (see report_list).",
      inputSchema: z.object({ reportId: z.string().describe("Report id from report_list or report_render") }),
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { ui: { resourceUri: UI_URIS.report } },
    },
    async ({ reportId }): Promise<ToolResult> => {
      const report = await repo.getReport(reportId);
      if (!report) return { isError: true, content: text(`No saved report with id "${reportId}". Call report_list to see available ids.`) };
      const meta = PURPOSES[report.meta.purpose];
      return {
        content: text(`Opened report for ${report.company.name} (${report.meta.purposeLabel}, researched ${report.meta.researchedAt.slice(0, 10)}). Headline: ${report.summary.headline}`),
        structuredContent: { reportId, report, fitLabel: meta.fitLabel, tabLabel: meta.tabLabel },
      };
    },
  );

  // ---------------------------------------------------------------------
  // Views (MCP App resources)
  // ---------------------------------------------------------------------

  registerAppResource(server, "Onboarding form", UI_URIS.onboarding, { description: "Interactive onboarding wizard for the research profile", _meta: { ui: { prefersBorder: false } } }, async () => ({
    contents: [{ uri: UI_URIS.onboarding, mimeType: RESOURCE_MIME_TYPE, text: UI_HTML.onboarding, _meta: { ui: { prefersBorder: false } } }],
  }));

  registerAppResource(server, "Research report", UI_URIS.report, { description: "Interactive company research report", _meta: { ui: { prefersBorder: false } } }, async () => ({
    contents: [{ uri: UI_URIS.report, mimeType: RESOURCE_MIME_TYPE, text: UI_HTML.report, _meta: { ui: { prefersBorder: false } } }],
  }));

  // ---------------------------------------------------------------------
  // Prompt
  // ---------------------------------------------------------------------

  server.registerPrompt(
    "research_company",
    {
      title: "Research a company",
      description: "Deep research on a company, tailored to your saved profile, ending in an interactive report.",
      argsSchema: z.object({
        company: z.string().describe("Company name"),
        context: z.string().optional().describe("Why now, or what you need from this"),
      }),
    },
    async ({ company, context }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Research ${company}${context ? ` (${context})` : ""} for me.`,
              "",
              "Steps: 1) call profile_get; if I have no profile, call onboarding_start and wait for me. 2) call research_brief for this company and ask any clarifying questions it lists in one message. 3) Run the deep research protocol with web search and page reads, triangulating key numbers. 4) call report_render with the complete structured report. 5) Reply with a 3-5 line summary and offer follow-ups.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  return server;
}
