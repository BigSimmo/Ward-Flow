# Design review of main, 2 Nov 2026

Checked main at 19bcd527 (#1275, includes #1272 to #1275), rendered locally from synthetic demo data. Compared with the master (Home, Ward, Capacity, Waiting, Forms, Discharges, Patient from its m/ build; Transport, Movements, ED, Handover, Alerts, Community from their approved bundles).
Covered: 26 pages at 390 light, 1280 light; 12 pages at 390, 820 and 1440 dark; master at 390 and 1280. Alerts was left to the ALERTS thread, Downtime and older pages to the Compare thread.

## Good news

- No text under 12px on any page at any width (automated scan of every visible text element).
- Desktop (1280, 1440) matches the master closely on Home, Capacity, Movements, Forms, ED and Handover.
- Phone matches the mock-ups on Home, Ward, Waiting, Discharges, Handover, Transport desk, Community team and Patient. Dark mode is consistent.

## Issues (one recommendation each)

Q224. Phone tab bars sit 56px too low and cover content. Capacity loses its "Mismatch" heading; Legal forms hides "Colours compare... Not legally checked"; Statistics and Community show a blank strip above the tabs. Cause: the kit's phone rule `.seg { position: relative }` (src/components/wf/choice.module.css) beats each page's `position: sticky; top: 56px`, so the bar is shifted, not stuck. Seen in a local dev build; check on a live phone. Recommend: fix once in the kit and recheck every phone tab bar.
Q225. Controls under 40px, also in the master: segment tabs 32px, chips 34px, the header "Statewide" picker 24px, Patient "Forms" link 13px tall, Referrals name links 18px, drawer close 32px. Recommend: lift segment and chip faces to 40px in the kit, one change for every screen.
Q226. The signed-in name is spelt three ways: "Dr S. Chen" (master), "Chen, Dr S." (rail card) and "Chen, Dr. S." (rail footer). Recommend: one spelling everywhere, the master's "Dr S. Chen".
Q227. Movements phone opens on five closed stage bars, so no patients show without a tap. The mock-up opened on cards then rows. Recommend: open the first stage by default (Movements PC thread's area).
Q228. Community team at 820: the tab row runs into the search icon and the third summary card is cut off. Recommend: let the summary cards wrap at tablet and move search out of the tab row.
Q229. ED hero at 1280 (master and main): the fourth figure "Under a form" drops to its own line. Recommend: keep all four figures on one row.
Q230. The master lags main where main changed on purpose (Movements phone link cards after the list; dock says Tasks per Q177). Recommend: refresh those two master tabs once Q227 is settled.

## Screens to update and perfect, ranked

1. Legal forms: Q224 hides the "not legally checked" warning on phones, a safety line.
2. Capacity: Q224 hides the Mismatch heading on phones.
3. Statistics: Q224 gap on phones, plus 32px tabs (Q225).
4. Movements: Q227, patients hidden one tap deeper on phones.
5. Alerts: already being restored by the ALERTS thread.
6. Community team: Q228 at tablet width.
7. ED: Q229 hero wrap on desktop.

## Other recommendations

- Fix shared kit problems (Q224, Q225) in the kit, not screen by screen.
- Add this sweep as a check: open each page at 390 and 1280 and fail on text under 12px, controls under 40px, or a sticky bar covering text. It found Q224 in minutes.
- Keep a "last compared with main" date on each master tab, so drift like Q230 shows up.
