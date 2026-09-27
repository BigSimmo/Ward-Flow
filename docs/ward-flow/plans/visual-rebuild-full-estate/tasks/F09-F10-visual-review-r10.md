# F09/F10 r10 visual review

Date: 2026-09-13
Reviewer: Codex Luna (source-independent image review)
Scope: valid r10 served app/mock pairs for Transport Officer, On-call, Alerts and Legal Forms at 1440/820/390 dark plus 820 light (32 images). Existing valid r9 light 1440/390 pairs were previously reviewed in `tasks/F09-F10-visual-review-r9.md`; the mislabeled `*-dark-r9.png` cells were excluded.

## Findings

No new P1/P2 visual defects were found in the inspected viewport tops. Dark surfaces, text contrast, card borders, control spacing, and mobile wrapping remained readable; no horizontal clipping or material overflow was visible in the 820 or 390 cells.

The app/drawing differences are visible but attributable to the live engine/shared shell: app alert and legal-form populations differ from drawing fixtures; Transport Officer has no live refused-actions group while the drawing does; On-call includes app provenance/warning content and different live counts. The app shell navigation and control counts/order also differ from the standalone drawings. These are recorded as deviations rather than matches because the screens do not reproduce the drawing fixture exactly.

At 390px, Alerts and Legal Forms controls wrap into multiple rows and push the content start lower than the drawings, but the rows remain inside the viewport width and retain readable spacing. This is a responsive shell/content difference, not observed clipping. The screenshots cover viewport tops only; lower groups, journeys/actions, keyboard/focus, print, forced-colours and human acceptance remain unverified.

## Evidence

The four current `screen-verification.json` records were updated to `deviates` partial-looking entries covering all six cells per screen (valid r9 light 1440/390 plus r10 light 820 and r10 dark 1440/820/390), with the authoritative mockup hashes. The r10 image hashes are:

- Alerts: app 1440D `3F71705F9C572DB9F51EEA243C630ED45A7426A9BBBF325F030EAEBD545769E8`, 820D `D024ECE4F4133A08F33258924C110756EC979D513A94303481ED2E0BAA65195B`, 390D `386CA0A951CD57F1D5E0156AC1A7F85FE9A49AACD949C111DC536C34A94A261B`, 820L `5E9D06CF9AD3C2A79E97FDF5D1F6F8E05025EA0A8A85267FC57A4F0E6A0CA5CB`; mock 1440D `B7DF897DCDF3231476EEF755CFCB3130986318FA112BF088E7CACDC2C5B045A2`, 820D `81EE8D2D217EFD52CFC9D4F62821F1A63662ABC2E0BB4CE45A8EA9033677EBD3`, 390D `DB33C5285534B04135702BD0639BD1429BE5BBD4D8896454FEA0A277B03FF46C`, 820L `DABF55B0FC367D78B3AD19D217DFA411C0A27DABD21144B4ECD28F4F3DF46976`.
- Legal Forms: app 1440D `0F6E6C502F062B9833CC8DEBB289DA0C52BB5608E286C707EB557F9B91016965`, 820D `BB8467753E1492BEF289783699AA286C6EEF5F227EE83BD54825B046FE9573DB`, 390D `598440327C991D406F0454EBF667823F1CE582EAF41D8D896184A797C3F15998`, 820L `089D2AD7EDC3CBCF0BC7A790C1F463A340A2E6F46D71E9E6F7B873B6F9276BDE`; mock 1440D `7880DD289885E10D5CD1745F6D040DA4BEC40DA5565262D560EF2ADC0BAAD1AA`, 820D `3DEAA5123BDD3465C39E02EE0FB2EC218E4756EB142142895DA8DDE152118501`, 390D `3F348ADE7B64EE74C63B40D18A63A5A16B6F5699B943A4C14C4D215C1CCF84F5`, 820L `6B3FE47E5CD4BE48CF9B65778551864A0DB5037D74D936DAE7797C0BFAAF323F`.
- On-call and Transport Officer r10 hashes are retained in the same screenshot directory and were included in the 32-image batch; no material visual issue was found.

Generated `docs/ward-flow/SCREEN-VERIFICATION.md` after the JSON update; generator and `--check` both reported 12/34 screens looked at and 0 structural problems. No tests, browser interactions, server, or provider checks were run in this task.
