# Triage form: webPSOLIS pick-lists, review and handover

Audience: the next Ward Flow chat and Josh. Status: done. The review merged in PR #1502 and the pick-lists were built in PR #1504 (both 8 Nov 2026). Owner: Claude (7 Nov 2026). Synthetic data only.

Original objective: Josh supplied photos of the webPSOLIS SSCD "New Triage" form's dropdowns (7 Nov 2026) to add to Ward Flow's triage and risk form. This note reviews them, records the option lists, recommends how each belongs in the form, and hands the build to a new chat. The triage form was built in #1500 (merged 7 Nov 2026, main `6b1352c93`).

## Privacy: read first

The source photos also showed a real person's record from production webPSOLIS, and a staff login. None of that is recorded here or anywhere in Ward Flow. Only the dropdown option lists, which are system reference values, were taken.

- Do not ask for, open, copy or commit the original photos.
- Any further screenshots should show the open dropdown only, cropped or on a test record, with no patient banner, contact details, notes panel or login line.
- Ward Flow stays synthetic (AGENTS.md hard rule 1). These values become pick-list options, never records.

## What the photos show

The PSOLIS form has seven tabs: Details, Problems, Assessment, Action Plan, Participants, Referred On, Additional Information. Values are copied exactly as PSOLIS spells them, including "LIASON". A list marked "partial" scrolled past what the photos show.

### Program (Details; depends on Stream, here RPH ADULT). Partial

RPH CONSULTATION AND LIAISON TRIAGE · RPH SAFE HAVEN · RPH AFTERCARE · EMHS EATING DISORDER SPECIALIST SERVICES (EMHS EDSS) TRIAGE · EMHS AMBULANCE CO-RESPONSE ADULT · RPH ED TRIAGE

### Venue (Details). Partial

CLINIC · COMMUNITY CENTRE · COURT · EDUCATION FACILITY · EMERGENCY DEPARTMENT · ENTERTAINMENT VENUE · GENERAL HOSPITAL · GENERAL HOSPITAL OUTPATIENT CLINIC · GP SURGERY · GROUP HOME · HOME/PRIVATE DWELLING · HOSTEL · INHOUSE SCHOOL · LOCK UP · (not seen) · NEONATAL INTENSIVE CARE UNIT · NURSING HOME · OTHER GOVERNMENT ORGANISATION · POLICE STATION · PRISON · PSYCHIATRIC HOSPITAL · PUBLIC SPACE · REHAB CENTRE · (more below)

### Referral list (Details, referral block). Label not visible; probably Referral type. Partial

BREACH RELEASE ORDER · CONDITION OF BAIL · CORRECTIONAL FACILITY · COURT · EXTERNAL PROGRAM · FAMILY / FRIEND · HOSPITAL · MEDICAL PRACTITIONER · NURSING HOME/HOSTEL · OTHER ESTABLISHMENT · OTHER ORGANISATION · POLICE · REFUGE · SCHOOL · SELF · UNKNOWN · (one more below)

### Problems (Problems tab, add many). Partial

ACCOMMODATION PROBLEMS · ADVERSE DRUG REACTION · AGGRESSIVE/THREATENING BEHAVIOUR · ALCOHOL/DRUGS · ANXIOUS · ASSAULT VICTIM · CULTURAL ISSUES · DELIBERATE SELF HARM · DEMENTIA RELATED BEHAVIOURS · DEPOT INJECTION · DEPRESSED MOOD · DISTURBED THOUGHTS, DELUSIONS ETC · EATING DISORDER · ELEVATED MOOD AND/OR DISINHIBITED BEHAVIOUR · EXISTING MENTAL ILLNESS - ALTERATION IN MEDICATION/TREATMENT REGIME · EXISTING MENTAL ILLNESS - CONTACT/INFORMATION ONLY · EXISTING MENTAL ILLNESS - EXACERBATION · GRIEF/LOSS ISSUES · HOMELESSNESS · INFORMATION ONLY · LEGAL PROBLEMS · MEDICATION · MOOD DISTURBANCE · OTHER · PERCEPTUAL DISTURBANCES · PERINATAL LOSS · PHYSICAL PROBLEMS · (possibly one not seen) · PROBLEMATIC BEHAVIOUR · PROBLEMS COPING WITH DAILY ROLES AND ACTIVITIES · PSYCHOTIC SYMPTOMS · RELATIONSHIP/FAMILY PROBLEM · RISK OF HARM TO OTHERS · RISK OF HARM TO SELF · SCHOOL PROBLEMS · SEXUAL ABUSE · SEXUAL ASSAULT · SOCIAL INTERPERSONAL (OTHER THAN FAMILY PROBLEM) · SUICIDAL IDEATION · (more may follow)

### Action plan (Action Plan tab, add many). Partial

DEPARTMENT OF CHILD PROTECTION NOTIFIED · POLICE NOTIFIED · AMBULANCE NOTIFIED · REFERRED TO INPATIENT MENTAL HEALTH SERVICE · REFERRED TO COMMUNITY MENTAL HEALTH SERVICE · REFERRED TO EMERGENCY DEPARTMENT · REFERRED TO COMMUNITY, PRIMARY CARE, NGO ETC · (not seen) · INTERPRETER BOOKED · ABORIGINAL LIASON OFFICER NOTIFIED · OTHER · ADVISED TO CALL AMBULANCE · ADVISED TO CALL POLICE · APPOINTMENT SET · ASSESSED BY DUTY DOCTOR · CASE MANAGER NOTIFIED · CLINICIAN TO RETURN CALL TO CLIENT · COMMUNITY TEAM NOTIFIED · COUNSELLED BY TRIAGE/DUTY OFFICER · DEPOT GIVEN · INFORMATION PROVIDED · INVITED TO PRESENT · MEDICATION ISSUE RESOLVED · MHERL NOTIFIED · (more below)

### Single values seen, lists not opened

- Medium: FACE TO FACE.
- Purpose: GP PHONE ADVICE.
- Not opened: Medium, Purpose, Reason, Urgency, Consumer present and Associate present.

## Review: fit with the current form

The current form (`src/components/ward-management/triage/triage-risk-data.ts`) holds short, hand-made lists. PSOLIS holds long, fixed lists. Matching PSOLIS lets **Copy** paste a value that PSOLIS accepts, which is the point of the form. The current friction rules still apply: nothing pre-selected, few taps, plain words.

| Ward Flow today                    | PSOLIS             | Recommendation                                                                                                                                                 |
| ---------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WHERE` (6 options)                | Venue (25+)        | Six common tiles, then "More" opening a searchable list of the full Venue list                                                                                 |
| `ARRIVED_BY` and the referrer line | Referral list (17) | Keep Arrived by. Add the Referral list as its own field: common tiles plus "More"                                                                              |
| `PROBLEMS` (12 chips)              | Problems (40+)     | Replace with the PSOLIS list: about eight common chips plus "More". Risk flags keep suggesting problems through `RISK_TO_PROBLEM`, re-pointed at PSOLIS values |
| `ACTIONS` (9 chips)                | Action plan (25+)  | Replace with the PSOLIS list. Group as Notified, Referred to, Advised, Done. The Outcome "Referred on" asks for a "Referred to …" action                       |
| "From your desk"                   | Stream, Program    | Keep from the desk, with **Change** showing only that stream's programs, from synthetic site settings                                                          |
| `HOW`                              | Medium             | Confirm the full Medium list first; keep tiles                                                                                                                 |
| `PURPOSE`                          | Purpose            | Confirm the full list; "GP advice" probably maps to GP PHONE ADVICE                                                                                            |

### Recommended way to build it

1. **One list file.** Add `triage-psolis-lists.ts`. Each option holds a stable code, a plain label in sentence case and the exact PSOLIS value: for example `["dsh", "Deliberate self-harm", "DELIBERATE SELF HARM"]`. The screen shows the label. Copy and the summary write the PSOLIS value.
2. **Long lists: common first, then search.** Show about six tiles or chips, then a "More" button opening a searchable list (`@/components/wf` kit, typing filters). This is one pattern for Venue, Referral, Problems and Actions.
3. **"Other" needs detail.** Choosing Other opens a short typed box. Typed text stays in React state only, as it does today.
4. **Order matters.** Problems and actions keep the order they were chosen, and Copy follows it.
5. **What is saved (Josh: yes, decision 2).** Problems, actions, venue and referral type are codes from fixed lists, so they join `RECORD_TRIAGE_SIGNED` the same way urgency does: checked against the list, no typed text. That needs:
   - the schema (`triage-record-schema.ts`);
   - the reducer check;
   - a journey map update (`docs/ward-flow/journey/`, `verify.mjs --write`, review stamps);
   - persistence classification tests.
6. **Site-specific values stay synthetic.** Program names are site settings keyed by stream, never typed into screens. The invented-figures and record-number guards still apply.
7. **Update `PSOLIS_FIELD_MAP`** so Help still says where each PSOLIS box comes from.

## Josh's decisions (7 Nov 2026)

1. **Missing list parts:** build with what we have. The lists the photos show completely are built now. The gaps stay marked in the list file, to fill in when Josh sends the rest:
   - the label of the referral list, and its item after UNKNOWN;
   - the Venue item after LOCK UP, and the end of the list;
   - the end of the Problems list;
   - the Action plan item after "REFERRED TO COMMUNITY, PRIMARY CARE, NGO ETC", and the end of the list;
   - the full Medium, Purpose, Reason, Consumer present, Associate present and Outcome lists. Until then, the form keeps its current Medium (`HOW`), Purpose and Outcome lists.

   Any later photos must show the open dropdown only, cropped, with no patient on screen.

2. **Save as codes:** yes. Problems, actions, venue and referral type join `RECORD_TRIAGE_SIGNED` as codes checked against their fixed lists, with no typed text (step 5 above).
3. **Wording:** plain sentence-case labels on screen; Copy and the summary write the exact PSOLIS value.
4. **Program:** filled in from the desk, with **Change** showing only that stream's programs.

## Handover: starting the new chat

Paste this into a new Ward Flow chat:

> Continue the triage form's PSOLIS pick-lists. Read `docs/ward-flow/handover/2026-11-07-triage-psolis-picklists.md` first, and AGENTS.md. Work on a new branch from Ward Flow `main`. Build the "Recommended way to build it" section following "Josh's decisions": build with the lists we have and leave the marked gaps; save problems, actions, venue and referral type as codes; plain labels on screen with exact PSOLIS values in Copy; Program from the desk with Change. Synthetic data only: do not ask for or use the original photos.

Where things are:

- Form and lists: `src/components/ward-management/triage/` (`triage-risk-data.ts`, `triage-risk-parts.tsx`, `triage-risk-decision.tsx`, `triage-risk-review.tsx`, `triage-risk-text.ts`).
- Signed record: `triage-record.ts`, `triage-record-schema.ts`, `triage-signed-reducer.ts`.
- Tests: `tests/ward-triage-*.test.ts`, `tests/ui-ward-triage.spec.ts`.

Checks before pushing:

- typecheck, lint, the triage tests;
- the design-language contract (use `String.raw` for RegExp template literals);
- invented figures, record numbers off screen, the patient-link allowlist (D-14);
- the journey map, if the event changes;
- the script budget, if the bar or phone sheets change.

The bar's New menu loads on first use and falls back to the referral slide-out offline (#1500). Browser specs that click New must choose Referral or Triage from the menu.

Follow-ups still open from #1500:

- the risk banner mock-up;
- a strict shared-server command schema for the triage event;
- a DOM test that the triage page closes for an out-of-scope person;
- the old "New referral" wording in `shell/ward-bar-controls.tsx` and the viewer's "Today's frame" bar;
- Josh signing the four synthetic urgency windows.
