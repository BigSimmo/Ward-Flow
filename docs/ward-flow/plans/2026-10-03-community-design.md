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
