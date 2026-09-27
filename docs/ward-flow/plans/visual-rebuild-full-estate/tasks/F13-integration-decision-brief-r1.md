# F13 integration decision brief (r1)

## Ward Answer

**Existing implementation and route.** The authoritative drawing is `docs/ward-flow/mockups/ward-answer-third-edition.html` (title at line 1; primary panels around lines 4782–4808). This is already implemented by `src/components/ward-management/ward/ward-screen.tsx`, routed at `src/app/mockups/ward-flow/ward/[unitId]/page.tsx`; the route resolves its unit from `ward-sites.ts` and renders `<WardScreen unitId=...>`. The build contract confirms the route is reachable through `ward-role-switcher.tsx:195` and that the implementation is live reducer-backed.

**Behaviour already implemented.** The current screen owns the real engine path: accept in principle (`ACCEPT_IN_PRINCIPLE`), closed-list decline/reason recording (`DECLINE` and `DECLINE_REASONS`), bed confirmation (`CONFIRM_CAPACITY`), eligibility/refusal wording from `stageCopy`, and additional bed-release, pull, override, suburb/team surfaces. These behaviours must be preserved. The drawing's Recent answers list is invented and has no confirmed equivalent data source; New referral is explicitly marked unwired in the drawing. Do not fabricate either capability. Existing contract: `docs/ward-flow/build-contracts-2026-09-12/contract-ward-answer.md`.

**Recommended strategy.** Treat F13 as a visual migration of the existing parameterized ward route. Keep `/mockups/ward-flow/ward/[unitId]` and the shared layout chrome. Reconcile the drawing's Ward answer presentation onto `WardScreen` while retaining the engine's richer controls and documenting each deliberate visual/data deviation. The route's unit parameter and fixture-backed metadata are dependencies.

**DOD.** Applies: it is a real route and screen. Require route reachability, retained behaviour, disclosure, served drawing comparison at 390/820/1440 in both themes, verification JSON/hash, focused ward tests, and the required typecheck. No claim of completion exists from this brief.

## Ward Flow Digest

**Status.** `docs/ward-flow/mockups/ward-flow-digest.html` is a governance/design digest, not a Ward Flow product screen. It identifies itself as “Ward Flow Digest” (title line 1, h1 line 591), contains standards, findings, adoption guidance, a screens index (sections around lines 1750, 2236, 2302), and explicitly says near its end that it is not itself a mockup built to the standard (around line 2492). There is no corresponding `Digest` component or `/mockups/ward-flow/digest` route in the current route tree.

**Recommended strategy.** Keep Digest as documentation-only. Do not add a product route, invent live data/actions, or treat its sections as a second screen contract. Its screen index can inform the existing per-screen build contracts and DOD process.

**DOD.** Screen DOD does not apply to Digest. Documentation freshness/links may be checked under the normal docs workflow; no visual screen verification entry should be created unless the owner explicitly reclassifies it as a product screen.

## Dependencies and limits

Ward Answer depends on the existing Ward Flow provider/reducer, `ward-screen.tsx` derivations and events, unit route parameter, shared Ward rail/bar, and the Ward Answer drawing hash in `mockups/MANIFEST.json`. This is a source/contract decision only; no tests, server, browser, provider, or production/auth work was performed.

## F13 correction: Ward overview is a separate commissioned screen

The owner has commissioned both ward-third-edition.html (the individual ward overview) and ward-answer-third-edition.html (the ward's answer workflow). The current route /mockups/ward-flow/ward/[unitId] renders one combined WardScreen (src/components/ward-management/ward/ward-screen.tsx): its current markup includes overview facts/figures, attention/coming-in/beds-on-the-way-out, “Awaiting your answer”, Today's return, bed lifecycle, record, and “Where to refer” mutations. Therefore the prior statement that the route is simply the Ward Answer screen was too broad; it is historical mapping to a combined component, not proof that both drawings are separately implemented.

Recommended distinct routing: keep /mockups/ward-flow/ward/[unitId] as the Ward overview route. Add a reachable sibling such as /mockups/ward-flow/ward/[unitId]/answer for the Ward Answer drawing, using the same provider/reducer and shared derivation/action functions. Extract or parameterize presentation around the existing engine; do not copy reducer/state/action logic. The Wards index already links to the overview route (src/components/ward-management/wards/ward-index.tsx, per-ward href around lines 250–253). Add an explicit Answer link from the overview or its existing ward navigation so the new route is reachable. Both routes require separate drawing-hash records and separate DOD visual checks.

F02 ownership/dependencies. The next Ward/Wards/ED worker should own only:

- Ward overview/answer seam: src/components/ward-management/ward/ward-screen.tsx, ward.module.css, and the dynamic route under src/app/mockups/ward-flow/ward/[unitId]/.
- Wards index: src/components/ward-management/wards/ward-index.tsx, ward-index.module.css, and src/app/mockups/ward-flow/wards/page.tsx.
- ED screen: src/components/ward-management/ed/ed-screen.tsx, ed.module.css, and src/app/mockups/ward-flow/ed/[edId]/page.tsx; the ED index/home (ed-home.tsx, ed-home-derivations.ts) is a separate network surface and should not be silently folded into the individual ED route.

Shared dependencies are the Ward Flow provider/reducer, ward-sites.ts, ward-model.ts, ward-derivations.ts, bed designation/availability and eligibility modules, shared WardPanel/WardTable/WardChip primitives, and the layout-mounted WardRail/WardBar. Preserve reducer events and existing dynamic identifiers. The three screens have distinct questions and should not share a copied render tree.

This correction is source/contract planning only; no tests, server, browser, or source edits were performed.
