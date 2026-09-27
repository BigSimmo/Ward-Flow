# F02/F05 Wards and Service visual review r28

Date: 2026-09-13  
Reviewer: gpt-5.6-sol / medium  
Scope: read-only review of the 16 supplied r28 app captures

## Evidence

Viewed at original detail:

- `ward-update-forms-app-{390,820,1440}-{light,dark}-r28.png` (6)
- `wards-directory-end-app-{390,820,1440}-{light,dark}-r28.png` (6)
- `statistics-service-identity-app-390-{light,dark}-r28.png` (2)
- `statistics-service-columns-app-1440-{light,dark}-r28.png` (2)

## Findings

No P1 finding.

### P2 — Ward maintenance form truncates selected-control text at every width

The waiting-on select visibly reads `Choose w` rather than `Choose what it is waiting on`, and the blocker select reads `No blocke` rather than `No blocker`, in light and dark at 390, 820, and 1440 px. This is content clipping, not a long-option edge case: `.capacityInput` fixes every number, time, and select control to `width: 6rem`, while its only full-width exception is below 20rem. The forms remain operable, but a coordinator cannot read the current choice reliably.

Smallest correction: keep the compact widths for number/time inputs and give these selects their own bounded widths, e.g. `#ward-bed-release-waiting-on { width: min(16rem, 100%); }` and `#ward-bed-release-blocker { width: min(10rem, 100%); }`, with a phone `max-width: 100%` safeguard. Existing values, labels, validation, and handlers remain unchanged.

### P2 — desktop flex stretching turns the release submit into an oversized block

At 1440 px, **Flag bed coming free** stretches to the full height of the multiline Waiting-on field group (about 120 px), while the expected-time and blocker controls remain ordinary controls. The same button wraps as a more proportionate row at 820 and 390. `.capacityRow` is a wrapping flex container without an `align-items` value, so its default cross-axis stretch expands the submit control to the tallest sibling.

Smallest correction: set `.capacityRow { align-items: flex-end; }` (or `align-self: flex-end` on `.capacitySubmit`) so the button retains its existing 48 px minimum and aligns with the controls without changing form order or behavior.

### P2 — explanatory bed-count prose loses a word boundary

All six Ward captures show `the two can disagree.Confirmed here counts…`. In `ward-screen.tsx`, the `</strong>` for the preceding sentence is followed by `<strong>Confirmed</strong>` without an explicit JSX space. Add `{" "}` after the sentence. The clinical wording itself should remain unchanged.

## Closed observations

- The opened Ward form, both empty-state lists, leave-bed form, Worth your attention, Awaiting your answer, and Today's return remain reachable. Light/dark labels and controls retain readable contrast; no form or panel crosses the viewport edge.
- The Wards directory tail shows all five WACHS wards and both Private wards at 390, 820, and 1440 px. The final `SJGS Adult Secure` row is visible, readable, and within the panel. Long `East Metropolitan Youth Unit (EMyU)` wraps without collision.
- The Service phone identity facts now retain compact label/value alignment. The full Sir Charles Gairdner / Joondalup / Graylands value wraps inside its track without clipping or horizontal overflow.
- The Service 1440 px columns now follow the drawing's wider-left/narrower-right proportion in both themes. Identity, ready-bed table, out-of-area bands/notices, and Flow remain legible; no new overflow is visible.

These still captures do not prove form focus states, opened native option menus, keyboard behavior, submission, print, or link activation. The controller supplied separate behavior evidence for capacity confirmation, Answer freshness, and the final directory link.

## Image hashes

```text
DB7D95A4F0DC5A65F9EA02B932B68678DCD2D1DC5F0272DC6F8719BA7F382792 ward-update-forms-app-390-light-r28.png
57DF053F25ACFE68BA4307AB96AADD62A84EB323BD5034EAAA49438800E1A89F ward-update-forms-app-390-dark-r28.png
1145D739913FC64DC3AF46459E8CDB398A346D9D1A39D0C23857A0BF7A39CD14 ward-update-forms-app-820-light-r28.png
50600F4AB313156FF490D4DC9B7076A0926BAB7526BF54F6CA48CAC16744F02A ward-update-forms-app-820-dark-r28.png
3C8B5D5DEAA5CBB9C1A0DA1DDF1748650EECF8EBAE20811625436EEB133D8C61 ward-update-forms-app-1440-light-r28.png
5D116A66BB99F393AC6639F12475EDDDC7C418FF20145085C37D476130878BD9 ward-update-forms-app-1440-dark-r28.png
1AC2671E598298AC7C6E3BD838DFD62EACCA31D12A4E9ADA6857E878FA2A249C wards-directory-end-app-390-light-r28.png
CB3DCD7499AD639E909955BF3D1FF227E6B7DCD3528713D8AA0AFE328A5280A1 wards-directory-end-app-390-dark-r28.png
8161031CFA57D46ACE718BE2D9560869D45B37C94E7BD4F958E2D34E3BF4307E wards-directory-end-app-820-light-r28.png
6435237B6ACE7619E2A3DDDEA646779DD3E4BB0DC39FCE796B4774092925BD65 wards-directory-end-app-820-dark-r28.png
D83B358CE26856C8AC09E4B75B329A709BE75188CB8EA641BEF5B1B06E0044A6 wards-directory-end-app-1440-light-r28.png
D4F17ABD0839E6196D9155129D4860933043AB0A45D4B54D73000FFED6D3E6F8 wards-directory-end-app-1440-dark-r28.png
17BD3635EC8347920DBF668FFFAAF05C91FB1A7826DFD2FDAD95D3170F260C68 statistics-service-identity-app-390-light-r28.png
37C6D235720DD8D1A24872838058CB9663F20E29B45D23DFBAC7B02AB6346C91 statistics-service-identity-app-390-dark-r28.png
9650FFF2B6822342C406A79F0058E459AE7966327F17DBC032926C1F5D6C58CA statistics-service-columns-app-1440-light-r28.png
D6A44D596017FA1722EFFD228AD0ACDC3CF1060088143FCCC589E0CDA17D8C6A statistics-service-columns-app-1440-dark-r28.png
```
