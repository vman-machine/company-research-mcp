/**
 * End-to-end test through a real MCP Apps host flow: the harness host connects
 * to the server, calls a tool, renders the view in a sandboxed iframe and
 * bridges the app protocol. Drives both views with Playwright and screenshots
 * every step. Requires the server on MCP_URL (default http://localhost:3000/mcp)
 * and `npm run harness:build`.
 */
import path from "node:path";
import fs from "node:fs";
import { chromium, type Browser, type Page, type FrameLocator } from "playwright";
import { Client, StreamableHTTPClientTransport, type CallToolResult } from "@modelcontextprotocol/client";
import { startHarness } from "./harness/serve";
import { SAMPLE_REPORT } from "../ui/shared/sample-report";

const MCP_URL = process.env.MCP_URL ?? "http://localhost:3000/mcp";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "test", "screenshots");
fs.mkdirSync(out, { recursive: true });

let failures = 0;
const check = (cond: unknown, msg: string) => {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${msg}`);
  if (!cond) failures++;
};
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });

async function launch(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch {
    return await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  }
}

const harness = startHarness({ hostPort: 8080, sandboxPort: 8081 });
const browser = await launch();

function hostUrl(tool: string, input: unknown, theme: "light" | "dark", width = 760) {
  const u = new URL(harness.hostUrl);
  u.searchParams.set("server", MCP_URL);
  u.searchParams.set("tool", tool);
  u.searchParams.set("input", JSON.stringify(input));
  u.searchParams.set("theme", theme);
  u.searchParams.set("width", String(width));
  return u.href;
}

async function open(tool: string, input: unknown, theme: "light" | "dark" = "light") {
  const ctx = await browser.newContext({ viewport: { width: 820, height: 900 }, colorScheme: theme });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => console.error("  pageerror:", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.error("  console.error:", m.text());
  });
  await page.goto(hostUrl(tool, input, theme));
  await page.waitForSelector("body[data-ready], body[data-error]");
  const status = await page.locator("#status").textContent();
  check(!(await page.locator("body[data-error]").count()), `${tool}: host reached tool result (${status})`);
  const app: FrameLocator = page.frameLocator("#app").frameLocator("iframe");
  return { ctx, page, app };
}

const panel = (page: Page, id: string) => page.locator(`#${id}`).textContent().then((t) => t ?? "");

// ---------------------------------------------------------------------------
console.log("\n[1] report_render through the host");
{
  const { ctx, page, app } = await open("report_render", SAMPLE_REPORT, "light");
  await app.locator(".rp-header .name").waitFor();
  check((await app.locator(".rp-header .name").textContent()) === "Lumen Freight Technologies", "report header shows company name");
  check((await page.locator("#app").boundingBox())!.height > 500, "host iframe auto-sized from app height");
  await page.waitForTimeout(400);
  await shot(page, "e2e-report-overview-light");

  const tabs = await app.getByRole("tab").allTextContents();
  check(tabs.some((t) => t.startsWith("Sales angle")), `tabs: ${tabs.join(" | ")}`);

  // Citation chip navigates to Sources and highlights
  await app.locator(".score-row .cite").first().click();
  await app.locator(".source.hl").waitFor();
  check(await app.getByRole("tab", { name: /Sources/ }).getAttribute("aria-selected") === "true", "citation click opens Sources tab with highlight");
  await shot(page, "e2e-report-sources-highlight-light");

  // Purpose tab and copy button
  await app.getByRole("tab", { name: "Sales angle" }).click();
  await app.locator("#sec-triggers").waitFor();
  await shot(page, "e2e-report-sales-angle-light");

  // Follow-up chip sends a message to the host
  await app.locator(".rp-footer .chip", { hasText: "Draft outreach email" }).click();
  await page.waitForFunction(() => (document.getElementById("messages")?.textContent ?? "").includes("Draft a short"));
  check((await panel(page, "messages")).includes("Sofia Marin"), "follow-up chip sent the prompt via ui/message");

  // Open link goes through the host
  await app.getByRole("tab", { name: /Sources/ }).click();
  await app.locator(".source .st").first().click();
  await page.waitForFunction(() => (document.getElementById("links")?.textContent ?? "").includes("http"));
  check((await panel(page, "links")).includes("lumenfreight.example/about"), "source link opened via ui/open-link");

  // Fullscreen round trip
  await app.getByRole("button", { name: "Full screen" }).click();
  await page.waitForFunction(() => document.body.classList.contains("fullscreen"));
  await app.locator(".frame.fullscreen").waitFor();
  check(true, "fullscreen requested and applied");
  await app.getByRole("tab", { name: "Financials" }).click();
  await page.waitForTimeout(300);
  await shot(page, "e2e-report-fullscreen-financials-light");
  await app.getByRole("button", { name: "Exit full screen" }).click();
  await page.waitForFunction(() => !document.body.classList.contains("fullscreen"));

  // Theme change propagates through host context
  await page.evaluate(() => (window as unknown as { setTheme: (t: string) => void }).setTheme("dark"));
  await page.waitForTimeout(400);
  const dataTheme = await app.locator("html").getAttribute("data-theme");
  check(dataTheme === "dark", `host theme change applied inside app (data-theme=${dataTheme})`);
  await app.getByRole("tab", { name: "Risks" }).click();
  await page.waitForTimeout(300);
  await shot(page, "e2e-report-risks-dark");
  await app.getByRole("tab", { name: "Overview" }).click();
  await page.waitForTimeout(300);
  await shot(page, "e2e-report-overview-dark");
  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log("\n[2] onboarding_start through the host, full wizard");
{
  const { ctx, page, app } = await open("onboarding_start", {}, "light");
  await app.getByText("Tell me about you").waitFor();
  await app.locator("#name").fill("Priya Nair");
  await app.locator("#title").fill("Enterprise Account Executive");
  await app.locator("#company").fill("Helios Payroll");
  await app.locator("#location").fill("London, UK");
  await shot(page, "e2e-onboarding-1-about");
  await app.getByRole("button", { name: "Continue" }).click();

  await app.getByText("Why do you research companies?").waitFor();
  await app.getByRole("radio", { name: /Sales and prospecting/ }).click();
  await shot(page, "e2e-onboarding-2-purpose");
  await app.getByRole("button", { name: "Continue" }).click();

  await app.getByText(/Tailor it for/).waitFor();
  await app.locator("#f-offering").fill("A multi-country payroll and benefits platform for 500-5,000 person companies.");
  await app.locator("#f-buyerPersonas").fill("CFO");
  await app.locator("#f-buyerPersonas").press("Enter");
  await app.locator(".suggestions .chip", { hasText: "Head of People" }).first().click();
  await app.getByRole("button", { name: /More options/ }).click();
  await app.locator(".suggestions .chip", { hasText: "New executive hire" }).first().click();
  await shot(page, "e2e-onboarding-3-details");
  await app.getByRole("button", { name: "Continue" }).click();

  await app.getByText("How should research run?").waitFor();
  await app.getByRole("radio", { name: "24 months" }).click();
  await shot(page, "e2e-onboarding-4-preferences");
  await app.getByRole("button", { name: "Continue" }).click();

  await app.getByText("Review and save").waitFor();
  await app.locator("#label").fill("Sales at Helios (e2e)");
  await shot(page, "e2e-onboarding-5-review");
  await app.getByRole("button", { name: "Save profile" }).click();

  await app.getByText("Profile saved").waitFor({ timeout: 20000 });
  await page.waitForTimeout(500);
  await shot(page, "e2e-onboarding-6-done");
  check((await app.locator(".done .title-lg").textContent()) === "Sales at Helios (e2e)", "done screen shows the saved profile label");
  await page.waitForFunction(() => (document.getElementById("context")?.textContent ?? "").includes("Research profile saved"));
  check(true, "profile_save result pushed to the model via ui/update-model-context");

  await app.getByPlaceholder(/Company name/).fill("Lumen Freight Technologies");
  await app.getByRole("button", { name: "Research" }).click();
  await page.waitForFunction(() => (document.getElementById("messages")?.textContent ?? "").includes("Research Lumen Freight Technologies"));
  check(true, "first-company prompt sent via ui/message");

  // Verify server state through the MCP client, then clean up
  const client = new Client({ name: "e2e", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));
  const got = (await client.callTool({ name: "profile_get", arguments: {} })) as CallToolResult;
  const profile = (got.structuredContent as { profile?: { id: string; label: string; purpose: string; purposeDetails: { buyerPersonas?: string[]; triggersOfInterest?: string[] }; preferences: { newsHorizonMonths: number } } }).profile;
  check(profile?.label === "Sales at Helios (e2e)" && profile.purpose === "sales", "server has the profile saved by the wizard");
  check(JSON.stringify(profile?.purposeDetails.buyerPersonas) === JSON.stringify(["CFO", "Head of People"]), `buyer personas saved: ${JSON.stringify(profile?.purposeDetails.buyerPersonas)}`);
  check(profile?.purposeDetails.triggersOfInterest?.includes("New executive hire") === true, "optional field from 'More options' saved");
  check(profile?.preferences.newsHorizonMonths === 24, "preference change (24 months) saved");
  if (profile) await client.callTool({ name: "profile_delete", arguments: { profileId: profile.id } });
  await client.close();
  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log("\n[3] report_open and error state");
{
  const { ctx, page, app } = await open("report_open", { reportId: "does-not-exist" }, "light");
  await app.locator(".frame.empty").waitFor();
  check((await app.locator(".frame.empty").textContent())?.includes("No saved report"), "report_open error is shown inside the view");
  await shot(page, "e2e-report-open-error");
  await ctx.close();
}

await browser.close();
harness.close();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll e2e checks passed");
process.exit(failures ? 1 : 0);
