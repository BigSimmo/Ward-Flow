# F05 Statistics Compare/Ward lower review r36

## Evidence inspected

The requested 12 Ward captures were inspected directly:

- `statistics-ward-{discharge,end}-app-{390,820,1440}-{light,dark}-r36.png`

The Compare captures were present under the gitignored artifact directory and were subsequently inspected directly:

- `statistics-compare-{table-end,chooser-end}-app-{390,820,1440}-{light,dark}-r36.png`

## Ward findings

No current P1/P2 visual defect is evident in the 12 Ward captures. The discharge captures show the existing discharge-planning figures and clinically-ready blocker rows with readable wrapping at 390px and aligned values at 820px/1440px in both themes. The end captures show the blocker tail, Referrals into this ward, Long stays, and the What this page is, and what is invented panel without visible clipping or contrast failure. The 1440px captures retain the intended two-column lower composition; the narrower captures stack it cleanly.

## Compare findings

No current P1/P2 visual defect is evident in the 12 Compare captures. The table-end captures show the final ward and emergency-department cards with readable names and hospitals in both themes; the 390px view intentionally stacks cards. The chooser-end captures show the final cards followed by the provenance panel and footer at all supplied widths, with no visible clipping or contrast failure.

## Evidence limits

This is image-only evidence. It does not prove chooser/entity-switch activation, keyboard/focus behavior, print output, or content outside each crop. The initial absent-Compare statement was caused by omitting gitignored artifacts and is superseded by the direct inspection above. No source, test, browser, or canonical verification files were changed.
