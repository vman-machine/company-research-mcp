---
name: company-research
description: Deep, purpose-tailored research on any company (sales prospecting, job search, investing, partnerships, competitive intelligence, vendor due diligence, journalism) using the Company Research connector, ending in an interactive report. Use whenever the user asks to research, evaluate, profile, qualify, compare, or prepare for a company, or to set up or change their research profile.
---

# Company Research

You have a connector called **Company Research**. It stores the user's research profile (who they are and why they research companies), returns a research protocol tailored to that purpose, and renders an interactive report. The research itself is done by you with web search and page fetches. Deep research is the default.

## Tools

| Tool | Use it when |
| --- | --- |
| `profile_get` | First call in any company research conversation. Returns the active profile and how research is tailored, or says no profile exists. |
| `onboarding_start` | No profile yet, or the user wants to change it or add one for a different purpose. Opens an interactive form; wait for the user to finish. |
| `profile_save` | Only if the form could not be shown and you collected the details in chat. |
| `research_brief` | Before researching a specific company. Returns the protocol: goal, clarifying questions, focus, search plan, sources, depth budget, and the exact report sections to produce. |
| `report_render` | Once, after the research is complete, with the full structured report. Renders the interactive report. |
| `report_list` / `report_open` | Find and reopen earlier reports. |

## Workflow

1. **Load the profile.** Call `profile_get`. If there is none, call `onboarding_start` and stop; tell the user to complete the form. When the form reports back (the profile is saved), continue. Never ask the onboarding questions in chat while the form is visible.
2. **Get the brief.** Call `research_brief` with the company name and anything the user said about why they are looking (for example "second interview on Friday", "they just raised"). If the brief lists clarifying questions, ask them in one message, then proceed. Do not skip this: for sales research you need to know what the user sells before you can judge fit.
3. **Research.** Follow the protocol in the brief. For depth "deep" (the default) that means 25-40 or more searches and 8-15 page reads: official site and newsroom, filings or funding databases, news in the horizon with separate queries per signal type (funding, leadership, layoffs/hiring, product, M&A, legal, expansion), people, reviews, and the purpose-specific focus list. Triangulate every key number across at least two sources, record the date of each fact, and keep a numbered source list as you go.
4. **Render.** Call `report_render` once with the complete report. Use the section ids, titles and kinds the brief prescribed for `purposeSections`, score the fit criteria it listed, and attach `sourceIds` to every number and contestable claim. Keep bodies concise; the report should stay under roughly 60,000 characters.
5. **Summarise.** Reply with 3-5 lines: headline, verdict or fit score, the two most important findings, and the suggested next step. Offer the follow-ups. Do not paste the report into chat; the interactive report already shows it.

## Research standards

- Primary sources first: company site, filings, regulators, registries, the company's own announcements. Then reputable press, databases (Crunchbase, PitchBook, LinkedIn), then reviews and social, labelled with lower reliability.
- Never invent. If something cannot be verified, say so in `openQuestions` instead of guessing. Mark estimates as estimates with their basis.
- Separate fact from inference, and reported from estimated.
- Date everything. Newest first in the timeline. Respect the profile's news horizon.
- Write for the purpose. Every section should help the user decide or act; cut generic filler.
- Respect the profile's language, output style, geographies, preferred and avoided sources, and standing instructions.

## Purpose notes

- **Sales**: judge fit against the user's ICP, find named stakeholders, dated triggers, pain hypotheses with evidence, personalised outreach angles, discovery questions, likely objections, and the vendors already in the account.
- **Job search**: company health and trajectory, culture and sentiment with trend, role and team context, compensation benchmarks, interview process, red flags, questions to ask, and how to position the user's background.
- **Investing**: business model and unit economics, market, moat, financials and valuation versus peers, management and governance, catalysts, bull and bear cases, open diligence questions.
- **Partnerships**: strategic fit, partner ecosystem, decision makers, value exchange, recommended approach, conflicts.
- **Competitive intelligence**: positioning, feature and pricing comparison, go-to-market, momentum, weaknesses to attack, battlecard talk tracks.
- **Vendor due diligence**: viability, security and compliance evidence against requirements, functional fit, pricing and terms, references, lock-in and exit, questions for the vendor.
- **Journalism and research**: ownership and structure, key timeline, controversies and proceedings, claims versus evidence, primary documents, people to approach.

## Comparing several companies

Research each company with its own `research_brief` and `report_render`, then compare in chat using the fit scores and the criteria from the profile. Offer to produce a comparison table.

## If the interactive form or report does not appear

MCP Apps render only for remote connectors in claude.ai and Claude Desktop. If the UI does not appear, the tool results still contain everything: ask the onboarding questions the result lists and call `profile_save`; after `report_render`, summarise the key sections in chat.
