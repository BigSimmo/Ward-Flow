# Q004 Task 4a — independent Capacity review

Reviewed 2026-09-13 against `task-4a-brief.md`, `task-4a-report.md`, the approved Task 3 contracts and `VISUAL-REVIEW.md`. Compared all four owned files against `.superpowers/sdd/2026-09-13-product-refinement/task-4a-before/`.

Viewed the supplied 1440/light reference captures for Network, Ward, Discharges and table, plus `capacity-before-light-1440.png`, under `.superpowers/sdd/2026-09-13-product-refinement/screens/`. These establish the reference and preceding build only. No current implementation screenshot was supplied to this reviewer; no visual score or current responsive/rendered acceptance is claimed. No tests, browser, server, Git, provider or source-edit operations were performed. Only this review file was written.

**Verdict: two required P2 corrections.** Both findings below are source-traced, with targeted runtime checks for the controller; neither is claimed as browser-observed.

## R1 — P2, blocking print correctness: freeing-ward names disappear in print

**Source:** `src/components/ward-management/capacity/capacity.module.css:1552–1564`; affected content is `capacity-screen.tsx:358–366`.

The new print rule hides every `.textButton`. That class now wraps the only ward name in each Network → Beds freeing row, not merely navigation chrome. The numeric sibling remains printed, producing repeated “1 freeing today” lines with no ward attached. The previous snapshot rendered these names as visible spans. This removes operational information from the requested natural print flow.

**Reproduction:** leave the default Network → Beds freeing view open with nonempty `freeingWards`, then inspect print preview. Each freeing row loses its ward name while retaining its count.

**Correction:** hide only navigation/action-only buttons in print, and preserve the ward-name button's text as ordinary printed content. A narrow selector or dedicated action class is sufficient. Verify that a printed freeing count retains its matching ward name, while Back/other navigation controls remain omitted as intended.

## R2 — P2, blocking keyboard return journey: a Network opener cannot regain focus

**Source:** `src/components/ward-management/capacity/capacity-screen.tsx:72–80`, with the affected opener at `:358–365` and conditional sidebar replacement at `:299–308`.

`selectWard` retains the currently focused DOM element. Opening a ward from the Network's Beds freeing list unmounts that entire Network branch, including the saved opener. `clearWard` calls `.focus()` on that detached element immediately after scheduling the state change, before the Network list remounts. The call cannot restore focus, and the currently focused sidebar control is then removed too. Keyboard users lose their position rather than returning to the ward they opened. Map/table openers remain mounted and therefore do not exercise this failure.

**Reproduction:** keyboard-focus a ward under Network → Beds freeing and press Enter; use Back to network (or Escape from the ward panel). Inspect the active element after the Network branch returns: the recreated ward button is not focused.

**Correction:** retain a stable opener identity and restore focus to its current DOM node after the Network branch commits, with a connected fallback. Reuse the approach already used for returning from record details, but do not keep only the old DOM-node reference. Verify this Network-origin journey as well as the still-mounted map/table origins.

## Preserved contracts and remaining evidence

- Counts still come from the existing gap/network/bed-map derivations. The filter marks the complete `networkRows` collection; sorting copies service ward arrays and does not remove wards or change totals. Anonymous releases and guarded admission records are not summed into a second headline count.
- Selected ward detail uses the declared coordinator's guarded provider API. Explicit record clicks allocate access requests; rendering/filtering does not dispatch opens. Detail is read through the handle each render, while generation/ward keys remount selection state. No new identity join or coordinator discharge write appears.
- Tab controls have native buttons, roving tab stops and Arrow/Home/End handling. Ward, map and table selection remains keyboard reachable. Update actions use the existing request event, and Ward detail shows request feedback.
- Source defines desktop independent panel scrolling and narrow/print bound release. Actual current scrolling, overflow, footer reachability, six width/theme comparisons and reference fidelity remain controller-owned live evidence. The supplied before/reference PNGs cannot prove the new implementation passes those checks.

No additional style changes or scope expansion are requested. Recheck the two affected journeys after correction and retain the controller's independent visual evidence separately.
