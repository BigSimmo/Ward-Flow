# Accessibility check for the shadow pilot screens, 8 November 2026

Point-in-time evidence record. Audience: Josh and anyone preparing the shadow pilot. Documentation owns. It is not
updated after this date; a later check gets its own record. Synthetic demo data only.

Source: `main` at `d85618e641e7949bdc7ec76eb8c37e7243d604ca`, plus the one fix listed below. Standard: WCAG 2.1 AA (axe
tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, plus `wcag22aa`). Every impact level was recorded, not only the
serious and critical ones the release gate fails on.

## How it was checked

- **Build.** A local production build (`WARD_GATE_BUILD=1 npm run build`, then `npm run start`). The dev server was
  stopped by the container's memory limit part way through, so it was not used for results. Demo mode with
  `?flags=role-access:on`. Each desk was set the way Go to a desk sets it.
- **Desks.** Flow coordinator (statewide), ward (RPH Adult Secure), ED (RPH ED), site bed manager (RPH) and transport
  officer.
- **Screens.** Sign-in, Home, Bed board, Referrals, Waiting, bed meeting TV, bed meeting agenda, Ward home, Handover,
  Discharges, Transport, Alerts, Help (it opens as a sheet over Home) and Settings.
- **Sizes and themes.** Desktop 1440x900 and phone 390x844, each in light and dark. Dark was confirmed on every dark
  scan.
- **Axe.** The repository's own `@axe-core/playwright` (~4.14). Nothing new was installed. There were 264 scans and
  none errored.
- **Keyboard.** 30 Tab presses from the top of 13 screens at both sizes, recording every stop's name and focus ring.
  The ring was confirmed by screenshot and pixel comparison where it is drawn on a wrapper. Dialogs were opened by
  keyboard and then checked: focus moves in, 40 Tabs and Shift+Tab stay inside, Escape closes it, and focus returns to
  the trigger.
- **Browser.** Chromium (Playwright's preinstalled revision 1243, run by path). Phone means Chromium phone emulation
  with an iPhone user agent. WebKit, a physical device and a screen reader were not used.

## Results by screen

When a screen is not part of a desk, that desk sees the "Not part of your role" page, and that page was the one
scanned. This covered: ED (Bed board, both bed meeting screens, Ward home, Discharges, Transport), ward (bed meeting
agenda, Transport), bed manager (Transport) and transport officer (Bed board, both bed meeting screens, Referrals,
Waiting, Ward home, Discharges, Handover).

| Screen             | Passed                                                                                                                                         | Fixed                                                                                                                | Remaining           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Sign-in            | Axe clean at all 4 size and theme combinations. The skip link is the first Tab stop. Every stop is named and has a ring.                       | None                                                                                                                 | None                |
| Home               | Axe clean for all desks, sizes and themes. Skip link first. Rings shown, with the search box ring drawn on its wrapper.                        | None                                                                                                                 | None                |
| Bed board          | Axe clean. Bed tiles have full names (name, state, days, home region). The phone record sheet traps focus, closes on Escape and returns focus. | None                                                                                                                 | R3                  |
| Referrals          | Axe clean. Keyboard reaches the main actions.                                                                                                  | None                                                                                                                 | None                |
| Waiting            | Axe clean. Keyboard reaches the main actions.                                                                                                  | None                                                                                                                 | None                |
| Bed meeting TV     | Axe clean on desktop. The phone shows its "needs a larger screen" card, which is also clean.                                                   | None                                                                                                                 | None                |
| Bed meeting agenda | Axe clean. The search box shows a ring when focused (pixel-checked in light and dark).                                                         | None                                                                                                                 | None                |
| Ward home          | Axe clean. The bed drawer (Place or move, then a bed) traps focus, closes on Escape and returns focus to the bed, on desktop and phone.        | None                                                                                                                 | None                |
| Handover           | Axe clean for the coordinator, ward and officer desks.                                                                                         | F1: on the bed manager's site sign-off, the spoken name of Open handover and View now starts with the visible words. | R2 (ED desk, phone) |
| Discharges         | Axe clean. Keyboard reaches the main actions.                                                                                                  | None                                                                                                                 | None                |
| Transport          | Axe clean. The Highlight transport jobs box shows a ring on its wrapper.                                                                       | None                                                                                                                 | None                |
| Alerts             | Axe clean. The Activity panel traps focus, closes on Escape and returns focus (desktop).                                                       | None                                                                                                                 | None                |
| Help               | Axe clean with the Help sheet open for every desk. The Tasks and Help sheet traps focus and returns it (desktop).                              | None                                                                                                                 | None                |
| Settings           | Axe clean. Keyboard reaches the display settings.                                                                                              | None                                                                                                                 | None                |
| Shell              | The Tools sheet (desktop) and Menu sheet (phone) trap focus, close on Escape and return focus.                                                 | None                                                                                                                 | R4                  |

## Fixed

- **F1, serious (axe `label-content-name-mismatch`, WCAG 2.5.3 Label in Name).** Handover, bed manager desk, desktop and
  phone, light and dark, 2 buttons per scan. The buttons showed "Open handover" but had the hidden name "Open Dabakarn
  handover", so a voice-control user saying the visible words would not match. The name is now "Open handover for
  _ward_", and "View _ward_ handover" when signed. Changed in
  `src/components/ward-management/handover/handover-site-sign-off.tsx`. The existing test
  `tests/ward-handover-site-sign-off.dom.test.tsx` now checks that each button's name starts with its visible text.
  A rescan of the bed manager on desktop in light and dark was clean after the fix. The phone rescan was not repeated
  because it is the same component.

## Remaining

- **R1, unverified (colour contrast).** Axe could not decide contrast for many text nodes on every screen. Examples
  are text over translucent, layered or gradient backgrounds. It reports these as "needs review", not as failures.
  They were not checked by hand. A short manual contrast pass with a colour picker on Home, Bed board and the bed
  meeting TV in both themes would close this.
- **R2, low (outside WCAG 2.1 AA).** Phone Handover on the ED desk. On first load, the Handover group heading sits
  partly under the pinned Copy summary bar, so axe reports `target-size` (a WCAG 2.2 rule). Scrolling clears it, as the
  release gate's sweep already accounts for pinned bars. A keyboard user tabbing to it could find it half covered (WCAG
  2.2 2.4.11 Focus Not Obscured). A `scroll-padding-bottom` on the handover scroller would fix it. It was left unfixed
  because it changes scroll layout.
- **R3, low (keyboard efficiency).** Bed board on desktop. Pressing a bed opens its record beside the grid without
  moving focus. That is correct for a panel that is not a dialog, but the record is about 14 Tab stops away, after the
  remaining beds, and Escape does not close it. A "Go to record" link or moving focus on open would help keyboard users.
  It was not changed because it is a design choice.
- **R4, not verified.** The focus ring on the Tools sheet's Search tools box and the Menu sheet's My wards picker uses
  the same wrapper pattern that was pixel-checked elsewhere, but these two were not pixel-checked. On the phone, the
  Tasks and Activity triggers sit inside Menu, and their sheets were not keyboard-tested separately.

## Counts

| Severity              | Found | Fixed | Remaining |
| --------------------- | ----: | ----: | --------: |
| Critical              |     0 |     0 |         0 |
| Serious (WCAG 2.1 AA) |     1 |     1 |         0 |
| Low                   |     2 |     0 |         2 |
| Not verified          |     2 |     0 |         2 |

## Not covered

This check did not use a screen reader (VoiceOver or NVDA), WebKit or a physical phone, forced colours or 200% zoom
and reflow, and it did not run the release-gate projects. The release-gate axe sweep (`tests/release-gate-axe-sweep.spec.ts`)
already blocks serious and critical violations for the coordinator view on every route. This check added the other
desks, the moderate and minor levels, and the keyboard checks.
