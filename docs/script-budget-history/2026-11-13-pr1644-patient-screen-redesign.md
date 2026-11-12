# 13 Nov 2026, patient screen redesign (PR #1644, D-165)

One limit is raised, on top of `main` at `865658a`:

- Movement `/ward-flow/movements/WF-001`: 613.2 to 613.5

Measured with a local `next build --webpack` and `scripts/check-script-budget.mjs`, which matched hosted CI's figures for the earlier head to 0.1 KB. Movement measures 613.3 KB; `main` alone measures 612.7 KB. The limit is the measurement plus 0.2.

Why it grew: the patient page's first load carries the new layout code, 0.6 KB of it: the 2:1 grid with its main and side columns, the joined status foot, the slot for the Triage and Carer call back rows, and the merged "Hand over and print" card. Swapping the two new card-head icons (`Printer`, `Route`) for icons already in that script would save 0.15 KB and bring it just under the old limit, but it would change the look Josh approved, so the icons stay.

What was trimmed first: hosted CI also measured Statistics 2.4 KB over its limit (636.1 against 633.9), although this PR adds no Statistics code. The redesign's History tab imported "Where the hours went" directly while the Now tab's lazy extras file still imported it too. That put the component (and the kit's stacked bar it uses, which Statistics also uses) in a second script, and the build's script splitter answered by leaving a second copy of about 20 small shared modules (ten icons and the lazy-loading runtime) inside the Statistics page script. History now takes the hours part from the same lazy file the Now tab already downloads, so the shared modules sit in one script again and Statistics is back to 633.7 KB, the same as `main`. Its limit is unchanged. Every other route measures the same as before this fix, to 0.1 KB.
