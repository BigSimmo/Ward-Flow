# F03/F07 patient surfaces visual review r19

Date: 2026-09-13  
Reviewer: `/root/statistics_inventory`  
Scope: independent visual review; this report is the only write.

## Evidence inspected

I viewed all 36 supplied native DPR 1.25 PNGs at original detail under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/`:

- Patient Now: `patient-now-{app,mock}-{390,820,1440}-{light,dark}-r19.png`.
- Patient Search: `patient-search-{app,mock}-{390,820,1440}-{light,dark}-r19.png`.
- Add patient: `add-patient-{app,mock}-{390,820}-{light,dark}-r18.png`, the r18 1440 dark pair, and the corrected `add-patient-{app,mock}-1440-light-r19.png` pair.

These are first-viewport images. They do not prove focus order, keyboard operation, control validation, internal-scroll endpoints, content below the viewport, print, forced colours or screen-reader output. Source was inspected only for the cause of the finding below.

## P2 — Add patient does not identify its four required controls at their labels

Every Add patient app cell labels the controls only **Record number**, **Date of birth**, **Given name** and **Family name**. The paired drawing places a visible **Required** marker beside each of those four labels. The app does eventually explain the rule in its unavailable notice, but at 390px that notice is below the initial viewport; the relationship is also less direct at wider sizes than a marker beside each control.

The current source confirms this is not a capture artifact: `add-patient.tsx` lines 562–618 render plain label text and the corresponding inputs have neither `required` nor `aria-required`. The existing `REQUIRED_FIELDS` gate correctly names exactly those four fields, while Gender remains optional. The smallest correction is to render a quiet `Required` span in each of the four labels and give those inputs native required semantics, reusing the current four-field list or an equally exact mapping. Sex must not be introduced from the drawing; the current engine contract requires four identity fields and keeps Gender optional.

## No other new P1/P2 in the observed cells

- **Patient Now:** the r19 inset correction is coherent in light and dark at all three widths. Identity rows, derived-age explanation and explicit current-movement absence align within the panel; the flat referral action remains visible and readable. The drawing's richer journey is not available from this route's authorised data, so its absence is not treated as a layout defect.
- **Patient Search:** Results remains before Search in the left desktop column, the idle preview holds its intended height, Everything has a legible selected treatment in both themes, and the 390/820 result regions expose bounded internal scrolling without horizontal clipping. The app's larger 49-result population is the current engine's three-population result set and is not a design defect.
- **Add patient:** the corrected 1440-light form width matches the intended two-column form. At 390px the fields stack without horizontal overflow; at 820px they form two columns. The extra What happens next panel and the engine's existing-person list are readable. The difference from the drawing's required Sex field is governed by the current four-field identity contract and is not raised as a defect.

No source, tests, browser session, server or verification JSON was changed or run.
