import type { ReportInput } from "../../src/server/schemas";

type Series = NonNullable<NonNullable<ReportInput["financials"]>["series"]>[number];
type Risk = NonNullable<ReportInput["risks"]>[number];

export function formatValue(value: number, opts: { unit?: string; currency?: string }, locale = "en"): string {
  try {
    if (opts.currency && /^[A-Z]{3}$/.test(opts.currency)) {
      return new Intl.NumberFormat(locale, { style: "currency", currency: opts.currency, notation: "compact", maximumFractionDigits: 1 }).format(value);
    }
    if (opts.unit === "%") return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;
    const n = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
    const unit = opts.unit && !/^(people|count|number|units?|employees)$/i.test(opts.unit) ? ` ${opts.unit}` : "";
    return `${n}${unit}`;
  } catch {
    return String(value);
  }
}

export function scoreTone(score: number): "success" | "warning" | "danger" {
  return score >= 70 ? "success" : score >= 45 ? "warning" : "danger";
}

export function ScoreRing({ score, size = 64, title }: { score: number; size?: number; title?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const tone = scoreTone(score);
  const color = tone === "success" ? "var(--success-fg)" : tone === "warning" ? "var(--warning-fg)" : "var(--danger-fg)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${title ?? "Score"} ${Math.round(score)} out of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-2)" strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dasharray 0.8s var(--ease)" }} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.3} fontWeight={700} fill="var(--fg)" fontFamily="var(--font)">
        {Math.round(score)}
      </text>
    </svg>
  );
}

export function BarSeries({ series, locale }: { series: Series; locale?: string }) {
  const pts = series.points;
  const W = 420;
  const H = 170;
  const padL = 6;
  const padR = 6;
  const padT = 26;
  const padB = 26;
  const max = Math.max(...pts.map((p) => p.value), 0) || 1;
  const n = pts.length;
  const slot = (W - padL - padR) / n;
  const bw = Math.min(52, slot * 0.62);
  const fmt = (v: number) => formatValue(v, { unit: series.unit, currency: series.currency }, locale);
  const last = pts[n - 1];
  const prev = pts[n - 2];
  const change = prev && prev.value ? ((last.value - prev.value) / Math.abs(prev.value)) * 100 : null;
  const hasEstimate = pts.some((p) => p.estimate);
  const pid = `hatch-${series.name.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="card chart-card">
      <div className="hd">
        <div>
          <div className="title-sm">{series.name}</div>
          <div className="small faint">{pts[0]?.period} to {last?.period}{series.unit && series.unit !== "%" && !series.currency ? ` · ${series.unit}` : ""}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="last">{fmt(last.value)}{last.estimate ? <span className="faint small"> est.</span> : null}</div>
          {change !== null && Number.isFinite(change) && (
            <div className={`small ${change >= 0 ? "" : ""}`} style={{ color: change >= 0 ? "var(--success-fg)" : "var(--danger-fg)", fontWeight: 600 }}>
              {change >= 0 ? "+" : ""}{change.toFixed(0)}% vs {prev!.period}
            </div>
          )}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${series.name} by period: ${pts.map((p) => `${p.period} ${fmt(p.value)}`).join(", ")}`}>
        <defs>
          <pattern id={pid} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--accent-soft)" />
            <rect width="3" height="6" fill="var(--accent)" opacity="0.7" />
          </pattern>
        </defs>
        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="var(--line)" />
        {pts.map((p, i) => {
          const h = Math.max(2, ((H - padT - padB) * p.value) / max);
          const x = padL + slot * i + (slot - bw) / 2;
          const y = H - padB - h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={h} rx={4} fill={p.estimate ? `url(#${pid})` : "var(--accent)"} opacity={p.estimate ? 1 : i === n - 1 ? 1 : 0.75} />
              <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="10.5" fontWeight={600} fill="var(--fg-2)" fontFamily="var(--font)">{fmt(p.value)}</text>
              <text x={x + bw / 2} y={H - padB + 15} textAnchor="middle" fontSize="10.5" fill="var(--fg-3)" fontFamily="var(--font)">{p.period}</text>
            </g>
          );
        })}
      </svg>
      {hasEstimate && (
        <div className="legend">
          <span><span className="sw" /> Reported</span>
          <span><span className="sw est" /> Estimate</span>
        </div>
      )}
    </div>
  );
}

const LEVELS = ["low", "medium", "high"] as const;

export function RiskMatrix({ risks }: { risks: Risk[] }) {
  const cells: Record<string, number[]> = {};
  risks.forEach((r, i) => {
    const key = `${r.severity ?? "medium"}-${r.likelihood ?? "medium"}`;
    (cells[key] ??= []).push(i + 1);
  });
  return (
    <div className="card chart-card" aria-label="Risk matrix: impact against likelihood">
      <div className="title-sm">Risk matrix</div>
      <div className="matrix">
        {[...LEVELS].reverse().map((sev, row) => (
          <RowFragment key={sev} sev={sev} row={row} cells={cells} />
        ))}
        <span />
        {LEVELS.map((lik) => (
          <span key={lik} className="axh">{lik}</span>
        ))}
      </div>
      <div className="legend"><span>Rows: impact (high at top). Columns: likelihood. Numbers match the list.</span></div>
    </div>
  );
}

function RowFragment({ sev, row, cells }: { sev: string; row: number; cells: Record<string, number[]> }) {
  return (
    <>
      {row === 0 && <span className="ax" style={{ gridRow: "1 / span 3" }}>impact</span>}
      {LEVELS.map((lik, col) => {
        const level = 2 - row + col; // 0..4
        const cls = level <= 1 ? "l1" : level === 2 ? "l2" : "l3";
        return (
          <div key={lik} className={`cell ${cls}`} title={`${sev} impact, ${lik} likelihood`}>
            {(cells[`${sev}-${lik}`] ?? []).map((n) => (
              <span key={n} className="pip">{n}</span>
            ))}
          </div>
        );
      })}
    </>
  );
}

export function RatingBar({ source, score, scale = 5, count }: { source: string; score: number; scale?: number; count?: number }) {
  const pct = Math.max(0, Math.min(1, score / scale)) * 100;
  return (
    <div className="rating">
      <span className="muted">{source}</span>
      <div className="bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      <span><b>{score}</b><span className="faint">/{scale}{count ? ` · ${count.toLocaleString()} reviews` : ""}</span></span>
    </div>
  );
}
