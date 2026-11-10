# Changes to safety controls get a second look

_Created 2026-11-10 - audit item M129; drafted on branch `claude/project-thread-bnphlk` (from `main` `29352cd0`); Documentation owns._

**Status:** draft rule and a **provisional** file list. Nothing is enforced yet. Today a thread can
auto-merge its own PR on these paths with no independent review (AGENTS.md hard rule 6;
`.github/CODEOWNERS` names one owner for everything).

**Done when:** the final file list is checked in as data, a workflow labels any PR that touches
it, and a test proves the label is applied. Before a pilot.

## 1. The rule (proposed)

1. A PR that changes a file holding a hazard control gets the label `safety-control`
   automatically, naming the H-numbers it touches.
2. While Ward Flow holds synthetic data, the label is a flag for the review section of the PR
   (`docs/agents/git-publication.md#reviews`); auto-merge rules are unchanged.
3. **During a pilot**, no release goes out with a `safety-control` change until the clinical
   safety owner (**to be named**) has reviewed it. The daily release workflow would check for
   unreviewed labelled merges since the last release and pause, the same way
   `WARD_RELEASE_PAUSED` does.

Points 2 and 3 change how PRs and releases work, so they need Josh's ruling as a D entry first.

## 2. Provisional file list

Built from the hazard log ([Clinical Safety Case section 7](CLINICAL-SAFETY-CASE.md#7-hazard-log-h-01-to-h-24))
and source paths that exist on 10 Nov 2026. **Audit item M65 owns the hazard-to-control mapping.**
Replace this list with M65's once it lands. Paths under `src/components/ward-management/` are
shortened to `wm/`.

| Hazard                                 | Files holding the control (provisional)                                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-01, H-23 wrong patient               | `wm/ward-patient-resolver.ts`, `wm/ward/ward-bed-layout.ts`, `wm/ward/ward-screen-derivations.ts`, `wm/arrival-identity-dialog.tsx`                                    |
| H-02, H-03 placement legality, sex     | `wm/ward-eligibility.ts`, `wm/ward-legal-status.ts`                                                                                                                    |
| H-04 invented fact shown as recorded   | `wm/ward/ward-referral-detail.tsx`                                                                                                                                     |
| H-06, H-21 pull time limit and release | `wm/patients/patient-now-arrival-section.tsx`, `wm/ward-flow-reducer.ts`, `wm/ward-flow-reducer-slices.ts`                                                             |
| H-08, H-16 lost or overwritten change  | `wm/ward-shared-client.ts`, `backend/ward-flow/engine.ts`                                                                                                              |
| H-09 legal form times                  | `wm/ward-legal-forms.ts`, `wm/ward-legal-clock.ts`, `wm/ward-legal-form-fit.ts`, `wm/ward-legal-form-time-order.ts`                                                    |
| H-10, H-11 ranking drift, queue order  | `tests/ward-never-build-drift-guard.test.ts`, `tests/ward-ruling-guardrails.test.ts`                                                                                   |
| H-14, all thresholds                   | `wm/ward-clinical-values.ts`, `docs/ward-flow/clinical-values.md`                                                                                                      |
| H-19 unauthorised access               | `wm/ward-role-permissions.ts`, `wm/ward-flow-event-roles.ts`, `wm/ward-access-admin.ts`, `backend/ward-flow/migrations/`, `src/proxy.ts`, `src/lib/front-door-pass.ts` |
| H-20 copies and prints                 | `wm/ward-clipboard.ts`, `wm/ward-shared-record-detail.ts`, `wm/ward-browser-data.ts`                                                                                   |

## 3. How it would be built (next step, not done)

- Put the final list in a data file (for example `scripts/ward-flow/safety-control-paths.json`),
  each path with its H-numbers.
- A small matcher script takes a list of changed paths and returns the H-numbers touched.
  A focused test (`tests/ward-audit-m129-safety-control-label.test.ts`) proves a listed path is
  matched and an unlisted one is not, and that every listed path exists.
- A `pull_request_target` workflow, built like `.github/workflows/pr-hold.yml` (reads metadata
  only, never runs PR code), adds the label. Adding a label needs `pull-requests: write`.
- Changing `.github/` workflows and the release gate is a repository-setting change in effect.
  It goes in its own PR with Josh's yes.
