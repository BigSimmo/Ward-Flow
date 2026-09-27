# F05 Ward statistics correction — r11

## Scope and evidence

Exclusive implementation scope:

- `src/components/ward-management/statistics/statistics-ward-screen.tsx`
- `src/components/ward-management/statistics/statistics-ward-third-edition.module.css`

Actual input bytes are retained under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F05-ward-statistics-r11/`.

I viewed the four served r11 references at original resolution:

```text
7A5CDC9B23CBB3B58BB399F4AF4FAC1CF24B552531265658D1182AD7C75395AC  statistics-ward-app-1440-light-r11.png
7B48BCB8081B721D3582C9ABA7B4A13E6189A667AD0565AF730274E10704246E  statistics-ward-mock-1440-light-r11.png
8BAD742AAC89EE24EB71CC187659341F18FE3348504DA67934DD6E2FBF846AF9  statistics-ward-app-390-light-r11.png
C9CB91B27FB3426CFF7C3F1F244A103502F2536B032DCDFED08F208C6FC00ACD  statistics-ward-mock-390-light-r11.png
```

The source structure was checked against the served drawing markup in
`docs/ward-flow/mockups/statistics-ward-third-edition.html:5155-5418`.

## Implemented structure

- The ward identity remains the first full-width content panel.
- The desktop content now has explicit placement rather than `auto-fit` placement. The left column
  runs Beds now, Occupancy over the window, then the retained Admissions and discharges panel. The
  right column runs Discharge planning, Clinically ready/not yet gone, Referrals, Length of stay,
  then the retained Long stays panel. The governance panel remains full width after both columns.
- At and below 62.5rem every panel returns to one source-readable column. Print uses the existing
  block expansion.

## Beds now

Beds now leads with a four-cell KPI band using only existing values: total ward beds,
`unitCapacity().occupied`, `unitCapacity().available`, and `openBedsNow()`. A five-row table then
shows the existing empty, allocatable, ready, open-now and pending-preparation figures with their
recorded meanings. No percentage, denominator, status threshold or new derivation was introduced.

The original explanatory paragraphs remain byte-for-byte in their meaning and retain all their
existing test IDs. They now sit in a keyboard-accessible native disclosure after the compact facts.
The page uses the existing `usePrintableDisclosures` hook and the established `source-print` class,
so before print the disclosure is opened and afterwards its exact prior state is restored.

## Demonstration charts

Both existing charts remain mounted and continue to receive only branded
`DemonstrationSeries` values. Their visible demonstration badges, not-real-history disclaimer and
full explanatory captions are unchanged. The local stylesheet only reduces SVG height and panel
spacing so the invented series no longer dominates the column.

## Retention check

A static comparison of literal `data-testid`/`testId` values found 43 before and 45 after. Nothing
was removed; the two additions identify Beds now and Occupancy for deterministic layout. Existing
null/nought distinctions, discharge populations, blocker vocabulary, referral overlap warning,
measurement limitations, links and governance content remain in the same source component.

## Hashes

```text
BEFORE                                                            AFTER
ED7AB0E2FE014EE670B1E56C564B15280D5BE026645249C60EB7C7D0174B4447  D780A52070A68DFED4295C3711B02D6617AE8C2BD92DA9CAE2AF82E518B83B72  src/components/ward-management/statistics/statistics-ward-screen.tsx
877647B3AC0F0700420D47D4DC9095EFC11540267761D0B74C3FA7D7A0EDC325  3A0B64CE661D282029561FEE84E108F9A686ACC3F1D7A678478913380F826FA8  src/components/ward-management/statistics/statistics-ward-third-edition.module.css
```

## Static evidence and limits

- `npx prettier --check` for both owned files — passed.
- `npx eslint src/components/ward-management/statistics/statistics-ward-screen.tsx` — passed with
  no findings.
- `git diff --check` for both owned files — passed.

No tests, application server or browser were run under the controller-owned boundary. The r11 app
captures precede the controller's shared frame colour-alias repair, so they demonstrate the prior
failure but cannot establish the corrected palette. Desktop column placement, disclosure printing,
table wrapping, chart height, phone order, dark mode and forced colours remain pending served
runtime evidence.

The application retains more explanatory clinical and measurement prose than the drawing. The
densest Beds-now material is now disclosed after its compact summary, while the other panels retain
their existing assertions rather than hiding or shortening safety-relevant population limits.
