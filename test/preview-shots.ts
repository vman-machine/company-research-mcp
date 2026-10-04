/**
 * Screenshots of the built views in standalone preview mode (no host), light and dark.
 * Usage: tsx test/preview-shots.ts
 */
import path from "node:path";
import fs from "node:fs";
import { chromium, type Browser } from "playwright";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "test", "screenshots");
fs.mkdirSync(out, { recursive: true });

export async function launch(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch {
    return await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  }
}

const browser = await launch();
for (const theme of ["light", "dark"] as const) {
  const ctx = await browser.newContext({ viewport: { width: 760, height: 900 }, colorScheme: theme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("pageerror:", e.message));
  await page.goto(`file://${root}/dist/ui/report.html#preview-${theme}`);
  await page.waitForSelector(".rp-header", { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, `preview-report-overview-${theme}.png`), fullPage: true });
  for (const tab of ["Sales angle", "Signals", "Financials", "People", "Market", "Risks", "Sources"]) {
    await page.getByRole("tab", { name: tab }).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, `preview-report-${tab.toLowerCase().replace(/\s+/g, "-")}-${theme}.png`), fullPage: true });
  }
  await page.goto(`file://${root}/dist/ui/onboarding.html#preview-${theme}`);
  await page.waitForSelector(".ob", { timeout: 15000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, `preview-onboarding-step1-${theme}.png`), fullPage: true });
  await ctx.close();
}
await browser.close();
console.log("preview screenshots written to", out);
for (const f of fs.readdirSync(out).sort()) console.log(" -", f);
