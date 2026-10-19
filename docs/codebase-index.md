# Ward Flow — current architecture orientation

`BigSimmo/Ward-Flow` is a synthetic prototype built with Next 16 and React 19. The approved app
governs appearance; current engine/source/tests govern behaviour. Start with the
[Ward README](ward-flow/README.md) and [task evidence](task-receipts.md).

| Area               | Current source and scope                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes             | `src/app/ward-flow/`: coordinator root [page.tsx](../src/app/ward-flow/page.tsx), unit board [board/[unitId]/page.tsx](../src/app/ward-flow/board/%5BunitId%5D/page.tsx), [handover/page.tsx](../src/app/ward-flow/handover/page.tsx) |
| Engine and screens | `src/components/ward-management/`: [provider](../src/components/ward-management/ward-flow-provider.tsx), [reducer](../src/components/ward-management/ward-flow-reducer.ts) and role-specific screen modules                           |
| Clock              | The provider reads elapsed wall-clock time and ticks every 30 seconds; controlled initial/test clocks are separate                                                                                                                    |
| Backend            | [backend/ward-flow](../backend/ward-flow/README.md): opt-in coordinator-only shared commands/audit. Provider in [DATABASE.md](ward-flow/DATABASE.md); local source does not prove hosted readiness                                    |
| API                | `src/app/api/health/` is [liveness](../src/app/api/health/route.ts) `{status:"ok"}`; `src/app/api/local-project-id/` identifies local preview checkout/runtime                                                                        |
| Shared support     | `src/lib/developer-area/`, `src/app/icons/` and shared UI/helpers; inspect affected imports rather than every historical map                                                                                                          |
| Tooling/history    | `scripts/`, `tests/`, `docs/`: [package commands](../package.json), scoped gates and the [dated detailed code map](ward-flow/code-map/README.md)                                                                                      |

## Ward repository layout

| Path            | Current role                                                        |
| --------------- | ------------------------------------------------------------------- |
| `.design/`      | Design briefs, reviews and screenshot evidence; not runtime modules |
| `.githooks/`    | Local commit/push hooks                                             |
| `.github/`      | Ward Flow CI and CodSpeed workflows and repository metadata         |
| `backend/`      | Separate synthetic shared-workspace backend                         |
| `bench/`        | CodSpeed/Vitest performance benchmarks (`npm run bench`)            |
| `data/`         | Reference datasets and generated source snapshots                   |
| `design/`       | Figma mapping, sync metadata and tokens; not an appearance mandate  |
| `docs/`         | Maintained guidance and explicitly preserved historical records     |
| `eslint-rules/` | Repository-specific lint rules                                      |
| `mockups/`      | Route notes and retirement evidence                                 |
| `public/`       | Static assets and reference forms                                   |
| `scripts/`      | Local development, documentation, verification and recovery tooling |
| `src/`          | Next.js routes, Ward engine/screens and shared support              |
| `tests/`        | Unit, DOM, browser and tooling contracts                            |

## Ward route groups

- `/mockups`: Ward Flow, digest and synthetic sign-in routes under `src/app/mockups/`.
- `/icons`: dynamic icon/OG support under `src/app/icons/`; exempt from product-route coverage.

## Ward API routes

- `/api/health`: liveness only, returning `{status:"ok"}`; no backend readiness assertion.
- `/api/local-project-id`: local checkout/runtime identity before attaching to a preview server.

## Ward library modules

- `src/lib/developer-area/`: synthetic developer-area access and request/header support.
  Inspect the shared top-level helpers and the affected imports for finer detail.

## Historical provenance

The directory-coverage checker reads only the maintained Ward sections above. It checks scoped
path mentions, not architecture truth or every individual screen. The catalogue below is dated
provenance, not current provider/design/workflow authority; the screen map preserves finer coverage.

> **Historical source boundary — 2 October 2026.** The preserved material below
> describes the former Database/PsychSift workflow or a completed task. Its commands,
> hosting and appearance claims are not current Ward instructions. Use the
> [repository boundary](../AGENTS.md) and [Ward entry point](ward-flow/README.md) for current work.

<!-- docs-script-refs:historical-start -->

The former PsychSift codebase index that used to follow here is preserved, unchanged, in
`docs/archive/historical-psychsift-codebase-index.md` (removed in the 15 Oct 2026 docs trim).
It is not current Ward Flow guidance.

<!-- docs-script-refs:historical-end -->
