/**
 * Research playbooks: turns a user's profile (who they are, why they research
 * companies) into a concrete deep-research protocol and report blueprint.
 *
 * This is the "skill" of the product. It is returned to the model by
 * `profile_get` (summary) and `research_brief` (full, per company).
 */
import type { Depth, Profile, PurposeKey } from "./schemas.js";
import { PURPOSES } from "../shared/purposes.js";

export type SectionKind = "cards" | "list" | "steps" | "qa" | "table" | "two-column" | "scorecard" | "text";

export interface SectionSpec {
  id: string;
  title: string;
  kind: SectionKind;
  guidance: string;
}

export interface PurposePlaybook {
  goal: (company: string, p: Profile | null) => string;
  clarifyFirst: (p: Profile | null) => string[];
  focus: (p: Profile | null) => string[];
  sections: (p: Profile | null) => SectionSpec[];
  fitCriteria: (p: Profile | null) => string[];
  extraSeeds: (company: string, p: Profile | null, year: number) => string[];
  sourceChecklist: string[];
  followUps: (company: string, p: Profile | null) => { label: string; prompt: string }[];
  textOnboardingQuestions: string[];
}

const q = (s: string) => `"${s}"`;
const take = (arr: string[] | undefined, n: number) => (arr ?? []).filter(Boolean).slice(0, n);
const details = (p: Profile | null) => p?.purposeDetails ?? {};

const SALES: PurposePlaybook = {
  goal: (c, p) =>
    `Decide whether and how to pursue ${c} as an account for ${details(p).offering ? `the user's offering (${details(p).offering})` : "the user's offering"}: fit against the ideal customer profile, who to approach, what to say, and why now.`,
  clarifyFirst: (p) => {
    const d = details(p);
    const out: string[] = [];
    if (!d.offering) out.push("What do you sell, and what problem does it solve for customers?");
    if (!d.buyerPersonas?.length) out.push("Who typically buys or champions it (job titles)?");
    if (!d.icpIndustries?.length && !d.icpCompanySizes?.length) out.push("Which industries and company sizes fit best?");
    return out;
  },
  focus: (p) => {
    const d = details(p);
    return [
      `ICP fit: industry, size, geography, business model${d.icpIndustries?.length ? ` (target industries: ${d.icpIndustries.join(", ")})` : ""}${d.icpCompanySizes?.length ? ` (target sizes: ${d.icpCompanySizes.join(", ")})` : ""}.`,
      `Trigger events in the news horizon: funding, leadership changes, expansion, M&A, layoffs, new strategy, regulatory pressure, stated priorities on earnings calls${d.triggersOfInterest?.length ? `. The user especially cares about: ${d.triggersOfInterest.join(", ")}` : ""}.`,
      "Strategic priorities and initiatives: annual report, CEO/CFO interviews, investor days, job postings (what they are building or fixing).",
      `Vendor and technology landscape: current tools, incumbent vendors, partners${d.competitors?.length ? `; look specifically for ${d.competitors.join(", ")}` : ""} (job posts, case studies, G2 reviews, BuiltWith-style signals).`,
      `Buying committee: decision makers, champions and blockers by title${d.buyerPersonas?.length ? ` (personas: ${d.buyerPersonas.join(", ")})` : ""}; recent hires or departures in those functions.`,
      `Pain hypotheses tied to ${d.offering ? "the offering" : "what the user sells"}: evidence of the problem (complaints, growth strain, compliance exposure, cost pressure, public commitments).`,
      "Budget and timing signals: funding, growth, cost programmes, fiscal year end, planning cycles, contract renewal windows.",
    ];
  },
  sections: () => [
    { id: "triggers", title: "Why now: trigger events", kind: "list", guidance: "4-8 dated events that create an opening, newest first. tag = date, badge = relevance." },
    { id: "stakeholders", title: "Stakeholder map", kind: "cards", guidance: "Named people where possible: likely economic buyer, champion, influencers, blockers. title = name and title, tag = role in the deal, body = why they matter and what they care about." },
    { id: "pains", title: "Pain hypotheses", kind: "cards", guidance: "3-6 specific, evidence-backed pains the offering addresses. badge = high/medium/low confidence. Cite sources." },
    { id: "angles", title: "Outreach angles", kind: "list", guidance: "3-5 personalised openers or value hypotheses the user could send. copyable = true. Reference specific facts about the company." },
    { id: "discovery", title: "Discovery questions", kind: "list", guidance: "6-10 questions that validate the pain hypotheses and surface budget, timing and process." },
    { id: "objections", title: "Likely objections", kind: "qa", guidance: "title = objection, body = suggested response grounded in research." },
    { id: "landscape", title: "Vendors and competitors in the account", kind: "table", guidance: "columns: Vendor | Category | Evidence | Implication. Include incumbents of the user's category and adjacent tools." },
  ],
  fitCriteria: (p) => {
    const d = details(p);
    return [
      "Industry match",
      "Company size",
      "Geography",
      "Buyer access (named personas found)",
      "Budget signals",
      "Timing and triggers",
      d.competitors?.length ? "Incumbent / competitor exposure" : "Vendor landscape fit",
      "Strategic alignment with the offering",
    ];
  },
  extraSeeds: (c, p, year) => {
    const d = details(p);
    const seeds = [
      d.offeringCategory ? `${q(c)} ${d.offeringCategory}` : d.offering ? `${q(c)} ${d.offering.split(" ").slice(0, 4).join(" ")}` : `${q(c)} vendors software tools`,
      `${q(c)} technology stack`,
      `${q(c)} partners OR partnership announces`,
      `${q(c)} expansion OR "opens office" OR "new market" ${year}`,
      `${q(c)} earnings call priorities ${year}`,
      `${q(c)} careers jobs ${take(d.buyerPersonas, 2).map((t) => t.split(" ").pop()).join(" ")}`.trim(),
    ];
    for (const comp of take(d.competitors, 3)) seeds.push(`${q(c)} ${q(comp)}`);
    for (const persona of take(d.buyerPersonas, 3)) seeds.push(`${q(c)} ${q(persona)} appointed OR joins OR hires OR names`);
    return seeds;
  },
  sourceChecklist: [
    "Company website: about, leadership, newsroom, careers (what they are hiring for)",
    "LinkedIn company page and the people in relevant functions",
    "Crunchbase / PitchBook / Companies House or equivalent for funding, ownership, size",
    "Annual report, 10-K, latest earnings call transcript (public companies)",
    "Job postings for tech stack and initiatives; G2/Capterra reviews for vendors in use",
    "Trade press and major outlets for triggers in the news horizon",
  ],
  followUps: (c, p) => {
    const persona = take(details(p).buyerPersonas, 1)[0] ?? "the most likely buyer";
    return [
      { label: "Draft outreach email", prompt: `Draft a short, personalised outreach email to ${persona} at ${c}, using the trigger events and pain hypotheses from the research report.` },
      { label: "Discovery call plan", prompt: `Build a 30-minute discovery call plan for ${c}: goals, hypotheses to validate, questions in order, and next-step ask.` },
      { label: "More trigger events", prompt: `Find more trigger events at ${c} from the last 90 days and update the Why now section.` },
      { label: "Map buying committee", prompt: `Map the full buying committee at ${c} with names, titles and LinkedIn URLs where available.` },
    ];
  },
  textOnboardingQuestions: [
    "What do you sell, and what problem does it solve?",
    "Who typically buys or champions it (titles)?",
    "Which industries, company sizes and regions fit best?",
    "Who do you compete with, and why do you win?",
    "Which buying triggers matter most to you?",
  ],
};

const JOB: PurposePlaybook = {
  goal: (c, p) => `Decide whether to pursue or accept a role at ${c}${details(p).targetRoles?.length ? ` (${details(p).targetRoles!.join(" / ")})` : ""} and prepare to interview well.`,
  clarifyFirst: (p) => {
    const d = details(p);
    const out: string[] = [];
    if (!d.targetRoles?.length) out.push("Which role or team are you considering?");
    if (!d.valuesPriorities?.length) out.push("What matters most to you in the next role?");
    return out;
  },
  focus: (p) => {
    const d = details(p);
    return [
      "Mission, strategy and outlook: where the company is going and whether it is winning.",
      "Financial health: public companies - revenue, growth, margins, guidance; private - funding, runway signals, burn, layoffs.",
      "Growth trajectory: headcount trend, hiring vs. layoffs, office/market expansion.",
      "Leadership and reputation: tenure, churn, controversies, Glassdoor CEO approval.",
      "Culture and employee sentiment: Glassdoor, Blind, Reddit, Comparably - themes, trend over the last 12 months, by function if possible.",
      `Compensation benchmarks for ${d.targetRoles?.length ? d.targetRoles.join(" / ") : "the target role"}${d.roleLevel ? ` at ${d.roleLevel} level` : ""}: Levels.fyi, Glassdoor, H-1B data (US), job ads with ranges.`,
      "Interview process and bar: stages, typical questions, timelines, offer practices.",
      `Role and team context: org, likely manager, recent hires/departures, projects, tech or tools in use${d.background ? `; how the user's background (${d.background}) maps onto it` : ""}.`,
      `Red flags${d.dealBreakers?.length ? ` (user's deal-breakers: ${d.dealBreakers.join(", ")})` : ""}: layoffs, lawsuits, exec churn, missed targets, negative press, RTO disputes.`,
    ];
  },
  sections: () => [
    { id: "health", title: "Company health and trajectory", kind: "cards", guidance: "Cards for growth, profitability or runway, hiring vs layoffs, leadership stability. badge = positive/neutral/negative." },
    { id: "culture", title: "Culture and sentiment", kind: "cards", guidance: "Themes from employee reviews with trend and evidence. badge = positive/negative/neutral. Cite sources." },
    { id: "role", title: "Role and team context", kind: "list", guidance: "What the team does, who leads it, recent changes, likely scope, how the user's background fits." },
    { id: "comp", title: "Compensation benchmarks", kind: "table", guidance: "columns: Level | Base | Total comp | Source. Use ranges; mark estimates." },
    { id: "process", title: "Interview process", kind: "steps", guidance: "Stages in order with what to expect and how long it takes." },
    { id: "redflags", title: "Red flags and watch-outs", kind: "list", guidance: "Each with evidence and how serious it is. badge = high/medium/low." },
    { id: "questions", title: "Questions to ask them", kind: "list", guidance: "8-12 sharp questions grounded in the research, grouped by interviewer type if useful." },
    { id: "positioning", title: "How to position yourself", kind: "list", guidance: "3-5 talking points linking the user's background to the company's current needs." },
  ],
  fitCriteria: () => [
    "Mission and values alignment",
    "Financial stability",
    "Growth and learning opportunity",
    "Culture signals",
    "Compensation vs expectations",
    "Work arrangement",
    "Leadership quality",
    "Risk (layoffs, volatility)",
  ],
  extraSeeds: (c, p, year) => {
    const d = details(p);
    const role = take(d.targetRoles, 1)[0] ?? "";
    return [
      `${q(c)} glassdoor reviews`,
      `${q(c)} blind OR teamblind`,
      `${q(c)} layoffs ${year} OR ${year - 1}`,
      `${q(c)} interview process ${role}`.trim(),
      `${q(c)} salary ${role} levels.fyi`.trim(),
      `${q(c)} culture values employees`,
      `${q(c)} employee reviews reddit`,
      `${q(c)} ${role} job description`.trim(),
      `${q(c)} return to office OR remote policy`,
      `${q(c)} engineering blog OR tech blog`,
    ];
  },
  sourceChecklist: [
    "Company careers page and the specific job posting(s)",
    "Glassdoor (reviews, interviews, salaries) and Blind; Reddit threads",
    "Levels.fyi and H-1B salary data where relevant",
    "Latest earnings release / annual report, or funding history and news for private companies",
    "LinkedIn: team size trend, recent joiners and leavers, hiring manager background",
    "Press coverage in the news horizon, especially layoffs and leadership changes",
  ],
  followUps: (c) => [
    { label: "Interview questions", prompt: `Prepare the 10 best questions I should ask in interviews at ${c}, tailored to each interviewer type, with the reasoning behind each.` },
    { label: "Tailored cover note", prompt: `Draft a short, specific cover note for my application to ${c} that references what the company is doing now.` },
    { label: "Offer negotiation prep", prompt: `Prepare negotiation points for an offer from ${c} using the compensation benchmarks and company context from the report.` },
    { label: "Compare employers", prompt: `Compare ${c} with another company I am considering on the criteria in my profile. Ask me for the other company name.` },
  ],
  textOnboardingQuestions: [
    "Which roles and level are you targeting?",
    "What matters most to you (growth, pay, stability, mission, flexibility)?",
    "Any must-haves or deal-breakers?",
    "A one-line summary of your background?",
  ],
};

const INVESTMENT: PurposePlaybook = {
  goal: (c, p) => `Form an evidence-based view on ${c} as an investment against the user's mandate${details(p).thesis ? ` ("${details(p).thesis}")` : ""}: thesis, quality, valuation, risks and catalysts.`,
  clarifyFirst: (p) => {
    const d = details(p);
    return !d.thesis && !d.investorType ? ["What is your mandate: stage, sector, horizon, and what makes an investment compelling for you?"] : [];
  },
  focus: (p) => {
    const d = details(p);
    return [
      "Business model and unit economics: how it makes money, pricing power, gross margin structure, customer concentration.",
      "Market: size, growth, structure, share, and the direction of travel.",
      "Moat: switching costs, network effects, scale, brand, IP, distribution; evidence that it is widening or eroding.",
      `Financials: revenue and growth, margins, FCF, cash and debt, dilution; private companies - funding history, implied valuation, burn and runway${d.keyMetrics?.length ? `. Prioritise: ${d.keyMetrics.join(", ")}` : ""}.`,
      "Valuation: multiples vs. closest peers and own history; what the price implies.",
      "Management and governance: track record, capital allocation, insider ownership, incentives, turnover, controversies.",
      `Catalysts and risks over ${d.horizon ?? "the next 12-24 months"}: product cycles, regulation, financing, competition, concentration, legal.`,
      "Bull, base and bear cases with the key assumptions behind each.",
    ];
  },
  sections: () => [
    { id: "thesis", title: "Bull vs bear", kind: "two-column", guidance: "left = bull case points, right = bear case points; 4-6 each, specific and sourced in intro." },
    { id: "valuation", title: "Valuation vs peers", kind: "table", guidance: "columns: Metric | Company | Peer median | Note. Include at least EV/Revenue or P/E, growth, margin. Mark estimates." },
    { id: "moat", title: "Competitive moat", kind: "cards", guidance: "One card per moat source with evidence and direction (badge positive/neutral/negative)." },
    { id: "management", title: "Management and governance", kind: "list", guidance: "Track record, ownership, incentives, red flags." },
    { id: "catalysts", title: "Catalysts", kind: "list", guidance: "Dated upcoming events that could move the thesis; tag = expected timing." },
    { id: "diligence", title: "Open diligence questions", kind: "list", guidance: "Questions for management, customers or further work before a decision." },
  ],
  fitCriteria: (p) => {
    const d = details(p);
    return [
      "Mandate fit (stage, sector, geography)",
      "Market attractiveness",
      "Moat strength",
      "Growth quality",
      "Profitability and unit economics",
      "Valuation attractiveness",
      "Management quality",
      `Risk level vs ${d.riskAppetite ? `${d.riskAppetite.toLowerCase()} appetite` : "appetite"}`,
    ];
  },
  extraSeeds: (c, _p, year) => [
    `${q(c)} earnings results ${year}`,
    `${q(c)} 10-K risk factors OR annual report`,
    `${q(c)} investor presentation OR investor day`,
    `${q(c)} valuation EV/revenue OR P/E multiple`,
    `${q(c)} bear case OR short thesis`,
    `${q(c)} bull case OR investment thesis`,
    `${q(c)} guidance ${year} outlook`,
    `${q(c)} insider ownership OR share buyback OR dilution`,
    `${q(c)} peers comparison competitors valuation`,
    `${q(c)} ARR growth net retention OR burn rate`,
  ],
  sourceChecklist: [
    "Filings: 10-K/20-F, latest 10-Q, proxy statement; or Companies House / registry filings",
    "Earnings call transcripts and investor presentations",
    "Market data: multiples vs peers (Yahoo Finance, Macrotrends, Koyfin, company IR)",
    "Crunchbase / PitchBook / press for private rounds and valuations",
    "Sell-side and independent research summaries, short reports, Substack analyses (flag reliability)",
    "Regulatory actions, litigation, and customer/employee reviews for operational signals",
  ],
  followUps: (c) => [
    { label: "One-page memo", prompt: `Write a one-page investment memo on ${c} using the report: thesis, key numbers, valuation, risks, decision.` },
    { label: "Stress test the bear case", prompt: `Stress test the bear case for ${c}: which assumptions would have to hold, and what evidence would confirm or refute them?` },
    { label: "Peer valuation", prompt: `Compare ${c}'s valuation to its 3 closest peers with a table of multiples, growth and margins.` },
    { label: "Last earnings call", prompt: `Summarise ${c}'s most recent earnings call: guidance, surprises, management tone, analyst concerns.` },
  ],
  textOnboardingQuestions: [
    "What kind of investor are you (angel, VC, public equities, retail)?",
    "Stage, sector and horizon?",
    "Your thesis or criteria in a sentence or two?",
    "Which metrics matter most to you, and what is your risk appetite?",
  ],
};

const PARTNERSHIP: PurposePlaybook = {
  goal: (c, p) => `Assess ${c} as a potential partner for ${details(p).yourOffering ? `the user's company (${details(p).yourOffering})` : "the user's company"}: strategic fit, complementary assets, who decides, and how to pitch.`,
  clarifyFirst: (p) => (!details(p).yourOffering ? ["What does your company do, and what kind of partnership are you after?"] : []),
  focus: (p) => {
    const d = details(p);
    return [
      "Strategy and stated priorities: where they are investing, what they need from partners.",
      "Existing partner ecosystem and programmes: tiers, requirements, notable partners, marketplace presence.",
      `Complementarity: products, channels and customers that overlap or extend${d.partnershipTypes?.length ? ` (partnership types sought: ${d.partnershipTypes.join(", ")})` : ""}.`,
      `Integration surfaces: APIs, marketplaces, data flows, workflows${d.integrationSurfaces ? ` (user's view: ${d.integrationSurfaces})` : ""}.`,
      "Track record of partnerships: announcements, outcomes, churned partners, exclusivity patterns.",
      "Decision makers: partnerships, alliances, BD and product leaders; recent hires in those functions.",
      "Conflicts: existing partners or in-house products that compete with the user's offering.",
    ];
  },
  sections: () => [
    { id: "fit-rationale", title: "Why this partnership makes sense", kind: "list", guidance: "Specific complementary assets and the customer value created." },
    { id: "ecosystem", title: "Partner ecosystem", kind: "table", guidance: "columns: Partner | Type | Since | What it tells us." },
    { id: "decision-makers", title: "Who decides", kind: "cards", guidance: "Partnerships / alliances / product leaders: name, title, mandate, how to reach." },
    { id: "value-exchange", title: "Value exchange", kind: "two-column", guidance: "left = what they gain, right = what the user gains." },
    { id: "approach", title: "Recommended approach", kind: "steps", guidance: "Sequenced steps: entry point, pilot proposal, proof, expansion." },
    { id: "conflicts", title: "Conflicts and risks", kind: "cards", guidance: "Competing partners, exclusivity, channel conflict, dependency." },
  ],
  fitCriteria: () => ["Strategic alignment", "Customer complementarity", "Product and integration fit", "Ecosystem maturity", "Decision-maker access", "Commercial model fit", "Conflict risk"],
  extraSeeds: (c, _p, year) => [
    `${q(c)} partner program`,
    `${q(c)} announces partnership ${year}`,
    `${q(c)} integrations marketplace`,
    `${q(c)} "head of partnerships" OR alliances OR "business development"`,
    `${q(c)} ecosystem strategy`,
    `${q(c)} API developer platform`,
  ],
  sourceChecklist: ["Partner programme pages and marketplace listings", "Partnership press releases over the news horizon", "LinkedIn for partnerships/BD leaders", "Developer docs and API availability", "Analyst or press commentary on ecosystem strategy"],
  followUps: (c) => [
    { label: "Partnership pitch", prompt: `Draft a partnership pitch email to the partnerships lead at ${c} with a concrete value exchange and a proposed pilot.` },
    { label: "Programme requirements", prompt: `Summarise ${c}'s partner programme tiers, requirements and benefits.` },
    { label: "Comparable deals", prompt: `Find comparable partnerships ${c} has done and what they looked like commercially.` },
  ],
  textOnboardingQuestions: ["What does your company do?", "What kind of partnership are you after?", "Where could the products or channels connect?"],
};

const COMPETITIVE: PurposePlaybook = {
  goal: (c, p) => `Build an actionable competitive picture of ${c} versus ${details(p).yourProduct ? `the user's product (${details(p).yourProduct})` : "the user's product"}: positioning, pricing, go-to-market, momentum, and where to win.`,
  clarifyFirst: (p) => (!details(p).yourProduct ? ["Which of your products are we comparing, and on what dimensions?"] : []),
  focus: (p) => {
    const d = details(p);
    return [
      "Product and features; roadmap signals from release notes, job posts, patents, conference talks.",
      "Pricing and packaging, discounting behaviour, contract norms.",
      "Positioning and messaging; target segments and ideal customers.",
      "Go-to-market: sales-led vs product-led, channel, partnerships, marketing spend signals.",
      "Momentum: hiring, funding, customer logos, growth signals, leadership moves.",
      "Customer sentiment: G2/Capterra/Trustpilot strengths and complaints; churn signals.",
      `Where to win: weaknesses, gaps, unhappy segments${d.dimensions?.length ? `. Compare on: ${d.dimensions.join(", ")}` : ""}.`,
    ];
  },
  sections: (p) => {
    const mine = details(p).yourProduct ? "Your product" : "Your product";
    return [
      { id: "positioning", title: "Positioning and target segments", kind: "list", guidance: "How they describe themselves, who they target, and what that implies." },
      { id: "feature-comparison", title: "Feature and capability comparison", kind: "table", guidance: `columns: Dimension | ${"{company}"} | ${mine} | Edge. Be concrete; mark unknowns.` },
      { id: "pricing", title: "Pricing and packaging", kind: "table", guidance: "columns: Plan | Price | Includes | Notes." },
      { id: "gtm", title: "Go-to-market motion", kind: "list", guidance: "Sales model, channels, partnerships, marketing signals." },
      { id: "momentum", title: "Momentum signals", kind: "cards", guidance: "Hiring, funding, logos, launches, leadership. badge = positive/neutral/negative for the competitor." },
      { id: "weaknesses", title: "Where to attack", kind: "list", guidance: "Documented weaknesses and complaints, each with a how-to-exploit note." },
      { id: "battlecard", title: "Battlecard talk tracks", kind: "list", guidance: "copyable = true. Objection handling and differentiation lines grounded in evidence." },
    ];
  },
  fitCriteria: () => ["Overlap with your product", "Momentum", "Customer satisfaction", "Pricing pressure", "Distribution strength", "Innovation pace"],
  extraSeeds: (c, p, year) => {
    const d = details(p);
    return [
      `${q(c)} pricing plans`,
      `${q(c)} release notes OR changelog ${year}`,
      d.yourProduct ? `${q(c)} vs ${q(d.yourProduct.split(" ").slice(0, 3).join(" "))}` : `${q(c)} vs alternatives`,
      `${q(c)} G2 reviews pros cons`,
      `${q(c)} roadmap OR "coming soon"`,
      `${q(c)} case study customers`,
      `${q(c)} hiring engineers product sales ${year}`,
      `${q(c)} patent OR patents`,
      `${q(c)} analyst report Gartner OR Forrester`,
    ];
  },
  sourceChecklist: ["Pricing and product pages, release notes, docs", "G2 / Capterra / Trustpilot / app store reviews", "Job postings (volume and roles) and LinkedIn headcount trend", "Press, funding, customer announcements", "Analyst reports and comparison sites", "Conference talks, webinars, patents"],
  followUps: (c) => [
    { label: "Sales battlecard", prompt: `Create a one-page sales battlecard against ${c} from the report: positioning, landmines, objection handling, proof points.` },
    { label: "Pricing deep dive", prompt: `Compare ${c}'s pricing and packaging with ours in detail, including likely discounting.` },
    { label: "Last 90 days of releases", prompt: `List ${c}'s product releases and announcements from the last 90 days and what they signal about roadmap.` },
  ],
  textOnboardingQuestions: ["Which of your products are we comparing?", "Which dimensions matter most (features, pricing, GTM, sentiment, hiring)?", "Which other competitors do you track?"],
};

const VENDOR: PurposePlaybook = {
  goal: (c, p) => `Determine whether ${c} is a safe and capable vendor for ${details(p).buyingWhat ? `the user's need (${details(p).buyingWhat})` : "the user's need"}: viability, security and compliance, fit against requirements, cost, support, lock-in.`,
  clarifyFirst: (p) => (!details(p).buyingWhat ? ["What are you buying, and what are the hard requirements?"] : []),
  focus: (p) => {
    const d = details(p);
    return [
      "Viability: ownership, funding, revenue scale, profitability signals, longevity, recent layoffs or restructuring.",
      `Security and compliance: SOC 2, ISO 27001, GDPR/data residency, HIPAA, pen tests, trust centre, breach or incident history${d.requirements?.length ? `. Required: ${d.requirements.join(", ")}` : ""}.`,
      "Functional fit against requirements; integration and API maturity; roadmap credibility.",
      "Pricing, contract terms, price increase history, hidden costs.",
      "Support and reliability: SLAs, status page history, review themes on support.",
      "Customer references: comparable customers, case studies, Gartner Peer Insights / G2 themes.",
      "Lock-in and exit: data export, API access, migration stories, contract exit terms.",
      "Legal and regulatory issues, key-person and key-customer concentration.",
    ];
  },
  sections: () => [
    { id: "viability", title: "Vendor viability", kind: "cards", guidance: "Ownership, financial strength, longevity, recent changes. badge = positive/neutral/negative." },
    { id: "security", title: "Security and compliance", kind: "table", guidance: "columns: Requirement | Evidence | Status (Met / Partial / Unknown / Not met)." },
    { id: "fit", title: "Fit against requirements", kind: "table", guidance: "columns: Requirement | Finding | Gap. One row per user requirement." },
    { id: "pricing", title: "Pricing and commercial terms", kind: "list", guidance: "Published pricing, typical contracts, increases, negotiation levers." },
    { id: "references", title: "Customer evidence", kind: "list", guidance: "Comparable customers, review themes, case studies, with reliability notes." },
    { id: "lockin", title: "Lock-in and exit", kind: "list", guidance: "Data portability, API, migration difficulty, contract terms." },
    { id: "questions-for-vendor", title: "Questions for the vendor", kind: "list", guidance: "Specific questions to close the gaps found." },
  ],
  fitCriteria: () => ["Financial viability", "Security and compliance", "Functional fit", "Total cost", "Support quality", "Exit and lock-in risk", "Reputation"],
  extraSeeds: (c) => [
    `${q(c)} SOC 2 OR "ISO 27001" trust center`,
    `${q(c)} security breach OR incident OR vulnerability`,
    `${q(c)} pricing contract terms`,
    `${q(c)} status page uptime outage`,
    `${q(c)} reviews G2 OR "Gartner Peer Insights" support`,
    `${q(c)} data processing agreement GDPR subprocessors`,
    `${q(c)} API documentation data export`,
    `${q(c)} price increase OR renewal`,
  ],
  sourceChecklist: ["Trust centre, security and compliance pages, DPA, subprocessor list", "Status page and incident history", "G2 / Gartner Peer Insights / Capterra reviews", "Funding, ownership, financial news", "Documentation (APIs, export), contract templates", "Comparable customer case studies and references"],
  followUps: (c) => [
    { label: "Security questionnaire", prompt: `Draft a vendor security and compliance questionnaire for ${c} targeting the gaps found in the report.` },
    { label: "Compare alternatives", prompt: `Compare ${c} against two alternative vendors for the same need using my requirements as criteria.` },
    { label: "Negotiation points", prompt: `Prepare negotiation points and contract protections for buying from ${c}.` },
  ],
  textOnboardingQuestions: ["What are you buying?", "What are the hard requirements (security, compliance, integrations, SLAs)?", "Budget and decision timeline?"],
};

const JOURNALISM: PurposePlaybook = {
  goal: (c, p) => `Assemble a verified, well-sourced factual picture of ${c}${details(p).angle ? ` for the angle: ${details(p).angle}` : ""}: history, ownership, money, people, controversies and open questions.`,
  clarifyFirst: (p) => (!details(p).angle ? ["What is the angle or question driving this?"] : []),
  focus: (p) => {
    const d = details(p);
    return [
      "Corporate structure and ownership: registries, filings, parents, subsidiaries, beneficial owners, shell patterns.",
      "History and timeline: founding, pivots, key deals, crises.",
      "Key people and their connections: executives, board, investors, advisers, former insiders.",
      "Money: revenue, funding, government contracts, grants, debt, related-party dealings.",
      "Controversies: lawsuits, regulatory actions, investigations, fines, labour disputes, safety or privacy incidents.",
      "Public statements vs. actions; lobbying and political ties.",
      `Prior coverage and what remains unreported${d.standards ? `. Sourcing standards: ${d.standards}` : ""}.`,
      "Primary documents to obtain and people to approach for comment.",
    ];
  },
  sections: () => [
    { id: "key-timeline", title: "Key timeline", kind: "steps", guidance: "The 8-15 events that matter for the angle, dated and sourced." },
    { id: "ownership", title: "Ownership and structure", kind: "list", guidance: "Who owns and controls it, with registry or filing evidence." },
    { id: "controversies", title: "Controversies and proceedings", kind: "cards", guidance: "One per matter: status, parties, what is established vs alleged. badge = high/medium/low significance." },
    { id: "claims-vs-evidence", title: "Claims vs evidence", kind: "table", guidance: "columns: Claim | Evidence | Status (Confirmed / Partially / Disputed / Unverified)." },
    { id: "documents", title: "Primary documents", kind: "list", guidance: "Filings, court records, contracts, FOI targets with where to get them." },
    { id: "contacts", title: "People to approach", kind: "list", guidance: "Named roles or people for comment or background, and why." },
  ],
  fitCriteria: () => ["Newsworthiness", "Evidence strength", "Primary source availability", "Novelty vs prior coverage", "Public interest"],
  extraSeeds: (c) => [
    `${q(c)} owner OR "parent company" OR shareholders`,
    `${q(c)} lawsuit OR settlement OR fine`,
    `${q(c)} investigation OR probe OR regulator`,
    `${q(c)} lobbying OR political donations`,
    `${q(c)} controversy OR scandal OR whistleblower`,
    `${q(c)} filings registry OR "Companies House" OR SEC`,
    `${q(c)} former employees OR ex-employees`,
    `${q(c)} contracts government OR tender`,
  ],
  sourceChecklist: ["Corporate registries and filings (Companies House, SEC EDGAR, OpenCorporates)", "Court records and regulator databases", "Archived versions of company statements (Wayback Machine)", "Investigative and local press coverage", "Lobbying and political finance registers", "Employee and customer review platforms for patterns"],
  followUps: (c) => [
    { label: "Source list", prompt: `Build a source list for a story on ${c}: documents to obtain, databases to query, and people to approach, with priorities.` },
    { label: "Records requests", prompt: `Identify records requests (FOI/FOIA or equivalent) that could surface new information about ${c}.` },
    { label: "Controversies timeline", prompt: `Produce a detailed, sourced timeline of controversies and proceedings involving ${c}.` },
  ],
  textOnboardingQuestions: ["What is your beat?", "What is the angle or question?", "Any sourcing standards I should hold to?"],
};

const OTHER: PurposePlaybook = {
  goal: (c, p) => `Produce a rigorous profile of ${c} tailored to the user's goal${details(p).description ? `: ${details(p).description}` : ""}.`,
  clarifyFirst: (p) => (!details(p).description ? ["What do you want to learn or decide about this company?"] : []),
  focus: (p) => [
    "Overview, history, products, scale, finances, people, strategy, recent news, competitors, reputation, risks.",
    `Whatever the user's goal requires${details(p).description ? ` (goal: ${details(p).description})` : ""}: prioritise depth where it matters for that goal.`,
  ],
  sections: () => [
    { id: "key-findings", title: "Key findings", kind: "list", guidance: "The 6-10 most important, sourced findings for the user's goal." },
    { id: "relevance", title: "What this means for your goal", kind: "list", guidance: "Map findings to the user's stated goal." },
    { id: "questions", title: "Open questions", kind: "list", guidance: "What is unknown and how to find out." },
  ],
  fitCriteria: () => ["Match to stated goal", "Evidence quality", "Recency", "Completeness"],
  extraSeeds: () => [],
  sourceChecklist: ["Company website and newsroom", "Wikipedia / Crunchbase / LinkedIn", "Filings if public", "Press over the news horizon", "Reviews and sentiment platforms"],
  followUps: (c) => [
    { label: "Go deeper", prompt: `Go deeper on the most important open question about ${c} from the report.` },
    { label: "Compare with a peer", prompt: `Compare ${c} with its closest peer on the dimensions that matter for my goal.` },
  ],
  textOnboardingQuestions: ["What do you want to learn or decide about companies?"],
};

export const PURPOSE_PLAYBOOKS: Record<PurposeKey, PurposePlaybook> = {
  sales: SALES,
  job: JOB,
  investment: INVESTMENT,
  partnership: PARTNERSHIP,
  competitive: COMPETITIVE,
  vendor: VENDOR,
  journalism: JOURNALISM,
  other: OTHER,
};

export const DEPTH_BUDGETS: Record<Depth, { searches: string; pageReads: string; scope: string }> = {
  quick: { searches: "6-10", pageReads: "1-3", scope: "Phases 0-3 plus a short purpose section. Skip sentiment and deep financial history." },
  standard: { searches: "12-20", pageReads: "3-6", scope: "All phases at moderate depth. Triangulate the headline numbers (size, revenue, funding)." },
  deep: { searches: "25-40 or more", pageReads: "8-15", scope: "All phases. Two passes on news (last 90 days, then the full horizon). Triangulate every key number across at least two sources. Read primary documents (filings, newsroom, trust centre, careers) directly." },
};

export function genericSeeds(company: string, year: number, isPublic: boolean | undefined): string[] {
  const c = q(company);
  const seeds = [
    `${c} company overview what they do`,
    `${c} leadership team executives`,
    `${c} revenue ${year} OR ${year - 1}`,
    `${c} employees headcount`,
    `${c} funding OR valuation OR acquired`,
    `${c} news ${year}`,
    `${c} announces`,
    `${c} CEO interview strategy`,
    `${c} layoffs OR restructuring OR hiring`,
    `${c} lawsuit OR regulator OR investigation`,
    `${c} competitors OR alternatives`,
    `${c} reviews`,
    `site:linkedin.com/company ${company}`,
    `${company} crunchbase`,
    `${company} wikipedia`,
  ];
  if (isPublic !== false) seeds.push(`${c} annual report OR 10-K investor relations`);
  return seeds;
}

export const RESEARCH_PROTOCOL = `## Deep research protocol

Work in phases. Use web search for discovery and fetch pages directly for primary sources. Keep a running list of sources with ids as you go.

0. **Scope**: confirm the exact entity (official name, website, HQ, parent or subsidiaries). If the name is ambiguous, ask the user one clarifying question before continuing.
1. **Foundation**: official site (about, products, leadership, newsroom, careers), Wikipedia, Crunchbase/PitchBook, LinkedIn company page. If public, the latest annual report, earnings release and investor presentation.
2. **Scale and finances**: revenue, growth, profitability, funding and valuation, headcount trend. Triangulate from at least two sources; label estimates as estimates with their basis.
3. **Signals**: news within the horizon. Run separate queries for funding, M&A, leadership changes, layoffs/hiring, product launches, partnerships, legal/regulatory, expansion. Include the company's own newsroom. Record exact dates.
4. **People and organisation**: leadership, recent executive changes, board and investors, organisational hints from job postings, and the people who matter for the user's purpose.
5. **Purpose deep-dive**: the focus list and sections in this brief. This is where most of the effort should go.
6. **Market, competition and sentiment**: competitors and positioning; reviews (G2, Capterra, Glassdoor, Blind, Trustpilot, app stores); social and press sentiment.
7. **Verify and synthesise**: resolve conflicts between sources, date every figure, assign confidence, list what could not be verified, then call \`report_render\` once with the complete report.

## Quality bar
- Every number and every claim that could be challenged carries source ids. Prefer primary sources; mark reliability honestly.
- State the "as of" date for figures. Newest first in the timeline.
- Do not invent or pad. If a section has no evidence, omit it or list the gap under openQuestions.
- Distinguish reported from estimated, and fact from inference.
- Write for the user's purpose: every section should help them decide or act.
- Keep the report payload lean: concise bodies, no duplicated text, under roughly 60,000 characters.

## After rendering
Reply in chat with a 3-5 line summary (headline, fit or verdict, two most important findings, suggested next step). Do not repeat the full report in chat; the interactive report already shows it. Offer the follow-ups.`;

export function profileSummary(p: Profile): string {
  const meta = PURPOSES[p.purpose];
  const d = p.purposeDetails ?? {};
  const lines: string[] = [];
  lines.push(`**Profile:** ${p.label} (id: ${p.id})`);
  lines.push(`**User:** ${p.user.name}${p.user.title ? `, ${p.user.title}` : ""}${p.user.company ? ` at ${p.user.company}` : ""}${p.user.location ? ` (${p.user.location})` : ""}`);
  lines.push(`**Purpose:** ${meta.label}${p.purpose === "other" && d.description ? ` - ${d.description}` : ""}`);
  const detailLines = Object.entries(d)
    .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : !!v))
    .map(([k, v]) => `- ${humanKey(k)}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  if (detailLines.length) lines.push("**Details:**", ...detailLines);
  const pref = p.preferences;
  lines.push(`**Preferences:** depth=${pref.depth}, news horizon=${pref.newsHorizonMonths} months, style=${pref.outputStyle}, language=${pref.language}${pref.geographies?.length ? `, geographies=${pref.geographies.join(", ")}` : ""}${pref.alwaysInclude?.length ? `, always include=${pref.alwaysInclude.join(", ")}` : ""}`);
  if (pref.extraInstructions) lines.push(`**Standing instructions:** ${pref.extraInstructions}`);
  return lines.join("\n");
}

export function humanKey(key: string): string {
  const map: Record<string, string> = {
    offering: "What they sell",
    offeringCategory: "Category",
    valueProp: "Value proposition",
    icpIndustries: "Target industries",
    icpCompanySizes: "Target company sizes",
    icpGeos: "Target geographies",
    buyerPersonas: "Buyer personas",
    dealSize: "Deal size",
    salesCycle: "Sales cycle",
    competitors: "Competitors",
    winReasons: "Why they win",
    triggersOfInterest: "Triggers of interest",
    targetRoles: "Target roles",
    roleLevel: "Level",
    mustHaves: "Must-haves",
    dealBreakers: "Deal-breakers",
    valuesPriorities: "Priorities",
    workStyle: "Work arrangement",
    compExpectations: "Compensation expectations",
    careerGoals: "Career goals",
    background: "Background",
    investorType: "Investor type",
    stageFocus: "Stage focus",
    sectorFocus: "Sector focus",
    checkSize: "Check size",
    horizon: "Horizon",
    thesis: "Thesis",
    riskAppetite: "Risk appetite",
    keyMetrics: "Key metrics",
    yourOffering: "Your offering",
    partnershipTypes: "Partnership types",
    integrationSurfaces: "Integration surfaces",
    yourProduct: "Your product",
    competitorSet: "Competitor set",
    dimensions: "Dimensions",
    buyingWhat: "Buying",
    requirements: "Requirements",
    budget: "Budget",
    timeline: "Timeline",
    beat: "Beat",
    angle: "Angle",
    standards: "Sourcing standards",
    description: "Goal",
    notes: "Notes",
  };
  return map[key] ?? key;
}

/** Short description of how research will be tailored. Shown after onboarding and in profile_get. */
export function playbookSummary(p: Profile): string {
  const pb = PURPOSE_PLAYBOOKS[p.purpose];
  const meta = PURPOSES[p.purpose];
  const focus = pb.focus(p).slice(0, 5);
  const sections = pb.sections(p).map((s) => s.title);
  return [
    `### How research is tailored for ${p.user.name}`,
    `Purpose: ${meta.label}. Default depth: ${p.preferences.depth}. News horizon: ${p.preferences.newsHorizonMonths} months.`,
    "",
    "Focus:",
    ...focus.map((f) => `- ${f}`),
    "",
    `Report tab "${meta.tabLabel}" will contain: ${sections.join("; ")}.`,
    `Score shown as "${meta.fitLabel}" against: ${pb.fitCriteria(p).join(", ")}.`,
    "",
    "Workflow: call `research_brief` with the company name, follow the protocol it returns, then call `report_render` with the structured report.",
  ].join("\n");
}

export interface BriefOptions {
  company: string;
  website?: string;
  context?: string;
  depth?: Depth;
  isPublic?: boolean;
}

export interface ResearchBrief {
  company: string;
  purpose: PurposeKey;
  purposeLabel: string;
  depth: Depth;
  goal: string;
  clarifyFirst: string[];
  focus: string[];
  sections: SectionSpec[];
  fitLabel: string;
  fitCriteria: string[];
  searchSeeds: string[];
  sourceChecklist: string[];
  followUps: { label: string; prompt: string }[];
  budget: { searches: string; pageReads: string; scope: string };
  newsHorizonMonths: number;
  markdown: string;
}

export function buildResearchBrief(profile: Profile | null, opts: BriefOptions): ResearchBrief {
  const purpose: PurposeKey = profile?.purpose ?? "other";
  const pb = PURPOSE_PLAYBOOKS[purpose];
  const meta = PURPOSES[purpose];
  const depth: Depth = opts.depth ?? profile?.preferences.depth ?? "deep";
  const year = new Date().getUTCFullYear();
  const horizon = profile?.preferences.newsHorizonMonths ?? 12;
  const sections = pb.sections(profile).map((s) => ({ ...s, guidance: s.guidance.replace("{company}", opts.company) }));
  const extra = (profile?.preferences.alwaysInclude ?? []).map((s) => s.toLowerCase());
  const seeds = [...genericSeeds(opts.company, year, opts.isPublic), ...pb.extraSeeds(opts.company, profile, year)].filter((s, i, a) => s.trim() && a.indexOf(s) === i);
  const budget = DEPTH_BUDGETS[depth];
  const clarify = pb.clarifyFirst(profile);
  const purposeLabel = profile
    ? `${meta.label} research for ${profile.user.name}${profile.user.company ? ` (${profile.user.company})` : ""}`
    : `${meta.label} research`;

  const md: string[] = [];
  md.push(`# Research brief: ${opts.company}`);
  md.push("");
  md.push(`**Purpose:** ${purposeLabel}. **Depth:** ${depth} (${budget.searches} searches, ${budget.pageReads} page reads). **News horizon:** ${horizon} months.`);
  if (opts.website) md.push(`**Website:** ${opts.website}`);
  if (opts.context) md.push(`**Context from the user:** ${opts.context}`);
  md.push("");
  md.push(`**Goal:** ${pb.goal(opts.company, profile)}`);
  if (!profile) md.push("", "_No research profile found. Research will be general. Suggest running `onboarding_start` afterwards so future reports are tailored._");
  if (clarify.length) {
    md.push("", "## Ask the user first (one message, then proceed)", ...clarify.map((c) => `- ${c}`));
  }
  if (profile) md.push("", "## Who this is for", profileSummary(profile));
  md.push("", "## Research focus", ...pb.focus(profile).map((f) => `- ${f}`));
  if (extra.length) md.push("", `Always include these report sections when evidence exists: ${extra.join(", ")}.`);
  if (profile?.preferences.extraInstructions) md.push("", `Standing instructions: ${profile.preferences.extraInstructions}`);
  md.push("", `## Scope for depth "${depth}"`, budget.scope);
  md.push("", RESEARCH_PROTOCOL);
  md.push("", "## Search plan (adapt as you learn)", ...seeds.map((s) => `- ${s}`));
  md.push("", "## Source checklist", ...pb.sourceChecklist.map((s) => `- ${s}`));
  md.push("", "## Report blueprint for `report_render`");
  md.push(`- \`meta.purpose\` = "${purpose}", \`meta.purposeLabel\` = "${purposeLabel}", \`meta.depth\` = "${depth}"${profile ? `, \`meta.profileId\` = "${profile.id}"` : ""}.`);
  md.push(`- \`summary.whyItMatters\`: implications specifically for this purpose.`);
  md.push(`- \`fit\`: label it "${meta.fitLabel}". Score each criterion 0-100 with a one-line assessment: ${pb.fitCriteria(profile).join("; ")}.`);
  md.push(`- \`purposeSections\` (use these ids, titles and kinds):`);
  for (const s of sections) md.push(`  - id "${s.id}" - "${s.title}" (${s.kind}): ${s.guidance}`);
  md.push(`- Also fill: metrics (4-8 tiles), timeline (dated signals in the horizon), financials.series when numbers exist, people, competitors, risks, sentiment, swot where useful, openQuestions, sources.`);
  md.push(`- \`followUps\`: offer 3-4, e.g. ${pb.followUps(opts.company, profile).map((f) => `"${f.label}"`).join(", ")}.`);
  md.push(`- Language: ${profile?.preferences.language ?? "English"}. Style: ${profile?.preferences.outputStyle ?? "executive"}.`);

  return {
    company: opts.company,
    purpose,
    purposeLabel,
    depth,
    goal: pb.goal(opts.company, profile),
    clarifyFirst: clarify,
    focus: pb.focus(profile),
    sections,
    fitLabel: meta.fitLabel,
    fitCriteria: pb.fitCriteria(profile),
    searchSeeds: seeds,
    sourceChecklist: pb.sourceChecklist,
    followUps: pb.followUps(opts.company, profile),
    budget,
    newsHorizonMonths: horizon,
    markdown: md.join("\n"),
  };
}

/** Questions to ask conversationally when the onboarding UI cannot render (text-only hosts). */
export function textOnboarding(purpose?: PurposeKey): string {
  const common = [
    "1. Your name, job title and company.",
    `2. Why you research companies: ${Object.values(PURPOSES).map((m) => `${m.key} (${m.label})`).join(", ")}.`,
  ];
  const specific = purpose
    ? PURPOSE_PLAYBOOKS[purpose].textOnboardingQuestions.map((qn, i) => `${i + 3}. ${qn}`)
    : ["3. Then ask the purpose-specific questions for the chosen purpose (call this tool again with `purpose` set to get them)."];
  const tail = [
    `${specific.length + 3}. Preferences: research depth (quick / standard / deep - default deep), news horizon in months (default 12), geographies, output style (executive / comprehensive), standing instructions.`,
    "",
    "Then call `profile_save` with the collected details, and confirm the saved profile to the user.",
  ];
  return ["The interactive onboarding form could not be shown here. Collect the same details in conversation, in at most two messages:", ...common, ...specific, ...tail].join("\n");
}
