# F11 DOM selector corrections r1

Date: 2026-09-13  
Writer: `/root/hub_inventory`

## Failure evidence

Read `C:/Users/joshs/AppData/Local/Temp/ward-tests-nStJ4c/report-0.json` and classified the three failures without executing tests.

1. `ward-screen-overview-and-entry.dom.test.tsx:160` used an unscoped `/All wards/` heading query. The current page correctly has an `h1` named `All wards` and an `h2` directory heading named `All wards 23 wards`; the count assertion intended the latter.
2. `ward-statistics.dom.test.tsx:198` still assigned the two decline articles to `ward-statistics-pressure`. Current source places both `ward-statistics-declines` and `ward-statistics-declines-by-reason` inside `ward-statistics-emergency-departments`.
3. `ward-statistics.dom.test.tsx:350` repeated the same stale pressure-panel ownership query for the withheld decline article. The article and its complete withheld explanation remain present under Emergency departments.

These were obsolete layout selectors. No missing product behavior was found.

## Corrections

- Scoped the ward directory-count query to the level-two `All wards` heading. The separate level-one page-title assertion remains unchanged.
- Updated only the two decline entries in the exhaustive Statistics placement table to their current Emergency departments owner. The exhaustive rendered-article equality, positive owner assertion, and negative system assertion remain intact.
- Updated the standalone withheld-decline assertion and its description to query the same current owner. Its conceptual copy assertions, both-record requirement, missing-record assertions, and the full withheld behavior checks are unchanged.

## Before-source evidence

Byte-exact copies are under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-test-selector-corrections/`.

| Test                                                | Before SHA-256                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| `tests/ward-screen-overview-and-entry.dom.test.tsx` | `E7A52EED21C762647AB1C06BB54AAD85036CFB206DCB1BC9F2AC4C618694370D` |
| `tests/ward-statistics.dom.test.tsx`                | `EFE03D4B40353D02FEB87D82D518BC51B0E8DB2227F53E5C2DAB9A911E10F74D` |

## Source checks

- Prettier formatted the two owned test files once.
- TypeScript syntax parse passed for both files.
- A static ownership check confirmed both decline articles occur between the current Emergency departments and Community teams panel boundaries.
- A static content check confirmed the withheld statement and its referral/movement record explanations remain in current product source.
- Tests were not executed, as instructed.
- No product source, browser, server, or Git operations were performed.

## After-source evidence

| Test                                                | After SHA-256                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| `tests/ward-screen-overview-and-entry.dom.test.tsx` | `CF18D2B0C2E866DF02984697F0AF513256E224F3AEEAD3A35CFD35FBD3AC18EE` |
| `tests/ward-statistics.dom.test.tsx`                | `AB8CA0DCBFDFD85C1D1A03456224DDA9F53852F1F622E7D691AD6CCBE2E603F4` |

Runtime test confirmation remains controller-owned.
