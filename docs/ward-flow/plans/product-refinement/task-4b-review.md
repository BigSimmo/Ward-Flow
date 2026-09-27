# Q004 Task 4b — independent Discharges review

Reviewed the brief/report, the two changed files against `task-4b-before`, and the supplied `screens/discharges-reference-1440.png`. Source-only review; no tests, browser, server, Git or provider operations. The reference image does not verify the redesigned implementation. Only this review document was written.

**One P2 correction required: preserve filter scope in printed output.**

`src/components/ward-management/discharges/discharges-third-edition.module.css:545–583` hides `.filters` and forces all status buttons to the same foreground, background and border colours. The selected status relies on those colours (`:128–132`). Consequently, a filtered print loses its service, ward, identity and selected-status context, while retaining the global population count and differently scoped worklist/status counts from `discharge-board.tsx:319–447`. The paper copy cannot distinguish an intentionally restricted population from the full register.

**Reproduction:** select Admission records, restrict Service and Patient link, then choose Confirmed and print. The controls identifying service/link are absent and Confirmed is no longer visibly selected, although only those rows and scoped counts print beside the unfiltered Admission records total.

**Smallest correction:** add a concise printable scope summary naming the active population and service/ward/identity/status restrictions, or retain equivalent readable filter values and an explicit textual selected-status marker in print. Keep the existing grouped calculations unchanged. Verify the filtered paper copy states exactly which subset its counts describe.

No other actionable defect found in this bounded review: `groupDischarges` remains unchanged; populations and counts stay separate; blocked-first grouping and timing exclusions survive; detail opens are deliberate guarded calls, and filters/reset clear selection. Current visual fidelity, responsive scrolling and execution evidence remain controller-owned. No visual score or passing test claim is made.
