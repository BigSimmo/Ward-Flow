# Ward Flow code: rules that fail a review

Claude loads this file whenever it opens code in this folder. It is a short product and safety
extract for the public [`BigSimmo/Ward-Flow`](https://github.com/BigSimmo/Ward-Flow) repository.
Start with the repository [`AGENTS.md`](../../../AGENTS.md) for checkout, ownership, verification
and remote boundaries, then [`docs/ward-flow/README.md`](../../../docs/ward-flow/README.md) for the
product. Check that the active checkout belongs to `BigSimmo/Ward-Flow`; the former Database ward
line and PsychSift provider instructions do not govern this repository.

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
  No coloured edge bars or top highlights on cards, rows or panels.
- **Design comes from the current rendered app.** The drawings in `docs/ward-flow/mockups/` are
  background; serve them for comparison, never open them as bare files. **Behaviour comes from this
  engine** and its tests. Record screen checks in
  `docs/ward-flow/SCREEN-VERIFICATION.md`.
- **Before each commit:** use the focused checks and required gates in repository `AGENTS.md` for
  the files changed. A documentation-only edit does not require a type check by default.
- **Repository base and remote:** use the current `BigSimmo/Ward-Flow` `main` and follow its
  `AGENTS.md` before any push or pull request. Verify the remote identity first.
