# Task 4 independent Command source review — revision 1

Date: 2026-09-13  
Reviewer: `statistics_inventory` / `gpt-5.6-sol` / medium  
Review independence: reviewer did not implement Command.  
Plan hash: `9ECE16E99228AF0B4053D7C6ED75CF694354EE9BBCBA9D0EC48A20F55573201E`

Reviewed source hashes:

- `coordinator-screen.tsx` — `3A3ED8DFCA64042E8DB4CD510167F3CE15E6118BD3817998F5B9987EE70384EF`
- `pressure-strip.tsx` — `30C2414ED844450383FF33709706CAAD6A05BB3FD8D76C834A5A15C85755302A`
- `coordinator.module.css` — `C3BF5A24CBA10986213FBB83AF9A70A1A725C3B3AFB4F2C74CC854FA85558B33`

## Verdict

Changes requested. The source preserves Command's state, actions and clinical/governance content and establishes the intended five-region hierarchy, but the supplied 1440px raster confirms three CSS defects and one material schematic departure. The clipped queue is the blocking usability defect.

## Findings

### Critical — bounded queue shrinks every rich row to its 48px floor

In `command-app-r1-1440-light.png`, the queue's rows are approximately 48px high: most show only the movement ID and the top of the tier/urgent badge, while the destination, cohort, legal and wait metadata are covered by the next row. The queue still scrolls, but scrolling cannot reveal content that each grid track has already compressed.

The late rebuild block makes `.queueList` a bounded flex child and grid scroll container but leaves its implicit rows at the default sizing behavior. `.queueRow` supplies only `min-height: 3rem`; it does not protect the row's multi-line max-content height in the constrained grid. Set `.queueList` to `align-content: start` and `grid-auto-rows: max-content` (or an equivalent non-shrinking intrinsic row rule) so the list, rather than each row, owns the vertical overflow. Keep the existing internal scrollbar and every row field.

Evidence: `coordinator.module.css` late `.queueList` block around line 3218 and `.queueRow` block around line 3228; app raster x261–483, y410 onward.

### Important — new pressure-card top bars encode a state edge the accepted design excludes

The late `.pressureCard::before` / `.pressureCardSelected::before` rules add a 3px top edge to every pressure card and recolour it when a department has a breach. The raster shows the repeated dark top bars across the full pressure strip. This is the drawing's edge-bar device applied to live state despite the Task 4 boundary explicitly excluding new state-edge bars; the card already states `N breaching` in text and uses selection border/fill when selected.

Remove the two pseudo-element rules and their breach recolouring rule. Keep the written breach count, existing card selection treatment and ordering unchanged.

Evidence: `coordinator.module.css` around lines 3081–3093; app raster y178–181.

### Important — Statewide flow does not yet read as the drawing's centred schematic

The five top-level regions are in the correct places, but the diagram itself reads as three tall inventory columns: the hub sits at the top, ED cards expand vertically with full names, and ward cards become tall chip stacks. The drawing places the hub at the vertical centre of the relationship field and uses a compact schematic rhythm. Full app names, capability text, bed states, recorded destinations and eligibility facts must remain, so achieving the drawing's exact card density by hiding or truncating those facts would be wrong.

The smallest safe geometry correction is to centre `.diagramHub` within its desktop grid track (`align-self: center` in the existing `min-width: 64rem` branch) and tighten only redundant card padding/gaps after a live content-fit check. Do not remove node facts or change connector/selection behavior. The remaining height difference should be recorded as a justified consequence of retained app-only content unless a denser fully readable card treatment is demonstrated.

Evidence: app raster center region x498–1018 versus `command-drawing-1440-light.png` center region x498–1034.

### Minor — late queue-header rule reverses the file's own narrow-column safeguard

The earlier `.queueRegion .regionHeader` rule intentionally stacks heading and count because 14rem cannot fit `Priority queue` plus `43 open movements`. The late rebuild block changes it back to a row. In the raster this wraps `Priority queue` onto two lines while the count remains alongside it, increasing chrome height and weakening the hierarchy.

Remove the late row-direction override or restore the earlier column/start alignment at the wide three-column layout. The count and heading remain present; only their layout changes.

## Preserved behavior and content

The TSX diff changes no derivation, filter, selection, reducer action, form, route or seed. `coordinator-screen.tsx` adds only the root marker. `pressure-strip.tsx` moves the existing ordering sentence into the existing header without changing its text or the pressure map/selection handler. The five top-level regions remain pressure, queue, flow, tabbed registers and shortlist; the center `midCol` correctly holds flow over registers.

Patients/Referrals tabs, all four register tabs, movement/referral selection, ED filtering, every shortlist gate, legal/urgency controls, referral/override/release/cancel flows, refusal marker, empty states and app-only diagram facts remain mounted in source. The blank shortlist in the supplied raster is the existing no-selection state, not a missing panel.

## Selector, token, responsive and print review

- Static extraction found all 156 `styles.*` names used by coordinator TSX files defined in `coordinator.module.css`; no application selector was unreachable.
- The CSS composes canonical `wardShellTokens` on `.screen`, carries the explicit `data-ward-design="third-edition"` marker, and contains no `--text-*` reference or literal sub-12px font size.
- The rebuild establishes full-width pressure plus queue / flow-and-registers / shortlist at 1400px and above; 1001–1399px uses the documented two-column intermediate arrangement; 1000px and below stacks. Existing phone policy continues to omit pressure and the costly diagram below 48rem while retaining queue, registers and shortlist.
- The appended breakpoint rules intentionally override several older 90rem/48rem rules. Most resolve correctly by later source order, but the queue-header reversal above is an actual collision.
- The earlier print block remains the substantive contract: it restores content-bearing buttons, releases the queue/diagram/register/shortlist scroll bounds, expands records and forces Canvas/CanvasText. The late print block repeats structural releases without defeating the earlier `!important` visibility/colour rules. Source review found no new print clipping rule.

## Evidence and limits

Visually inspected at original resolution:

- `command-app-r1-1440-light.png` — `6317ED05016491C5CBA6D77924CCA7CD0EDC5641A840D2B0F8E360252B219892`
- `command-drawing-1440-light.png` — `1ED31546003881BF9A04C684AED00C01D1F45A46155DE8482EBEC5D353B4CDD5`

This remains a source review plus one controller-supplied desktop visual cell. No tests, browser, server or source edits were performed by the reviewer. Dark mode, 820px, phone, interaction, overflow-at-end, forced-colours and print runtime evidence remain controller-owned and pending. Human visual acceptance remains pending.
