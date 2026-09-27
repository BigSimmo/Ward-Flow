# Focused batch evidence — report-0

Source: `C:/Users/joshs/AppData/Local/Temp/ward-tests-i9LIiX/report-0.json`. This records the controller's run only; no rerun, browser, server, or source/ledger/verification-schema change was made here.

Command supplied by the controller:

```text
node .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-focused.mjs tests/ward-community-corrected-claims.test.ts tests/ward-facade-agrees-with-screens.test.ts tests/ward-command-third-edition.dom.test.tsx tests/ward-community-team-hub.dom.test.tsx tests/ward-community-third-edition-headings.dom.test.tsx tests/ward-delays-screen.dom.test.tsx tests/ward-delays-third-edition.dom.test.tsx tests/ward-statistics-compare-two-tables.dom.test.tsx tests/ward-statistics-overview-invented.dom.test.tsx tests/ward-statistics-overview-parked.dom.test.tsx tests/ward-statistics-sections.dom.test.tsx
```

## Aggregate

The controller summary is **11 handed in / 11 ran / 209 collected / 203 passed / 2 failed / 4 pending**. The JSON also reports 49 discovered suites, of which 45 passed and 4 failed at the broader discovery level; the bounded batch figures above are the relevant positional-file result.

## Per-file counts

| File                                                 | Passed | Failed | Pending/skipped |
| ---------------------------------------------------- | -----: | -----: | --------------: |
| `ward-community-corrected-claims.test.ts`            |     29 |      0 |               0 |
| `ward-facade-agrees-with-screens.test.ts`            |     39 |      1 |               0 |
| `ward-command-third-edition.dom.test.tsx`            |      8 |      0 |               0 |
| `ward-community-team-hub.dom.test.tsx`               |      0 |      0 |               4 |
| `ward-community-third-edition-headings.dom.test.tsx` |      7 |      0 |               0 |
| `ward-delays-screen.dom.test.tsx`                    |     21 |      1 |               0 |
| `ward-delays-third-edition.dom.test.tsx`             |     13 |      0 |               0 |
| `ward-statistics-compare-two-tables.dom.test.tsx`    |     29 |      0 |               0 |
| `ward-statistics-overview-invented.dom.test.tsx`     |      5 |      0 |               0 |
| `ward-statistics-overview-parked.dom.test.tsx`       |     13 |      0 |               0 |
| `ward-statistics-sections.dom.test.tsx`              |     39 |      0 |               0 |

The four pending entries are all `skipped` in `ward-community-team-hub.dom.test.tsx`. Their exact titles are:

- the fixture genuinely carries other destinations, so the absence assertions below are not vacuous
- renders its own team's addressing, including a cancelled arm's own words
- shows NOTHING about the referral's other destinations — not a count, not a name, not the word “elsewhere”
- says plainly it does not name any other destination

The JSON provides empty `failureMessages` for these skipped entries and no additional skip reason.

## Diagnosed failures

- `ward-facade-agrees-with-screens.test.ts`: shell-bar literal statistics route assertions now conflict with the existing constants; the correction is to use those constants.
- `ward-delays-screen.dom.test.tsx`: the global `of 43` locator matches the new wait-band entries and the panel count; the correction scopes the query to the Waiting region.

Those corrections were reported by the controller but were **not rerun** in this evidence record.
