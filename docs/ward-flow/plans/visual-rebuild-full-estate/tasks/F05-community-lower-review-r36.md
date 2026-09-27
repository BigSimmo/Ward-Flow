# F05 Community lower review r36

Reviewed these 18 supplied app captures directly:

- `community-table-end-app-{390,820,1440}-{light,dark}-r36.png`
- `community-operational-accepted-end-app-{390,820,1440}-{light,dark}-r36.png`
- `community-operational-lower-app-{390,820,1440}-{light,dark}-r36.png`

## Findings

- No current P1/P2 visual defect is evident in the inspected regions. The table-end captures show the final team rows and the two provenance/absence panels in both themes. At 390px the table has an explicit horizontal scroll track; visible row labels and values remain readable in the viewport.
- The accepted-end captures show the Expected back list with its count and the Discharged into the catchment panel beginning below it. The narrower crops end during that next panel; this is a crop boundary, not evidence that the panel is missing. The 1440px crops continue through Left the ward another way, Referrals we have made, What this page cannot tell you, This team, and the Go to panel, with no visible clipping or theme contrast failure.
- The operational-lower captures show the empty/refusal panels, provenance wording, This team facts, and Go to links with readable spacing in both themes. No unsupported action or invented contact data is visible in these crops.

## Evidence limits

The 390px and 820px accepted-end images do not show the full Discharged into the catchment contents; the 390px operational-lower image ends within the absence panel; and the 1440px operational-lower image begins the About panel at its bottom edge. These captures do not prove chooser/back interaction, link activation, keyboard/focus behavior, print output, or complete page-end coverage. No source, test, browser, or canonical verification files were changed.
