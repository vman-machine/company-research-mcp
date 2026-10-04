import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ReportInput } from "../../src/server/schemas";
import { Badge, Icon, Monogram, Rich, copyText } from "../shared/components";
import { BarSeries, RatingBar, RiskMatrix, ScoreRing } from "./charts";

export type Report = ReportInput;
type Section = Report["purposeSections"][number];
type Item = NonNullable<Section["items"]>[number];

export interface ReportContext {
  report: Report;
  locale: string;
  fitLabel: string;
  onCite: (id: number) => void;
  openLink: (url: string) => void;
  sendMessage: (text: string) => Promise<boolean>;
  notify: (msg: string) => void;
}

export const ReportCtx = createContext<ReportContext | null>(null);
const useReport = () => {
  const ctx = useContext(ReportCtx);
  if (!ctx) throw new Error("ReportCtx missing");
  return ctx;
};

export function fmtDate(value: string | undefined, locale: string): string {
  if (!value) return "";
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(value);
  if (!m) return value;
  const [, y, mo, d] = m;
  try {
    if (d) return new Date(Date.UTC(+y, +mo! - 1, +d)).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    if (mo) return new Date(Date.UTC(+y, +mo - 1, 1)).toLocaleDateString(locale, { month: "short", year: "numeric", timeZone: "UTC" });
  } catch { /* fall through */ }
  return y;
}

export function Cites({ ids }: { ids?: number[] }) {
  const { onCite, report } = useReport();
  if (!ids?.length) return null;
  return (
    <span className="cites">
      {ids.map((id) => {
        const src = report.sources.find((s) => s.id === id);
        return (
          <button key={id} type="button" className="cite" title={src ? `${src.title}${src.publisher ? ` - ${src.publisher}` : ""}` : `Source ${id}`} onClick={() => onCite(id)} aria-label={`Source ${id}`}>
            {id}
          </button>
        );
      })}
    </span>
  );
}

function SectionHead({ title, intro, right }: { title: string; intro?: string; right?: ReactNode }) {
  return (
    <div className="stack" style={{ gap: 2 }}>
      <div className="section-head">
        <h3>{title}</h3>
        {right}
      </div>
      {intro && <div className="section-head"><span className="intro">{intro}</span></div>}
    </div>
  );
}

const toneForBadge = (b?: string) => (b === "high" ? "accent" : b === "medium" ? "neutral" : b === "low" ? "low" : b ?? "neutral");
const sevTone = (s?: string) => (s === "high" ? "danger" : s === "medium" ? "warning" : "neutral");
const relTone = (s?: string) => (s === "high" ? "success" : s === "low" ? "warning" : "neutral");

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
export function OverviewTab() {
  const { report: r, fitLabel } = useReport();
  return (
    <>
      {r.metrics && r.metrics.length > 0 && (
        <div className="metrics">
          {r.metrics.map((m, i) => (
            <div key={i} className="card soft metric">
              <span className="k">{m.label}</span>
              <span className="v">{m.value}</span>
              {m.change && (
                <span className={`c ${m.trend ?? "flat"}`}>
                  {m.trend && <Icon name={m.trend === "up" ? "trend-up" : m.trend === "down" ? "trend-down" : "trend-flat"} size={13} />}
                  {m.change}
                </span>
              )}
              {(m.note || m.sourceIds?.length) && <span className="n">{m.note}<Cites ids={m.sourceIds} /></span>}
            </div>
          ))}
        </div>
      )}

      <section className="section">
        <SectionHead title="Key findings" />
        <ul className="bullets">{r.summary.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
      </section>

      <div className="callout">
        <span className="eyebrow" style={{ color: "var(--accent)" }}>Why it matters for you</span>
        <ul className="bullets">{r.summary.whyItMatters.map((b, i) => <li key={i}>{b}</li>)}</ul>
        {r.summary.recommendation && <div className="reco"><b>Recommended next step:</b> {r.summary.recommendation}</div>}
      </div>

      {r.fit && (
        <section className="section">
          <SectionHead title={`${fitLabel} scorecard`} right={<span className="small muted">{Math.round(r.fit.score)}/100 · {r.fit.label}</span>} />
          <p className="muted small">{r.fit.rationale}</p>
          <div className="scorecard">
            {r.fit.criteria.map((c, i) => (
              <div key={i} className="score-row">
                <span className="nm">{c.name}</span>
                <div className="bar" aria-hidden="true"><span style={{ width: `${Math.max(2, c.score)}%`, background: c.score >= 70 ? "var(--success-fg)" : c.score >= 45 ? "var(--warning-fg)" : "var(--danger-fg)" }} /></div>
                <span className="num">{Math.round(c.score)}</span>
                <span className="as">{c.assessment}<Cites ids={c.sourceIds} /></span>
              </div>
            ))}
          </div>
        </section>
      )}

      {r.swot && (
        <section className="section">
          <SectionHead title="SWOT" />
          <div className="swot">
            {([["s", "Strengths", r.swot.strengths], ["w", "Weaknesses", r.swot.weaknesses], ["o", "Opportunities", r.swot.opportunities], ["t", "Threats", r.swot.threats]] as const).map(([k, t, items]) => (
              <div key={k} className={`card soft ${k}`}>
                <h4>{t}</h4>
                <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {r.company.description && (
        <section className="section">
          <SectionHead title="About" />
          <Rich text={r.company.description} className="muted" />
        </section>
      )}

      {r.openQuestions && r.openQuestions.length > 0 && (
        <section className="section">
          <SectionHead title="Open questions" intro="Could not be verified or needs a human check." />
          <ul className="bullets">{r.openQuestions.map((q, i) => <li key={i} className="muted">{q}</li>)}</ul>
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Purpose sections
// ---------------------------------------------------------------------------
export function PurposeTab() {
  const { report: r } = useReport();
  return (
    <>
      {r.purposeSections.map((s) => (
        <section key={s.id} className="section" id={`sec-${s.id}`}>
          <SectionHead title={s.title} intro={s.intro} />
          <SectionBody section={s} />
        </section>
      ))}
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const { notify } = useReport();
  return (
    <button type="button" className="icon-btn" title="Copy" aria-label="Copy text" onClick={async () => notify((await copyText(text)) ? "Copied" : "Copy failed")}>
      <Icon name="copy" size={16} />
    </button>
  );
}

function ItemCard({ item }: { item: Item }) {
  return (
    <div className="card stack" style={{ gap: 6 }}>
      <div className="item-ttl row wrap" style={{ gap: 6 }}>
        <span className="title-sm" style={{ flex: 1, minWidth: 0 }}>{item.title}</span>
        {item.tag && <Badge>{item.tag}</Badge>}
        {item.badge && <Badge tone={toneForBadge(item.badge)}>{item.badge}</Badge>}
      </div>
      <Rich text={item.body} className="muted" />
      <div className="row between">
        <span><Cites ids={item.sourceIds} /></span>
        {item.copyable && <CopyButton text={item.body} />}
      </div>
    </div>
  );
}

function ItemRow({ item, index, kind }: { item: Item; index: number; kind: Section["kind"] }) {
  return (
    <div className={`item ${kind === "qa" ? "qa" : ""}`}>
      {kind === "steps" ? <span className="marker">{index + 1}</span> : kind === "qa" ? null : <span className="marker dot" aria-hidden="true" />}
      <div className="body">
        <div className={kind === "qa" ? "q" : "ttl"}>
          <span>{item.title}</span>
          {item.tag && <Badge>{item.tag}</Badge>}
          {item.badge && <Badge tone={toneForBadge(item.badge)}>{item.badge}</Badge>}
        </div>
        <div className={kind === "qa" ? "a" : "txt"}><Rich text={item.body} /></div>
        <Cites ids={item.sourceIds} />
      </div>
      {item.copyable && <div className="acts"><CopyButton text={item.body} /></div>}
    </div>
  );
}

function SectionBody({ section: s }: { section: Section }) {
  switch (s.kind) {
    case "cards":
      return <div className="grid-2">{(s.items ?? []).map((it, i) => <ItemCard key={i} item={it} />)}</div>;
    case "table":
      return <DataTable columns={s.columns ?? []} rows={s.rows ?? []} />;
    case "two-column":
      return (
        <div className="two-col">
          {s.left && <div className="card soft left"><h4>{s.left.title}</h4><ul>{s.left.items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
          {s.right && <div className="card soft right"><h4>{s.right.title}</h4><ul>{s.right.items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
        </div>
      );
    case "text":
      return null;
    case "scorecard":
      return (
        <div className="items">
          {(s.items ?? []).map((it, i) => (
            <div key={i} className="item">
              <div className="body">
                <div className="ttl"><span>{it.title}</span>{it.badge && <Badge tone={toneForBadge(it.badge)}>{it.badge}</Badge>}{it.tag && <Badge>{it.tag}</Badge>}</div>
                <div className="txt"><Rich text={it.body} /></div>
                <Cites ids={it.sourceIds} />
              </div>
            </div>
          ))}
        </div>
      );
    default:
      return <div className="items">{(s.items ?? []).map((it, i) => <ItemRow key={i} item={it} index={i} kind={s.kind} />)}</div>;
  }
}

export function DataTable({ columns, rows, note }: { columns: string[]; rows: string[][]; note?: string }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="table-wrap">
        <table className="data">
          <thead><tr>{columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>{row.map((cell, j) => <td key={j} className={/^[-+€$£¥]?[\d.,]+[%KMBx]?$/.test(cell.trim()) ? "num" : undefined}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <span className="small faint">{note}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signals (timeline)
// ---------------------------------------------------------------------------
export function SignalsTab() {
  const { report: r, locale } = useReport();
  const [cat, setCat] = useState<string>("all");
  const items = useMemo(() => [...(r.timeline ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [r.timeline]);
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of items) m.set(t.category ?? "other", (m.get(t.category ?? "other") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);
  const shown = cat === "all" ? items : items.filter((t) => (t.category ?? "other") === cat);
  return (
    <section className="section">
      <SectionHead title="Signals and events" intro={`${items.length} dated events, newest first.`} />
      {cats.length > 1 && (
        <div className="filters" role="group" aria-label="Filter by category">
          <button type="button" className={`chip ${cat === "all" ? "selected" : ""}`} onClick={() => setCat("all")}>All <span className="faint">{items.length}</span></button>
          {cats.map(([c, n]) => (
            <button key={c} type="button" className={`chip ${cat === c ? "selected" : ""}`} onClick={() => setCat(c)}>{labelCat(c)} <span className="faint">{n}</span></button>
          ))}
        </div>
      )}
      <div className="timeline">
        {shown.map((t, i) => (
          <div key={i} className="tl-item">
            <span className="date">{fmtDate(t.date, locale)}</span>
            <span className="rail"><span className={`dot ${t.impact ?? "neutral"}`} /></span>
            <div className="ev">
              <div className="ttl">
                <span>{t.title}</span>
                <Badge>{labelCat(t.category ?? "other")}</Badge>
                {t.relevance === "high" && <Badge tone="accent">key</Badge>}
              </div>
              {t.description && <div className="desc">{t.description}<Cites ids={t.sourceIds} /></div>}
              {!t.description && <Cites ids={t.sourceIds} />}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const CAT_LABELS: Record<string, string> = { funding: "Funding", leadership: "Leadership", product: "Product", ma: "M&A", legal: "Legal", financial: "Financial", hiring: "Hiring", layoffs: "Layoffs", partnership: "Partnership", expansion: "Expansion", regulatory: "Regulatory", other: "Other" };
const labelCat = (c: string) => CAT_LABELS[c] ?? c;

// ---------------------------------------------------------------------------
// Financials
// ---------------------------------------------------------------------------
export function FinancialsTab() {
  const { report: r, locale } = useReport();
  const f = r.financials;
  if (!f) return null;
  return (
    <>
      {f.summary && (
        <section className="section">
          <SectionHead title="Financial picture" />
          <Rich text={f.summary} className="muted" />
        </section>
      )}
      {f.series && f.series.length > 0 && (
        <div className="grid-2">{f.series.map((s, i) => <BarSeries key={i} series={s} locale={locale} />)}</div>
      )}
      {f.series?.some((s) => s.sourceIds?.length) && (
        <div className="small faint">Sources: {f.series.map((s, i) => <span key={i}>{s.name}<Cites ids={s.sourceIds} /> </span>)}</div>
      )}
      {f.funding && f.funding.length > 0 && (
        <section className="section">
          <SectionHead title="Funding history" />
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Date</th><th>Round</th><th>Amount</th><th>Investors</th><th>Valuation</th><th></th></tr></thead>
              <tbody>
                {f.funding.map((x, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(x.date, locale)}</td>
                    <td><b>{x.round}</b></td>
                    <td className="num">{x.amount}</td>
                    <td className="muted">{(x.investors ?? []).join(", ")}</td>
                    <td className="num">{x.valuation ?? ""}</td>
                    <td><Cites ids={x.sourceIds} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {f.tables?.map((t, i) => (
        <section key={i} className="section">
          <SectionHead title={t.title} right={<Cites ids={t.sourceIds} />} />
          <DataTable columns={t.columns} rows={t.rows} note={t.note} />
        </section>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------
const ROLE_LABEL: Record<string, string> = { ceo: "CEO", founder: "Founder", executive: "Executive", board: "Board", investor: "Investor", manager: "Manager", other: "" };

export function PeopleTab() {
  const { report: r, openLink } = useReport();
  return (
    <section className="section">
      <SectionHead title="People who matter" intro="Leadership and the people relevant to your purpose." />
      <div className="grid-2">
        {(r.people ?? []).map((p, i) => (
          <div key={i} className="card person">
            <Monogram name={p.name} size={40} />
            <div className="pb">
              <div className="nm">
                <span>{p.name}</span>
                {p.role && ROLE_LABEL[p.role] && <Badge>{ROLE_LABEL[p.role]}</Badge>}
                {p.linkedin && (
                  <button type="button" className="cite" style={{ height: 20 }} onClick={() => openLink(p.linkedin!)} title="Open LinkedIn profile" aria-label={`Open LinkedIn profile of ${p.name}`}><Icon name="external" size={11} /></button>
                )}
              </div>
              <div className="ti">{p.title}{p.since ? <span className="faint"> · since {p.since}</span> : null}</div>
              {p.background && <div className="bg">{p.background}</div>}
              {p.relevance && <div className="rel"><b>Why they matter</b>{p.relevance}<Cites ids={p.sourceIds} /></div>}
              {!p.relevance && <Cites ids={p.sourceIds} />}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Market and competitors
// ---------------------------------------------------------------------------
export function MarketTab() {
  const { report: r } = useReport();
  const m = r.market;
  return (
    <>
      {m && (
        <section className="section">
          <SectionHead title="Market" right={<Cites ids={m.sourceIds} />} />
          {m.description && <Rich text={m.description} className="muted" />}
          <div className="row wrap">
            {m.size && <span className="fact"><b>Size</b> {m.size}</span>}
            {m.growth && <span className="fact"><b>Growth</b> {m.growth}</span>}
          </div>
          {m.positioning && <div><b className="small faint" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>Positioning</b><div className="muted">{m.positioning}</div></div>}
          {m.trends && m.trends.length > 0 && <ul className="bullets">{m.trends.map((t, i) => <li key={i} className="muted">{t}</li>)}</ul>}
        </section>
      )}
      {r.products && r.products.length > 0 && (
        <section className="section">
          <SectionHead title="Products" />
          <div className="grid-2">
            {r.products.map((p, i) => (
              <div key={i} className="card stack" style={{ gap: 4 }}>
                <div className="row wrap"><span className="title-sm">{p.name}</span>{p.category && <Badge>{p.category}</Badge>}</div>
                <div className="muted small">{p.description}</div>
                {(p.pricing || p.customers) && <div className="small faint">{[p.pricing && `Pricing: ${p.pricing}`, p.customers && `Customers: ${p.customers}`].filter(Boolean).join(" · ")}</div>}
                <Cites ids={p.sourceIds} />
              </div>
            ))}
          </div>
        </section>
      )}
      {r.competitors && r.competitors.length > 0 && (
        <section className="section">
          <SectionHead title="Competitive landscape" />
          <div className="grid-2">
            {r.competitors.map((c, i) => (
              <div key={i} className="card stack" style={{ gap: 6 }}>
                <div className="row wrap"><span className="title-sm" style={{ flex: 1 }}>{c.name}</span><Badge tone={c.relationship === "direct" ? "danger" : c.relationship === "incumbent" ? "warning" : "neutral"}>{c.relationship ?? "direct"}</Badge></div>
                {c.description && <div className="muted small">{c.description}</div>}
                {(c.strengths || c.weaknesses) && (
                  <div className="grid-2" style={{ gap: 8 }}>
                    {c.strengths && <div className="small"><b style={{ color: "var(--success-fg)" }}>Stronger</b><div className="muted">{c.strengths}</div></div>}
                    {c.weaknesses && <div className="small"><b style={{ color: "var(--danger-fg)" }}>Weaker</b><div className="muted">{c.weaknesses}</div></div>}
                  </div>
                )}
                {c.note && <div className="small" style={{ paddingTop: 6, borderTop: "1px dashed var(--line)" }}>{c.note}</div>}
                <Cites ids={c.sourceIds} />
              </div>
            ))}
          </div>
        </section>
      )}
      {r.techStack && r.techStack.length > 0 && (
        <section className="section">
          <SectionHead title="Technology and vendors in use" />
          <div className="row wrap">{r.techStack.map((t, i) => <span key={i} className="chip static">{t}</span>)}</div>
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Risks and sentiment
// ---------------------------------------------------------------------------
const order = { high: 0, medium: 1, low: 2 } as const;

export function RisksTab() {
  const { report: r } = useReport();
  const risks = useMemo(() => [...(r.risks ?? [])].sort((a, b) => (order[a.severity ?? "medium"] - order[b.severity ?? "medium"]) || (order[a.likelihood ?? "medium"] - order[b.likelihood ?? "medium"])), [r.risks]);
  const s = r.sentiment;
  return (
    <>
      {risks.length > 0 && (
        <section className="section">
          <SectionHead title="Risks" intro="Ordered by impact, then likelihood." />
          <div className="risk-grid">
            <RiskMatrix risks={risks} />
            <div className="items">
              {risks.map((x, i) => (
                <div key={i} className="risk">
                  <span className="idx">{i + 1}</span>
                  <div className="body stack" style={{ gap: 4, flex: 1 }}>
                    <div className="row wrap" style={{ gap: 6 }}>
                      <span className="title-sm" style={{ flex: 1 }}>{x.title}</span>
                      <Badge tone={sevTone(x.severity)}>{x.severity ?? "medium"} impact</Badge>
                      <Badge tone={relTone(x.likelihood === "high" ? "low" : x.likelihood === "low" ? "high" : "medium")}>{x.likelihood ?? "medium"} likelihood</Badge>
                    </div>
                    <div className="muted small">{x.description}<Cites ids={x.sourceIds} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {s && (
        <section className="section">
          <SectionHead title="Sentiment" right={s.overall && <Badge tone={s.overall === "positive" ? "success" : s.overall === "negative" ? "danger" : "warning"}>{s.overall}</Badge>} />
          {s.ratings && s.ratings.length > 0 && <div className="stack">{s.ratings.map((g, i) => <RatingBar key={i} source={g.source} score={g.score} scale={g.scale ?? 5} count={g.count} />)}</div>}
          {s.themes && s.themes.length > 0 && (
            <div className="grid-2">
              {s.themes.map((t, i) => (
                <div key={i} className="card soft stack" style={{ gap: 4 }}>
                  <div className="row wrap"><span className="title-sm" style={{ flex: 1 }}>{t.theme}</span><Badge tone={t.sentiment === "positive" ? "success" : t.sentiment === "negative" ? "danger" : "warning"}>{t.sentiment}</Badge></div>
                  <div className="muted small">{t.evidence}<Cites ids={t.sourceIds} /></div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------
const TYPE_LABEL: Record<string, string> = { official: "Official", filing: "Filing", news: "News", database: "Database", review: "Reviews", social: "Social", blog: "Blog", report: "Report", other: "Web" };

export function SourcesTab({ highlight }: { highlight: number | null }) {
  const { report: r, openLink, locale } = useReport();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlight === null) return;
    const el = ref.current?.querySelector<HTMLElement>(`[data-source="${highlight}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight]);
  const sources = [...r.sources].sort((a, b) => a.id - b.id);
  const byRel = { high: 0, medium: 0, low: 0 } as Record<string, number>;
  for (const s of sources) byRel[s.reliability ?? "medium"] = (byRel[s.reliability ?? "medium"] ?? 0) + 1;
  return (
    <section className="section" ref={ref}>
      <SectionHead title={`${sources.length} sources`} intro={`${byRel.high} high reliability · ${byRel.medium} medium · ${byRel.low} low. Click a number anywhere in the report to jump here.`} />
      <div className="items">
        {sources.map((s) => (
          <div key={s.id} className={`source ${highlight === s.id ? "hl" : ""}`} data-source={s.id}>
            <span className="sid">{s.id}</span>
            <div>
              <button type="button" className="st" onClick={() => openLink(s.url)} title={s.url}>
                {s.title} <Icon name="external" size={12} />
              </button>
              <div className="sm">
                {s.publisher && <span>{s.publisher}</span>}
                {s.date && <span>· {fmtDate(s.date, locale)}</span>}
                <Badge>{TYPE_LABEL[s.type ?? "other"] ?? s.type}</Badge>
                <Badge tone={s.reliability === "high" ? "success" : s.reliability === "low" ? "warning" : "neutral"}>{s.reliability ?? "medium"} reliability</Badge>
              </div>
              {s.note && <div className="sn">{s.note}</div>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Footer follow-ups
// ---------------------------------------------------------------------------
export function FollowUps({ items }: { items: { label: string; prompt: string }[] }) {
  const { sendMessage, notify } = useReport();
  const [sent, setSent] = useState<string | null>(null);
  if (!items.length) return null;
  return (
    <>
      {items.map((f) => (
        <button key={f.label} type="button" className="chip" disabled={sent === f.label} onClick={async () => { const ok = await sendMessage(f.prompt); setSent(ok ? f.label : null); notify(ok ? "Sent to Claude" : "Could not send. Type the request in chat."); }} title={f.prompt}>
          <Icon name={sent === f.label ? "check" : "bolt"} size={13} /> {f.label}
        </button>
      ))}
    </>
  );
}

export { ScoreRing };
