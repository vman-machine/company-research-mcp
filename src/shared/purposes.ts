/**
 * Purpose catalog shared by the server and the onboarding view.
 * Keep this file free of Node or server-only imports: it is bundled into the UI.
 */
import type { PurposeDetails, PurposeKey } from "../server/schemas.js";

export type FieldKind = "text" | "textarea" | "chips" | "segmented";

export interface FieldSpec {
  key: keyof PurposeDetails;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  help?: string;
  options?: string[]; // segmented
  suggestions?: string[]; // chips quick-add
  required?: boolean;
}

export interface PurposeMeta {
  key: PurposeKey;
  label: string;
  short: string;
  description: string;
  icon: "target" | "briefcase" | "chart" | "handshake" | "radar" | "shield" | "pen" | "sparkle";
  tabLabel: string; // label of the purpose tab in the report
  fitLabel: string; // label of the score ring in the report
  fields: FieldSpec[];
}

export const PURPOSES: Record<PurposeKey, PurposeMeta> = {
  sales: {
    key: "sales",
    label: "Sales and prospecting",
    short: "Sales",
    description: "Qualify accounts, find the right people, and personalise outreach.",
    icon: "target",
    tabLabel: "Sales angle",
    fitLabel: "Account fit",
    fields: [
      { key: "offering", label: "What do you sell?", kind: "textarea", required: true, placeholder: "e.g. A payroll and benefits platform for mid-sized companies in Europe", help: "Research is tailored to how your offering fits the target company." },
      { key: "valueProp", label: "Why do customers buy it?", kind: "textarea", placeholder: "The outcome you deliver and what you replace" },
      { key: "buyerPersonas", label: "Who buys or champions it?", kind: "chips", required: true, placeholder: "Add a title and press Enter", suggestions: ["CFO", "VP Finance", "Head of People", "CIO", "CTO", "VP Engineering", "CMO", "COO", "Head of Procurement", "CEO / Founder"] },
      { key: "icpIndustries", label: "Ideal industries", kind: "chips", placeholder: "Add an industry", suggestions: ["SaaS", "Fintech", "Healthcare", "Manufacturing", "Retail", "Logistics", "Professional services", "Public sector", "Energy"] },
      { key: "icpCompanySizes", label: "Ideal company size", kind: "chips", placeholder: "Add a size band", suggestions: ["1-50", "51-200", "201-1,000", "1,001-5,000", "5,000+"] },
      { key: "icpGeos", label: "Target geographies", kind: "chips", placeholder: "Add a region", suggestions: ["UK", "Europe", "North America", "APAC", "Middle East", "Global"] },
      { key: "competitors", label: "Who do you usually compete with?", kind: "chips", placeholder: "Add a competitor" },
      { key: "triggersOfInterest", label: "Buying triggers you care about", kind: "chips", placeholder: "Add a trigger", suggestions: ["New executive hire", "Funding round", "Expansion to new market", "Layoffs or restructuring", "M&A", "New product launch", "Regulatory change", "Tech stack change", "Poor reviews of incumbent"] },
      { key: "dealSize", label: "Typical deal size", kind: "text", placeholder: "e.g. $40k-$150k ACV" },
    ],
  },
  job: {
    key: "job",
    label: "Job search",
    short: "Job",
    description: "Judge employers, spot red flags, and prepare for interviews.",
    icon: "briefcase",
    tabLabel: "Candidate view",
    fitLabel: "Employer fit",
    fields: [
      { key: "targetRoles", label: "Roles you are targeting", kind: "chips", required: true, placeholder: "Add a role and press Enter", suggestions: ["Software engineer", "Product manager", "Data scientist", "Designer", "Sales", "Marketing", "Finance", "Operations", "Engineering manager"] },
      { key: "roleLevel", label: "Level", kind: "segmented", options: ["Entry", "Mid", "Senior", "Lead / Staff", "Manager", "Director+", "Executive"] },
      { key: "background", label: "Your background in one or two lines", kind: "textarea", placeholder: "e.g. 8 years in B2B product, last 3 at a fintech scale-up" },
      { key: "valuesPriorities", label: "What matters most to you", kind: "chips", required: true, placeholder: "Add a priority", suggestions: ["Compensation", "Growth and learning", "Stability", "Mission", "Work-life balance", "Strong leadership", "Remote flexibility", "Brand name", "Equity upside"] },
      { key: "workStyle", label: "Work arrangement", kind: "segmented", options: ["Remote", "Hybrid", "On-site", "Flexible"] },
      { key: "mustHaves", label: "Must-haves", kind: "chips", placeholder: "Add a must-have", suggestions: ["Visa sponsorship", "Equity", "4-day week", "Relocation support", "Clear promotion path"] },
      { key: "dealBreakers", label: "Deal-breakers", kind: "chips", placeholder: "Add a deal-breaker", suggestions: ["Recent layoffs", "Return-to-office mandate", "Poor Glassdoor trend", "Runway under 12 months", "High exec churn"] },
      { key: "compExpectations", label: "Compensation expectations", kind: "text", placeholder: "e.g. £120k base, total £160k+" },
      { key: "careerGoals", label: "Where do you want to be in 3 years?", kind: "text", placeholder: "Optional" },
    ],
  },
  investment: {
    key: "investment",
    label: "Investing",
    short: "Invest",
    description: "Test a thesis: business quality, valuation, risks, and catalysts.",
    icon: "chart",
    tabLabel: "Investment case",
    fitLabel: "Thesis fit",
    fields: [
      { key: "investorType", label: "Investor type", kind: "segmented", required: true, options: ["Angel", "VC", "Growth / PE", "Public equities", "Retail", "Family office"] },
      { key: "stageFocus", label: "Stage focus", kind: "chips", placeholder: "Add a stage", suggestions: ["Pre-seed", "Seed", "Series A", "Series B-C", "Growth", "Public small-cap", "Public large-cap"] },
      { key: "sectorFocus", label: "Sectors or themes", kind: "chips", placeholder: "Add a sector", suggestions: ["AI / ML", "SaaS", "Fintech", "Healthcare", "Climate", "Consumer", "Industrial", "Semiconductors", "Infrastructure"] },
      { key: "thesis", label: "Your thesis or criteria", kind: "textarea", required: true, placeholder: "e.g. Category leaders with >30% growth, improving margins, founder-led, trading below 10x forward revenue" },
      { key: "keyMetrics", label: "Metrics you care about", kind: "chips", placeholder: "Add a metric", suggestions: ["Revenue growth", "Gross margin", "FCF margin", "Net revenue retention", "Rule of 40", "EV/Revenue", "P/E", "Burn multiple", "Market share"] },
      { key: "horizon", label: "Horizon", kind: "segmented", options: ["< 1 year", "1-3 years", "3-7 years", "7+ years"] },
      { key: "riskAppetite", label: "Risk appetite", kind: "segmented", options: ["Conservative", "Balanced", "Aggressive"] },
      { key: "checkSize", label: "Typical investment size", kind: "text", placeholder: "Optional" },
    ],
  },
  partnership: {
    key: "partnership",
    label: "Partnerships and BD",
    short: "Partner",
    description: "Find strategic fit, the right contacts, and a value exchange that lands.",
    icon: "handshake",
    tabLabel: "Partnership view",
    fitLabel: "Partner fit",
    fields: [
      { key: "yourOffering", label: "What does your company do?", kind: "textarea", required: true, placeholder: "One or two lines on your product, customers and channels" },
      { key: "partnershipTypes", label: "Partnership types you want", kind: "chips", required: true, placeholder: "Add a type", suggestions: ["Technology integration", "Reseller / channel", "Co-marketing", "Distribution", "Referral", "Joint venture", "OEM / embed", "Data partnership"] },
      { key: "integrationSurfaces", label: "Where could the products connect?", kind: "textarea", placeholder: "APIs, marketplaces, workflows, shared customers" },
    ],
  },
  competitive: {
    key: "competitive",
    label: "Competitive intelligence",
    short: "Compete",
    description: "Track a rival's positioning, pricing, momentum, and weak spots.",
    icon: "radar",
    tabLabel: "Competitive view",
    fitLabel: "Threat level",
    fields: [
      { key: "yourProduct", label: "Your product", kind: "textarea", required: true, placeholder: "What you sell and to whom, so comparisons are concrete" },
      { key: "dimensions", label: "Dimensions to compare", kind: "chips", required: true, placeholder: "Add a dimension", suggestions: ["Features", "Pricing and packaging", "Positioning", "Go-to-market", "Customer sentiment", "Hiring", "Funding", "Roadmap signals", "Partnerships"] },
      { key: "competitorSet", label: "Other competitors you track", kind: "chips", placeholder: "Add a competitor" },
    ],
  },
  vendor: {
    key: "vendor",
    label: "Vendor due diligence",
    short: "Vendor",
    description: "Check viability, security, fit, and lock-in before you buy.",
    icon: "shield",
    tabLabel: "Due diligence",
    fitLabel: "Vendor fit",
    fields: [
      { key: "buyingWhat", label: "What are you buying?", kind: "textarea", required: true, placeholder: "e.g. A data warehouse for a 300-person company, replacing an on-prem system" },
      { key: "requirements", label: "Hard requirements", kind: "chips", required: true, placeholder: "Add a requirement", suggestions: ["SOC 2 Type II", "ISO 27001", "GDPR", "HIPAA", "EU data residency", "SSO / SAML", "99.9% SLA", "API access", "Data export"] },
      { key: "budget", label: "Budget", kind: "text", placeholder: "Optional" },
      { key: "timeline", label: "Decision timeline", kind: "segmented", options: ["This month", "This quarter", "6 months", "Exploring"] },
    ],
  },
  journalism: {
    key: "journalism",
    label: "Journalism and research",
    short: "Research",
    description: "Build a verified, sourced picture: ownership, money, people, controversies.",
    icon: "pen",
    tabLabel: "Investigation",
    fitLabel: "Story strength",
    fields: [
      { key: "beat", label: "Your beat or field", kind: "text", required: true, placeholder: "e.g. Technology policy, corporate finance, labour" },
      { key: "angle", label: "The angle or question", kind: "textarea", required: true, placeholder: "What are you trying to establish or explain?" },
      { key: "standards", label: "Sourcing standards", kind: "chips", placeholder: "Add a standard", suggestions: ["Primary documents only", "Two independent sources per claim", "On-record quotes", "Flag anonymous sources", "Link every fact"] },
    ],
  },
  other: {
    key: "other",
    label: "Something else",
    short: "Other",
    description: "Describe your goal and the research adapts to it.",
    icon: "sparkle",
    tabLabel: "Analysis",
    fitLabel: "Relevance",
    fields: [
      { key: "description", label: "What do you want to learn or decide?", kind: "textarea", required: true, placeholder: "e.g. I'm writing a case study on how mid-market logistics firms adopt AI" },
    ],
  },
};

export const PURPOSE_ORDER: PurposeKey[] = ["sales", "job", "investment", "partnership", "competitive", "vendor", "journalism", "other"];

export const DEPTH_OPTIONS = [
  { key: "quick", label: "Quick", description: "A fast orientation: 6-10 searches, the essentials only." },
  { key: "standard", label: "Standard", description: "A solid profile: 12-20 searches, key sections covered." },
  { key: "deep", label: "Deep", description: "Thorough and triangulated: 25-40 searches, every section, every key number verified." },
] as const;

export const OPTIONAL_SECTIONS = ["financials", "people", "competitors", "sentiment", "risks", "timeline", "market", "products", "tech stack", "swot"] as const;
