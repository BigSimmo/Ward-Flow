# F13 Ward Answer missing-panel correction r25

Date: 2026-09-13  
Implementer: `gpt-5.6-sol / medium`

## Scope

Changed only:

- `src/components/ward-management/ward/ward-screen.tsx`
- `src/components/ward-management/ward/ward.module.css`
- `tests/ward-answer-current-facts.dom.test.tsx`

The source files were edited in place. Before-source copies are in
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-ward-answer-panels-r24/`.

## Result

- Added the drawing's missing `Confirm your beds` panel after the Answer request. It displays current
  ready, empty, allocatable, confirmed-discharge and expected-discharge facts plus the existing
  freshness presentations.
- Extracted the existing capacity form as one local render function. Overview and Answer mount it on
  mutually exclusive branches, so the existing ids, testids, state and ward-scoped `CONFIRM_CAPACITY`
  dispatch occur exactly once.
- Added `Recent answers` from authoritative ward-owned facts only: movements accepted by this unit and
  decline entries recorded against this unit. Recorded times are sorted newest first. Seeded accepted
  facts without `acceptedAt` remain present as `Time not recorded` rather than being dropped.
- Stated the model limits beside the history: no shift boundary and no answering-person name. No role,
  staff identity or shift claim was fabricated.
- Kept the two panels Answer-only and placed them before the synthetic governance disclaimer. Phone
  layouts stack their facts and history rows.
- Scoped compact inline Accept/Decline sizing to Answer at desktop widths. Existing phone and ordinary
  Ward button behavior is unchanged.
- Extended the existing Answer regression test to cover a single live capacity form, its real update,
  both accepted and declined ward-owned history, and retention of undated accepted facts.

The Security gate's existing detail can mention bed availability while the Security verdict passes.
That wording remains unchanged because `ward-eligibility.ts` is engine-owned and this correction was
explicitly presentation-only.

## Ordinary Ward failure diagnosis

The three `ward-bed-release.dom.test.tsx` failures and the one
`ward-daily-return-rows.dom.test.tsx` failure in
`C:/Users/joshs/AppData/Local/Temp/ward-tests-8U7sNh/report-0.json` are stale text queries, not lost
behavior:

- The rendered `ward-unit-beds` DOM contains the expected live values, including `Ready 1`,
  `Confirmed 1`, and `Expected 0`, but each chip now renders its label and number in sibling
  `<span>`/`<strong>` elements. Exact `getByText("Confirmed 1")` and `/^Ready \d+/` queries therefore
  cannot match one element.
- The daily-return test's raw HTML regex likewise expects contiguous `Expected N` text and returns no
  match across the same split markup.

The principled follow-up is to query each `data-state` chip and assert its label and strong value
separately. No Ward product change is indicated by these four failures.

## Evidence

- TypeScript syntax transpile: `PARSE_OK` for the source and regression test.
- CSS delimiter check: `CSS_BRACES 277/277`.
- `git diff --check` on the three owned files: passed with no output.
- Prettier wrote the three owned files successfully.
- Tests and browser checks were not run, as directed; the controller owns the focused rerun and visual
  closure.

## Hashes

| File                                     | Before SHA-256                                                     | After SHA-256                                                      |
| ---------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `ward-screen.tsx`                        | `41A6D29BA79A47B6C40186E2649FF464C2389D42A817349A77C7D6641496F614` | `D33A0BC4E45623E50149C04F4425244C1CBAD9450D954A36E92FD63BE060A2C0` |
| `ward.module.css`                        | `673D2531CDFC83AA569A5AD3E285CFBCCACEC12DECFEF1645EDC6A2050C72CA2` | `7606398D737478A0264D7DE8D7F634E5CACCF6CA2BB7AF7D6B5E642572B43A78` |
| `ward-answer-current-facts.dom.test.tsx` | `E00EB836402298F26282BC80740052B883C7EF41DA2D19610DF54B0BBD419016` | `2C7401A2FCD8568B5137FAE3B6C50EFDB1542666AAC87D864FDEC8DAF4B32988` |
