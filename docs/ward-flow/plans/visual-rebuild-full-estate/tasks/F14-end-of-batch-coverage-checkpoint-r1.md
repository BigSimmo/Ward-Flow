# F14 end-of-batch coverage checkpoint r1

Date: 2026-09-13  
Reviewer: `/root/hub_inventory`  
Mode: bounded source and ledger audit only

## Coverage result

The current roster has **34 operational drawings and 2 reference drawings**. Direct inspection of the route tree found a real route file and mounted screen implementation for every operational row in `scripts/ward-flow/screen-pairs.mjs`; no commissioned operational drawing is absent from source.

The 34 operational routes divide into:

- **22 drawing routes reached directly from the 23-entry Ward registry.** The extra registry destination is `/community`, the undrawn but intentional index that leads to individual community-team screens.
- **12 drawing routes reached inside the product rather than directly from the rail:** community team from the Community index; Patient Now and Add a patient from search; Statistics overview, compare, ward, community, ED and service routes from the Statistics hub/choosers and existing record links; Settings and Sign in from Tools; Ward Answer from the ward overview.

All registry entries continue to use their source hrefs. The latest rail groups the 11 drawing-core destinations in the reference order, promotes an active extra destination, keeps remaining destinations in More pages while open, and retains all 23 in the closed desktop rail. This audit found no source-level route loss in that partition.

## F13 source trace

### Ward Answer

- `src/app/mockups/ward-flow/ward/[unitId]/answer/page.tsx` is a distinct dynamic route and renders the existing reducer-backed `WardScreen` with `presentation="answer"`.
- `ward-screen.tsx` links from the overview to `/ward/${unit.id}/answer`; Answer links back to the overview and labels the selected ward.
- Answer mode retains the existing incoming movement arrays, eligibility/restriction checks, decline reasons and reducer actions. Its presentation isolates the bed-request list and adds previous/next traversal without copying engine state or action logic.
- `ward-place.ts`, `ward-nav.ts` and the shared bar contain the corresponding Answer route context/title/action mapping.

This establishes distinct source and reachability, not rendered parity. `/ward/[unitId]/answer` remains one of the 19 routes with no visual-verification record.

### Ward Flow Digest

- `src/app/mockups/ward-flow-digest/route.ts` implements a fixed `GET` that reads the single authoritative `docs/ward-flow/mockups/ward-flow-digest.html` file and returns it as UTF-8 HTML. It introduces no second document, dynamic file selector, engine state or clinical behavior.
- `ward-bar.tsx` links to that fixed document from the Tools section using native navigation and labels it as a design reference.
- The route is deliberately a reference (`contract: false`), separate from the 34 operational screen records. `design-system-third-edition.html` is the other reference and intentionally has no route.
- Production remains guarded: `/mockups/ward-flow-digest` starts with `/mockups`, does not match the exact-or-slash developer-gated `/mockups/ward-flow` prefix because the next character is `-`, and therefore reaches `shouldBlockProductionMockups`, which returns a 404 in normal production. The document route is locally reachable by design; this audit makes no production-availability claim.

The Digest's local served check remains pending in the ledger. Source presence alone does not prove the filesystem document is included and readable in every packaged runtime.

## Evidence still open

`screen-verification.json` currently contains **15 recorded and 19 null** operational rows. Every recorded verdict is `deviates`; these are partial agent observations, not full DOD or human acceptance. The null routes are:

`/movements`, `/ward/[unitId]`, `/wards`, `/ed/[edId]`, `/search`, `/people/[patientId]`, `/referrals/new`, `/statistics/ward/[unitId]`, `/statistics/community/[teamId]`, `/network`, `/governance`, `/handover`, `/discharges`, `/out-of-area`, `/people/new`, `/referrals`, `/statistics`, `/statistics/service/[serviceId]`, and `/ward/[unitId]/answer`.

The following remain evidence gaps, not newly discovered missing implementations:

- Shared shell six-cell integration and representative focus, drawer, search, closed-rail, overflow and persistence journeys remain in controller work. The latest Tasks drawer correction is source-only until recaptured.
- The latest page corrections still need their fresh matrices, below-fold checks, meaningful journeys, print/forced-color coverage where required, and human acceptance.
- The latest focused test corrections and the final consolidated Ward/typecheck gates do not have a succeeding post-correction verdict in the current ledger.
- The ED Statistics r15 review records one open P2: the shared shell title truncates more aggressively than the drawing at 1440 and 820. That is already in active controller/shared-shell work and is not an unowned screen implementation gap.

## Actionable bookkeeping gap

The `PROGRESS.md` resume text still says 12 of 34 screens have recorded looking, while the current verification JSON contains 15. Root should refresh that sentence from the authoritative JSON during F14 consolidation; the page-state table itself correctly avoids calling the estate complete.

No product source, tests, browser, server, provider, or Git operations were performed. This checkpoint does not claim visual completion, passing gates, production availability, or human acceptance.
