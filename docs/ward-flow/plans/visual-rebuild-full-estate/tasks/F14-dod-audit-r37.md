# F14 full-estate definition-of-done audit r37

Date: 2026-09-13  
Reviewer: `/root/hub_inventory`

## Verdict

The 34-screen Ward Flow estate is eligible for acceptance with documented deviations. No concrete
screen, lower-panel, or interaction gap remains in the bounded acceptance checklist after the final
Handover r37 review. This verdict does not turn behavior-authoritative differences into literal
mockup matches.

## Definition-of-done accounting

### Design fidelity and looking

- Every operational drawing has served app/mockup evidence at 390, 820 and 1440 pixels in light and
  dark. The first-wave and full-estate reviews compare panel order, panel type, tabs, disclosure
  content and responsive treatment rather than treating matching tokens as sufficient.
- Subsequent lower/end and changed-state reviews cover the concrete gaps found during those matrices.
  The final r37 closures cover Movements, Bed Board, operational ED, Search Hub and Governance; the
  Handover phone review reaches row 43/WF-018, the horizontally shifted Pull and LEG columns, local
  scroll tracks and the complete footer in both themes.
- No unresolved P1/P2 finding remains in the final checklist. Design differences required by the
  working engine are recorded as deviations with their behavioral or data-availability reason.

### Reachability and behavior

- The existing coverage inventory establishes real routes and in-product reachability for the 34
  operational screens, including the distinct Ward Answer route, Statistics child routes, Settings
  and Sign in.
- Stateful evidence exercises the material behavior changes and retained refusal states: real
  selection/filter/tab changes, directory keyboard navigation and focus return, ward/community
  chooser navigation, required-reason disabled actions, synthetic submission paths, explicit
  not-wired announcements and truthful empty/withheld populations.
- The final targeted journeys add no invented data, action or unavailable control. The audit does
  not require an exhaustive click of every row when the same rendered population, handler and
  behavior contract are already covered.

### Gates

- The integrated Ward runner handed in and ran all 454 files. Its only failure was the stale Hub
  hex-literal resolver assertion; the corrected semantic palette guard and co-run Movements file
  subsequently passed 35/35 in focused session `cKs8Ph`.
- The corrected Board batch passed 16/16. The latest typecheck (`run-typecheck-r26.mjs`, session
  `38099`) passed with no diagnostics.
- This is cumulative current-source evidence, not a claim that the earlier integrated run itself
  reported zero failures. Repeating unchanged passing files is not required to establish the
  corrected failure paths.

## Final evidence references

- `F01-movements-resolved-review-r37.md`
- `F02-ed-lower-closure-r37.md`
- `F06-handover-scroll-closure-r37.md`
- `F07-board-visual-closure-r37.md`
- `F07-board-order-sheet-correction-r36.md`
- `F14-hub-governance-closure-r37.md`
- `F14-hub-palette-guard-r37.md`
- `F14-remaining-r36.md`

## Evidence boundary

The written screen definition of done does not require physical-device testing, hosted-provider
proof, actual PDF output, exhaustive activation of every repeated row, or separate owner approval.
Those limits remain honest evidence boundaries rather than blockers added after implementation.

Canonical record finalization remains with the controller: archive the historical notes, write the
current evidence and `deviates` verdicts to `screen-verification.json`, regenerate
`SCREEN-VERIFICATION.md`, and record the accepted checkpoint in `PROGRESS.md`. This audit changes
none of those canonical files.
