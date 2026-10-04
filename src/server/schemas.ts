/**
 * Shared data contracts: research profiles (from onboarding) and research
 * reports (produced by the model, rendered by the report view).
 *
 * These Zod schemas are also exposed to the model as tool input schemas, so the
 * descriptions double as instructions. Keep them precise.
 */
import { z } from "zod";

export const PURPOSE_KEYS = [
  "sales",
  "job",
  "investment",
  "partnership",
  "competitive",
  "vendor",
  "journalism",
  "other",
] as const;
export const PurposeKeySchema = z.enum(PURPOSE_KEYS);
export type PurposeKey = z.infer<typeof PurposeKeySchema>;

export const DEPTHS = ["quick", "standard", "deep"] as const;
export const DepthSchema = z.enum(DEPTHS);
export type Depth = z.infer<typeof DepthSchema>;

const str = (desc: string) => z.string().describe(desc);
const strList = (desc: string) => z.array(z.string()).describe(desc);

export const PurposeDetailsSchema = z
  .object({
    // Sales and prospecting
    offering: str("What the user sells: product or service, in plain words").optional(),
    offeringCategory: str("Category of the offering, e.g. 'payroll software', 'cybersecurity consulting'").optional(),
    valueProp: str("Why customers buy it; the outcome it delivers").optional(),
    icpIndustries: strList("Ideal customer industries").optional(),
    icpCompanySizes: strList("Ideal customer company sizes, e.g. '200-1000 employees', 'Enterprise'").optional(),
    icpGeos: strList("Target geographies").optional(),
    buyerPersonas: strList("Titles of the people who buy or champion, e.g. 'VP Engineering', 'CFO'").optional(),
    dealSize: str("Typical deal size / contract value").optional(),
    salesCycle: str("Typical sales cycle length").optional(),
    competitors: strList("Competing vendors the user usually sells against").optional(),
    winReasons: str("Why the user wins deals; differentiators").optional(),
    triggersOfInterest: strList("Buying triggers the user cares about, e.g. 'new CFO', 'funding round', 'expansion to EU'").optional(),

    // Job search
    targetRoles: strList("Roles the user is targeting").optional(),
    roleLevel: str("Seniority level sought, e.g. 'Senior', 'Director'").optional(),
    mustHaves: strList("Non-negotiables, e.g. 'remote', 'equity', 'visa sponsorship'").optional(),
    dealBreakers: strList("Red flags that would rule a company out").optional(),
    valuesPriorities: strList("What the user values most: growth, stability, mission, pay, learning, work-life balance...").optional(),
    workStyle: str("Preferred work arrangement: remote, hybrid, on-site").optional(),
    compExpectations: str("Compensation expectations").optional(),
    careerGoals: str("Where the user wants to be in 2-5 years").optional(),
    background: str("Short professional background summary of the user").optional(),

    // Investing
    investorType: str("angel, VC, PE, public equities, retail, family office...").optional(),
    stageFocus: strList("Stages of interest, e.g. 'Seed', 'Series B', 'Public small-cap'").optional(),
    sectorFocus: strList("Sectors or themes of interest").optional(),
    checkSize: str("Typical investment size").optional(),
    horizon: str("Investment horizon").optional(),
    thesis: str("Investment thesis or criteria in the user's words").optional(),
    riskAppetite: str("Risk appetite: conservative, balanced, aggressive").optional(),
    keyMetrics: strList("Metrics the user cares about most, e.g. 'ARR growth', 'FCF margin', 'NRR'").optional(),

    // Partnerships / business development
    yourOffering: str("What the user's company does, for partnership context").optional(),
    partnershipTypes: strList("Partnership types sought: reseller, integration, co-marketing, distribution, JV...").optional(),
    integrationSurfaces: str("Where the products or services could connect").optional(),

    // Competitive intelligence
    yourProduct: str("The user's product being compared").optional(),
    competitorSet: strList("Known competitors to track").optional(),
    dimensions: strList("Dimensions to compare on: pricing, features, GTM, hiring, roadmap...").optional(),

    // Vendor due diligence / procurement
    buyingWhat: str("What the user is buying or evaluating").optional(),
    requirements: strList("Hard requirements: SOC 2, GDPR, SLAs, data residency, integrations...").optional(),
    budget: str("Budget range").optional(),
    timeline: str("Decision timeline").optional(),

    // Journalism / academic / general
    beat: str("Beat or research area").optional(),
    angle: str("Story angle or research question").optional(),
    standards: str("Sourcing standards, e.g. 'primary sources only', 'on-record quotes'").optional(),

    // Any purpose
    description: str("Free-text description of the purpose when none of the presets fit").optional(),
    notes: str("Anything else that should shape the research").optional(),
  })
  .describe("Purpose-specific details. Fill only the fields relevant to the chosen purpose.");
export type PurposeDetails = z.infer<typeof PurposeDetailsSchema>;

export const PreferencesSchema = z.object({
  depth: DepthSchema.default("deep").describe("Research depth. 'deep' is the default and recommended."),
  newsHorizonMonths: z.number().int().min(1).max(60).default(12).describe("How far back to look for news and signals"),
  geographies: strList("Geographies to emphasise").optional(),
  language: str("Preferred output language, BCP 47 or plain name").default("English"),
  outputStyle: z.enum(["executive", "comprehensive"]).default("executive").describe("'executive' = tight and decision-oriented; 'comprehensive' = exhaustive"),
  alwaysInclude: strList("Report sections to always include, e.g. 'financials', 'people', 'competitors', 'sentiment', 'risks', 'timeline'").optional(),
  preferredSources: strList("Sources to prioritise").optional(),
  avoidSources: strList("Sources to avoid or treat with caution").optional(),
  extraInstructions: str("Any standing instructions for every research run").optional(),
});
export type Preferences = z.infer<typeof PreferencesSchema>;

export const UserInfoSchema = z.object({
  name: str("The user's name"),
  title: str("Job title").optional(),
  company: str("Employer or own company").optional(),
  companyWebsite: str("Website of the user's company").optional(),
  location: str("City / country / time zone").optional(),
  email: str("Email, optional, only used as a label").optional(),
});

export const ProfileInputSchema = z.object({
  id: str("Stable id (slug). Omit to create a new profile; pass an existing id to update it.").optional(),
  label: str("Short label for this profile, e.g. 'Sales at Acme' or 'Job search 2026'").optional(),
  user: UserInfoSchema,
  purpose: PurposeKeySchema.describe("Why the user researches companies"),
  purposeDetails: PurposeDetailsSchema.default({}),
  preferences: PreferencesSchema.default({ depth: "deep", newsHorizonMonths: 12, language: "English", outputStyle: "executive" }),
  makeActive: z.boolean().default(true).describe("Make this the active profile used by default"),
});
export type ProfileInput = z.infer<typeof ProfileInputSchema>;

export const ProfileSchema = ProfileInputSchema.omit({ makeActive: true }).extend({
  id: z.string(),
  label: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const sourceIds = z.array(z.number().int()).describe("Ids of supporting sources from the `sources` array").optional();
const Confidence = z.enum(["high", "medium", "low"]);
const Trend = z.enum(["up", "down", "flat"]);

export const SourceSchema = z.object({
  id: z.number().int().describe("Sequential id starting at 1; referenced by sourceIds elsewhere"),
  title: str("Page or document title"),
  url: str("Full URL"),
  publisher: str("Publisher or site name").optional(),
  date: str("Publication date, YYYY-MM-DD or YYYY-MM").optional(),
  type: z.enum(["official", "filing", "news", "database", "review", "social", "blog", "report", "other"]).default("other"),
  reliability: Confidence.default("medium").describe("How much to trust it: official/filings high, reputable news high/medium, social low"),
  note: str("What this source was used for").optional(),
});

export const MetricSchema = z.object({
  label: str("Metric name, e.g. 'Revenue (FY2025)'"),
  value: str("Formatted value, e.g. '$1.2B', '4,300', '38%'"),
  change: str("Formatted change vs prior period, e.g. '+18% YoY'").optional(),
  trend: Trend.optional(),
  note: str("Short qualifier, e.g. 'estimate', 'company reported'").optional(),
  sourceIds,
});

export const TimelineItemSchema = z.object({
  date: str("YYYY-MM-DD or YYYY-MM"),
  title: str("Short headline"),
  description: str("1-2 sentence detail").optional(),
  category: z.enum(["funding", "leadership", "product", "ma", "legal", "financial", "hiring", "layoffs", "partnership", "expansion", "regulatory", "other"]).default("other"),
  impact: z.enum(["positive", "negative", "neutral"]).default("neutral"),
  relevance: Confidence.default("medium").describe("Relevance to the user's purpose"),
  sourceIds,
});

export const SeriesSchema = z.object({
  name: str("Series name, e.g. 'Revenue', 'Headcount', 'ARR'"),
  unit: str("Unit, e.g. 'USD', 'people', '%'").optional(),
  currency: str("ISO currency if monetary").optional(),
  points: z.array(z.object({
    period: str("Label such as '2023', 'FY24', 'Q2 2025'"),
    value: z.number(),
    estimate: z.boolean().default(false).describe("True if estimated rather than reported"),
  })).min(1),
  sourceIds,
});

export const FundingRoundSchema = z.object({
  date: str("YYYY-MM or YYYY-MM-DD"),
  round: str("Round name, e.g. 'Series B', 'IPO', 'Debt'"),
  amount: str("Formatted amount, e.g. '$45M'"),
  investors: strList("Lead and notable investors").optional(),
  valuation: str("Post-money valuation if known").optional(),
  sourceIds,
});

export const TableSchema = z.object({
  title: str("Table title"),
  columns: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())),
  note: str("Footnote").optional(),
  sourceIds,
});

export const PersonSchema = z.object({
  name: str("Full name"),
  title: str("Current title"),
  role: z.enum(["ceo", "founder", "executive", "board", "investor", "manager", "other"]).default("executive"),
  since: str("In role since, if known").optional(),
  background: str("One-line background").optional(),
  relevance: str("Why this person matters for the user's purpose").optional(),
  linkedin: str("LinkedIn URL if found").optional(),
  sourceIds,
});

export const CompetitorSchema = z.object({
  name: str("Competitor name"),
  relationship: z.enum(["direct", "indirect", "adjacent", "incumbent"]).default("direct"),
  description: str("What they do, one line").optional(),
  strengths: str("Where they are stronger").optional(),
  weaknesses: str("Where they are weaker").optional(),
  note: str("Angle for the user").optional(),
  sourceIds,
});

export const RiskSchema = z.object({
  title: str("Risk headline"),
  description: str("What could go wrong and why it matters to the user"),
  severity: Confidence.default("medium").describe("Impact if it happens"),
  likelihood: Confidence.default("medium"),
  category: str("e.g. financial, legal, market, execution, reputational").optional(),
  sourceIds,
});

export const SectionItemSchema = z.object({
  title: str("Item title or question"),
  body: str("Item body, answer or detail. Plain text; short paragraphs allowed."),
  tag: str("Short tag shown as a chip, e.g. a persona, a category, a date").optional(),
  badge: z.enum(["high", "medium", "low", "positive", "negative", "neutral"]).optional().describe("Optional emphasis badge"),
  copyable: z.boolean().default(false).describe("True for text the user will want to copy, like an outreach opener"),
  sourceIds,
});

export const PurposeSectionSchema = z.object({
  id: str("Stable id from the research brief, e.g. 'triggers', 'stakeholders', 'bull-bear'"),
  title: str("Section heading"),
  kind: z.enum(["cards", "list", "steps", "qa", "table", "two-column", "scorecard", "text"]).describe("How to render: cards (grid), list (bulleted rich items), steps (numbered), qa (question/answer), table (use columns/rows), two-column (left/right lists, e.g. bull vs bear), scorecard (items with badge as score), text (intro only)"),
  intro: str("One or two sentence lead-in").optional(),
  items: z.array(SectionItemSchema).optional(),
  columns: z.array(z.string()).optional().describe("For kind=table"),
  rows: z.array(z.array(z.string())).optional().describe("For kind=table"),
  left: z.object({ title: z.string(), items: z.array(z.string()) }).optional().describe("For kind=two-column"),
  right: z.object({ title: z.string(), items: z.array(z.string()) }).optional().describe("For kind=two-column"),
});

export const ReportSchema = z.object({
  company: z.object({
    name: str("Company name as commonly known"),
    legalName: str("Registered legal name if different").optional(),
    website: str("Primary website URL").optional(),
    tagline: str("One-line description of what the company does"),
    description: str("2-4 sentence neutral description"),
    hq: str("Headquarters city, country").optional(),
    founded: str("Founding year").optional(),
    industry: str("Primary industry").optional(),
    ownership: z.enum(["public", "private", "subsidiary", "nonprofit", "government", "unknown"]).default("unknown"),
    ticker: str("Ticker symbol if public, e.g. 'NASDAQ: ACME'").optional(),
    stage: str("Funding stage for private companies, e.g. 'Series C'").optional(),
    employees: str("Headcount, formatted, e.g. '~2,400'").optional(),
    revenue: str("Latest annual revenue, formatted, with period, e.g. '$310M (FY2025)'").optional(),
    valuation: str("Latest valuation or market cap, formatted").optional(),
    ceo: str("CEO name").optional(),
  }),
  meta: z.object({
    purpose: PurposeKeySchema,
    purposeLabel: str("Human label for the purpose, e.g. 'Sales research for Acme'"),
    profileId: str("Profile id used").optional(),
    researchedAt: str("ISO date of the research"),
    depth: DepthSchema.default("deep"),
    overallConfidence: Confidence.describe("Overall confidence in the report"),
    confidenceNote: str("What limits confidence, e.g. 'private company, revenue estimated'").optional(),
    searchesRun: z.number().int().optional().describe("Approximate number of searches and page reads performed"),
  }),
  summary: z.object({
    headline: str("One sentence verdict tailored to the purpose"),
    bullets: z.array(z.string()).min(3).max(7).describe("Key findings, each one sentence with the most important facts"),
    whyItMatters: z.array(z.string()).min(1).max(6).describe("Implications for the user's specific purpose"),
    recommendation: str("Recommended next action for the user").optional(),
  }),
  fit: z.object({
    score: z.number().min(0).max(100).describe("0-100 fit against the user's criteria"),
    label: str("Short verdict, e.g. 'Strong fit', 'Proceed with caution'"),
    rationale: str("Why this score"),
    criteria: z.array(z.object({
      name: str("Criterion name"),
      score: z.number().min(0).max(100),
      assessment: str("One-line assessment"),
      sourceIds,
    })).min(1),
  }).optional().describe("Fit scorecard against the profile's criteria. Include whenever a profile exists."),
  metrics: z.array(MetricSchema).max(10).optional().describe("Key metric tiles, 4-8 ideally"),
  timeline: z.array(TimelineItemSchema).optional().describe("Dated signals and events within the news horizon, newest first"),
  financials: z.object({
    summary: str("Short narrative on financial health and trajectory").optional(),
    series: z.array(SeriesSchema).optional().describe("Numeric series to chart, e.g. revenue by year, headcount by year"),
    funding: z.array(FundingRoundSchema).optional(),
    tables: z.array(TableSchema).optional(),
  }).optional(),
  people: z.array(PersonSchema).optional(),
  products: z.array(z.object({
    name: z.string(),
    description: z.string(),
    category: z.string().optional(),
    pricing: z.string().optional(),
    customers: z.string().optional().describe("Notable customers or segments"),
    sourceIds,
  })).optional(),
  market: z.object({
    description: str("Market the company competes in").optional(),
    size: str("Market size with year and source").optional(),
    growth: str("Market growth rate").optional(),
    positioning: str("How the company is positioned").optional(),
    trends: strList("Relevant market trends").optional(),
    sourceIds,
  }).optional(),
  competitors: z.array(CompetitorSchema).optional(),
  swot: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    opportunities: z.array(z.string()),
    threats: z.array(z.string()),
  }).optional(),
  risks: z.array(RiskSchema).optional(),
  sentiment: z.object({
    overall: z.enum(["positive", "mixed", "negative"]).optional(),
    themes: z.array(z.object({
      theme: z.string(),
      sentiment: z.enum(["positive", "negative", "mixed"]),
      evidence: str("What people say, paraphrased"),
      sourceIds,
    })).optional(),
    ratings: z.array(z.object({
      source: str("e.g. Glassdoor, G2, Trustpilot, App Store"),
      score: z.number(),
      scale: z.number().default(5),
      count: z.number().int().optional(),
      sourceIds,
    })).optional(),
  }).optional(),
  techStack: strList("Known technologies, tools or vendors in use").optional(),
  purposeSections: z.array(PurposeSectionSchema).describe("Purpose-specific analysis sections, as prescribed by research_brief"),
  openQuestions: strList("Things that could not be verified or need a human check").optional(),
  followUps: z.array(z.object({
    label: str("Button label, 2-6 words"),
    prompt: str("The message to send to the assistant when clicked"),
  })).max(6).optional().describe("Suggested next steps the user can trigger with one click"),
  sources: z.array(SourceSchema).min(1),
});
export type Report = z.infer<typeof ReportSchema>;
export type ReportInput = z.input<typeof ReportSchema>;

export const ReportSummarySchema = z.object({
  id: z.string(),
  company: z.string(),
  purpose: PurposeKeySchema,
  purposeLabel: z.string(),
  headline: z.string(),
  fitScore: z.number().optional(),
  researchedAt: z.string(),
  savedAt: z.string(),
});
export type ReportSummary = z.infer<typeof ReportSummarySchema>;
