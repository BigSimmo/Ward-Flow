# Pilot site browsers and devices (checklist)

**Audience:** the pilot site's IT contact, Josh and builders. **Status:** draft checklist, waiting for the site's list. **Owner:** Documentation. **Written:** 10 November 2026 for M99 of the master audit list.

Which browsers and devices Ward Flow must support is **not Josh's decision**: the pilot site's IT names the list. (The audit list cites D-84 for this, but D-84 is about hosting; no decision yet records the browser rule.) Until that list arrives, the nightly runs stand in: desktop Chrome, a Safari-engine phone (WebKit) and an iPad (tablet WebKit), plus the Firefox and WebKit responsive checks. Those are emulated engines on a hosted runner, not the site's own machines.

**Still to do:** (1) the site's IT writes down the list below; (2) a person opens Ward Flow on each one and records a dated pass. Copy this file to `pilot-site-browsers-<site>-YYYY-MM-DD.md` for each site.

## The site's list (filled in by the site's IT)

| Device or desktop image | Operating system and version | Browser and version | Managed policies that matter (pop-ups, storage, full screen, notifications) | Who uses it (desk) |
| ----------------------- | ---------------------------- | ------------------- | --------------------------------------------------------------------------- | ------------------ |
|                         |                              |                     |                                                                             |                    |

Ask especially about: shared ward computers (session storage cleared on sign-out?), the meeting-room TV and what drives it, locked-down Internet Explorer mode or old Edge, and phones issued to staff.

## Pass on each (filled in by a person, on the real device)

For each row above: open the sign-in page, choose the desk, open Home, Capacity and the desk's own main screen, print one sheet, open the TV view where it applies, and go offline then back online once.

| Device and browser | Date | Opens and signs in | Main screens | Print | TV view | Offline and back | Notes |
| ------------------ | ---- | ------------------ | ------------ | ----- | ------- | ---------------- | ----- |
|                    |      |                    |              |       |         |                  |       |

Synthetic data only. Do not use a real staff account until the real-data gate (D-87) has passed.
