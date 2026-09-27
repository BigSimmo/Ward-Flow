# F14 provenance corrections r2

Actual-before copies for Capacity and On-call were recorded in `C:\Users\joshs\AppData\Local\Temp\f14-small-before`; hashes are in `F14-disclosure-time-corrections-r1.md`.

- `capacity/capacity-screen.tsx`: changed the non-clinical sentence to `It is not a real medical device or clinical decision support.` The existing paragraph already says every figure is synthetic and nobody exists; this binds the realness marker to the medical-device claim without adding data.
- `on-call/on-call-screen.tsx`: retained the visible top disclosure and bound the detailed disclosure sentences to the existing synthetic claim. The contact sentence now says the way of contacting anybody is invented, held or shown; the covered-role paragraph says the names are invented. No details disclosure was force-opened.

The remaining bare-call time issue was already corrected in `ward/ward-screen.tsx` using `formatInstantWithDay`; no further WardScreen edit was made in this round. Settings and statistics claim corrections are recorded in r2 of the disclosure report.

Static checks: Prettier completed on Capacity and On-call; `git diff --check` reported no diagnostics for those paths. No tests, browser, server, provider, or hosted checks were run. The provenance guard was not rerun, so no full guard-pass claim is made; additional provenance headings in ED/statistics/alerts remain outside this bounded ownership and require their active owners' review.
