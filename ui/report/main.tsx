import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "../shared/theme.css";
import "./report.css";
import { useFullscreenToggle, useMcpApp, type McpAppState } from "../shared/useMcpApp";
import { Badge, Icon, Monogram, Skeleton, copyText, useToast } from "../shared/components";
import { SAMPLE_REPORT } from "../shared/sample-report";
import { PURPOSES } from "../../src/shared/purposes";
import type { PurposeKey } from "../../src/server/schemas";
import { FinancialsTab, FollowUps, MarketTab, OverviewTab, PeopleTab, PurposeTab, ReportCtx, RisksTab, ScoreRing, SignalsTab, SourcesTab, fmtDate, type Report } from "./sections";
import { reportToMarkdown } from "./markdown";

interface ResultData {
  reportId?: string;
  report?: Report;
  fitLabel?: string;
  tabLabel?: string;
  savedAt?: string;
}

const looksLikeReport = (x: unknown): x is Report => {
  const r = x as Partial<Report> | null;
  return !!r && typeof r === "object" && !!r.company?.name && !!r.summary?.headline && Array.isArray(r.sources);
};

function ReportApp() {
  const state = useMcpApp("Company Research Report");
  const rsc = (state.toolResult?.structuredContent ?? null) as ResultData | null;
  const [fetched, setFetched] = useState<Report | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const report: Report | null = useMemo(() => {
    if (state.status === "preview") return SAMPLE_REPORT;
    if (rsc?.report && looksLikeReport(rsc.report)) return rsc.report;
    if (looksLikeReport(state.toolInput)) return state.toolInput;
    return fetched;
  }, [state.status, rsc?.report, state.toolInput, fetched]);

  // Fallback: the host gave us a result with an id but no report data (no tool-input notification).
  useEffect(() => {
    if (report || !rsc?.reportId || state.status !== "connected" || fetchError) return;
    state.actions
      .callServerTool("report_open", { reportId: rsc.reportId })
      .then((res) => {
        const sc = (res.structuredContent ?? {}) as ResultData;
        if (looksLikeReport(sc.report)) setFetched(sc.report);
        else setFetchError("The saved report could not be loaded.");
      })
      .catch((err) => setFetchError(err instanceof Error ? err.message : String(err)));
  }, [report, rsc?.reportId, state.status, fetchError, state.actions]);

  if (state.status === "error") return <div className="frame empty"><Icon name="warning" /> <span>Could not connect to the host: {state.error?.message}</span></div>;
  if (state.cancelledReason && !report) return <div className="frame empty"><Icon name="warning" /> <span>Research was cancelled: {state.cancelledReason}</span></div>;
  if (fetchError && !report) return <div className="frame empty"><Icon name="warning" /> <span>{fetchError}</span></div>;
  if (state.toolResult?.isError && !report) {
    const t = state.toolResult.content?.find((c) => c.type === "text") as { text?: string } | undefined;
    return <div className="frame empty"><Icon name="warning" /> <span>{t?.text ?? "The report could not be rendered."}</span></div>;
  }
  if (!report) return <LoadingReport />;
  return <ReportView report={report} state={state} result={rsc} />;
}

function LoadingReport() {
  return (
    <div className="frame" aria-busy="true">
      <div className="rp-header" style={{ paddingBottom: 18 }}>
        <div className="rp-top">
          <Skeleton w={48} h={48} r={14} />
          <div className="rp-identity" style={{ gap: 8 }}>
            <Skeleton w="45%" h={22} />
            <Skeleton w="70%" h={14} />
            <div className="row wrap" style={{ marginTop: 4 }}><Skeleton w={90} h={26} r={8} /><Skeleton w={110} h={26} r={8} /><Skeleton w={80} h={26} r={8} /></div>
          </div>
          <Skeleton w={64} h={64} r={32} />
        </div>
        <div className="rp-verdict"><Skeleton w="30%" h={12} /><Skeleton w="90%" h={20} /><Skeleton w="60%" h={20} /></div>
      </div>
      <div className="rp-content" style={{ paddingBottom: 20 }}>
        <div className="metrics"><Skeleton h={72} r={10} /><Skeleton h={72} r={10} /><Skeleton h={72} r={10} /><Skeleton h={72} r={10} /></div>
        <Skeleton w="100%" h={14} /><Skeleton w="85%" h={14} /><Skeleton w="92%" h={14} />
      </div>
    </div>
  );
}

type TabId = "overview" | "purpose" | "signals" | "financials" | "people" | "market" | "risks" | "sources";

function ReportView({ report: r, state, result }: { report: Report; state: McpAppState; result: ResultData | null }) {
  const purpose = (r.meta?.purpose ?? "other") as PurposeKey;
  const meta = PURPOSES[purpose] ?? PURPOSES.other;
  const fitLabel = result?.fitLabel ?? meta.fitLabel;
  const tabLabel = result?.tabLabel ?? meta.tabLabel;
  const locale = state.hostContext?.locale ?? (typeof navigator !== "undefined" ? navigator.language : "en");
  const { mode, toggle } = useFullscreenToggle(state);
  const { toast, show } = useToast();
  const [tab, setTab] = useState<TabId>("overview");
  const [highlight, setHighlight] = useState<number | null>(null);

  const tabs = useMemo(() => {
    const t: { id: TabId; label: string; count?: number }[] = [{ id: "overview", label: "Overview" }];
    if (r.purposeSections?.length) t.push({ id: "purpose", label: tabLabel });
    if (r.timeline?.length) t.push({ id: "signals", label: "Signals", count: r.timeline.length });
    if (r.financials && (r.financials.summary || r.financials.series?.length || r.financials.funding?.length || r.financials.tables?.length)) t.push({ id: "financials", label: "Financials" });
    if (r.people?.length) t.push({ id: "people", label: "People", count: r.people.length });
    if (r.market || r.competitors?.length || r.products?.length || r.techStack?.length) t.push({ id: "market", label: "Market" });
    if (r.risks?.length || r.sentiment) t.push({ id: "risks", label: "Risks" });
    t.push({ id: "sources", label: "Sources", count: r.sources.length });
    return t;
  }, [r, tabLabel]);

  useEffect(() => {
    if (!tabs.some((t) => t.id === tab)) setTab("overview");
  }, [tabs, tab]);

  const ctx = useMemo(
    () => ({
      report: r,
      locale,
      fitLabel,
      onCite: (id: number) => {
        setTab("sources");
        setHighlight(id);
      },
      openLink: (url: string) => void state.actions.openLink(url),
      sendMessage: state.actions.sendMessage,
      notify: show,
    }),
    [r, locale, fitLabel, state.actions, show],
  );

  const copyMarkdown = async () => {
    const ok = await copyText(reportToMarkdown(r, { fitLabel, tabLabel }));
    show(ok ? "Report copied as Markdown" : "Copy failed");
  };

  const c = r.company;
  const facts: { k: string; v: string }[] = [];
  if (c.hq) facts.push({ k: "HQ", v: c.hq });
  if (c.founded) facts.push({ k: "Founded", v: c.founded });
  if (c.industry) facts.push({ k: "Industry", v: c.industry });
  if (c.employees) facts.push({ k: "Employees", v: c.employees });
  if (c.revenue) facts.push({ k: "Revenue", v: c.revenue });
  if (c.valuation) facts.push({ k: "Valuation", v: c.valuation });
  if (c.ticker) facts.push({ k: "Ticker", v: c.ticker });
  else if (c.stage) facts.push({ k: "Stage", v: c.stage });
  else if (c.ownership && c.ownership !== "unknown") facts.push({ k: "Ownership", v: c.ownership });
  if (c.ceo) facts.push({ k: "CEO", v: c.ceo });

  const followUps = r.followUps?.length ? r.followUps : [];
  const confTone = r.meta.overallConfidence === "high" ? "success" : r.meta.overallConfidence === "low" ? "warning" : "neutral";

  return (
    <ReportCtx.Provider value={ctx}>
      <div className={`rp frame ${mode === "fullscreen" ? "fullscreen" : ""}`}>
        <header className="rp-header">
          <div className="rp-top">
            <Monogram name={c.name} size={48} />
            <div className="rp-identity">
              <h1 className="name">{c.name}</h1>
              <div className="tagline">{c.tagline}</div>
              <div className="rp-facts">
                {facts.map((f) => (
                  <span key={f.k} className="fact"><b>{f.k}</b> {f.v}</span>
                ))}
                {c.website && (
                  <button type="button" className="fact" style={{ cursor: "pointer", border: 0 }} onClick={() => state.actions.openLink(c.website!)} title={c.website}>
                    <Icon name="external" size={12} /> {c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                  </button>
                )}
              </div>
            </div>
            <div className="rp-score">
              {r.fit && (
                <>
                  <div className="lbl">
                    <span className="v">{r.fit.label}</span>
                    <span className="k">{fitLabel}</span>
                  </div>
                  <ScoreRing score={r.fit.score} size={64} title={fitLabel} />
                </>
              )}
              {state.canFullscreen && (
                <button type="button" className="icon-btn" onClick={toggle} title={mode === "fullscreen" ? "Exit full screen" : "Full screen"} aria-label={mode === "fullscreen" ? "Exit full screen" : "Full screen"}>
                  <Icon name={mode === "fullscreen" ? "collapse" : "expand"} size={18} />
                </button>
              )}
            </div>
          </div>
          <div className="rp-verdict">
            <div className="meta">
              <Badge tone="accent"><Icon name={meta.icon} size={12} /> {r.meta.purposeLabel}</Badge>
              <Badge tone={confTone}>{r.meta.overallConfidence} confidence</Badge>
              <span>{fmtDate(r.meta.researchedAt, locale)} · {r.meta.depth ?? "deep"} research{r.meta.searchesRun ? ` · ${r.meta.searchesRun} searches` : ""}</span>
            </div>
            {r.meta.confidenceNote && <div className="note">{r.meta.confidenceNote}</div>}
            <div className="headline">{r.summary.headline}</div>
          </div>
        </header>

        <nav className="rp-tabs" aria-label="Report sections">
          <div className="tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                {t.label}
                {t.count !== undefined && <span className="count">{t.count}</span>}
              </button>
            ))}
          </div>
        </nav>

        <main className="rp-content fade-in" key={tab} role="tabpanel">
          {tab === "overview" && <OverviewTab />}
          {tab === "purpose" && <PurposeTab />}
          {tab === "signals" && <SignalsTab />}
          {tab === "financials" && <FinancialsTab />}
          {tab === "people" && <PeopleTab />}
          {tab === "market" && <MarketTab />}
          {tab === "risks" && <RisksTab />}
          {tab === "sources" && <SourcesTab highlight={highlight} />}
        </main>

        <footer className="rp-footer">
          <FollowUps items={followUps} />
          <span className="spacer" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyMarkdown} title="Copy the whole report as Markdown">
            <Icon name="copy" size={14} /> Copy as Markdown
          </button>
          {result?.reportId && <span className="small faint mono" title="Saved report id">{result.reportId}</span>}
        </footer>
        {toast}
      </div>
    </ReportCtx.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ReportApp />
  </StrictMode>,
);
