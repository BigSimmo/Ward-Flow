# F09 Alerts and Settings visual review r33

Date: 2026-09-13  
Scope: read-only original-detail review of 18 supplied actual captures.

## Finding

- **P2 — Settings “Demonstration controls” body copy has no panel-body inset.** In
  `settings-thresholds-app-{390,820,1440}-{light,dark}-r33.png`, the paragraph starts directly on the
  panel's left border while the heading above and the bodies of the neighbouring Settings panels are
  inset. At 390 px this creates an especially abrupt edge beneath the header divider; the same
  misalignment remains clear at 820 and 1440 px in both themes. The smallest correction is a
  Settings-local body inset matching its existing panel content padding, without changing the
  read-only explanation or adding controls.

No other P1 or P2 issue was found in the pictured regions.

## Observed closure and containment

- All three opened Alerts disclosure regions remain contained and readable at 390, 820, and 1440 px
  in Light and Dark. “For other roles” records preserve their three-column relationship where space
  permits and stack coherently on phone. The limitations cards and the “What is invented and what is
  real” provenance rows remain fully bordered, padded, and legible.
- No alert acknowledgement/action control is shown in these states, so none was expected or treated
  as missing.
- The r32 Alerts captures retain the old unsupported override-failure sentence. That source wording
  was already corrected after capture and is intentionally not re-reported as a current finding;
  these images cannot visually prove the newer sentence.
- The Settings thresholds table stays inside its panel. At 390 and 820 px, the local horizontal
  scrollbar is visible and the columns remain reachable without widening the page; at 1440 px the
  complete five-column table is readable. Provenance fields (`Lives in`, `Set by`) and the explicit
  current-state/absence wording remain visible.
- Default service and print-threshold values are presented as read-only facts with explicit
  explanations. Their lack of edit controls is therefore not treated as a defect. The supplied
  persistence journey for theme and rail state was controller evidence and was not independently
  exercised here.

## Evidence

Viewed originals:

- `alerts-expanded-app-{390,820,1440}-{light,dark}-r32.png` (6)
- `alerts-limitations-app-{390,820,1440}-{light,dark}-r32.png` (6)
- `settings-thresholds-app-{390,820,1440}-{light,dark}-r33.png` (6)

No supplied image was modified.

## Limits

These captures do not show every page beginning or end. This review does not establish disclosure
keyboard behavior, table pointer/touch scrolling, navigation callbacks, print, forced colors,
post-correction Alerts wording, persisted-state mechanics, or full Alerts/Settings DOD acceptance.
No source, browser, test, or verification JSON changes were made or run.
