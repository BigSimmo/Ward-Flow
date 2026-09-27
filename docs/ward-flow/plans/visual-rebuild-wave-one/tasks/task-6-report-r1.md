# Task 6 Community implementation — revision 1

Date: 2026-09-13. Controller Astra. Current plan SHA256 DEB1A10C336EB44856430D8C15D91B09EE5787B5762B3D55A0159DB0C772BAEB; app HEAD1ef9ed3975078b789e9b5d70b3f000c64edc3809. Source-only independent review: task-6-source-review-r1.md. Visual review/correction closure: task-6-review-r1.md.

## Result and retained behavior

Canonical third-edition root; continuous six-figure band inside the team panel; native Change team disclosure; waiting/attention paired only at desktop; remaining registers full-width; real In-bed WardTable; native printable provenance footer. The first real WardFigure consumer exposed that the pilot's separate cards did not match the drawing's continuous band, so controller corrected only its third-edition rules. Legacy unmarked figures retain their original path. At tablet width the six Community figures use three columns/two rows, phone two columns.

All provider inputs, team lookup, aliases, linkage, membership resolution, duration calculations, clinical populations, absence wording, action-permission constraints, test IDs and dynamic navigation destinations remain. No clinical action or seed was added. The In-bed table displays actual admission IDs and the existing expectedBackLabel alongside every formerly rendered field. All occupied rows remain; cards were not kept as a substitute for the drawing's table.

## Deviations with reasons

- Six figures rather than the drawing's five: the existing Longest wait remains an independent figure and no derived fact was dropped. A balanced 3x2 tablet band avoids an orphan sixth cell.
- Actual provider/referral populations and clocks replace invented drawing examples. No referred person, name, accepted date or movement identifier was fabricated. In-bed identity is explicitly Admission because these are admission records. Existing acceptance-relative detail remains in its own table rather than duplicating a new acceptance calculation.
- Expected back, other departures, referrals we have made, limits, Go to and full page provenance remain as full-width app-only panels/content. Their absence claims and links are required by working behavior.
- All real available other-team links remain under Change team instead of the drawing's four sample teams. Current rendered Midland switcher had63 other links; that is an observation, not a hardcoded invariant.
- The complete synthetic/not-a-medical-device warning stays visible before the first panel. No unsupported contact/accept/decline actions were invented. Duration does not create urgency color.
- Table overflow on phones keeps every column reachable; a truthful narrow-screen scroll notice accompanies each table. The prototype's full limitations make some panels taller than the drawing.

## Evidence and limits

Served app/drawing matrix captured at390/820/1440, light/dark, in scratch community-r4-{app,mockup}-{width}-{theme}.png plus per-file geometry.json. The prior r3 light captures were invalid due displaced origin and the tablet sixth tile needed correction; they are superseded, not accepted evidence. Captures now reset scroll and wait for finite responsive transitions. Independent review closure subsequently accepted all twelve r4 app/reference cells; see task-6-review-r1.md and integrated-acceptance-r1.md.

Actual UI navigation: opened Change team, counted63 links, clicked Albany, confirmed /community/albany and measured-empty statement Nobody referred to this team is currently in a bed. Returned to Midland. Phone In-bed table:343px client width,720px scroll width,9 rows; lower screenshot community-phone-table-r4.png inspected by controller. Beforeprint event opened both marked disclosures; afterprint restored both to false. This is local event/DOM evidence, not actual PDF/physical-device proof.

First focused batch ran11/11 files,209 collected,203 passed,2 failed,4 pending; failures were shell route literals and unrelated-to-data Delays locator, recorded in focused-batch-r1.md. The separate six-file focused batch completed: the actual Community route component passed all 37 tests; its three failures were Board presentation assertions, since corrected. Exact evidence: focused-batch-r2.md. Full suite/typecheck and human acceptance remain pending. No Git publication or provider operations.

## Current output SHA256

- `src/components/ward-management/community/community-screen.tsx`: `80b6df065b8df0df6b588ba600cbbb33b56f4615eed513b069382babf92eb630`
- `src/components/ward-management/community/community.module.css`: `c95ed5358f4abff694d4d2880acf2ddaf9562331585fd213629d171e2d59ed28`
- `src/components/ward-management/ward-figure.module.css`: `fa4e0c379805be358a2b04d4df1e9b73d55409f50c377f843fa9136792e6521c`
