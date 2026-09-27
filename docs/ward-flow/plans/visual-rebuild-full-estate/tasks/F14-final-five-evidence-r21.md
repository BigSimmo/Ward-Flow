# F14 final-five evidence preparation r21

Date: 2026-09-13  
Mode: read-only evidence integration preparation  
Canonical files intentionally unchanged: `docs/ward-flow/screen-verification.json`,
the old visual-rebuild PROGRESS.md (gone — retired; status lives in STATUS.md and the plan task files)

These objects follow the current `screen-verification.json` schema. Every verdict is `deviates`
because the evidence is partial and human acceptance is pending. A `deviates` object records what
was actually reviewed; it does not assert full six-cell DOD, complete below-fold coverage, or an
exact drawing match. Network and Discharges are additionally stale against later source work and
must not be used to close their current implementations.

## JSON-ready partial objects

```json
{
  "emergency-department-third-edition.html": {
    "date": "2026-09-13",
    "who": "Codex independent visual reviewer; human acceptance pending",
    "widths": [390, 820, 1440],
    "themes": ["light", "dark"],
    "verdict": "deviates",
    "mockupSha256": "85a6be83781cd9e51ca18a50cdeba18c4501e91c88366cee998651fd6c90f647",
    "notes": "Partial r19 evidence only. All six app/drawing top-viewport pairs were independently inspected at .superpowers/sdd/2026-09-13-visual-rebuild-full-estate/emergency-department-{app,mock}-{1440,820,390}-{light,dark}-r19.png. No visible P1/P2 was found in the department strip, selected-department context, Needs attention panel, Department lists, or tab strip. A separate observed interaction selected Still to be moved and ArrowLeft returned Recently answered. RPH/JHC and title differences were accepted as engine-authoritative context. Lower content, full journeys, scroll ends, remaining keyboard/focus behavior, print, forced colors, screen-reader semantics, physical devices, and hosted behavior remain unverified; no DOD or human-match claim. Source-to-capture hashes were not recorded, so this object does not claim current-source byte identity. Evidence: tasks/F08-F14-network-governance-ed-visual-review-r19.md."
  },
  "statistics-ward-third-edition.html": {
    "date": "2026-09-13",
    "who": "Codex independent visual reviewer (Luna); human acceptance pending",
    "widths": [390, 820, 1440],
    "themes": ["light", "dark"],
    "verdict": "deviates",
    "mockupSha256": "a6377d7cb6e4273c5434dae443bbfe7c66472c88dc491a0e665304d47c7efb6e",
    "notes": "Partial post-correction r20 evidence. All six app/drawing top-viewport pairs were independently inspected at .superpowers/sdd/2026-09-13-visual-rebuild-full-estate/statistics-ward-{app,mock}-{1440,820,390}-{light,dark}-r20.png. No visible P1/P2 remained in the identity band, KPI/table structure, discharge panel, clinically-ready panel, or light/dark contrast. The r20 phone cells show only the upper identity/KPI region; lower tables/charts, complete scroll range, interactions, focus/keyboard, print, forced colors, physical devices, and hosted behavior remain unverified. The reviewed capture followed the r19 label/KPI correction; current TSX/CSS bytes still match that correction report, but the visual report did not record a per-capture source fingerprint. Evidence: tasks/network-statistics-ward-tasks-visual-review-r20.md and tasks/F05-ward-statistics-correction-r19.md."
  },
  "network-third-edition.html": {
    "date": "2026-09-13",
    "who": "Codex independent visual reviewer; human acceptance pending",
    "widths": [390, 820, 1440],
    "themes": ["light", "dark"],
    "verdict": "deviates",
    "mockupSha256": "d775086794d2ad9e104c43191012cb9db9a4f851fbedf2b8912519f0cba14be7",
    "notes": "Failed/stale partial evidence; do not close. All six r20 app/drawing top-viewport pairs were independently inspected at .superpowers/sdd/2026-09-13-visual-rebuild-full-estate/network-{app,mock}-{1440,820,390}-{light,dark}-r20.png. The review found a real P1 at desktop: adjacent unit names/capabilities collided and long being-made-ready copy collapsed into an unreadable narrow strip. The earlier r19 review also found P2 density/panel-form drift at 1440 and 820, while its phone captures did not reach the lower flow instrument. Root is correcting the P1 in r21, so these screenshots predate current source and provide failure evidence only. Fresh r21 six-cell captures and independent closure are required. Lower content, full journeys, focus/keyboard, print, forced colors, physical devices, hosted behavior, and source-to-capture byte identity remain unverified. Evidence: tasks/network-statistics-ward-tasks-visual-review-r20.md and tasks/F08-F14-network-governance-ed-visual-review-r19.md."
  },
  "governance-third-edition.html": {
    "date": "2026-09-13",
    "who": "Codex independent visual reviewer; human acceptance pending",
    "widths": [390, 820, 1440],
    "themes": ["light", "dark"],
    "verdict": "deviates",
    "mockupSha256": "ff7ba6bf1fb8a5b8983d245dad42686a6ba52478dfdad50d334d641976cbb651",
    "notes": "Partial r19 evidence only. All six app/drawing top-viewport pairs were independently inspected at .superpowers/sdd/2026-09-13-visual-rebuild-full-estate/governance-{app,mock}-{1440,820,390}-{light,dark}-r19.png. No visible P1/P2 was found: the empty override/detail state and absence wording truthfully reflected the current model instead of inventing the drawing's populated review counters or decisions; mobile controls wrapped, the explanatory section continued below the viewport without visible clipping, and light/dark contrast was legible. Lower content, populated governance states, full journeys, focus/keyboard, print, forced colors, screen-reader semantics, physical devices, and hosted behavior remain unverified; no DOD or human-match claim. Source-to-capture hashes were not recorded, so this object does not claim current-source byte identity. Evidence: tasks/F08-F14-network-governance-ed-visual-review-r19.md."
  },
  "discharges-third-edition.html": {
    "date": "2026-09-13",
    "who": "Codex independent visual reviewer (gpt-6); human acceptance pending",
    "widths": [390, 820, 1440],
    "themes": ["light", "dark"],
    "verdict": "deviates",
    "mockupSha256": "d6c67d2bd307b0bda97502b4992dbca70597d7ea372ed73cd404d5f723ee9e07",
    "notes": "Stale partial evidence; fresh post-fix capture required. All six r19 app/drawing top-viewport pairs were independently inspected at .superpowers/sdd/2026-09-13-visual-rebuild-full-estate/discharges-{app,mock}-{1440,820,390}-{light,dark}-r19.png. No P1 was visible, but the review found a P2 at 390: the Unit column broke FSH Adult Secure into single-letter fragments and later columns extended beyond the right edge without an in-view horizontal-scroll cue. A later page-local CSS correction added a word-safe Unit minimum, a genuine contained horizontal scrollport, and a print reset without changing the four groups or data. The captures predate that correction, so they cannot verify the current screen. Fresh six-cell captures must close the phone readability/overflow finding. Below-fold populations, scroll ends, interactions, focus/keyboard, print output, forced colors, physical devices, and hosted behavior remain unverified. Evidence: tasks/discharges-handover-out-of-area-visual-review-r19.md and tasks/discharges-handover-out-of-area-overflow-correction-r19.md."
  }
}
```

## Hash provenance and capture currency

- Each `mockupSha256` above is the current authoritative drawing hash recorded in
  `docs/ward-flow/mockups/MANIFEST.json`. It identifies the drawing source; it is not a screenshot
  hash and does not prove that a capture used current application source.
- Network r20 is known to predate the active r21 source correction. No current application-source
  hash is attached because the source is changing and the r20 report recorded screenshots rather
  than capture-source fingerprints.
- Discharges r19 was captured against the pre-fix CSS state. The correction report records
  `B3E54BA9E915CF1CA4811E92F026DD98A36416FB9C139F2F779D642FAFB0F22F` before and
  `3BFE587526C76A2CEB859EF5D45A7E6B746684BE4B458781411AD2295FFDC829` after. A read-only hash on
  2026-09-13 confirms the current CSS remains the after value, but no post-fix screenshots have yet
  been reviewed.
- Ward Statistics r20 followed the r19 source correction. Read-only hashes on 2026-09-13 confirm
  the current files still equal the correction report: TSX
  `BF4F918276C8E05F3BD23FCD9B54D5C7125ED9BC1B55BDA7013EC9AA42F32755`; CSS
  `5EB5C2259AC4221EF67806233E060A900E1F9D1E3DDFE94166450D5AA5E2F262`. Because the capture process
  did not record those hashes itself, this remains supporting continuity evidence rather than an
  exact capture-source attestation.
- The ED and Governance r19 reports contain no capture-source fingerprint. Their objects therefore
  retain only the review date, image paths, drawing hashes, visible findings, and explicit limits.

## Integration disposition

- **Eligible as partial looked evidence:** Emergency Department, Governance, Ward Statistics.
- **Keep visibly open:** Network, because r20 contains a real P1 and r21 source work requires fresh
  closure; Discharges, because its only reviewed matrix predates the overflow/readability fix.
- None of these objects establishes human acceptance, complete screen journeys, physical-device
  behavior, print correctness, hosted behavior, or full DOD.
