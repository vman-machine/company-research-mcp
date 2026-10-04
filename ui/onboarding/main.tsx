import { StrictMode, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../shared/theme.css";
import "./onboarding.css";
import { useMcpApp, type McpAppState } from "../shared/useMcpApp";
import { Badge, Chip, ChipInput, Field, Icon, Segmented, Skeleton, useToast } from "../shared/components";
import { DEPTH_OPTIONS, OPTIONAL_SECTIONS, PURPOSES, PURPOSE_ORDER, type FieldSpec } from "../../src/shared/purposes";
import type { Depth, Profile, PurposeKey } from "../../src/server/schemas";

// ---------------------------------------------------------------------------
// Draft state
// ---------------------------------------------------------------------------
type DetailValue = string | string[];

interface Draft {
  id?: string;
  label: string;
  user: { name: string; title: string; company: string; companyWebsite: string; location: string };
  purpose: PurposeKey | null;
  details: Record<string, DetailValue>;
  prefs: {
    depth: Depth;
    newsHorizonMonths: number;
    outputStyle: "executive" | "comprehensive";
    geographies: string[];
    alwaysInclude: string[];
    extraInstructions: string;
    language: string;
  };
}

const emptyDraft = (purposeHint?: PurposeKey): Draft => ({
  label: "",
  user: { name: "", title: "", company: "", companyWebsite: "", location: "" },
  purpose: purposeHint ?? null,
  details: {},
  prefs: { depth: "deep", newsHorizonMonths: 12, outputStyle: "executive", geographies: [], alwaysInclude: [], extraInstructions: "", language: "English" },
});

function draftFromProfile(p: Profile): Draft {
  const details: Record<string, DetailValue> = {};
  for (const [k, v] of Object.entries(p.purposeDetails ?? {})) if (v !== undefined && v !== null) details[k] = v as DetailValue;
  return {
    id: p.id,
    label: p.label,
    user: { name: p.user.name ?? "", title: p.user.title ?? "", company: p.user.company ?? "", companyWebsite: p.user.companyWebsite ?? "", location: p.user.location ?? "" },
    purpose: p.purpose,
    details,
    prefs: {
      depth: p.preferences?.depth ?? "deep",
      newsHorizonMonths: p.preferences?.newsHorizonMonths ?? 12,
      outputStyle: p.preferences?.outputStyle ?? "executive",
      geographies: p.preferences?.geographies ?? [],
      alwaysInclude: p.preferences?.alwaysInclude ?? [],
      extraInstructions: p.preferences?.extraInstructions ?? "",
      language: p.preferences?.language ?? "English",
    },
  };
}

const STEPS = ["About you", "Purpose", "Details", "Preferences", "Review"] as const;

const clean = (s: string) => s.trim();
const hasValue = (v: DetailValue | undefined) => (Array.isArray(v) ? v.length > 0 : !!v && v.trim().length > 0);

function buildPayload(d: Draft) {
  const details: Record<string, DetailValue> = {};
  for (const [k, v] of Object.entries(d.details)) if (hasValue(v)) details[k] = Array.isArray(v) ? v : clean(v);
  const user: Record<string, string> = { name: clean(d.user.name) };
  for (const k of ["title", "company", "companyWebsite", "location"] as const) if (clean(d.user[k])) user[k] = clean(d.user[k]);
  return {
    ...(d.id ? { id: d.id } : {}),
    ...(clean(d.label) ? { label: clean(d.label) } : {}),
    user,
    purpose: d.purpose,
    purposeDetails: details,
    preferences: {
      depth: d.prefs.depth,
      newsHorizonMonths: d.prefs.newsHorizonMonths,
      outputStyle: d.prefs.outputStyle,
      language: d.prefs.language || "English",
      ...(d.prefs.geographies.length ? { geographies: d.prefs.geographies } : {}),
      ...(d.prefs.alwaysInclude.length ? { alwaysInclude: d.prefs.alwaysInclude } : {}),
      ...(clean(d.prefs.extraInstructions) ? { extraInstructions: clean(d.prefs.extraInstructions) } : {}),
    },
    makeActive: true,
  };
}

function stepValid(step: number, d: Draft): string | null {
  if (step === 0) return clean(d.user.name) ? null : "Add your name to continue.";
  if (step === 1) return d.purpose ? null : "Pick the purpose that fits best.";
  if (step === 2 && d.purpose) {
    const missing = PURPOSES[d.purpose].fields.filter((f) => f.required && !hasValue(d.details[f.key as string]));
    return missing.length ? `Fill in: ${missing.map((f) => f.label.replace(/\?$/, "")).join(", ")}.` : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
function OnboardingApp() {
  const state = useMcpApp("Company Research Onboarding");
  if (state.status === "connecting") return <LoadingFrame />;
  if (state.status === "error") return <div className="frame" style={{ padding: 20 }}><b>Could not connect to the host.</b> <span className="muted">{state.error?.message}</span></div>;
  return <Wizard state={state} />;
}

function LoadingFrame() {
  return (
    <div className="frame" style={{ padding: 20 }} aria-busy="true">
      <div className="stack" style={{ gap: 12 }}>
        <Skeleton w={160} h={12} />
        <Skeleton w="60%" h={24} />
        <Skeleton w="90%" h={14} />
        <div className="grid-2" style={{ marginTop: 8 }}>
          <Skeleton h={42} r={8} />
          <Skeleton h={42} r={8} />
        </div>
      </div>
    </div>
  );
}

interface ToolData {
  mode?: "create" | "edit";
  profile?: Profile | null;
  purposeHint?: PurposeKey;
  profiles?: { id: string; label: string }[];
}

function Wizard({ state }: { state: McpAppState }) {
  const data = (state.toolResult?.structuredContent ?? {}) as ToolData;
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ profile: Profile; playbook: string } | null>(null);
  const { toast, show } = useToast();
  const hydrated = useRef(false);

  // Hydrate from the tool result once (edit mode prefill or purpose hint).
  useEffect(() => {
    if (hydrated.current || !state.toolResult || touched) return;
    hydrated.current = true;
    if (data.profile) setDraft(draftFromProfile(data.profile));
    else if (data.purposeHint) setDraft(emptyDraft(data.purposeHint));
  }, [state.toolResult, data.profile, data.purposeHint, touched]);

  const update = (fn: (d: Draft) => Draft) => {
    setTouched(true);
    setDraft(fn);
  };

  const error = stepValid(step, draft);
  const purposeMeta = draft.purpose ? PURPOSES[draft.purpose] : null;

  const next = () => {
    if (error) {
      setAttempted(true);
      return;
    }
    setAttempted(false);
    setShowMore(false);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => {
    setAttempted(false);
    setStep((s) => Math.max(s - 1, 0));
  };

  const onEnter = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT" && !(e.target as HTMLElement).closest(".chip-input")) {
      e.preventDefault();
      if (step < STEPS.length - 1) next();
    }
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const payload = buildPayload(draft);
    try {
      if (state.status === "preview") {
        await new Promise((r) => setTimeout(r, 500));
        const p = { ...(payload as unknown as Profile), id: payload.id ?? "preview-profile", label: payload.label ?? `${purposeMeta?.label} for ${payload.user.name}`, createdAt: "", updatedAt: "" };
        setSaved({ profile: p, playbook: `### How research is tailored for ${p.user.name}\nPurpose: ${purposeMeta?.label}. Default depth: ${draft.prefs.depth}.\n\nFocus:\n- Preview mode: the real playbook comes from the server.` });
        return;
      }
      const result = await state.actions.callServerTool("profile_save", payload);
      const sc = (result.structuredContent ?? {}) as { profile?: Profile; playbook?: string };
      if (result.isError || !sc.profile) {
        const text = result.content?.find((c) => c.type === "text") as { text?: string } | undefined;
        throw new Error(text?.text ?? "The server did not return a saved profile.");
      }
      setSaved({ profile: sc.profile, playbook: sc.playbook ?? "" });
      await state.actions.updateModelContext(
        `Research profile saved via the onboarding form: "${sc.profile.label}" (id ${sc.profile.id}, purpose ${sc.profile.purpose}, user ${sc.profile.user.name}). It is now the active profile. Do not re-ask these questions; the user can ask to research a company next.`,
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const sendFallback = async () => {
    const payload = buildPayload(draft);
    const ok = await state.actions.sendMessage(`Please save this research profile with the profile_save tool:\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``);
    show(ok ? "Sent to chat" : "Could not send to chat");
  };

  if (saved) return <Done state={state} saved={saved} onEdit={() => { setSaved(null); setStep(0); setDraft(draftFromProfile(saved.profile)); }} onAnother={() => { setSaved(null); setStep(0); setDraft(emptyDraft()); setTouched(false); }} />;

  return (
    <div className="ob frame" onKeyDown={onEnter}>
      <header className="ob-header">
        <div className="row between">
          <span className="eyebrow">Company Research · {data.mode === "edit" ? "Edit profile" : "Profile setup"}</span>
          <span className="small faint">Step {step + 1} of {STEPS.length}</span>
        </div>
        <div className="ob-stepper" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
          {STEPS.map((s, i) => (
            <div key={s} className={`seg-bar ${i < step ? "done" : i === step ? "current" : ""}`} title={s} />
          ))}
        </div>
        <div>
          <h1 className="title-lg">{stepTitle(step, draft)}</h1>
          <p className="muted" style={{ marginTop: 4 }}>{stepSubtitle(step, draft)}</p>
        </div>
      </header>

      <div className="ob-body fade-in" key={step}>
        {step === 0 && <AboutStep draft={draft} update={update} />}
        {step === 1 && <PurposeStep draft={draft} update={update} />}
        {step === 2 && purposeMeta && <DetailsStep draft={draft} update={update} fields={purposeMeta.fields} showMore={showMore} setShowMore={setShowMore} />}
        {step === 3 && <PreferencesStep draft={draft} update={update} />}
        {step === 4 && <ReviewStep draft={draft} update={update} />}
        {attempted && error && <div className="error-box" role="alert">{error}</div>}
        {saveError && (
          <div className="error-box" role="alert">
            <div><b>Could not save:</b> {saveError}</div>
            <div className="row wrap" style={{ marginTop: 8 }}>
              <button className="btn btn-sm" type="button" onClick={save}>Try again</button>
              <button className="btn btn-sm" type="button" onClick={sendFallback}>Send to chat instead</button>
            </div>
          </div>
        )}
      </div>

      <footer className="ob-footer">
        <div>
          {step > 0 && (
            <button type="button" className="btn btn-ghost" onClick={back}>
              <Icon name="arrow-left" size={16} /> Back
            </button>
          )}
        </div>
        <div className="row">
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={next} aria-disabled={!!error}>
              Continue <Icon name="arrow-right" size={16} />
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : data.mode === "edit" ? "Save changes" : "Save profile"} <Icon name="check" size={16} />
            </button>
          )}
        </div>
      </footer>
      {toast}
    </div>
  );
}

function stepTitle(step: number, d: Draft) {
  switch (step) {
    case 0: return "Tell me about you";
    case 1: return "Why do you research companies?";
    case 2: return d.purpose ? `Tailor it for ${PURPOSES[d.purpose].short.toLowerCase() === "other" ? "your goal" : PURPOSES[d.purpose].label.toLowerCase()}` : "Details";
    case 3: return "How should research run?";
    default: return "Review and save";
  }
}

function stepSubtitle(step: number, d: Draft) {
  switch (step) {
    case 0: return "Used to personalise reports and outreach. Only your name is required.";
    case 1: return "Each purpose gets its own research playbook and report layout. You can add more profiles later.";
    case 2: return d.purpose === "sales" ? "The more I know about what you sell, the sharper the fit assessment and outreach angles." : "These details shape what gets researched and how findings are judged.";
    case 3: return "Deep research is the default: 25-40 searches, primary sources, every key number triangulated.";
    default: return "Saved profiles drive every future research run. You can edit them any time.";
  }
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------
type StepProps = { draft: Draft; update: (fn: (d: Draft) => Draft) => void };

function AboutStep({ draft, update }: StepProps) {
  const set = (k: keyof Draft["user"]) => (v: string) => update((d) => ({ ...d, user: { ...d.user, [k]: v } }));
  return (
    <div className="form-grid">
      <Field label="Your name" required htmlFor="name">
        <input id="name" className="input" autoFocus value={draft.user.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Priya Nair" autoComplete="name" />
      </Field>
      <Field label="Job title" htmlFor="title">
        <input id="title" className="input" value={draft.user.title} onChange={(e) => set("title")(e.target.value)} placeholder="e.g. Enterprise Account Executive" />
      </Field>
      <Field label="Company" htmlFor="company">
        <input id="company" className="input" value={draft.user.company} onChange={(e) => set("company")(e.target.value)} placeholder="Your employer or your own company" />
      </Field>
      <Field label="Company website" htmlFor="website">
        <input id="website" className="input" value={draft.user.companyWebsite} onChange={(e) => set("companyWebsite")(e.target.value)} placeholder="https://" inputMode="url" />
      </Field>
      <Field label="Location" help="Helps with time zones, regional sources and currency." htmlFor="location">
        <input id="location" className="input" value={draft.user.location} onChange={(e) => set("location")(e.target.value)} placeholder="City, country" />
      </Field>
    </div>
  );
}

function PurposeStep({ draft, update }: StepProps) {
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="purpose-grid" role="radiogroup" aria-label="Purpose">
        {PURPOSE_ORDER.map((key) => {
          const m = PURPOSES[key];
          const selected = draft.purpose === key;
          return (
            <button key={key} type="button" role="radio" aria-checked={selected} className={`card card-select purpose-card ${selected ? "selected" : ""}`} onClick={() => update((d) => ({ ...d, purpose: key, details: d.purpose === key ? d.details : {} }))}>
              <span className="ic"><Icon name={m.icon} size={18} /></span>
              <span>
                <span className="t">{m.label}</span>
                <div className="d">{m.description}</div>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetailsStep({ draft, update, fields, showMore, setShowMore }: StepProps & { fields: FieldSpec[]; showMore: boolean; setShowMore: (v: boolean) => void }) {
  const required = fields.filter((f) => f.required);
  const optional = fields.filter((f) => !f.required);
  const primary = [...required, ...optional.slice(0, Math.max(0, 3 - required.length))];
  const more = optional.filter((f) => !primary.includes(f));
  const setVal = (key: string) => (v: DetailValue) => update((d) => ({ ...d, details: { ...d.details, [key]: v } }));
  const render = (f: FieldSpec, autoFocus = false) => {
    const key = f.key as string;
    const val = draft.details[key];
    const id = `f-${key}`;
    const wide = f.kind === "textarea" || f.kind === "chips";
    return (
      <div key={key} className={wide ? "span-2" : undefined}>
        <Field label={f.label} required={f.required} help={f.help} htmlFor={id}>
          {f.kind === "text" && <input id={id} className="input" autoFocus={autoFocus} value={(val as string) ?? ""} onChange={(e) => setVal(key)(e.target.value)} placeholder={f.placeholder} />}
          {f.kind === "textarea" && <textarea id={id} className="textarea" autoFocus={autoFocus} value={(val as string) ?? ""} onChange={(e) => setVal(key)(e.target.value)} placeholder={f.placeholder} rows={3} />}
          {f.kind === "chips" && <ChipInput id={id} value={(val as string[]) ?? []} onChange={(v) => setVal(key)(v)} placeholder={f.placeholder} suggestions={f.suggestions} />}
          {f.kind === "segmented" && <Segmented value={val as string | undefined} options={(f.options ?? []).map((o) => ({ value: o, label: o }))} onChange={(v) => setVal(key)(v)} ariaLabel={f.label} />}
        </Field>
      </div>
    );
  };
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="form-grid">{primary.map((f, i) => render(f, i === 0))}</div>
      {more.length > 0 && (
        <>
          <button type="button" className="btn btn-ghost btn-sm more-toggle" onClick={() => setShowMore(!showMore)} aria-expanded={showMore}>
            <Icon name={showMore ? "chevron-up" : "chevron-down"} size={14} /> {showMore ? "Fewer options" : `More options (${more.length})`}
          </button>
          {showMore && <div className="form-grid fade-in">{more.map((f) => render(f))}</div>}
        </>
      )}
    </div>
  );
}

function PreferencesStep({ draft, update }: StepProps) {
  const setPref = <K extends keyof Draft["prefs"]>(k: K, v: Draft["prefs"][K]) => update((d) => ({ ...d, prefs: { ...d.prefs, [k]: v } }));
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label="Research depth">
        <div className="depth-options" role="radiogroup" aria-label="Research depth">
          {DEPTH_OPTIONS.map((o) => (
            <button key={o.key} type="button" role="radio" aria-checked={draft.prefs.depth === o.key} className={`card card-select depth-card ${draft.prefs.depth === o.key ? "selected" : ""}`} onClick={() => setPref("depth", o.key)}>
              <div className="row between"><span className="t">{o.label}</span>{o.key === "deep" && <Badge tone="accent">Default</Badge>}</div>
              <div className="d">{o.description}</div>
            </button>
          ))}
        </div>
      </Field>
      <div className="form-grid">
        <Field label="News horizon" help="How far back to look for signals and events.">
          <Segmented value={String(draft.prefs.newsHorizonMonths)} options={[{ value: "6", label: "6 months" }, { value: "12", label: "12 months" }, { value: "24", label: "24 months" }]} onChange={(v) => setPref("newsHorizonMonths", Number(v))} ariaLabel="News horizon" />
        </Field>
        <Field label="Report style">
          <Segmented value={draft.prefs.outputStyle} options={[{ value: "executive", label: "Executive" }, { value: "comprehensive", label: "Comprehensive" }]} onChange={(v) => setPref("outputStyle", v)} ariaLabel="Report style" />
        </Field>
      </div>
      <Field label="Geographies to emphasise" help="Optional. Sources and context are weighted towards these regions.">
        <ChipInput value={draft.prefs.geographies} onChange={(v) => setPref("geographies", v)} placeholder="Add a region" suggestions={["UK", "Europe", "North America", "APAC", "India", "Middle East", "LATAM", "Global"]} />
      </Field>
      <Field label="Always include" help="Sections to include whenever there is evidence. Everything else appears when relevant.">
        <div className="suggestions">
          {OPTIONAL_SECTIONS.map((s) => {
            const on = draft.prefs.alwaysInclude.includes(s);
            return (
              <Chip key={s} selected={on} onClick={() => setPref("alwaysInclude", on ? draft.prefs.alwaysInclude.filter((x) => x !== s) : [...draft.prefs.alwaysInclude, s])}>
                {on && <Icon name="check" size={12} />} {s}
              </Chip>
            );
          })}
        </div>
      </Field>
      <Field label="Standing instructions" help="Applied to every research run." htmlFor="extra">
        <textarea id="extra" className="textarea" rows={2} value={draft.prefs.extraInstructions} onChange={(e) => setPref("extraInstructions", e.target.value)} placeholder="e.g. Always convert currency to GBP. Flag any public-sector customers." />
      </Field>
    </div>
  );
}

function ReviewStep({ draft, update }: StepProps) {
  const m = draft.purpose ? PURPOSES[draft.purpose] : null;
  const rows: [string, string][] = [];
  rows.push(["Name", [draft.user.name, draft.user.title].filter(Boolean).join(", ")]);
  if (draft.user.company) rows.push(["Company", `${draft.user.company}${draft.user.companyWebsite ? ` · ${draft.user.companyWebsite}` : ""}`]);
  if (draft.user.location) rows.push(["Location", draft.user.location]);
  if (m) rows.push(["Purpose", m.label]);
  for (const f of m?.fields ?? []) {
    const v = draft.details[f.key as string];
    if (hasValue(v)) rows.push([f.label.replace(/\?$/, ""), Array.isArray(v) ? v.join(", ") : v]);
  }
  rows.push(["Depth", `${DEPTH_OPTIONS.find((d) => d.key === draft.prefs.depth)?.label} · ${draft.prefs.newsHorizonMonths}-month horizon · ${draft.prefs.outputStyle}`]);
  if (draft.prefs.geographies.length) rows.push(["Geographies", draft.prefs.geographies.join(", ")]);
  if (draft.prefs.alwaysInclude.length) rows.push(["Always include", draft.prefs.alwaysInclude.join(", ")]);
  if (clean(draft.prefs.extraInstructions)) rows.push(["Instructions", draft.prefs.extraInstructions]);
  const defaultLabel = m ? `${m.label} for ${draft.user.name || "me"}` : "";
  return (
    <div className="stack" style={{ gap: 14 }}>
      <Field label="Profile name" help="Shown when you have several profiles, e.g. one for sales and one for investing." htmlFor="label">
        <input id="label" className="input" value={draft.label} onChange={(e) => update((d) => ({ ...d, label: e.target.value }))} placeholder={defaultLabel} />
      </Field>
      <div className="card soft">
        <dl className="review-grid">
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------
function Done({ state, saved, onEdit, onAnother }: { state: McpAppState; saved: { profile: Profile; playbook: string }; onEdit: () => void; onAnother: () => void }) {
  const [company, setCompany] = useState("");
  const [sent, setSent] = useState(false);
  const { toast, show } = useToast();
  const m = PURPOSES[saved.profile.purpose];
  const go = async () => {
    const c = company.trim();
    if (!c) return;
    const ok = await state.actions.sendMessage(`Research ${c} for me using my "${saved.profile.label}" profile. Start with research_brief and run the full deep research protocol, then render the report.`);
    if (ok) {
      setSent(true);
      show("Sent to Claude");
    } else show("Could not send. Type it in the chat instead.");
  };
  return (
    <div className="frame done fade-in">
      <div className="row" style={{ gap: 14 }}>
        <div className="check"><Icon name="check" size={22} strokeWidth={2.2} /></div>
        <div>
          <span className="eyebrow">Profile saved</span>
          <h1 className="title-lg">{saved.profile.label}</h1>
          <div className="row wrap" style={{ marginTop: 6 }}>
            <Badge tone="accent"><Icon name={m.icon} size={12} /> {m.label}</Badge>
            <Badge>{saved.profile.preferences?.depth ?? "deep"} research</Badge>
            <Badge>{saved.profile.preferences?.newsHorizonMonths ?? 12}-month horizon</Badge>
          </div>
        </div>
      </div>

      <PlaybookPreview markdown={saved.playbook} />

      <div className="card soft stack" style={{ gap: 10 }}>
        <div>
          <div className="title-sm">Research your first company</div>
          <div className="small faint">Claude will run the tailored deep-research protocol and render an interactive report.</div>
        </div>
        <div className="first-company">
          <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="Company name, e.g. Lumen Freight Technologies" aria-label="Company name" />
          <button type="button" className="btn btn-primary" onClick={go} disabled={!company.trim() || sent}>
            {sent ? "Sent" : "Research"} <Icon name={sent ? "check" : "send"} size={16} />
          </button>
        </div>
      </div>

      <div className="row wrap">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}><Icon name="edit" size={14} /> Edit profile</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onAnother}><Icon name="plus" size={14} /> Add another profile</button>
      </div>
      {toast}
    </div>
  );
}

function PlaybookPreview({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n").filter((l) => l.trim() && !/^Workflow:/.test(l));
  const blocks: { type: "h" | "li" | "p"; text: string }[] = lines.map((l) => (/^#+\s/.test(l) ? { type: "h", text: l.replace(/^#+\s*/, "") } : /^-\s/.test(l) ? { type: "li", text: l.replace(/^-\s*/, "") } : { type: "p", text: l }));
  const items: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) items.push(<ul key={`ul-${items.length}`}>{list.map((t, i) => <li key={i}>{t}</li>)}</ul>);
    list = [];
  };
  for (const b of blocks) {
    if (b.type === "li") list.push(b.text);
    else {
      flush();
      items.push(b.type === "h" ? <h4 key={items.length}>{b.text}</h4> : <p key={items.length}>{b.text}</p>);
    }
  }
  flush();
  return <div className="playbook">{items}</div>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OnboardingApp />
  </StrictMode>,
);
