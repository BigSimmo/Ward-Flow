# Task 4 independent Command review — revision 2

Date: 2026-09-13  
Reviewer: `statistics_inventory` / `gpt-5.6-sol` / medium  
Review independence: reviewer did not implement Command.  
Plan SHA-256: `9ECE16E99228AF0B4053D7C6ED75CF694354EE9BBCBA9D0EC48A20F55573201E`

## Verdict

Changes requested. The rich queue-row clipping and pressure-card edge defects from revision 1 are closed, and the behavior-bearing TSX remains unchanged. Three presentation defects remain in the current six-cell evidence: the queue heading shrinks into its tabs, the late phone cascade restores a panel the established phone contract hides, and the centred hub falls below the initial desktop diagram viewport.

## Findings

### P2 — the queue heading still shrinks into the tab strip

At both 820px and 1440px, in both themes, `43 open movements` is clipped across the top edge of the Patients/Referrals tab strip. The header was correctly changed back to a stacked layout, but it remains a shrinkable child of the bounded flex-column `.queueRegion`. The tabs explicitly use `flex: 0 0 auto`; the heading does not. Under the panel's height constraint, the heading shrinks toward its 2.5rem minimum and the second line is painted underneath the following strip.

Give `.queueRegion .regionHeader` `flex: 0 0 auto` so both heading lines retain their intrinsic height. Verify at 820px and 1440px with the queue scrolled at its start and end; the list, rather than its heading, must own the vertical reduction.

Evidence: `coordinator.module.css:3145`; app rasters at x24–780/y574–670 (820px) and x260–484/y298–406 (1440px).

### P2 — the late phone rule reverses the established Command phone-content contract

The earlier, documented `max-width: 48rem` contract hides `.pressureStrip` and `.diagramRegion`, leaving the queue, registers and shortlist as the phone workflow. The late rebuild block changes `.pressureStrip` back to `display: block` at the same breakpoint and later source order. The 390px app captures therefore spend the first content viewport on emergency-department pressure while the selected movement's queue row and shortlist context remain below the fold; the fixed Refer/Override bar is visible without its subject. This is a real cascade reversal, not merely a different fixture.

Remove the late `.pressureStrip { display: block; }` override and its now-unused phone-only header/list adjustments, or explicitly amend the phone behavior decision before retaining it. The smallest correction is to let the earlier paired hide rule continue to win.

Evidence: established rule and rationale at `coordinator.module.css:2233-2255`; reversing rule at `coordinator.module.css:3420-3436`; 390px app rasters y715 onward.

### P2 — the hub is centred against all diagram content and disappears below the initial desktop viewport

The 1440px app cells show the emergency-department column and inpatient-unit column, but no hub or relationship arrows in the initial Statewide flow viewport. `align-self: center` centres the hub against the full height of the retained unit inventory rather than the visible scroller. The result still reads as two inventory columns at initial load, while both drawing cells keep the hub and relationship structure visible. Full names, capabilities, bed states and eligibility facts remain valid reasons for a taller scroll area; they do not justify moving the diagram's defining relationship out of the initial view.

Replace the content-height centring with geometry that keeps the hub in the initial diagram viewport while preserving every node fact and connector meaning. Recheck connector measurement at the top and after vertical and horizontal scrolling; a sticky hub alone would be unsafe because the current overlay is measured from node rectangles and is not documented to remeasure on scroll.

Evidence: `coordinator.module.css:3391-3394`; 1440px app diagram x498–1018/y340–810 versus mockup x498–1034/y318–786.

## Closed revision-1 findings

- **Rich queue rows:** closed. `.queueList` now has `align-content: start` and `grid-auto-rows: max-content`. The 820px and 1440px app cells show complete multi-line rows instead of approximately 48px clipped tracks. WF-014 remains selected and its visible row retains tier, wait, cohort/origin and operational score.
- **Pressure state edges:** closed. No pressure-card `::before` selector remains, and no top status bars appear in any app cell. Written pressure facts and the selected-card outline contract remain available.
- **Queue title wrapping:** the title itself no longer wraps mid-word, but the header-height defect above prevents closing the whole header finding.
- **Diagram density:** card gaps and padding are tighter. The taller-than-drawing inventory remains an accepted consequence of retained facts; the missing initial hub is the narrower unresolved defect.

## Behavior, content, selectors and print

The only TSX diffs from the source baseline remain the `data-ward-design="third-edition"` root marker and relocation of the unchanged pressure ordering sentence into its existing header. No derivation, state, reducer dispatch, ordering, filter, form, handler, seed or route changed. Patients/Referrals and all four register tabs remain mounted. Movement and referral selection, every eligibility gate, legal/urgency changes, escalation, referral, override, release, transport cancellation, refusal records and empty states remain present in the unchanged behavior-bearing components. The selected WF-014 capture truthfully shows an accepted movement; controller journey evidence records Refer disabled for its moving stage and Override requiring a candidate.

All 156 `styles.*` names used across coordinator TSX resolve in `coordinator.module.css`. The module composes `wardShellTokens`, the screen has the opt-in marker, no `--text-*` references remain, forced-colours keeps selected outlines, and the substantive print block restores content-bearing queue rows, diagram units, pressure cards, shortlist subject/candidates and headings while releasing the screen and internal overflow bounds. Source inspection found no lost gate, action or refusal fact and no new print clipping declaration. Print and forced-colours runtime evidence are controller-owned and are not established by these screenshots.

## Source evidence

- `coordinator-screen.tsx` — `3A3ED8DFCA64042E8DB4CD510167F3CE15E6118BD3817998F5B9987EE70384EF`
- `pressure-strip.tsx` — `30C2414ED844450383FF33709706CAAD6A05BB3FD8D76C834A5A15C85755302A`
- `coordinator.module.css` — `2CD43DE862A1F3AFA0586C1A62110F970508505D56C71D83B3B29763BD5AF2EC`
- `task-4-report-r2.md` — describes the same three source hashes and the revision-1 corrections.

`git diff --check -- src/components/ward-management/coordinator` produced no output. Static selector extraction found 156 used names and zero unresolved names. No test, browser, server or source edit was performed by this reviewer.

## Visual evidence map

Every PNG below was inspected at original resolution. Geometry sidecars record DPR 1, scale 1, `scrollX: 0`, `scrollY: 0`, explicit theme, and heights of 844px at 390 or 1000px at 820/1440. The app visual widths are 375, 805 and 1425px respectively; rail widths are 375, 805 and 236px. Mockup visual widths are 375, 805 and 1440px; rail widths match.

| Cell       | App SHA-256                                                        | Drawing SHA-256                                                    |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 390 light  | `6826EA62E971D88978735414955F970DAAE2642A625424D9BE537C80BABBFD51` | `BA529F9744EF96C045DCB0A6730551A681F4F24DC7D9BBFB0E80B56BF818980B` |
| 390 dark   | `A83EFED25D2A2D6EDCA09A6DC2AAB9CE62083B9FC7C40DD46DB45833391F9425` | `C056D9F02A52CC4EE767E95DB05525B5F08A7DF493BE22290A24959EE509C9A4` |
| 820 light  | `CAB7F5AE84AD1D1EC762C44B83E385E9CD5124D2CF6E9D33A3306D342A894738` | `37688660358ECBC0F7EBE26618D2BBBCD5F0AE238823C985C41DB92CC88C34CB` |
| 820 dark   | `285ACA4549D7CDD866113B00DCBB82B7FD7006B1FBB66B73B5462E4A967D167C` | `C975AB9E6B365F7E7BC194FAC4DD65CCE4B84752BB9A49BDC2B312A55D2554D9` |
| 1440 light | `FD705ACD2A5570590AAACE7A5568F00C649C19DCD4DFF117F9AEF8BB69DE13B0` | `B2FECAAC46E47EA80D63C08BC0AF5BCD434612479F123F9E85B8202777C36A57` |
| 1440 dark  | `6759D64C7ED7B520F4A2C29D52551AE96C2AE7CB4186E8145E449282755E0482` | `D64DE6A7BFA987CED2ED86576BA28BA0F7EAD6305CAD26A68B095DE2212D8F68` |

The initial 390px cells do not establish the queue, registers or shortlist below the fold. The initial 820px cells establish pressure plus the beginning of the complete queue only. The 1440px cells establish all five regions, but not the ends of their independent scroll areas. Controller-owned real journeys, scroll-end checks, focus, forced-colours and print remain the required runtime evidence. Human visual acceptance remains pending.

## Revision 3 closure

Independent reviewer: `hub_inventory` / `gpt-6`  
Correction input: `task-4-correction-r3.md`  
Evidence: all twelve frozen `command-r4` app/drawing images viewed at original detail, plus all twelve geometry sidecars and focused inspection of the final CSS selectors.

All three remaining P2 findings are closed.

- **Queue heading:** both 820px app cells and both 1440px app cells show “Priority queue” and the complete `43 open movements` count on two clear lines above the Patients/Referrals tabs. Neither line overlaps the tab strip. The list owns the bounded region's vertical scrolling and its rich rows remain full height.
- **Phone pressure contract:** both 390px app cells omit emergency-department pressure and the diagram. The required governance statement is followed directly by Priority queue, so the established phone workflow is restored and the fixed Refer/Override actions are no longer paired with an unrelated pressure panel. The corresponding drawings still show pressure, but the app behavior is the explicit retained product contract recorded in the correction report.
- **Initial desktop hub:** both 1440px app cells show the Statewide flow hub, incoming connector and accepted-destination connector within the initial diagram scrollport. The hub, nodes and connector overlay remain one scrolling canvas; the static cells show no detached connector or overlap at the captured origin.

No new viewport-level overflow, clipping or theme-specific regression is visible. Pressure retains its own horizontal scroller at 820px and 1440px, the diagram retains its explicit sideways-scroll affordance, queue/register regions retain their independent bounded scrolling, and the page itself begins at `scrollX: 0`, `scrollY: 0` in every geometry sidecar. App visual widths remain 375px, 805px and 1425px at DPR 1 and scale 1, with no app dialogs open.

The r4 images do not prove queue scroll-end behavior, connector alignment after internal vertical or horizontal scrolling, hidden phone regions in print, keyboard/focus behavior, forced colours, or actual print/PDF output. Those remain controller-owned runtime evidence. Within the requested three corrections and new-overflow check, no further source change is requested.
