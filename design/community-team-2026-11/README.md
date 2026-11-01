# Community team page: locked design

_Updated 2026-11-01 - design and structure locked by Josh at 08:29 Perth time; Design owns._

**In one line:** this folder holds the approved design for the community team page (`/ward-flow/community/[teamId]`), the source that draws it, and the instructions to build it. It changes no app code.

- **Status:** design and structure locked by Josh on 1 November 2026 ("lock in this design and structure for mockups"). Josh approved the build at 08:33 ("complete all the builds for mockups"); it follows [BUILD.md](BUILD.md).
- **Interactive mock-up:** <https://claude.ai/artifact/V4JG7mtEBPhF1Q25DkEnGB> (private to Josh until he shares it).
- **Build instructions:** [BUILD.md](BUILD.md).
- **Data:** every person, clinician, phone number and figure is invented. Real data needs separate clinical, privacy and legal review first.

## What is here

| Path                                       | What it is                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `BUILD.md`                                 | What to build, which real components to reuse, the data the app lacks, the PR order and acceptance checks |
| `screenshots/tab-*.png`                    | The five tabs at 1440px, light                                                                            |
| `screenshots/referral-page-light.png`      | The full referral page, light                                                                             |
| `screenshots/referral-page-dark.png`       | The full referral page, dark                                                                              |
| `screenshots/referral-document-viewer.png` | The document preview on the full referral page                                                            |
| `mockup/`                                  | The scripts that draw the mock-up from the real local page                                                |

## How the mock-up is drawn

The mock-up is not a hand-drawn page. `mockup/capture.cjs` opens the real Midland page and the real ward page in the local app, takes their CSS, runs `mockup/transform.js` to rebuild the hero and body using the real kit and ward class names and `--wf-*` tokens, and saves one self-contained HTML file. `mk.css` holds the mock-up's additions, `mk.js` its clicks, and `notes.html` the "Mock-up notes" panel listing what the app does and does not hold.

To redraw it:

1. Start the local app on port 3377 (`npm run ensure`).
2. From the repository root, run `bash design/community-team-2026-11/mockup/run.sh`. It writes `community-team-mockup.html` and one screenshot per tab beside the scripts. Both are git-ignored.
3. `node design/community-team-2026-11/mockup/viewref.cjs light` (or `dark`) screenshots the referral panel, the full referral page and the document viewer.

The class names in `transform.js` are the hashed CSS-module names from the build of 1 November 2026. If a kit stylesheet changes, the hashes change and the mock-up needs those names updated. The build itself uses the components, not these names.
