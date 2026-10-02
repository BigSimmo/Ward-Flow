# Ward Flow code: rules that fail a review

Claude loads this file whenever it opens code in this folder. It is a short extract. The full
process is `docs/ward-flow/HOW-WE-WORK.md` and the entry point is `docs/ward-flow/README.md`; where
they differ, they win.

**Read before any task:** [`docs/ward-flow/code-map/README.md`](../../../docs/ward-flow/code-map/README.md)

- **Synthetic data only.** Made-up patients. Never show an invented clinical figure as if it were real.
- **D4:** a control that is not connected says exactly "Not wired in this prototype."
- **D5:** no Mental Health Act section numbers, and no computed legal time limits. Show only times a
  person typed.
- **No typed text in browser storage.** Classify every new event in
  `ward-flow-persistence-classification.ts`; any id or free-text field needs review.
- **New events** go in `EVENT_ROLE` (`ward-flow-events.ts`) and `tests/ward-event-permissions.test.ts`.
- **Privacy wording.** Never say something is not stored, private or anonymised unless a test proves
  it. No patient names or typed text in URLs, logs, screenshots, commit messages or memory.
- **Design tokens only, no hex.** Tap targets 48px via `var(--ward-tap)` or `var(--spacing-tap, 3rem)`.
  Preserve the current accepted app's appearance. Historical accent and typography prescriptions
  do not authorise restyling it. Keep status understandable and controls accessible.
- **Design comes from the latest accepted Ward Flow app**, not the drawings in
  `docs/ward-flow/mockups/`. **Behaviour comes from this engine** and its tests. Record the actual
  checked revision, widths, themes and evidence in `docs/ward-flow/screen-verification.json`.
- **Checks follow the changed scope:** affected tests, typecheck only when selected, and the
  dedicated-repository gate. Documentation-only changes do not trigger browser checks.
- **Main means this dedicated repository's main branch.** The former Database ward line is retired.
  Pushes, PRs, merges, deployment and providers require their separately applicable authority.
