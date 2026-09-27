# Task 4 Command correction report — revision 3

Date: 2026-09-13  
Source baseline: `1ef9ed3975078b789e9b5d70b3f000c64edc3809`  
Plan SHA-256: `9ECE16E99228AF0B4053D7C6ED75CF694354EE9BBCBA9D0EC48A20F55573201E`  
Review input: `task-4-review-r2.md`, SHA-256 `EB33A155A047B789388CC59A52C30144022ECC61239A1EB302A857F326AE14E7`

## Corrected result

Only `src/components/ward-management/coordinator/coordinator.module.css` changed.

- `coordinator.module.css`: `DEAB7F980401812C03D9E626BBC79A3A28FDC7A2CDC7319D96CC623FAB693D79`

Unchanged Task 4 source hashes:

- `coordinator-screen.tsx`: `3A3ED8DFCA64042E8DB4CD510167F3CE15E6118BD3817998F5B9987EE70384EF`
- `pressure-strip.tsx`: `30C2414ED844450383FF33709706CAAD6A05BB3FD8D76C834A5A15C85755302A`

## Corrections applied

- `.queueRegion .regionHeader` now uses `flex: 0 0 auto`. The bounded queue reduces its scrolling list rather than shrinking the two-line heading/count into the Patients/Referrals tabs.
- The late phone rules that restored and restyled `.pressureStrip` were removed. The earlier established `max-width: 48rem` rule again hides pressure and the diagram together, leaving queue, registers and shortlist as the phone workflow. The phone queue retains the rebuild's larger `min(70vh, 38rem)` cap.
- At 64rem and above, `.diagramHub` now starts at a viewport-derived `clamp(8rem, 18vh, 11rem)` offset rather than using `align-self: center` against the full height of the unit inventory. This places the hub within the initial diagram scroller at ordinary desktop heights. It deliberately remains in the same rigid canvas as every node and the measured SVG overlay: vertical and horizontal scrolling move the hub, nodes and connectors together, without introducing sticky movement that the current ResizeObserver/window-resize measurement contract does not recompute on scroll.

No node, fact, connector type, gate, action, refusal, state, derivation, handler, TSX or print rule changed.

## Checks and acceptance boundary

`git diff --check -- src/components/ward-management/coordinator/coordinator.module.css` produced no output. Static inspection confirms the final cascade contains the non-shrinking queue header and viewport-derived hub offset, while no later phone rule restores `.pressureStrip` after the established hide rule.

No tests, browser work or server work were run by this worker. The controller owns the refreshed six-cell capture, queue header/content scroll-end check, initial and scrolled connector alignment, phone journey, forced-colours and print evidence. Human visual acceptance remains pending that runtime closure.
