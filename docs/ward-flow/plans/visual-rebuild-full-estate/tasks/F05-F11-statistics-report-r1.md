# F05 + F11 Statistics family report — revision 2

## Scope and evidence

- Approved plan SHA-256: `2194350e1ad66ed47049cf7eaa115db7789d8bebae18ab06c465559b253b4155`.
- Baseline HEAD supplied at the first increment: `1ef9ed3975078b789e9b5d70b3f000c64edc3809`.
- Original before bytes: `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-statistics/manifest.json`.
- Accepted presentation increment before the structural continuation: `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-statistics-r2/manifest.json`.
- Served references inspected for the structural continuation:
  - `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/statistics-ward-reference-1440-light.png`
  - `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/statistics-landing-reference-1440-light.png`
- Owned routes: Statistics landing, service, ward, community and emergency-department Statistics.
- Accepted Overview and Compare source, shared section frame, shared Statistics CSS, claims, charts, primitives, engine, shell and tests were not edited.

## Completed implementation

All five mounted routes retain the page-scoped third-edition token and layout seam from revision 1. Existing state, derivations, conditional branches, actions, navigation destinations and disclosure wording remain authoritative.

### Landing

The former two broad audience panels are decomposed into the drawing's six real panel regions, in drawing order:

1. `Across all services` carries the service-wide bed facts and the explicit unavailable offer measure.
2. `Flow over time` carries the existing patient flow interval and chronology evidence.
3. `Where the pressure is` carries referrals refused by every ward asked so far and blocked discharge reasons.
4. `Emergency departments` carries the existing decline attribution refusal and decline-reason distribution.
5. `Community teams` retains the complete dynamic team chooser and adds an explicit statement that this landing page does not calculate a single network community figure.
6. `Referrals for a bed` carries the existing referral-to-bed join evidence and its stated limit.

The six regions use a full-width Across/Flow stack followed by two-column Pressure/ED and Community/Referrals rows at desktop widths, collapsing to one column at the existing 40rem landing breakpoint. The existing route index and health-service chooser remain available as additional navigation surfaces. No destination was typed locally or removed.

### Ward

The former comprehensive outer measures panel is now the drawing's independent two-column panel structure:

- left: `Length of stay`, then `Admissions and discharges`;
- right: `Discharge planning`, `Clinically ready, not yet gone`, `Referrals into this ward`, then `Long stays`.

The ward identity remains full width above `Beds now` and `Occupancy over the window`. The final `What this page is, and what is invented` panel retains the chooser link and zero-versus-absence explanation.

Every previous test id remains present. All three nullable measurements retain their worded absence branches; every measured zero remains a number. The full blocker vocabulary, current-versus-cumulative referral warning, discharge-date population distinction, chronology exclusions and demonstration-chart disclosures remain unchanged. Desktop columns are independent vertical stacks; they become one column at 62.5rem and document flow in print.

### Community

The page now exposes every drawing heading as a panel. Supported current facts remain derived from `communityFigures` and are shown under `Discharges from hospital into this team's care` and `People currently in a hospital bed`, with the same facts still fully defined in the Caseload table.

The unsupported drawing measures are visible stated absences rather than missing panels or zeros:

- `How long each open case has been open`: no community-case opened instant exists.
- `Referrals into the team`: no existing community Statistics derivation defines a reporting-window population; the page does not mislabel all retained referrals as one period.
- `Where referrals came from`: the existing derivation does not classify origin.
- `Time to first contact`: no community contact event or pair of instants exists.
- `Contacts`: community contacts are not records in this prototype.
- `The same cases, grouped`: points to the one existing four-category Caseload derivation instead of creating a second vocabulary.

The existing cross-team comparison, provenance, unseen-admission limit, chooser routing and operational-team link remain unchanged.

### Emergency department

The existing drawing-shaped panels already carried truthful stated absences for `Wait time over the last 30 days` and `Where they went, last 7 days`; those remain intact. Desktop placement now follows the drawing's summary and two-column order: band distribution/waiting on the left and trend/destinations on the right, followed by the full-width comparison and provenance panels. Existing measured wait rows, decline facts and the broader model-limit explanation remain visible below the drawing-shaped panels rather than being removed.

### Service

The revision-1 service presentation remains unchanged: identity and current 30-day flow span the grid, while ready-bed cohorts, destinations, out-of-area bands, demonstration trends, caveats and chooser navigation retain their existing source order and behavior.

## Retention evidence

A source-only retention comparison against `before-statistics-r2` found no missing pre-existing `data-testid` values in any of the five TSX files. Link and button element counts are unchanged on every route. Panel counts changed only where required by the structural decomposition: landing 4 to 7, ward 4 to 10, community 5 to 13; service and ED remain 5 and 10.

TypeScript `transpileModule` parsed all five TSX files and PostCSS parsed all five page-scoped CSS modules: `PARSE_OK tsx=5 css=5`.

No tests, browser checks, local server or Git operations were run under this worker's boundary. Controller-owned runtime comparison remains required before visual acceptance.

## Truthful differences from the drawings

- Landing uses the current engine's evidence-heavy measurements and absences under the six authoritative headings. It does not copy the drawing's fabricated headline totals or 14-day series, and it retains the Statistics route index plus dynamic service/team choosers.
- Ward's `Admissions and discharges` region carries the existing supported flow intervals. It does not invent today/week/month admission totals. The discharge-planning region retains current date coverage and outcome facts without fabricating a monthly history table.
- Community has no community-case or contact event model. Those drawing regions say precisely why no value exists. Supported hospital/current-bed figures are repeated under their matching drawing headings and explicitly identified as the same figures defined in Caseload.
- ED retains additional real explanatory panels for declines and unmeasured model facts. Removing them would erase current source truth merely to reduce panel count.
- Governance/access text and invented-data disclosures remain more extensive than the drawings because they are existing application contracts.

## Output fingerprints

| File                                            | Revision-2 input                                                   | Output                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `statistics-screen.tsx`                         | `c7c03a1d628f9d09d5eec1298467485573b66d382db34db2498309c100d5f5fe` | `ae733be5874f264900b748aa0e4f70b96b7de4299087535e5bbefdc93f9cc6a0` |
| `statistics-service-screen.tsx`                 | `9df6e431f1da1bd6ca3878aa11df696d96470f2a490ece9d5b54cf0a45f2a577` | `9df6e431f1da1bd6ca3878aa11df696d96470f2a490ece9d5b54cf0a45f2a577` |
| `statistics-ward-screen.tsx`                    | `3094ddeac5f053fa8716212e60b291ad9e7a14b0745427a8d449de3afda4b0d0` | `ed7ab0e2fe014ee670b1e56c564b15280d5be026645249c60eb7c7d0174b4447` |
| `statistics-community-screen.tsx`               | `6fd3d75f3a6207219ed16002525d76695843c15c07c7e8d84b847bb4d25dbef6` | `4efc4e4e9fe2102aff13e145bdd095df7359ac807ba82926ca4631f84555fe61` |
| `statistics-ed-screen.tsx`                      | `99afad7c92eb370f880d99384ab45700c3ca2da8c4fbdd6d982b2a8079f544f9` | `99afad7c92eb370f880d99384ab45700c3ca2da8c4fbdd6d982b2a8079f544f9` |
| `statistics-landing-third-edition.module.css`   | `7d878c49c31ea1c4b44856dfa36186670aabdeb51cf09c4e689cf12df2e2fe33` | `12d5dab4789e073b71724527ec4b8c02b8c18b8f1753b4fe3415417d17104049` |
| `statistics-service-third-edition.module.css`   | `cfc4910827d90e0963eb900e7dc3f41b8afebe001c02a23ebd0b917f4827ecce` | `cfc4910827d90e0963eb900e7dc3f41b8afebe001c02a23ebd0b917f4827ecce` |
| `statistics-ward-third-edition.module.css`      | `f21331988893a34d7b7285d66d67b7201f9ca0f9c1524fce5d438b5cb4e8ce47` | `877647b3ac0f0700420d47d4dc9095efc11540267761d0b74c3fa7d7a0edc325` |
| `statistics-community-third-edition.module.css` | `d85326adde120a51ce70badda1af351d88be4d08cf9b886b898edba706ad3c06` | `d85326adde120a51ce70badda1af351d88be4d08cf9b886b898edba706ad3c06` |
| `statistics-ed-third-edition.module.css`        | `2d90174e1b80732c9cea903018542aea27fc07576d54f8643ee7baa606022599` | `850fabffbea5ac821492518fa9caf2ead76327ed3c9065c526e5ea957327c6a5` |

## Controller verification requested

Run the affected Statistics DOM suite and the Statistics journey selected by the plan. Visual acceptance should cover all five routes at 390, 820 and 1440 pixels in light and dark, including below-fold panel order, table overflow, unresolved ids, entity switching, print and forced colors. Overview and Compare need regression cells because they share the mounted frame even though their content source was untouched.
