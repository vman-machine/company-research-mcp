import type { ReportInput } from "../../src/server/schemas";

const line = (s?: string | null) => (s ? [s, ""] : []);
const bullets = (items?: string[] | null) => (items?.length ? [...items.map((i) => `- ${i}`), ""] : []);
const cite = (ids?: number[]) => (ids?.length ? ` [${ids.join(", ")}]` : "");

function table(columns: string[], rows: string[][]): string[] {
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  return [`| ${columns.map(esc).join(" | ")} |`, `| ${columns.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map(esc).join(" | ")} |`), ""];
}

export function reportToMarkdown(r: ReportInput, labels: { fitLabel: string; tabLabel: string }): string {
  const out: string[] = [];
  const c = r.company;
  out.push(`# ${c.name}`, "");
  out.push(`*${c.tagline}*`, "");
  const facts = [c.hq && `HQ: ${c.hq}`, c.founded && `Founded: ${c.founded}`, c.industry && `Industry: ${c.industry}`, c.employees && `Employees: ${c.employees}`, c.revenue && `Revenue: ${c.revenue}`, c.valuation && `Valuation: ${c.valuation}`, c.ticker ?? c.stage, c.ceo && `CEO: ${c.ceo}`, c.website].filter(Boolean) as string[];
  out.push(facts.join(" · "), "");
  out.push(`${r.meta.purposeLabel} · researched ${r.meta.researchedAt.slice(0, 10)} · depth ${r.meta.depth ?? "deep"} · confidence ${r.meta.overallConfidence}${r.meta.confidenceNote ? ` (${r.meta.confidenceNote})` : ""}`, "");
  out.push(`## Summary`, "", `**${r.summary.headline}**`, "", ...bullets(r.summary.bullets));
  out.push(`### Why it matters`, "", ...bullets(r.summary.whyItMatters));
  if (r.summary.recommendation) out.push(`**Recommended next step:** ${r.summary.recommendation}`, "");
  out.push(...line(c.description));
  if (r.fit) {
    out.push(`## ${labels.fitLabel}: ${Math.round(r.fit.score)}/100 (${r.fit.label})`, "", r.fit.rationale, "");
    out.push(...table(["Criterion", "Score", "Assessment"], r.fit.criteria.map((x) => [x.name, String(Math.round(x.score)), x.assessment + cite(x.sourceIds)])));
  }
  if (r.metrics?.length) out.push(`## Key metrics`, "", ...table(["Metric", "Value", "Change", "Note"], r.metrics.map((m) => [m.label, m.value, m.change ?? "", (m.note ?? "") + cite(m.sourceIds)])));
  if (r.purposeSections?.length) {
    out.push(`## ${labels.tabLabel}`, "");
    for (const s of r.purposeSections) {
      out.push(`### ${s.title}`, "", ...line(s.intro));
      if (s.kind === "table" && s.columns && s.rows) out.push(...table(s.columns, s.rows));
      else if (s.kind === "two-column") {
        if (s.left) out.push(`**${s.left.title}**`, "", ...bullets(s.left.items));
        if (s.right) out.push(`**${s.right.title}**`, "", ...bullets(s.right.items));
      } else if (s.items?.length) {
        s.items.forEach((it, i) => out.push(`${s.kind === "steps" ? `${i + 1}.` : "-"} **${it.title}**${it.tag ? ` (${it.tag})` : ""}: ${it.body}${cite(it.sourceIds)}`));
        out.push("");
      }
    }
  }
  if (r.timeline?.length) out.push(`## Signals and events`, "", ...r.timeline.map((t) => `- **${t.date}** ${t.title}${t.description ? `: ${t.description}` : ""} _(${t.category ?? "other"}${t.impact && t.impact !== "neutral" ? `, ${t.impact}` : ""})_${cite(t.sourceIds)}`), "");
  if (r.financials) {
    out.push(`## Financials`, "", ...line(r.financials.summary));
    for (const s of r.financials.series ?? []) out.push(`**${s.name}**${s.unit ? ` (${s.unit})` : ""}: ${s.points.map((p) => `${p.period}: ${p.value.toLocaleString()}${p.estimate ? " (est.)" : ""}`).join(", ")}${cite(s.sourceIds)}`, "");
    if (r.financials.funding?.length) out.push(...table(["Date", "Round", "Amount", "Investors", "Valuation"], r.financials.funding.map((f) => [f.date, f.round, f.amount, (f.investors ?? []).join(", "), f.valuation ?? ""])));
    for (const t of r.financials.tables ?? []) out.push(`**${t.title}**`, "", ...table(t.columns, t.rows));
  }
  if (r.people?.length) out.push(`## People`, "", ...r.people.map((p) => `- **${p.name}**, ${p.title}${p.since ? ` (since ${p.since})` : ""}${p.background ? ` - ${p.background}` : ""}${p.relevance ? ` _Why they matter: ${p.relevance}_` : ""}${cite(p.sourceIds)}`), "");
  if (r.market) {
    out.push(`## Market`, "", ...line(r.market.description), ...line(r.market.size && `Size: ${r.market.size}`), ...line(r.market.growth && `Growth: ${r.market.growth}`), ...line(r.market.positioning), ...bullets(r.market.trends));
  }
  if (r.competitors?.length) out.push(`## Competitors`, "", ...table(["Competitor", "Relationship", "Strengths", "Weaknesses", "Note"], r.competitors.map((x) => [x.name, x.relationship ?? "direct", x.strengths ?? "", x.weaknesses ?? "", (x.note ?? "") + cite(x.sourceIds)])));
  if (r.swot) out.push(`## SWOT`, "", `**Strengths**`, ...bullets(r.swot.strengths), `**Weaknesses**`, ...bullets(r.swot.weaknesses), `**Opportunities**`, ...bullets(r.swot.opportunities), `**Threats**`, ...bullets(r.swot.threats));
  if (r.risks?.length) out.push(`## Risks`, "", ...r.risks.map((x) => `- **${x.title}** (impact ${x.severity ?? "medium"}, likelihood ${x.likelihood ?? "medium"}): ${x.description}${cite(x.sourceIds)}`), "");
  if (r.sentiment) {
    out.push(`## Sentiment${r.sentiment.overall ? `: ${r.sentiment.overall}` : ""}`, "");
    for (const t of r.sentiment.themes ?? []) out.push(`- **${t.theme}** (${t.sentiment}): ${t.evidence}${cite(t.sourceIds)}`);
    for (const g of r.sentiment.ratings ?? []) out.push(`- ${g.source}: ${g.score}/${g.scale ?? 5}${g.count ? ` (${g.count} reviews)` : ""}`);
    out.push("");
  }
  if (r.techStack?.length) out.push(`## Technology in use`, "", r.techStack.join(", "), "");
  if (r.openQuestions?.length) out.push(`## Open questions`, "", ...bullets(r.openQuestions));
  out.push(`## Sources`, "", ...r.sources.map((s) => `${s.id}. [${s.title}](${s.url})${s.publisher ? ` - ${s.publisher}` : ""}${s.date ? `, ${s.date}` : ""} (${s.reliability ?? "medium"} reliability)${s.note ? ` - ${s.note}` : ""}`), "");
  return out.join("\n");
}
