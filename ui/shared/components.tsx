import { type ReactNode, useEffect, useState, type KeyboardEvent } from "react";

// ---------------------------------------------------------------------------
// Icons (monochrome, stroke-based, inherit currentColor)
// ---------------------------------------------------------------------------
export type IconName =
  | "target" | "briefcase" | "chart" | "handshake" | "radar" | "shield" | "pen" | "sparkle"
  | "check" | "arrow-left" | "arrow-right" | "external" | "copy" | "expand" | "collapse"
  | "search" | "info" | "warning" | "plus" | "x" | "link" | "calendar" | "user" | "building"
  | "trend-up" | "trend-down" | "trend-flat" | "chevron-down" | "chevron-up" | "send" | "bolt" | "edit" | "list";

const PATHS: Record<IconName, ReactNode> = {
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  handshake: <><path d="M3 11l4-4 5 5 2-2 3 3-5 5-3-3M21 11l-4-4-3 3" /><path d="M8 14l-2 2M11 17l-1 1" /></>,
  radar: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="M12 12l6-6M12 3v2" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></>,
  pen: <><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" /><path d="M13 7l3 3" /></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" /></>,
  check: <path d="M5 12l4 4L19 6" />,
  "arrow-left": <path d="M19 12H5M11 18l-6-6 6-6" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></>,
  expand: <><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></>,
  collapse: <><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  warning: <><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v4M12 17h.01" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  link: <><path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1" /><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" /></>,
  "trend-up": <><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></>,
  "trend-down": <><path d="M3 7l6 6 4-4 8 8" /><path d="M14 17h7v-7" /></>,
  "trend-flat": <path d="M3 12h18M16 7l5 5-5 5" />,
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  "chevron-up": <path d="M6 15l6-6 6 6" />,
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2 2 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
};

export function Icon({ name, size = 18, className, strokeWidth = 1.8 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
export function Badge({ tone = "neutral", children, className = "" }: { tone?: string; children: ReactNode; className?: string }) {
  return <span className={`badge ${tone} ${className}`}>{children}</span>;
}

export function Chip({ selected, onClick, onRemove, children, title }: { selected?: boolean; onClick?: () => void; onRemove?: () => void; children: ReactNode; title?: string }) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag type={onClick ? "button" : undefined} className={`chip ${selected ? "selected" : ""} ${onClick ? "" : "static"}`} onClick={onClick} title={title} aria-pressed={onClick ? selected : undefined}>
      {children}
      {onRemove && (
        <button type="button" className="x icon-inline" aria-label="Remove" onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ border: 0, background: "transparent", padding: 0, display: "inline-flex", cursor: "pointer", color: "inherit" }}>
          <Icon name="x" size={12} />
        </button>
      )}
    </Tag>
  );
}

export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: { value: T | undefined; options: { value: T; label: string }[]; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={`seg-opt ${value === o.value ? "active" : ""}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, help, required, children, htmlFor }: { label: string; help?: string; required?: boolean; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>
        {label}
        {required && <span className="req" aria-hidden="true">*</span>}
      </label>
      {children}
      {help && <span className="help">{help}</span>}
    </div>
  );
}

export function ChipInput({ value, onChange, placeholder, suggestions, id }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[]; id?: string }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const items = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    const next = [...value];
    for (const it of items) if (!next.some((v) => v.toLowerCase() === it.toLowerCase())) next.push(it);
    onChange(next);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  const remaining = (suggestions ?? []).filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="chip-input" onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}>
        {value.map((v) => (
          <Chip key={v} selected onRemove={() => onChange(value.filter((x) => x !== v))}>{v}</Chip>
        ))}
        <input id={id} value={draft} placeholder={value.length ? "Add another" : placeholder ?? "Type and press Enter"} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={() => draft && add(draft)} aria-label={placeholder ?? "Add item"} />
      </div>
      {remaining.length > 0 && (
        <div className="suggestions" aria-label="Suggestions">
          {remaining.slice(0, 9).map((s) => (
            <Chip key={s} onClick={() => add(s)}>
              <Icon name="plus" size={12} /> {s}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

/** Minimal rich text: **bold**, line breaks to paragraphs. No HTML. */
export function Rich({ text, className = "" }: { text: string; className?: string }) {
  const paras = text.split(/\n{2,}|\n(?=[-*•] )/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className={`rich ${className}`}>
      {paras.map((p, i) => (
        <p key={i}>{renderInline(p)}</p>
      ))}
    </div>
  );
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <b key={i}>{part.slice(2, -2)}</b>;
    const lines = part.split("\n");
    return lines.flatMap((l, j) => (j === 0 ? [l] : [<br key={`${i}-${j}`} />, l]));
  });
}

export function Skeleton({ w = "100%", h = 14, r }: { w?: string | number; h?: number; r?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r }} aria-hidden="true" />;
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 1800);
    return () => clearTimeout(t);
  }, [msg]);
  return { toast: msg ? <div className="toast" role="status">{msg}</div> : null, show: setMsg };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function Monogram({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), display: "grid", placeItems: "center", fontWeight: 700, fontSize: Math.round(size * 0.38), letterSpacing: "-0.02em", color: "#fff", background: `linear-gradient(135deg, hsl(${hue} 55% 48%), hsl(${(hue + 40) % 360} 60% 38%))`, flex: "0 0 auto" }}>
      {initials}
    </div>
  );
}
