# External Skill Precedence and Evidence

> **Ward Flow scope note (3 October 2026):** Repository contracts in [`AGENTS.md`](../../AGENTS.md), [`docs/ward-flow/README.md`](../ward-flow/README.md), and [`design/v9/design-system-v9.md`](../../design/v9/design-system-v9.md) outrank generic external skills and output-style plugins. Historical PsychSift examples below (`docs/search-chrome-behaviour.md`, `ui-smoke`) are retained for provenance; for Ward Flow v9/v10 screens, standard row height is `--wf-row-default: 44px`, touch row height is `--wf-row-touch: 52px`, and desktop button height is `--wf-target: 28px` (owner ruling 9 Oct 2026: _"Check the 48px PsychSift knob. Ward is 44"_).

<!-- BEGIN:external-skill-precedence -->

# External skill precedence

User-global skills and output-style plugins are installed outside this repo and know nothing about
its contracts. Where they conflict with repo docs or committed tests, the repo wins. This section
is the tie-breaker for that case only: it scopes external, generic guidance and does not override
system, developer, user, security, or compliance requirements, which remain higher priority.

- **Repo contracts outrank generic rules.** The Front-End Checklist skill corpus (~390 user-global
  skills: `alt-text`, `touch-targets`, `focus-styles`, `reduced-motion`, `color-contrast`, and so
  on) is generic guidance. On any conflict these win: `docs/wiring-conventions.md`,
  `docs/search-chrome-behaviour.md`, the `@theme` tokens in
  `src/app/globals.css`, and any committed test.
- **Never regress a fixed flake to satisfy a generic rule.** Known collision: generic touch-target
  guidance often teaches the WCAG 2.1/2.2 AAA-level "enhanced" criterion (2.5.5: 44×44 px, which is
  `min-h-11` in Tailwind), though the AA-level minimum is 24×24 px (2.5.8). Legacy `--ward-*` surfaces
  and historical PsychSift screens use `min-h-12` (48 px) — exceeding both the AA minimum and the AAA enhanced criterion —
  because `min-h-11` (44 px) hit a sub-pixel rounding flake in `ui-smoke`, whereas Ward Flow v9/v10 uses `--wf-row-default: 44px`, `--wf-row-touch: 52px`, and `--wf-target: 28px` (`design/v9/design-system-v9.md`). Design-scratch mockups
  (`*-mockups.tsx`) still carry `min-h-11` and are gate-exempt. Do not "fix" committed tokens or tests to satisfy a generic rule.
- **Unlayered CSS is deliberate.** Component classes in `globals.css` intentionally override
  Tailwind utilities. Generic specificity and utility-first advice does not apply here.
- **Cite the source when applying an external rule.** If a checklist rule drives a change, name the
  rule and confirm it contradicts no repo doc or test.

## Evidence and calibration are never compressed

Output-style plugins such as caveman mode may compress prose. They must never compress proof.

- **Always paste the decisive line.** Report gates with real output, not a summary. Under heavy-lock
  contention, `npm run verify:ui` queues Playwright admission for up to 15 minutes and, if still
  blocked at the deadline, exits `75` with a `DATABASE_HEAVY_RUN_ADMISSION_BUSY` marker
  (`run-playwright.mjs`) — a distinct non-zero code from an ordinary test failure, so tooling can
  tell "blocked, retry" apart from "red", but it never soft-skips green either way. When the gate
  does run, grep for the "N passed" line; exit 0 alone is not proof.
- **State verified versus assumed.** Calibration is not filler. Say what was actually run, what was
  read, and what is inferred. Do not drop uncertainty to save tokens.
- **Third-party fix claims stay unverified until checked.** Bot or agent claims that a fix landed
  must be verified against the actual ref/commit content before being repeated as fact. Prioritize
  inspecting already-fetched local refs (`git log`, `git show`) first; `git fetch` or other
  network/provider access requires explicit user confirmation per the "API and provider confirmation
  boundary" section.
- **Preserve the actual publication contract.** This Ward Flow checkout has no inherited PR-policy
  workflow, evaluator or PR template. The former PsychSift clinical/RAG body-parser instructions
  do not establish a Ward Flow gate. When publication is authorised, first verify the applicable
  Ward Flow requirements and preserve any required title, body and checklist fields in full.
  Keep acceptance evidence and uncertainty explicit regardless of the output style. Publication
  remains subject to the root API and provider confirmation boundary.

<!-- END:external-skill-precedence -->
