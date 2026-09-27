# F14 Hub and Governance visual closure — r37

## Scope and evidence

Read-only inspection of eight current served-app captures. This is targeted closure evidence for the final Community preview and corrected Governance subtitle, not a full-screen or 34-item definition-of-done review.

| Capture                                                | SHA-256                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| `hub-last-community-preview-app-390-light-r37.png`     | `F19CCA028927F6BED08E14B10233938B2BFEF17F21D8BB6B78316710798671B4` |
| `hub-last-community-preview-app-390-dark-r37.png`      | `F7A23FA73613136C18A6DA8BE9AA050B18073587F3B34E34658225D8D98E9D6F` |
| `hub-last-community-preview-app-820-light-r37.png`     | `3718D51886D9068DA0B55D4A203481813EF9AD1D3A1C2EE75590F7A79F4E9AC3` |
| `hub-last-community-preview-app-820-dark-r37.png`      | `58E3BA73A00FD5EA99BF57FAA71F184B4250325C55C26567485BB6777339F074` |
| `governance-subtitle-corrected-app-390-light-r37.png`  | `C9030AB342F11780972D5D27233EB7B1944E9BA4B023D49F8241DF933A6C783D` |
| `governance-subtitle-corrected-app-390-dark-r37.png`   | `F6D1E6F788F4B1A093BBD4F0B44A833D33E453026B26EA7AE1803DEFC38DA0F4` |
| `governance-subtitle-corrected-app-1440-light-r37.png` | `25FCD18459EE9A209A5D53D87D500C5FE287DE9C9AD46A182B30B92720E54C61` |
| `governance-subtitle-corrected-app-1440-dark-r37.png`  | `7BEAD90E43DA65EF5A13EB847720AF0F6B87F510A9E9F7551F0B8A8FF1B6483C` |

## Findings

No P1 or P2 visual defect remains in the inspected regions.

### Hub final Community preview

- The 390px and 820px captures in both themes show the selected Kimberley placeholder as a Community team, with its region, prototype-name disclosure, absent bed and queue facts, and synthetic-data provenance retained.
- The action truthfully says it opens the Community team index and the adjacent text explains why this placeholder has no per-team statistics route. The button remains contained and readable at 390px.
- The list and preview remain separate bounded regions. At 390px the Notes subsection continues inside its visible internal scroll region; a scrollbar and directional affordances are present, while the action, absence explanation and provenance remain visible below it. There is no observed horizontal clipping or theme-contrast failure.
- Controller-supplied journey evidence, separate from the screenshots: filtering `SJGS` produced two results; two ArrowDown presses plus Enter opened the real SJGS ward route. Browser Back returned to Hub; after the list settled, Escape restored 41/41 results, emptied the value and returned focus to search. This was not re-executed by this reviewer.

### Governance effectiveness subtitle

- The corrected subtitle reads `Two measures reported for this synthetic scenario` in all four captures. It accurately covers the two displayed rows without implying that both produce a computed value: median referral-to-acceptance says `Not enough data to compute`, while average units contacted reports `1.2 units`.
- The phone order remains Public grounding, Change audit, then Effectiveness. Both rows, their denominators, the synthetic-scenario limitation and the unpublished third-measure explanation are readable and contained in light and dark.
- At 1440px the independent left and right columns remain legible: Public grounding and Effectiveness form the right column while decision/change audit content stays left. The differing column heights create open ground but do not hide or reorder content.

## Limits

These captures do not re-prove Hub search focus styling at every intermediate state, the complete list scroll range, Governance controls above the captured desktop position, print, forced colours, screen-reader output, physical devices, or human acceptance. No source, test, browser, generated verification record or canonical document was changed during this review.
