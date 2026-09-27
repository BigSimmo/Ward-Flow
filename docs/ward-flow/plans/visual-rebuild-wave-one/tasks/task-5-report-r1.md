# Task 5 Delays implementation — revision 1

Controller Astra, 2026-09-13. Status: implemented first pass, verification and independent review pending. Plan SHA-256 9ECE16E99228AF0B4053D7C6ED75CF694354EE9BBCBA9D0EC48A20F55573201E; HEAD 1ef9ed3975078b789e9b5d70b3f000c64edc3809 plus uncommitted wave source.

Owned changes: src/components/ward-management/delays/delays-screen.tsx and delays.module.css. No derivation, reducer, provider, clock, routing, fixture or test changes.

The screen opts into the canonical token layer. Existing waitingSplit figures now use the drawing's four-cell definition-list band rather than the prior stacked bar. Existing owner counts supply neutral meter tracks. Five owner cards, flat waiting list, grouped blocker list, two-tab register and detail panel keep their state/handlers; columns and row treatments follow the drawing. All certified screen text uses the new scale with a 12px floor. Scoped local filter/selected-record descendant rules bridge the legacy nested controls without changing other screens. Phone owner cards scroll horizontally; list/cause/register retain their previously explicit bounded-scroll behavior. Print expands bounded lists.

## Retention and departures

- Real engine populations and owner/cause order retained. The app has 43 open movements at the inspected state; the drawing has 16. No copied counts, patients, invented clocks or hidden fields.
- Selection initially remains empty, unlike the drawing's pinned WF-014. Existing user selection and toggle-off behavior remain authoritative.
- Marking controls remain visible and highlight rather than hide; the drawing lacks some of them. All handlers and clear/mark precedence remain unchanged.
- Waiting cause words, full urgency labels, last-recorded-event age, legal-form wording, clearance unknown/yes/no, referral/refusal and release navigation facts remain unchanged. The engine cannot honestly supply the drawing's blocker duration, so 'nothing recorded for' stays.
- Owner and severity edge bars belong to the older drawing; the third edition uses neutral cards/rows and semantic words. The layout now follows that design. The old waiting-list footnote that claimed a colored owner edge was corrected to describe the visible blocker wording. Long waits use the drawing's amber text; duration and data-long marker remain.
- Complete app-only synthetic warning and one-line subtitle remain above the first panel; the shell supplies the visible page title while the screen retains its accessible h1. This adds vertical space versus the drawing and preserves disclosure.
- The existing owner explanation remains below the cards, adding height versus the drawing's shorter note. Attention and unnamed-person panels remain below the working columns; nothing is folded away.
- Empty cause groups are still omitted by the existing engine presentation, rather than fabricating the drawing's zero groups. The five owner cards always remain and show 'nobody' at measured zero.
- Detail includes all current SelectedPerson and full DelayRow facts/actions. It is taller than the drawing because those facts and legal caveats remain available. No automatic selection, booking or new action added.

## Evidence and limits

Viewed served drawing delays-third-edition.html over HTTP at 1440 and 390, plus first application desktop render. Scratch delays-drawing-1440-light.png and delays-drawing-390-light.png, delays-app-r1-1440-light.png. The misleadingly named delays-before-1440-light.png was taken during the partial edit; it is not a baseline. Six-cell visual evidence is pending.

Scoped Prettier completed. Proposed focused batch containing two Delays DOM files and Statistics/Command files was admission-blocked before starting by U04 worktree PID19624; no tests ran and no pass is claimed. No heavy suite, typecheck, build, provider, publication or physical-device/PDF verification.

Next: controller captures selected/detail and full matrix, independent review, then focused tests when admission becomes available. Human acceptance pending.
