# The app frame, shared code, and PsychSift at module level

Read-only map, written 25 September 2026 against tip `ace8e9ee8d` on branch
`ward/extend-ward-flow-code-map` (`D:/Worktrees/Database/ward-code-map`). This part covers two
things only: (1) every file outside `src/components/ward-management/**` and
`src/app/mockups/ward-flow*/**` that Ward Flow code imports, file by file, plus the request/frame
path that gets Ward Flow onto the screen; and (2) the rest of PsychSift, at module level only (folder
and file counts, no per-file detail) — module level because a separate cleanup thread is retiring
PsychSift from this branch, and that thread's own tracer results are the right source for anything
deeper. Nothing was run except read-only `grep`, `git ls-files` and `wc -l`. File counts are
`git ls-files <pattern> | wc -l`; line counts are `wc -l` on the file itself. Import targets were
found by grepping every `import`/`export … from` line in the two Ward folders, then classifying each
target as inside or outside those folders (a small number of `../ward-*` and `./*` relative imports
all resolved to files still inside one of the two Ward folders and are not counted as "outside").
Back to [the code map index](README.md).

---

## 1. Shared code Ward Flow loads

### 1.1 Files outside Ward Flow that Ward Flow code imports

261 import lines across the two Ward folders name a target outside them. Excluding the five bare npm
packages (below), that resolves to eleven distinct project files. Ordered by number of importing Ward
files.

- **`src/components/ui-primitives.tsx`** (5 lines) — a barrel: `export * from` four files under
  `src/components/primitive-recipes/` (`recipes.ts` 137, `composer.ts` 42, `clinical.tsx` 171,
  `feedback.tsx` 410) plus `MetroPulseCircle` from `src/components/ui/metro-pulse-circle.tsx` (82).
  Imported by 14 Ward files for shared control recipes (`cn`, `toolbarButton`, buttons, badges) —
  e.g. `ward-management/ward/ward-screen.tsx`, `ward-management/ed/ed-screen.tsx`,
  `ward-management/ward-role-switcher.tsx`. One of the four re-exported files, `clinical.tsx`,
  itself imports `@/lib/source-authority-registry` (497 lines) and `@/lib/types` (1,187 lines) —
  PsychSift's clinical-citation classification code. Because the barrel is `export *`, every Ward
  file that imports anything from `ui-primitives` pulls that module graph into its dependency tree,
  whether or not the Ward file ever renders a clinical-citation element.
- **`src/lib/client-store-factory.ts`** (32 lines) — `createBrowserStore`, an SSR-safe store built
  on React's `useSyncExternalStore`. Imported by 7 Ward files: `shell/ward-bar.tsx`,
  `shell/ward-rail.tsx`, `shell/ward-service-store.ts`, `use-ward-sidebar-collapsed.ts`,
  `hub/hub-browser-memory.ts`, `community/community-index.tsx`, `referrals/referral-match.tsx`. No
  outside imports of its own beyond `react`.
- **`src/lib/form-register.ts`** (170 lines) — the canonical Mental Health Act form titles/codes
  table. Imported by 4 files: `ward-legal-forms.ts`, `referrals/ward-referral-drawer.tsx`,
  `search/patient-search.tsx`, `search/record-preview.tsx`. Itself imports
  `@/lib/form-ranker` (203 lines, a `FormAvailability` type) — part of PsychSift's own on-call/forms
  surface.
- **`src/components/ui/sheet.tsx`** (588 lines) — the shared slide-in drawer/dialog primitive.
  Imported by 4 files: `movements/movement-drawer.tsx`, `shell/ward-bar.tsx`, `shell/ward-rail.tsx`,
  and the retired `ward-management-navigation.tsx`. Imports `@/components/ui/overlay-root` (167
  lines) and `@/components/ui-primitives` (above).
- **`src/components/ui/missing-value.tsx`** (83 lines) — renders an empty-value placeholder.
  Imported by 2 files: `discharges/discharge-board.tsx`, `ward-management-console.tsx`. Imports
  `@/components/ui-primitives` and `@/components/ui/design-system-diagnostics` (30 lines).
- **`src/components/contextual-back-link.tsx`** (82 lines) — a back-navigation link that resolves
  its target from router history. Imported by 2 files: `patients/patient-now-screen.tsx`,
  `ward-management-console.tsx`. Imports only `next/link`, `next/navigation` and `react` types — no
  PsychSift-specific dependency.
- **`src/components/clinical-dashboard/brand.tsx`** (87 lines) — the PsychSift brand-mark SVG.
  Imported by 2 files, and both are the retired chrome the overview map already names as unmounted:
  `ward-management-navigation.tsx` and `ward-sidebar-content.tsx`. Imports
  `@/components/ui-primitives` and `@/lib/brand-mark` (189 lines). No currently-mounted Ward screen
  reaches this file.
- **`src/components/ui/tooltip.tsx`** (198 lines) — the shared tooltip primitive. Imported once, by
  `shell/ward-rail.tsx` (rail tooltips). Imports `@/components/ui/overlay-root` and
  `@/components/ui-primitives`.
- **`src/components/ui/sheet-focus.ts`** (345 lines) — dialog focus-trap/return-focus utility.
  Imported once, by `ward-modal-focus.ts`. No outside project imports of its own.
- **`src/components/developer-area/ward-flow-access-gate.tsx`** — the developer-cookie access gate,
  with its route guard, key screen and `lib/developer-area/link-access*.ts`: removed 28 September 2026 at Josh's request; Ward Flow now opens with no developer key.
- **`src/components/ward-flow-sign-in/ward-flow-sign-in-screen.tsx`** (535 lines) — the sign-in
  mockup screen. This is a sibling of `ward-flow/`, not a child of it (see the prefix note at
  `src/lib/developer-area/headers.ts:40-46`), so it never gets the rail, the provider, or any Ward
  chrome. Imported once, by `src/app/mockups/ward-flow-sign-in/page.tsx`. Imports `react`,
  `lucide-react`, `@/components/clinical-dashboard/use-theme.ts` (158 lines) and `@/lib/theme.ts`
  (71 lines) — theming code shared with the rest of PsychSift, nothing Ward-specific.

**npm packages** (the only bare-specifier import targets found in 261 outside-import lines): `react`
19.2.8 (85 imports), `next` ^16.3.3 (37 bare `next` imports, all `import type { Metadata } from
"next"` in `page.tsx` files — type-only, no runtime code — plus 49 `next/link` and 22
`next/navigation`), `lucide-react` ^1.34.0 (27 imports). No other npm package is imported anywhere in
`src/components/ward-management/**` or `src/app/mockups/ward-flow*/**` (package.json:347, 349,
356-357).

### 1.2 The request/frame path

- **`src/proxy.ts`** (383 lines) — imports `isWardFlowPath`, `WARD_FLOW_OFFLINE_HEADER` and friends
  from `@/lib/developer-area/headers` (lines 10-17). Strips any client-supplied copy of
  `x-ward-flow-offline` from every request unconditionally (line 192), then restores it only when
  `isWardFlowPath(pathname)` (lines 198-200) — so a client cannot spoof the header to skip Supabase
  auth on a non-Ward page. Returns immediately for a Ward Flow path, before the Supabase
  session-refresh logic runs, so Ward Flow never touches `@supabase/ssr` (lines 286-294, with the
  comment explaining why: Ward Flow must not inherit a Clinical KB session merely because the
  browser also holds an `sb-` cookie). `shouldBlockProductionMockups` (lines 350-373) 404s all of
  `/mockups/**` in production except the developer-gated prefixes from
  `isDeveloperGatedPath`/`DEVELOPER_GATED_PATH_PREFIXES` (`headers.ts`), which Ward Flow's two
  routes are members of.
- **`src/app/layout.tsx`** (183 lines) — imports `WARD_FLOW_OFFLINE_HEADER` (line 15); reads it into
  `isOfflineWardFlow` (line 117). When true: `authOrigin` is forced to `null` (line 122), skipping
  the Supabase preconnect/dns-prefetch `<link>` tags; and children render inside only
  `MobileKeyboardProvider`, with `AuthProvider`/`AccountDataProvider` omitted entirely (lines
  171-179) — this is the "Supabase auth providers are not mounted" branch the overview map names.
- **`src/app/mockups/layout.tsx`** (34 lines) — imports `mockupsEnabled` from `@/lib/env` and
  `DEVELOPER_AREA_HEADER` from `@/lib/developer-area/headers`. Calls `notFound()` unless mockups are
  enabled or the request carries the developer-gated header proxy.ts set (lines 28-31). Also imports
  `./mockups.css` and mounts `MockupsLayoutClient` (`mockups-layout-client.tsx`, 282 lines) around
  every route under `/mockups`, Ward Flow included.
- **`src/app/mockups/error.tsx`** (154 lines) — "THE MOCKUPS BOUNDARY", per its own doc comment.
  Added to close a gap Ward's own nearer boundary (`ward-flow/error.tsx`) documented but could not
  fix itself: Next.js's `error.tsx` never wraps the `layout.tsx` sitting beside it in the same route
  segment, so nothing placed anywhere inside `mockups/ward-flow/` could ever catch a throw out of
  `ward-flow/layout.tsx` itself (`DeveloperAreaGate`, `WardFlowProvider`, or the reducer's
  `useReducer` initialiser `seedWardFlowStateAt`). Sitting one segment further up, at `mockups/`,
  this file treats `ward-flow/layout.tsx` as a nested layout and does wrap it, so those three throws
  now land here instead of replacing the whole document via `src/app/error.tsx`. It still cannot
  catch a throw during `ward-movements.ts`'s module-scope evaluation (`export const wardMovements =
[...]`) — no error boundary anywhere in the tree can, because that runs before any render starts —
  and it does not wrap `mockups/layout.tsx` itself (the `mockupsEnabled()`/`headers()` gate above
  it), which still escapes to `src/app/error.tsx`. It is generic for every design-scratch route
  under `mockups/`, not Ward-specific, and deliberately does not reuse `WardFlowErrorPanel`: a test
  (`tests/ward-flow-seam.test.ts`, named in this file's own comment) forbids anything outside Ward
  Flow's own folders from importing its code.
- **`src/app/error.tsx`** (17 lines) — the application-shell boundary: `RouteErrorBoundary` with a
  generic "Something went wrong" panel. Catches a throw from `src/app/mockups/layout.tsx` or
  anything above the `mockups/` segment; everything below that segment now has a nearer boundary
  (`mockups/error.tsx` above, and Ward Flow's own `ward-flow/error.tsx` for 25 routes,
  `ward-flow/statistics/error.tsx` for the 5 statistics routes, `ward-flow/sovereign/error.tsx` for
  the showcase route).
- **`src/lib/developer-area/headers.ts`** (74 lines) — the constants shared between `proxy.ts` and
  every Server Component gate: `WARD_FLOW_OFFLINE_HEADER`, `WARD_FLOW_PATH_PREFIX` =
  `/mockups/ward-flow`, `isWardFlowPath()`, `DEVELOPER_GATED_PATH_PREFIXES` (lines 52-58: `
/mockups/development`, `/mockups/caring-contacts`, `/mockups/care-plan`, `/mockups/ward-flow`,
  `/mockups/ward-flow-sign-in` — the last two are separate entries, not one, because
  `/mockups/ward-flow-sign-in` is a sibling of `/mockups/ward-flow` and the prefix match is
  exact-or-following-slash, explained at lines 40-51), and `isDeveloperGatedPath()`.
  **`/mockups/ward-flow-digest` is not in this list.** Its `route.ts` reads
  `docs/ward-flow/mockups/ward-flow-digest.html` off disk with `node:fs/promises` and `node:path`
  and serves it verbatim — a genuine production route handler, not a mockup page — but because it is
  not developer-gated, `shouldBlockProductionMockups` 404s it in any real production deploy; it only
  serves in dev/test. No other file under `src/lib/developer-area/` (12 further files — `access.ts`,
  `clinical-answer-failures.ts`, `corpus-health.ts`, `freshness.ts`, `hub-panels.ts`,
  `ledger-snapshot.ts`, `link-access.ts`, `link-access-shared.ts`,
  `repo-awareness-snapshot(-counts).ts`, `repo-awareness-types.ts`, `environment-facts.ts`) is
  imported by Ward Flow code; they serve PsychSift's own developer/on-call tooling.
- **`src/lib/env.ts`** `mockupsEnabled()` (line 475) — `true` outside production; in production,
  `true` only if `NEXT_PUBLIC_MOCKUPS_ENABLED === "true"`. This is the one non-developer-gated way
  mockup routes (including a bare `/mockups/ward-flow` with no developer cookie) could become
  reachable in production, by that env flag.
- **`src/app/globals.css`** (5,505 lines) — imported once, at `src/app/layout.tsx:16`, so every Ward
  Flow page gets the whole sheet: the v2 design tokens Ward's own `ward-tokens.module.css` aliases
  (overview map §3.4), plus one token defined directly here rather than in any Ward file —
  `--spacing-ward-phone-bar: 3.5rem` (line 134, "Ward Flow's fixed phone navigation bar and the
  matching content reserve") — used by 5 Ward CSS modules (`escalation.module.css`,
  `tracker/live-tracker.module.css`, `ward-chrome-header.module.css`,
  `ward-management-modes.module.css`, `ward-sidebar.module.css`; two of the five belong to chrome
  the overview map records as retired or unreachable). Also carries `@source not "./mockups"` and
  `@source not "../components/**/*mockup*"` (lines 5-6), which exclude `src/app/mockups/**` and
  mockup-named component folders from Tailwind's utility scan for this sheet;
  `src/components/ward-management/` is not named `*mockup*`, so this specific exclusion never
  touched it, but its routes under `src/app/mockups/ward-flow*/` are excluded and need re-including
  (next bullet).
- **`src/app/mockups/mockups.css`** (62 lines) — re-includes the excluded utility vocabulary for
  every mockup route via `@source "../../components"` (line 10), which is what actually makes
  Tailwind utility classes written inside `src/components/ward-management/**` compile at all. Its
  own comment documents a real incident: 553 utilities were silently inert across the mockup tree
  before this file's `@source` lines were added, now guarded by
  `tests/mockup-utility-emission.test.ts`.
- **`next.config.ts`** — one Ward-relevant rule: the header block matching `source:
"/mockups/:path*"` (lines 131-132) adds `X-Robots-Tag: noindex, nofollow` to every mockup
  response, Ward Flow included. No other Ward-specific config.
- **`tsconfig.json`** — one path alias, `"@/*": ["./src/*"]`, which is how every
  `@/components/ward-management/...` and `@/lib/...` import in Ward Flow code resolves.
  `"exclude"` drops `docs/**` from the TypeScript project entirely (its own comment: "frozen evidence
  artefacts here intentionally reference removed/renamed symbols"), so nothing under
  `docs/ward-flow/` is type-checked by the main project.
- **`eslint.config.mjs`** — `MOCKUP_IGNORES` (line 35) = `["src/app/mockups/**", "**/*-mockups/**",
"**/*-mockups.tsx", "**/*-mockup.tsx"]`. This exempts `src/app/mockups/ward-flow/**` (matches the
  first glob) from four local rules: `require-lucide-icon-aria` (lines 59-66),
  `require-button-wiring` + `no-hardcoded-hex` (lines 73-81), `require-z-index-ladder` (lines
  90-97), and the mockup-import boundary rule (lines 103-120, `no-restricted-imports` forbidding
  production code from importing anything path-matched as mockup). `src/components/ward-management/`
  matches none of the four `MOCKUP_IGNORES` globs, so it is held to the same production lint rules
  as the rest of PsychSift — confirmed directly against the config text, matching the overview map's
  claim.

### 1.3 Load-bearing shared files

If PsychSift's own code were deleted from this branch, Ward Flow would not run without changes to
these:

- The whole frame chain in §1.2: `src/proxy.ts`, `src/app/layout.tsx`, `src/app/mockups/layout.tsx`
  (+ `mockups.css`, `mockups-layout-client.tsx`), `src/app/mockups/error.tsx`, `src/app/error.tsx`,
  `src/lib/developer-area/headers.ts`, `src/lib/env.ts` (`mockupsEnabled`), `src/app/globals.css`,
  `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`. Ward Flow has no request path independent
  of these; none of its 41 `page.tsx` routes (`git ls-files
'src/app/mockups/ward-flow/**/page.tsx' | wc -l`, this tip) render without them.
- **`src/components/ui-primitives.tsx`** and its five underlying files
  (`primitive-recipes/{recipes,composer,clinical,feedback}.ts(x)`, `ui/metro-pulse-circle.tsx`) — 14
  Ward files import from the barrel; deleting it breaks compilation across most of the screen
  folders.
- **`src/lib/client-store-factory.ts`** — the rail, service selector and sidebar-collapsed state all
  depend on it.
- **`src/components/developer-area/ward-flow-access-gate.tsx`** — removed 28 September 2026 at Josh's request; Ward Flow now opens with no developer key. The proxy still lets
  `/mockups/ward-flow` past the mockups-layout 404 through the developer-area header.
- **`src/components/ward-flow-sign-in/ward-flow-sign-in-screen.tsx`** — the sign-in route has
  nothing else to render.
- **The most surprising dependency:** `src/lib/source-authority-registry.ts` (497 lines) and
  `src/lib/types.ts` (1,187 lines) — PsychSift's clinical-citation classification code — are pulled
  in transitively through `primitive-recipes/clinical.tsx` inside the `ui-primitives` barrel.
  Nothing about either file looks Ward-related, and no Ward screen renders a clinical-citation
  badge, but a PsychSift retirement cleanup that deletes them breaks the barrel's `export *` — and
  therefore every one of the 14 Ward files that imports `cn` or any other `ui-primitives` export —
  unless the `clinical.tsx` re-export line is dropped from the barrel first.
- Lower-risk (single or double importer, easy to patch around if removed): `ui/sheet.tsx`,
  `ui/missing-value.tsx`, `contextual-back-link.tsx`, `clinical-dashboard/brand.tsx` (only reached by
  already-retired chrome), `ui/tooltip.tsx`, `ui/sheet-focus.ts`, `lib/form-register.ts` (+ its own
  `lib/form-ranker.ts` dependency).

---

## 2. PsychSift at module level

Module level only. PsychSift is being retired from this branch by a separate cleanup thread; the
per-file detail that would normally go here belongs to that thread's own tracer results, not this
map. Counts are tracked files (`git ls-files`) at tip `ace8e9ee8d`.

- **`src/app/`** — 417 files total: 167 non-route/non-api files plus 91 `page.tsx` across the real
  product route tree (the `(search-app)` group and standalone routes — answer, documents, services,
  forms, favourites, differentials, DSM, specifiers, formulation, prescribing, tools, calculators,
  therapy compass, factsheets, dictionary, sources, on-call, Caring Contacts, privacy, safety plan,
  auth callback), 62 files under `src/app/api/` (below), and 188 files under `src/app/mockups/` of
  which 49 are Ward Flow's.
- **`src/app/api/`** — 62 route files in around 21 groups; largest are caring-contacts, documents,
  and ingestion.
- **`src/lib/`** — 420 files: 254 flat modules directly in `src/lib/` (retrieval, ranking, answer
  verification, ingestion, chunking, source governance, env, privacy, clinical data, and the
  `form-ranker.ts`/`theme.ts`/`brand-mark.ts`/`source-authority-registry.ts`/`types.ts` files this
  part's §1 found reached from Ward Flow) plus named subfolders: `rag/` 38, `caring-contacts/` 36,
  `clinical-ask/` 14, `sources/` 13, `developer-area/` 13, `validation/` 9, `supabase/` 9,
  `observability/` 9, `on-call/` 8, `caring-contacts-server/` 7, `extractors/` 4, `webhooks/` 2,
  `services-canonical-data/` 2, `documents/` 2.
- **`src/components/`** — 912 files total, 597 outside `ward-management/`. Largest non-Ward folders:
  `clinical-dashboard/` 132 (the app shell), `caring-contacts/` 57, `ui/` 41, `therapy-compass/` 37,
  `care-plan/` 34, `document-viewer/` 26, `developer-area/` 17, `on-call/` 14, `differentials/` 14,
  `calculators/` 13.
- **`worker/`** — 29 files. The ingestion worker (Node + Python OCR), no relation to Ward Flow.
- **`supabase/`** — 247 files, 234 of them migrations, none mentioning Ward Flow (per the overview
  map). Ward Flow has no database and no migrations of its own.
- **`eval/`** — 18 files. RAG/answer-quality eval labs.
- **`data/`** — 16 files. Committed clinical data snapshots.
- **`caring-contacts/`** (top-level, not `src/caring-contacts`) — 10 files. Isolated Caring Contacts
  migrations, kept separate from `supabase/migrations/`.
- **`public/`** — 127 files. Static assets served to the whole app, Ward Flow included where it
  shares an asset (e.g. icons/fonts), but nothing under `public/` is Ward-specific.
- **`.github/`** — 33 files, 24 CI workflows plus the PR template. None of these run for Ward Flow,
  which is never pushed.
- **`scripts/`** — 358 files total, 49 under `scripts/ward-flow/` (covered by the sibling map for
  that area), 309 elsewhere: ops, eval, reindex, and CI gate scripts for PsychSift.
- **`docs/`** — 3,843 files total, 1,280 under `docs/ward-flow/` (covered by the sibling map for
  that area), 2,563 elsewhere: runbooks, governance, decisions, the design system, and the two
  project-wide maps (`docs/codebase-index.md`, `docs/site-map.md`). These two file/line counts for
  `docs/` differ slightly from the existing `docs/ward-flow/code-map.md` overview (3,835 / 1,272) —
  both were measured correctly, on different tips a few commits apart; this file's own tip is stated
  above.

### Retirement status

The cleanup thread traced every tracked file from Ward Flow's screens, engine, tests, scripts,
tool settings and docs (imports, file paths named in code, local web addresses, and Next.js layout
wrapping). Its plan is `docs/ward-flow/plans/2026-09-25-psychsift-retirement.md`, committed on local
branch `ward/psychsift-cleanup-plan-20260925` (commit `1215291989`, measured at ward-line tip
`a2f12e9250`, 9,021 tracked files). Folded into the ward line in merge `d9170013c6`.
Its headline counts:

- **Ward Flow's own files:** 2,496.
- **PsychSift files Ward Flow's screens load: 47.** Shared UI (`ui-primitives.tsx`,
  `primitive-recipes/`, nine `components/ui/` files), brand mark and theme, `contextual-back-link.tsx`,
  the developer-key gate with `lib/developer-area/{headers,link-access,link-access-shared}.ts`,
  `form-register.ts` and the thirteen search helpers it drags in, `env.ts` and three small files it
  imports, `owner-scope.ts`, `types.ts`, `cn.ts`, `tailwind-merge.ts`, `client-store-factory.ts`.
  These stay and later move into Ward Flow.
- **Loaded only by Ward Flow's tests and tools: 57** (tool configs, test and browser runners,
  `ensure-local-server.mjs`, a few helpers).
- **Held in by shared plumbing: about 1,200.** 452 only through the app frame (root layout, mockups
  layout, proxy), 567 named by path in something kept, and 15 PsychSift tests that run inside the
  ward suite (plus 81 files they load).
- **Safe to remove now, in batches: 2,283.** PsychSift design studies, Railway/Docker/GitHub CI,
  product pages and API, then the remaining tests, scripts and source.
- **Needs Josh's yes: 2,407 PsychSift documents**, plus the Care Plan, Caring Contacts and Developer
  Hub prototypes. **Claude and AI tool folders (614)** belong to the setup thread.

Findings from that trace worth knowing before any Ward Flow task:

- `src/lib/ward-output.ts` and `tests/ward-output.test.ts` are **PsychSift**, not Ward Flow, despite
  the name (they format PsychSift answers). The ward suite picks the test up by its name.
- `src/app/mockups/mockups-layout-client.tsx` returns Ward Flow pages untouched, but its import alone
  pulls about 370 PsychSift files into every Ward Flow page build.
- `.audit-reports/` belongs to Ward Flow (written by `scripts/ward-flow/audit-*`).
- Once PsychSift is removed from the ward line, the line must never be merged into GitHub `main`: it
  would delete the live app. The push guard stays until Ward Flow has its own home.

---

## Pitfalls in this area

1. **`/mockups/ward-flow-digest` is not developer-gated.** `DEVELOPER_GATED_PATH_PREFIXES`
   (`src/lib/developer-area/headers.ts:52-58`) lists `/mockups/ward-flow` and
   `/mockups/ward-flow-sign-in` but not `/mockups/ward-flow-digest`, even though the digest route
   sits right beside the other two and serves a real file
   (`docs/ward-flow/mockups/ward-flow-digest.html`) from `src/app/mockups/ward-flow-digest/route.ts`.
   `shouldBlockProductionMockups` (`src/proxy.ts:350-373`) therefore 404s it in any real production
   deploy; it only serves in dev/test. A future editor adding a fourth Ward-adjacent
   `/mockups/ward-flow-*` route must add its own line to the prefixes array by hand — the comment at
   `headers.ts:40-51` explains why a sibling can't just fall under the `/mockups/ward-flow` prefix,
   and a second comment there (48-51) warns not to place any note _inside_ the array itself, because
   `scripts/check-mockup-retirement.mjs`'s `readDeveloperGatedPrefixes` extracts every quoted span
   between the brackets and would turn a comment's own code spans into phantom prefixes.
2. **ESLint's mockup exemption does not cover the engine.** `MOCKUP_IGNORES`
   (`eslint.config.mjs:35`) matches `src/app/mockups/ward-flow/**` but nothing under
   `src/components/ward-management/**`, so the 315-file engine and screen tree is linted as full
   production code (hex-token, z-index-ladder, button-wiring and lucide-icon-aria rules all apply)
   even though it is a synthetic, never-deployed prototype. Do not assume a Ward file can skip these
   rules because it "is a mockup".
3. **The `ui-primitives` barrel pulls in clinical-citation code.** Importing anything from
   `@/components/ui-primitives` — 14 Ward files do — pulls in
   `primitive-recipes/clinical.tsx`'s own imports, `@/lib/source-authority-registry.ts` (497 lines)
   and `@/lib/types.ts` (1,187 lines), because the barrel is `export *`. A PsychSift-retirement pass
   that deletes those two files first, before narrowing the barrel, breaks every Ward file that
   imports `cn` or any other primitive.
4. **Ward Flow's error-boundary coverage has a real, documented gap, not a hypothetical one.**
   `ward-flow/error.tsx` cannot catch a throw from `ward-flow/layout.tsx` itself (same-segment rule
   in Next 16), so `src/app/mockups/error.tsx` (154 lines) was added specifically to close that —
   but even it cannot catch `ward-movements.ts` building its seeded fixtures at module scope
   (`export const wardMovements = [...]`, evaluated before any render), which still escapes all the
   way to the generic `src/app/error.tsx`. Any future refactor that moves seed construction later
   (inside a function, inside the provider) changes this; moving it earlier or adding a second
   module-scope array elsewhere does not fix it and could make it worse.
5. **A Ward-specific CSS token lives inside the 5,505-line shared `globals.css`, not in any Ward
   file.** `--spacing-ward-phone-bar` (`src/app/globals.css:134`) will not turn up in a file search
   scoped to `ward-management/` or `mockups/ward-flow/`; a grep across `globals.css` itself is
   needed. Two of its five consuming CSS modules belong to chrome the overview map already records
   as retired.
6. **Tailwind utilities written inside `ward-management/` compile only because of one `@source`
   line.** `globals.css`'s own exclusions (`@source not "./mockups"`,
   `@source not "../components/**/*mockup*"`, lines 5-6) would not have excluded
   `ward-management/` anyway (it isn't named `*mockup*`), but its routes live under
   `src/app/mockups/`, which the first exclusion does drop — and `mockups.css`'s
   `@source "../../components"` (line 10) is what re-includes it. Trimming that line without
   re-checking Ward Flow reproduces the 553-inert-utility incident `mockups.css`'s own comment
   documents, this time silently for Ward.
7. **The `x-ward-flow-offline` header is a security-relevant marker stripped and reset in one
   place.** `src/proxy.ts:192` strips any client-supplied copy before every request;
   `src/proxy.ts:198-200` restores it only for a genuine Ward Flow path. `src/app/layout.tsx:117-179`
   trusts that header completely to decide whether to skip Supabase's `AuthProvider` /
   `AccountDataProvider`. A refactor that moves or renames this header without preserving the
   strip-then-restore order would let a crafted request skip Supabase auth setup on a real page.
8. **`docs/ward-flow/` is excluded from the TypeScript project.** `tsconfig.json`'s `"exclude"` list
   drops all of `docs/**`, so no code sample or symbol reference inside `docs/ward-flow/` is
   type-checked by the main build; a renamed export can go stale there with nothing red.

## Not checked

No test, build, lint, or browser run of any kind. Whether `MobileKeyboardProvider` itself is safe to
mount without the providers it would otherwise sit inside. Whether every one of the 5 CSS modules
using `--spacing-ward-phone-bar` is actually reachable (two are flagged retired by the overview map,
not independently re-verified here). The full contents of the 91 non-Ward `src/app` product routes,
the 62 API route files, or any file under `src/lib/`, `src/components/` outside the eleven listed
here, `worker/`, `supabase/`, `eval/`, `data/`, `caring-contacts/`, `public/`, `.github/`, or the 309
non-Ward `scripts/` files — Section 2 is counts only, exactly as the brief asked. Whether
`NEXT_PUBLIC_MOCKUPS_ENABLED` is set in any real deployed environment. Live Railway or Supabase state.
