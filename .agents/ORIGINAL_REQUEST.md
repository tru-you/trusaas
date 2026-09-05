# Original User Request

## Initial Request — 2026-09-02T11:39:12Z

Audit the TruSaaS dealer management suite for small, high-return improvements. The product is already winning competitive deals against South Africa's largest provider — it works well. The goal is *subtle refinement and polish*, not structural changes. Produce a prioritised punch-list of concrete, shippable improvements across UX, performance, code quality, and missing micro-features.

Working directory: c:\Users\pgdeb\dev\TruSaaS\TruDealerMaster\trudata
Integrity mode: development

## Requirements

### R1. Codebase Audit — Five App Surfaces

Audit each of these five surfaces for small improvements:

1. **TruLens** (`trusaas-lens/` / `TruLens/`) — PWA photo studio for vehicle photography
2. **TruInspect** (`truinspect/`) — Vehicle condition reports and desktop manager
3. **TruFlow Premium** (`truflow-premium/`) — Full dealer management system (desktop)
4. **TruFlow Mobile** (`truflow-mobile/`) — Companion mobile app
5. **CDN Widgets** (`packages/standalone/`) — 8 embeddable widgets (afford, book, chat, concierge, form, loader, repay, share) plus their WordPress plugin (`packages/truwidgets-wp/`)

For each surface, look across these categories:
- **UX polish**: micro-interactions, loading states, empty states, error messages, visual consistency, mobile responsiveness, form validation feedback, transition smoothness
- **Performance**: bundle size opportunities, unnecessary re-renders, slow API calls, missing caching, image optimisation gaps
- **Code quality**: dead code, duplicated logic, error handling gaps, missing input validations, console.log leftovers, hardcoded values that should be configurable
- **Missing micro-features**: things a dealer or prospect would notice — better defaults, helpful tooltips, keyboard shortcuts, copy-to-clipboard, undo support, smart autofill
- **Widget embed experience**: how easy it is for dealers to install, configure, and troubleshoot widgets on their sites

### R2. Prioritised Punch-List Output

Produce a single consolidated report with every finding. Each finding must include:
- **App** — which surface it applies to
- **Category** — UX / Performance / Code Quality / Micro-feature / Widget DX
- **File(s)** — exact file path(s) and line number(s)
- **Description** — what the issue is, with evidence (e.g., "empty state shows raw 'undefined'", "this 400-line component has 3 identical fetch blocks")
- **Suggested fix** — concrete, specific description of what to change (not just "improve this")
- **Effort** — S (< 30 min), M (1-3 hours), L (half-day+)
- **Impact** — High / Medium / Low (from the dealer's or prospect's perspective)

Rank findings by impact-to-effort ratio (high-impact, low-effort first).

### R3. Constraints

- Do NOT propose architectural rewrites, framework migrations, or major refactors
- Do NOT propose changes that would break existing API contracts or data formats
- Every suggestion must be a contained change that can be shipped independently
- Focus on what a *dealer using the product daily* would notice, not abstract code purity

## Acceptance Criteria

### Coverage
- [ ] Every one of the 5 app surfaces has at least 3 findings
- [ ] At least 2 of the 5 audit categories (UX, Performance, Code Quality, Micro-feature, Widget DX) are represented per app surface
- [ ] At least 5 findings across the suite are rated S-effort + High-impact (quick wins)

### Quality of Findings
- [ ] Every finding includes an exact file path and line number reference
- [ ] Every finding includes a concrete suggested fix (not vague advice like "improve error handling")
- [ ] No finding proposes an architectural rewrite or framework migration
- [ ] Every finding can be understood and acted on by a developer without further clarification

### Report Structure
- [ ] Findings are sorted by impact-to-effort ratio (best quick wins first)
- [ ] Report includes a summary table at the top with counts per app × category
- [ ] Report includes a "Top 10 Quick Wins" section highlighting the highest-value, lowest-effort changes
