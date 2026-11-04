# Script budget history entries

From 4 November 2026, each raise or lowering of a limit in `script-budget.json` gets its own file in
this folder, so parallel pull requests never edit the same lines. Appends to one shared file made
nearly every open PR conflict whenever another one merged.

- Name the file `YYYY-MM-DD-pr<number>-<short-slug>.md`, for example
  `2026-11-04-pr1380-kit-polish.md`. Use the PR number once it exists.
- Write one dated paragraph in the same form as before: the routes raised or lowered, old and new
  limits, the measured size and why it changed.
- Never edit another PR's file.

Entries up to 4 November 2026 stay in [`../script-budget-history.md`](../script-budget-history.md).
