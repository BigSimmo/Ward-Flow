# What the device keeps after a shift: walkthrough

_Created 2026-11-10 - audit item M5b (sources A39, B96); template drafted from source on branch `claude/project-thread-bnphlk` (from `main` `29352cd0`); Documentation owns._

**Status:** draft template. **No walkthrough has been done.** A person fills this in on one real
desktop and one real phone, before any real patient data. Writing the template does not tick the
item.

**What it checks.** Full patient names on screen are allowed (D-83). This check is only that
nothing about a patient **outlasts the session** on the device: downloads, the clipboard, browser
tab titles, history, and the phone's app-switcher preview.

**Synthetic data only.** Use the public demo or a synthetic test account. Pick one invented
patient from the seed and write down only their record id, never a name, in this record.

## What the code already does (checked 10 Nov 2026)

| Area            | What source says                                                                                                                                                                                                            | Where                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Browser storage | Sign-out, expiry and a refused session sweep every key starting `ward-`, `ward_`, `wardflow` or `wf-`, except ten display settings and `ward_flow_choice_*`. `tests/ward-browser-data.test.ts` checks the key list.         | `src/components/ward-management/ward-browser-data.ts`              |
| Drafts          | Typed drafts live in sessionStorage under `wf-draft:v2:*` and are swept at sign-out. Go/no-go row C1 is still open for live mode.                                                                                           | `ward-session-drafts.ts`                                           |
| Service worker  | Caches static files only, never pages or data.                                                                                                                                                                              | `public/ward-flow-push-sw.js`                                      |
| Tab title       | Titles are fixed text or a place name: "Patient — Ward Flow", "Movement record — Ward Flow", a ward, board or team name. No patient name found in a title. Page addresses carry record ids, which stay in history.          | `patients/patient-now-screen.tsx`, `src/app/ward-flow/**/page.tsx` |
| Clipboard       | Every copy starts with the synthetic line (D-71 item 7). Nothing clears the clipboard at sign-out. The operating system keeps it.                                                                                           | `ward-clipboard.ts`                                                |
| Downloads       | Files the person chooses to save stay in the Downloads folder: patient chronology, statistics CSV, separation review JSON, rules export, demo world, Report-a-problem picture (blurred, D-102). The app cannot remove them. | `ward-download.ts` callers                                         |
| Push alerts     | Fixed text with counts and a place name only.                                                                                                                                                                               | `public/ward-flow-push-sw.js`                                      |

So the expected findings are: storage clear, tab title and history to be seen, and the clipboard
and Downloads folder **kept by the device by design**. The walkthrough records what actually
happens and whether the pilot needs a staff rule (for example "clear Downloads at the end of a
shift") rather than a code change.

## Steps (about 30 minutes per device)

Do each step on the desktop, then the phone. Record what you saw, not what you expected.

1. **Start clean.** Note the browser and version, the operating system, and whether it is a shared
   or personal device. Clear the browser's Ward Flow site data first.
2. **Sign in** with a synthetic account. Open the chosen invented patient's record.
3. **Tab title.** Look at the tab title, the window title and the browser's history list. Does
   any show a patient name?
4. **Copy.** Use one copy button (for example a referral summary). Paste into a plain text editor.
   Check the synthetic line is first.
5. **Download.** Save one file: the patient chronology report and the statistics CSV. Note the
   file names and whether either holds a name (D-102 says the patient-table export carries none).
6. **Phone only: app switcher.** Leave the record on screen and open the app switcher. Does the
   preview show the record? Note whether the browser blurs previews.
7. **Sign out.** Then, in the browser's developer tools (desktop) or site settings (phone), list
   what is left in local storage, session storage, IndexedDB, cookies and cache storage for the
   site.
8. **After sign-out.** Paste again: is the copied text still on the clipboard? Are the downloaded
   files still there? Does the history still show the record's address? Does the app switcher
   still show the old preview?
9. **Close the browser** and reopen it. Repeat step 7.
10. **Tidy up.** Delete the downloaded files and clear the clipboard. Note anything you could not
    remove.

## Record (fill in on the day)

| Step | Desktop: what was seen | Phone: what was seen | Outlasts the session? | Action (code, staff rule, none) |
| ---- | ---------------------- | -------------------- | --------------------- | ------------------------------- |
| 3    |                        |                      |                       |                                 |
| 4    |                        |                      |                       |                                 |
| 5    |                        |                      |                       |                                 |
| 6    | n/a                    |                      |                       |                                 |
| 7    |                        |                      |                       |                                 |
| 8    |                        |                      |                       |                                 |
| 9    |                        |                      |                       |                                 |

Date: \_\_\_\_\_\_\_ Done by (role): \_\_\_\_\_\_\_ Build or release id: \_\_\_\_\_\_\_

Desktop: browser and version \_\_\_\_\_\_\_, operating system \_\_\_\_\_\_\_

Phone: browser and version \_\_\_\_\_\_\_, operating system \_\_\_\_\_\_\_

Findings passed to the privacy impact assessment ([draft](PRIVACY-IMPACT-ASSESSMENT.md)): \_\_\_\_\_\_\_

**Done when:** one dated record each for a desktop and a phone, filed in
`docs/ward-flow/evidence/` as `<date>-device-after-session-walkthrough.md`.
