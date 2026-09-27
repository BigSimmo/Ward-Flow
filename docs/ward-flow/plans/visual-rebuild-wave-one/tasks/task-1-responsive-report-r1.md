# Task 1 responsive rail correction report — revision 1

Date: 2026-09-12  
Agent: `statistics_inventory` / gpt-5.6-sol / medium  
Plan SHA-256: `976FAD1AED1E13F0AA7D59CE520A0283471A488E723F965F64ADD4506E6EA666`

## Result

Below the existing 1000px breakpoint, the Ward Flow rail now keeps the third-edition drawing's core destinations plus the active registry entry in one wrapping navigation stream. Every other registered destination remains available through a 48px `More pages` trigger backed by the existing shared `Sheet`.

Desktop behavior and geometry are unchanged: the full registry remains in the existing grouped, scrolling rail, including its open/closed preference, shift statement, pinned absence, disclaimer, reconciliation line and toggle.

## Changed files and hashes

- `src/components/ward-management/shell/ward-rail.tsx` — `7D27D784007C8923C8F5344168A4C3B6C238DC27692DEB1A36D76E15D5DFD431`
- `src/components/ward-management/shell/ward-rail.module.css` — `089192B3923069B60A4B94B11BE47DF7558B578D0C374C88CEADBCBF08418626`

This report is intentionally excluded from its own pre-write hash list.

## Implementation

- `railEntries()` remains the only destination source. The compact policy selects registry IDs; every rendered href, label, icon, count and active state still comes from the same `WARD_VIEWS`/`WARD_NAV` entry.
- The narrow in-flow set is Command, Movements, Capacity, All wards, Emergency department, All community teams, Patient search, Referral board, Handover, Statistics and Governance. A registered active route outside that set is promoted into the in-flow set for that render.
- Non-core entries remain in the desktop lists and are hidden only below 1000px. The open Sheet renders those same derived extra entries with the existing link renderer, so count labels, current-page semantics and announcements do not fork.
- The shared `Sheet` supplies dialog semantics, focus trapping, Escape/backdrop close and focus restoration. Its initial focus is the first extra destination and its return target is the More pages trigger.
- A Sheet link's click handler only announces and closes local overlay state. It does not prevent default or replace Next Link navigation, so Ctrl/Cmd/Shift/Alt clicks retain native modified-click behavior.
- At the narrow breakpoint, `.railScroll`, semantic group wrappers and `.railList` use `display: contents`. Their `nav`, `section`, `ul` and `li` semantics remain in the DOM while the visible links, brand and More pages control participate in the rail's single flex-wrap stream. This corrects the first runtime capture, where separate list boxes still reserved full rows and left the rail about 555px tall.
- The second runtime capture exposed a specificity collision: an unnecessary `.railList > li { display: block }` rule outranked `.compactExtra { display: none }` and restored all 23 links. The generic rule was removed, leaving the compact hide selector effective while list semantics remain intact.
- The reconciliation line retains one instance at every width and takes a full row after navigation. The full synthetic-data disclaimer remains in the desktop rail footer under the existing contract; the narrow footer remains hidden exactly as before.

## Deliberate deviation

No `New referral` action was added to the Hub bar. D-16's primary-action registry explicitly resolves the Hub route to `{ kind: "none" }`; adding a bar action would contradict that engine-owned absence. The responsive rail retains both Referral board and New referral as registered destinations, with the latter available through More pages.

## Verification boundary

- `git diff --check -- src/components/ward-management/shell/ward-rail.tsx src/components/ward-management/shell/ward-rail.module.css` — `SCOPED_DIFF_CHECK_CLEAN`.
- `node_modules/.bin/prettier.cmd --check src/components/ward-management/shell/ward-rail.tsx src/components/ward-management/shell/ward-rail.module.css` — both files match Prettier style.
- TypeScript `transpileModule` syntax check for `ward-rail.tsx` — `WARD_RAIL_TSX_TRANSPILE_CLEAN`.

No tests, browser work or server commands were run by this agent. The controller owns frozen 390px, 820px and 1440px captures and must confirm the final wrapped height, Sheet operation, focus return, modified clicks and desktop invariance before visual acceptance.

Controller correction: model label verified against the original spawn arguments (gpt-5.6-sol, medium, fork_turns none); the earlier generic GPT-6 persona label was inaccurate.
