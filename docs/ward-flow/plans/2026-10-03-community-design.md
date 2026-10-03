# Community directory design - 3 October 2026

Task: community-design-c53c. Fast Preview, local only.
Base: 461d5e06e5ebc4e198068de1d90cd84689008642 (verified local main).

Removed the four summary cards and the unwired Export Directory action. Retained referral actions, catchment guide, derived counts, search, alphabet navigation, separate source names and prototype disclosure. The page now has a visible heading, a neutral search surface, subtly spaced alphabet letters without an internal scrollbar and alternating bordered directory rows.

Removed circular border-token aliases that suppressed separators. Similar-name details remain at the bottom, collapsed into a 50px strip with an accessible expansion control. Explicitly hide its body while collapsed and prevent the flex layout retaining empty space.

Verification: 23 focused tests passed across gateway, index and alphabet accessibility suites. The existing scope suite has five skipped tests. Changed-component ESLint and git diff --check passed. Local Community route visually inspected; searching Albany showed 1 of 64, clear restored the directory, letter C focused its heading, and the bottom strip expanded and collapsed (50px closed). No responsive breakpoint rules changed. Full suite, hosting and deployment unverified; no provider calls or publication.

Owner correction: removed the boxed, scrolling alphabet rail. Retained a plain vertical rail with a small gap between letters. Josh approved scoped takeover of community-index.tsx. Browser confirmed alphabet rail has no border or internal scrolling, with 20px letters and 4px gaps.

Follow-up: matched the header search with a recessed surface, rounded corners, inset depth, soft outer elevation and an accent focus ring. Results use separated rounded rows with soft elevation instead of a bordered grid. Alphabet rail remains plain and non-scrolling.

Further search refinement: removed legacy ancestor-dark overrides that flattened the shadow even with the explicit light palette. Search and filters share a 56px height, with 16px search curvature, layered inset and outer shadows, and aligned internal spacing. Palette remains token based.
Browser proof for the refinement: computed 56px search height, 16px corner radius and four active shadow layers; left edge matches the alphabet rail at 20px. Albany search returned 1 of 64 and Clear restored 64. CSS-only follow-up; no repeat unit suite required. git diff --check passed.

Compact refinement: reduced search/filter height from 56px to the 48px tap target, softened depth to a small outer shadow and light inset, removed the filter container border and shadow, and increased the result-count gap to 12px.
Browser verified both controls at 48px and count gap at 12px; visually reviewed desktop, Albany filtering and Clear. CSS-only refinement; no repeat unit run. git diff --check passed.

Name-filter dropdown: replaced the segmented buttons with one labelled native select. Default All names and optional Names that read alike retain their derived counts and filtering. Compact styling uses a clear chevron and keyboard focus ring; updated the existing filter interaction test without removing assertions.
Dropdown evidence: 18 tests passed across gateway and alphabet accessibility suites. Browser selection alike showed 22 of 64; all restored 64. Desktop screenshot reviewed, git diff --check passed. No publication or deployment.

Useful filter and button polish: added Recently opened using the existing local recent-team store, intersected with source teams and search. Empty history is explicit. Unified page action and guide buttons with restrained elevation, rounded corners, consistent tap targets and focus rings; refined recent links and warning markers. Shared sidebar/header controls remain outside this page scope.
Verification: 19 focused tests passed, including visited-source filtering and its combination with search. Browser checked empty recent history, restoring All names, and opening/closing Catchment Guide; desktop appearance reviewed. git diff --check passed. Publication and hosting remain unverified.

Final cohesion pass under the revised Rapid Design Iteration Prompt: show recently opened chips only when visits exist, distinguish the list heading as A–Z directory, simplify guide labels and similar-name guidance, and remove the unwired matrix download and its unused local toast. Existing source derivation, synthetic disclosure and separate-name warning remain. No shared chrome edits.
Cohesion verification: initial selected run found one obsolete heading-copy expectation (23 passed, 1 failed). Replaced it with the same directory-section presence check using its stable test ID; targeted rerun 5/5 passed. Combined valid suite evidence: 24 focused tests passing, no tests removed. Diff-integrity passed 5 -> 5 against 1617ef7. Browser inspected desktop page and guide copy, Close and Escape with focus return. git diff --check passed.

Search placement refinement: stop the field growing across the page; cap it at 22rem (352px), left-aligned beside the filter. It shrinks on narrow screens and the existing flexible row wraps the filter when needed. No shared chrome edits.

Local browser check: desktop search width 352px; at 390px viewport search shrinks to 335px and filter wraps below with no horizontal overflow. Temporary viewport reset. Formatting and git diff --check passed.
