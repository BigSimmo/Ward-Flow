# Check E: empty, loading and error states (main b27fddcc, 2 Nov 2026)

Covered: 24 routes emptied (patients, movements, referrals, admissions, releases and bookings removed from the saved demo session, then reloaded) at 1280 light and 390 light, 10 of them at 820 dark, plus the bed meeting TV. Slow loads (page code held back 6 to 8 s), slow and hung page changes (held 8 s and 60 s), offline before and after load, offline page changes and six pop-ups offline (Broadcast, Tools, New referral, Activity, Try a scenario, a Waiting row), 500s on page data, on the page itself and on `/api/session`. Phone checks were repeated with real iPhone and Android user agents.
Passed: no "undefined", "NaN", "null", "[object Object]" or raw error text on any empty, slow or offline screen. No sideways scroll. Every emptied page explains itself in plain words ("Nobody is waiting in any emergency department", "Nothing needs you", "No outstanding jobs"). Counts read 0, not blank. Page changes show a shaped "Loading page" placeholder at once. Offline, the amber notice is clear, the Demo pill turns to "Offline" and every pop-up tested still opens. A reload while offline shows a good "Ward Flow needs a connection" page with Try again and the downtime pack advice. A 500 on page data falls back to a full load and the page opens.
How the data loads: there is no data API in this demo build. Records come from the bundled demo world, saved in the browser tab (`ward-flow-demo-state-v1`). The only network calls are the page, its code files, page-data prefetches (`?_rsc=`) and `/api/session`. So "slow" and "error" here mean slow or failed code and page data.

### E1. Offline, a tapped link says the page "will open when the connection is back", but it never does

Where: every page with in-app links, all widths, both themes. Seen: offline at 390, tapping Referrals in the dock shows "You're offline. This page will open when the connection is back." Back online and 4 s later, the page was still Capacity. Nothing is remembered. The page you tapped was already prefetched and could have opened offline, but the tap is blocked anyway. Cause: src/components/ward-management/shell/ward-offline-links.tsx:7 (wording) and :20-35 (blocks every link and keeps nothing). Recommend: change the words to "You're offline. Tap again once you're back online." Or remember the tap and open it when the connection returns. Severity: medium. Confidence: high. Evidence: evidence/E-1-offline-link-promise-390-dark.jpg

### E2. If the page code never arrives, "Loading, not live yet" stays forever with no way out

Where: every page, all widths. Seen: with code files failing (patchy Wi-Fi, or a release swapping files mid-load), after 20 s the note still says "Loading, not live yet. Taps work once this goes." There is no time limit, no "check your connection" and no Reload button. The page looks normal but no tap works. The error panel and the offline page cannot help, because both need the code that failed. On a 1.6 Mbps link (fast 3G) a normal load already takes about 5.9 s to become tappable. Cause: src/app/ward-flow/layout.tsx:223 (static note); it is hidden only by `data-wf-bar-ready` (ward-flow-layout.module.css:324). Recommend: after about 15 s, have the small inline early script change the note to "Still loading. Check the connection." with a Reload button. Severity: medium. Confidence: high. Evidence: evidence/E-2-code-never-loads-390.jpg (taken with a desktop user agent, so the layout behind it is squeezed; on a real phone the layout is correct, see note at the end).

### E3. A page change that never finishes shows "Loading page" forever

Where: any in-app page change, seen at 1280 (Wards to a ward page). Seen: with page data held for 60 s, the grey placeholder and spinner still showed at 25 s and 40 s. There is no "taking longer than usual" line, no Try again and no Back. The same thing happens on a slow server or a captive Wi-Fi portal. Cause: src/app/ward-flow/loading.tsx (spinner and blocks only). Recommend: after about 10 s, add "This is taking longer than usual." with Try again and a link back to the last page. Severity: low. Confidence: high. Evidence: evidence/E-3-hung-navigation-1280.jpg

### E4. The "Loading, not live yet" note covers the page title while it shows

Where: phone 390 (real phone user agent) and desktop 1280, both themes; not tablet 769 to 1000px, where it moves to the bottom. Seen: the note sits 8px under the header, on top of the hero. On Waiting it hides most of "62 waiting in ED" and the Demo pill. On Home it hides "MODELLED NETWORK". On Capacity at 1280 it sits over the eyebrow line. It lasts about 1.5 s on good Wi-Fi and 4 to 6 s on a weak signal. Cause: src/app/ward-flow/ward-flow-layout.module.css:290-292 (`position: fixed; top: header + 0.5rem`). Recommend: use the tablet rule at every width and rest the note at the foot of the window, above the phone dock. Severity: low. Confidence: high. Evidence: evidence/E-4-loading-note-covers-title-390.jpg

### E5. Empty lists blame a search or filter that nobody set

Where: Patients (/ward-flow/search) and Discharges, all widths. Seen: with nobody on the census and nothing typed, Patients says "No patient matches the current search" and offers "Clear search", which does nothing. With no releases and every filter on All, Discharges says "No releases match these filters." Most other pages say plainly that there is nothing ("No referrals queued.", "Nothing needs you"). Cause: src/components/ward-management/search/patient-census-view.tsx:1020; src/components/ward-management/discharges/discharge-board.tsx:612. Recommend: when no search or filter is set, say "No patients on the census yet." and "No bed releases open." and hide Clear search. Severity: low. Confidence: high. Evidence: evidence/E-5-patients-empty-1280.jpg, evidence/E-6-discharges-empty-1280.jpg

### E6. Going offline throws an uncaught error on the first keyboard focus

Where: all pages, all widths (not visible on screen). Seen: going offline before the first focus logs "Loading chunk 9239 failed" twice as an uncaught page error. The focus-visibility helper (WCAG 2.4.11 "focus not obscured") then never loads, so offline, a focused control can sit under the sticky header or dock. The error also fills Sentry with noise. Cause: src/components/ward-management/shell/ward-accessibility.tsx:53-56 (`void import("./keep-focus-clear")` with no catch, retried on every focus). Recommend: preload the helper when the shell is idle (like `preload-when-idle.ts`) and catch a failed load. Severity: low. Confidence: high.

## Not a finding, for the record

- At 390 with a desktop user agent (Playwright's default, or a phone set to "request desktop site"), the page draws the desktop layout squeezed until the code loads, then jumps. With real iPhone and Android user agents, the server draws the phone layout first and nothing jumps (A1-17 works). Reviewers who screenshot phones should set a mobile user agent.
- In the emptied world, Home, Wards and Statistics still show 85.2% occupied and 26 beds ready. That is because ward bed counts are kept separately from patient records. My emptying was artificial, so this is not reported.

## Could not check

- A real backend (live shared build): no Supabase calls were allowed. So save failures, conflicts, sign-in expiry and "server board not arrived yet" were not checked. In this demo build there is no data API to make slow or return 500.
- A real 500 page from the server: I could only fake the page's response, which bypasses the app's own error pages (`error.tsx`, `global-error.tsx`).
- First visit offline with no service worker: this shows the browser's own offline page, as expected.
- Landscape phone (844x390), 1024, 1180 and 1440 were not run for this check. Sign-in redirects straight to Home in this demo build.
