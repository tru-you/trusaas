# TruSaaS Dealer Management Suite Audit Plan

## Objective
Audit the 5 app surfaces of the TruSaaS suite for high-return, small, concrete, and shippable improvements across UX polish, performance, code quality, missing micro-features, and widget embed experience. Produce `audit_report.md`.

## Surfaces
1. **TruLens** (`trusaas-lens/` / `TruLens/`) — PWA photo studio
2. **TruInspect** (`truinspect/`) — Vehicle condition reports and desktop manager
3. **TruFlow Premium** (`truflow-premium/`) — Full DMS (desktop)
4. **TruFlow Mobile** (`truflow-mobile/`) — Mobile companion app
5. **CDN Widgets & WP Plugin** (`packages/standalone/` + `packages/truwidgets-wp/`)

## Execution Steps
1. **Phase 1: Dispatch Specialized Explorers (Parallel)**
   - Explorer 1: TruLens audit
   - Explorer 2: TruInspect audit
   - Explorer 3: TruFlow Premium audit
   - Explorer 4: TruFlow Mobile audit
   - Explorer 5: CDN Widgets & WordPress Plugin audit
2. **Phase 2: Result Aggregation & Verification**
   - Collect explorer reports.
   - Verify every finding has exact file paths, line numbers, concrete suggested fixes, effort rating (S/M/L), and impact rating (High/Medium/Low).
   - Ensure coverage criteria are met:
     * >=3 findings per surface
     * >=2 categories represented per surface
     * >=5 S-effort + High-impact quick wins across the suite
     * No architectural rewrites or breaking API changes.
3. **Phase 3: Synthesis & Report Generation**
   - Synthesize all findings into `audit_report.md` with:
     * Executive Summary & category × app matrix table
     * "Top 10 Quick Wins" section (highest value, lowest effort)
     * Consolidated findings list sorted by impact-to-effort ratio
4. **Phase 4: Final Verification & Notification**
   - Verify report completeness and send completion message to parent.
