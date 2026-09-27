# Task 4 Command correction report — revision 2

Date: 2026-09-13  
Source baseline: `1ef9ed3975078b789e9b5d70b3f000c64edc3809`  
Plan SHA-256: `9ECE16E99228AF0B4053D7C6ED75CF694354EE9BBCBA9D0EC48A20F55573201E`  
Review input: `task-4-review-r1.md`, SHA-256 `188EE9158520F6CE291C615F1F1F48DF603378CD24F312A302B642BC2CBA5763`

## Corrected result

The Command queue now gives every rich row its intrinsic content height and scrolls the list around those complete rows. The selected row uses the established full fill and ring treatment without adding a left state stripe. The pressure cards no longer draw decorative status edges. The narrow queue header stacks its title and count, and the desktop diagram hub is vertically centred with tighter node spacing that retains every existing name, capability, bed state, destination and eligibility fact.

## Changed paths and hashes

Only `src/components/ward-management/coordinator/coordinator.module.css` changed in this correction pass.

- `coordinator.module.css`: `2CD43DE862A1F3AFA0586C1A62110F970508505D56C71D83B3B29763BD5AF2EC`

Unchanged Task 4 source hashes:

- `coordinator-screen.tsx`: `3A3ED8DFCA64042E8DB4CD510167F3CE15E6118BD3817998F5B9987EE70384EF`
- `pressure-strip.tsx`: `30C2414ED844450383FF33709706CAAD6A05BB3FD8D76C834A5A15C85755302A`

## Corrections applied

- `.queueList` now uses `align-content: start` and `grid-auto-rows: max-content`. Its bounded panel remains the scroll owner; rows cannot shrink to their 3rem target floor and cover cohort, route, legal, wait or score content.
- `.queueRowSelected` keeps the accent fill and uses a complete 2px inset outline. The short left stripe is removed because the drawing's selection policy is a whole-control treatment.
- The pressure-card `::before` rules and breach recolouring were removed. Breach status remains written in each applicable card and continues to determine engine-owned ordering.
- The queue header again stacks its heading and derived count in the 14rem column, avoiding the two-line title beside a competing count.
- At diagram widths of 64rem and above, the flow hub centres itself in its grid track. Department/service/unit gaps and node padding are tightened without truncation, hiding or removal.

The schematic remains taller than the drawing because the app preserves full department names, unit capability, all bed states, eligibility reasons, recorded destinations and referrals. That is an explicit behavior/content retention constraint rather than a remaining permission to hide facts for visual density.

No TSX, derivation, state, ordering, filter, form, handler, seed or test changed.

## Checks and acceptance boundary

`npx prettier --write src/components/ward-management/coordinator/coordinator.module.css` ran once and reported the file unchanged. `git diff --check` is clean for the coordinator scope. Static inspection confirms the intrinsic queue-row rules are present and the pressure pseudo-elements and selected-row stripe are absent.

No tests, browser work or server work were run by this worker. The controller owns the focused Command DOM and interaction run, refreshed 390px/820px/1440px light/dark captures, scroll-end inspection, focus, forced-colours and print evidence. Human visual acceptance remains pending those refreshed captures.
