/**
 * End-to-end protocol test against a running server (default http://localhost:3000/mcp).
 * Exercises every tool through the real MCP client, and checks the MCP Apps metadata.
 */
import { Client, StreamableHTTPClientTransport, type CallToolResult } from "@modelcontextprotocol/client";
import { SAMPLE_REPORT } from "../ui/shared/sample-report";

const url = new URL(process.env.MCP_URL ?? "http://localhost:3000/mcp");
let failures = 0;
const check = (cond: unknown, msg: string) => {
  if (cond) console.log(`  ok   ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
};
const sc = (r: CallToolResult) => (r.structuredContent ?? {}) as Record<string, any>;

const client = new Client({ name: "protocol-test", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(url));
console.log(`Connected to ${url} as ${client.getServerVersion()?.name} ${client.getServerVersion()?.version}`);
check(!!client.getInstructions?.(), "server advertises instructions");

const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
console.log("tools:", names.join(", "));
for (const n of ["profile_get", "onboarding_start", "profile_save", "profile_delete", "research_brief", "report_render", "report_list", "report_open"]) check(names.includes(n), `tool ${n} present`);
const uiOf = (n: string) => (tools.find((t) => t.name === n)?._meta as any)?.ui?.resourceUri;
check(uiOf("onboarding_start") === "ui://company-research/onboarding.html", "onboarding_start links its UI");
check(uiOf("report_render") === "ui://company-research/report.html", "report_render links its UI");
check(uiOf("report_open") === "ui://company-research/report.html", "report_open links its UI");
check(!uiOf("profile_get"), "profile_get has no UI");

const { resources } = await client.listResources();
check(resources.some((r) => r.uri === "ui://company-research/onboarding.html"), "onboarding resource listed");
check(resources.some((r) => r.uri === "ui://company-research/report.html"), "report resource listed");
for (const uri of ["ui://company-research/onboarding.html", "ui://company-research/report.html"]) {
  const res = await client.readResource({ uri });
  const c = res.contents[0] as { mimeType?: string; text?: string };
  check(c.mimeType === "text/html;profile=mcp-app", `${uri} has MCP App mime type`);
  check((c.text?.length ?? 0) > 1000 && c.text!.includes("<script"), `${uri} HTML has inline script (${((c.text?.length ?? 0) / 1024).toFixed(0)} KB)`);
}

const { prompts } = await client.listPrompts();
check(prompts.some((p) => p.name === "research_company"), "prompt research_company present");

let r = (await client.callTool({ name: "profile_get", arguments: {} })) as CallToolResult;
console.log("profile_get (empty):", sc(r).hasProfile);

r = (await client.callTool({ name: "onboarding_start", arguments: { purpose: "sales" } })) as CallToolResult;
check(sc(r).mode === "create", "onboarding_start returns create mode");

r = (await client.callTool({
  name: "profile_save",
  arguments: {
    label: "Sales at Helios Payroll",
    user: { name: "Priya Nair", title: "Enterprise AE", company: "Helios Payroll", location: "London" },
    purpose: "sales",
    purposeDetails: { offering: "Multi-country payroll and benefits platform", buyerPersonas: ["CFO", "VP People"], icpIndustries: ["SaaS", "Logistics"], icpCompanySizes: ["500-2,000"], competitors: ["Deel", "ADP"], triggersOfInterest: ["New CFO", "Expansion to new market"] },
    preferences: { depth: "deep", newsHorizonMonths: 12, language: "English", outputStyle: "executive" },
  },
})) as CallToolResult;
const profileId = sc(r).profile?.id as string;
check(!!profileId && !r.isError, `profile_save created profile ${profileId}`);
check(typeof sc(r).playbook === "string" && sc(r).playbook.includes("Sales"), "profile_save returns a playbook summary");

r = (await client.callTool({ name: "profile_get", arguments: {} })) as CallToolResult;
check(sc(r).hasProfile === true && sc(r).profile?.id === profileId, "profile_get returns the active profile");

r = (await client.callTool({ name: "research_brief", arguments: { company: "Lumen Freight Technologies", context: "They just opened a Chicago office" } })) as CallToolResult;
const briefText = (r.content[0] as { text: string }).text;
check(briefText.includes("# Research brief: Lumen Freight Technologies"), "research_brief has title");
check(briefText.includes("Deep research protocol") && briefText.includes('"stakeholders"'), "research_brief includes protocol and sales sections");
check(Array.isArray(sc(r).searchSeeds) && sc(r).searchSeeds.length > 15, `research_brief has ${sc(r).searchSeeds?.length} search seeds`);
check(sc(r).depth === "deep", "research_brief depth defaults to deep");

r = (await client.callTool({ name: "report_render", arguments: SAMPLE_REPORT as unknown as Record<string, unknown> })) as CallToolResult;
const reportId = sc(r).reportId as string;
check(!r.isError && !!reportId, `report_render saved report ${reportId}`);
check(sc(r).fitLabel === "Account fit" && sc(r).fitScore === 82, "report_render returns fit label and score");
check(!("report" in sc(r)), "report_render does not echo the full report (lean result)");

r = (await client.callTool({ name: "report_list", arguments: {} })) as CallToolResult;
check(Array.isArray(sc(r).reports) && sc(r).reports[0]?.id === reportId, "report_list lists the saved report first");

r = (await client.callTool({ name: "report_open", arguments: { reportId } })) as CallToolResult;
check(sc(r).report?.company?.name === "Lumen Freight Technologies", "report_open returns the full report");

r = (await client.callTool({ name: "report_open", arguments: { reportId: "nope" } })) as CallToolResult;
check(r.isError === true, "report_open with unknown id is an error");

// Invalid report should be rejected by schema validation
try {
  r = (await client.callTool({ name: "report_render", arguments: { company: { name: "X" } } })) as CallToolResult;
  check(r.isError === true, "report_render rejects an incomplete report");
} catch (err) {
  check(true, `report_render rejects an incomplete report (${(err as Error).message.slice(0, 60)}...)`);
}

r = (await client.callTool({ name: "profile_delete", arguments: { profileId } })) as CallToolResult;
check(sc(r).deleted === true, "profile_delete removed the profile");

const prompt = await client.getPrompt({ name: "research_company", arguments: { company: "Acme" } });
check(prompt.messages[0]?.content.type === "text" && (prompt.messages[0].content as { text: string }).text.includes("Acme"), "prompt expands with company name");

await client.close();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll protocol checks passed");
process.exit(failures ? 1 : 0);
