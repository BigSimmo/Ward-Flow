# F14 Patient and Settings journeys r34

Date: 2026-09-13  
Evidence provenance: controller-performed local browser journeys supplied to this reviewer. This report records those observations; it does not claim an independent replay, hosted behavior, or canonical verification completion.

## Patient Search and preview

- Searching `hallow` returned two people. Selecting the first person exposed PT-001 / Talia Halloway in the preview and the corrected accepted-referral summary.
- Searching an empty-example name exposed **Add this person**; following it prefills **Given name** only.
- Searching/filtering for WF-004 with **Bed pulled** and SJGM returned one result. ArrowRight moved the Everything facet to Accepted. Its preview truthfully stated that no Person or Referral record was linked.
- In the typeahead, ArrowDown then Enter selected the person's name as the query; it did not navigate. The person link opened PT-001.

## Patient Now and referral context

- PT-001 traversed Now → Details → Documents → Now with ArrowRight across the tabs.
- **Home** remains optional and is not implemented.
- **Refer patient** opened `/new?patientId=PT-001` with patient context. No referral was submitted during this check.

## Add patient

- With three required questions unanswered, the Add action remained disabled.
- UMRN `UM100001`, given name `Talia`, family name `Halloway`, and DOB committed through the native date-input arrow produced an exact-duplicate warning. The warning was non-blocking.
- Changing the values to `SYN-R33` / `Example` / `Review` produced a valid add; the new record opened as PT-A01.
- After that add, the observed operational counters remained movements 43, referrals 6, and capacity 27.

## Settings and sign-in

- Settings persisted Light theme plus a closed rail across reload after hydration. The controller then restored an open rail and Dark theme.
- Default service and print thresholds remained explicit read-only settings.
- Sign-in with Ward selected showed four available and nine unavailable destinations. Activating the sign-in button announced that it is not wired; no new surface opened.

## Limits

These observations cover the named local journeys and visible resulting states only. They do not establish submission behavior for **Refer patient**, Home implementation, print output, physical-device behavior, hosted persistence, authentication, or full-screen DOD. This evidence write made no source, test, browser, or canonical-record change.
