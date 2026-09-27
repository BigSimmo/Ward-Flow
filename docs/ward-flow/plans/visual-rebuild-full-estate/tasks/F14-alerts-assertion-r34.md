# F14 Alerts assertion correction r34

Captured the actual pre-edit test at `C:\Users\joshs\AppData\Local\Temp\ward-alerts-screen-test-r34-before\ward-alerts-screen.dom.test.tsx` before editing. Updated only the stale override assertion in `tests/ward-alerts-screen.dom.test.tsx`:

- renamed the case to describe prior-gate absence and retained record facts;
- replaced the obsolete `cannot say which check was overridden` matcher with the rendered `cannot identify a prior gate verdict` wording;
- added matchers for the retained `who, when, which fixed reason and which wards` facts and the explicit non-retention statement.

The test remains a real rendered-screen assertion and no checks were removed. `git diff --check -- tests/ward-alerts-screen.dom.test.tsx` reported no whitespace errors. No test or browser run was performed; the parent will run this single file.

## Add Patient duplicate visual review

Also inspected all six supplied captures directly: `add-patient-duplicate-app-{390,820,1440}-{light,dark}-r33.png`. No P1/P2 visual issue was found. The duplicate warning, board list, lower “What happens next” panel, identity disclosure, and dark/light surfaces remain readable and contained at all supplied widths. This is screenshot-only evidence and does not prove validation, duplicate handling, submission, keyboard, print, or DOD acceptance.

No source, browser, server, or canonical verification record was changed by this task.
