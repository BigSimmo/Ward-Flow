# Task 6 Community source review

Bounded static review of the Task 6 brief/inventory and current diffs against `1ef9ed3975078b789e9b5d70b3f000c64edc3809`. No tests, browser, server, or source edits were performed.

## Findings

- No render branch was lost: the current file retains the unknown-team branch and all prior `data-testid` values. The five populations, empty/absence notices, referral queue detail, six derived figures, team facts, links, provenance/governance disclosures, and the dynamic `COMMUNITY_TEAM_PAGES` switcher remain present. Existing calculations and source/alias/linkage calls are unchanged in the diff.
- The new `usePrintableDisclosures()` call is safe in this component. It installs document print listeners only, and the moved team switcher is explicitly marked `source-print`, so a closed team disclosure is expanded for print and restored afterward. It does not alter team resolution or list state.
- The opt-in `ward-figure.module.css` rules scope through `[data-ward-design="third-edition"]`, rebind nested figure aliases at the primitive roots, and use the canonical `--t-*` floor (`--t-0`/12px or larger). `WardPanel` already owns its corresponding primitive-level third-edition aliases; Community's consumer overrides do not modify shared defaults.
- Current source preserves all three outgoing links (`All community teams`, `Raise a referral`, `Referral board`) and dynamic team links. The switcher now uses a native details disclosure but still renders every other source-derived team link.

No actionable source issue found within the requested scope. Static review cannot establish computed CSS, browser disclosure/print behavior, or visual fidelity; human visual acceptance remains pending.

## Follow-up closure

- The new in-bed `WardTable` retains the existing count/empty branches and list test-id prefix, adds the real `admission.id` as the row heading, and keeps `bedStateLabel`, `stayLabel`, and `expectedBackLabel` values.
- The pre-existing admitted-before-bed table retains its test-id prefix and fields; both tables opt into `hasScrollThreshold`, matching the consumer-level scroll marker used by the stylesheet.
- The footer's native `aboutDisclosure` is marked `source-print`, so the existing print hook expands it for printing and restores its prior state afterward. No selected-referral control exists in this screen; the report's earlier wording now says `referral queue detail`.
