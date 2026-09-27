# Owner answers — 17 September 2026

> **Index IDs (Wave 2 docs hygiene, 22 September 2026):** round-1 decisions below are `OA-n`; second-round answers are `R2-n`; the third and fourth rulings are `OA-65` / `OA-66`. These IDs make the file visible in `OWNER-RULINGS.md`. Numbers still match the chat list.

Josh answered the 64 open questions put to him in the Ward Lead chat on 17 September 2026 (list and
recommendations below). **His general answer: yes to every recommendation**, except the items he
answered separately. His separate answers are quoted **verbatim** under each item. Ward Lead's
reading of each exception follows it, marked as a reading, not his words.

Numbers match the question list in chat. Items marked **CLARIFY** are not yet decided: he asked a
question back, and nothing is built for them until he answers.

## His words, verbatim

> 1. Yes to all recommendations however be aware that the timer that starts when a patient arrives is
>    separate to forms. One records time in ED and the other is a forms category.
> 2. 3D you can review online in Australia but it is a psychiatrist allowing 3 days to remain on forms.
> 3. Yes to recommendation.
> 4. Yes build now
> 5. I am confused?
> 6. You make a list for me
> 7. Yes they can
> 8. No!
> 9. Explain this?
> 10. The ward can also release it as well or the original referrer
> 11. Default to 4 hours
> 12. You decide most or best good reasons based on your understanding of ward flow
> 13. Clarify which is which?
> 14. Wire it up now and build anything required
> 15. What command drawing? I didn't know that it showed wards??? Clarify
> 16. What drawing?
> 17. What is this
>
> 64.Leave all of these please they are not related

## Decisions

### A. Clinical and legal

#### OA-1 — Legal form time limits

the app works out no limits itself. The clinician types in the expiry
written on the form; it shows as a warning that never blocks. WA legal advice before anyone relies on
it. **Owner note:** the time-in-ED clock (starts on arrival) and the form clocks are separate things
and must never be merged or used as stand-ins for each other.

#### OA-2 — Form 3D

per the owner, a psychiatrist allowing the patient to remain on forms for up to 3 days.
Official form title to be confirmed from a public WA source before relabelling.

#### OA-3 — No Mental Health Act section numbers anywhere.

#### OA-4 — "Form 1A received" can be undone as a correction with a reason; the original stays in history.

#### OA-5 — Regional extensions: the clinician records the extension and the new expiry; the app never

calculates one.

#### OA-6 — Examination order revoked after transport booked: keep the bed flagged; a person decides whether

to release it.

#### OA-7 — A repeat examination is a new record, with a "further examination ordered" outcome.

#### OA-8 — Gender and beds: now, by recording gender at referral and checking the incoming patient only;

"unknown" refused only on single-gender wards.

#### OA-9 — Non-binary patient: coordinator places with a recorded reason after checking with the ward,

preferring a single room; fix the demo patient recorded as non-binary but called "her".

#### OA-10 — High-acuity override needs a reason and a "nurse unit manager consulted" tick.

#### OA-11 — Voluntary patients take open beds first; secure patients take locked beds first.

#### OA-12 — An admission from a referral carries the referral's broad diagnosis category, marked tentative.

#### OA-13 — Keep the tentative diagnosis on the bed board, from a fixed list.

### B. Referrals

#### OA-14 — ED to community team referral: **build now.** All teams offered, the patient's area team first;

    while on a form, not offered until the examination outcome is recorded; then allowed with legal
    status shown.

#### OA-15 — Accepting a referral starts nothing; a separate "start the bed journey" step.

#### OA-16 — A community team may accept a referral, for follow-up only.

#### OA-17 — CLARIFY

— the referrer withdrawing only the community part after a ward accepts.

#### OA-18 — Re-referring adds wards; replacing is a withdrawal with a reason from a fixed list. **Ward Lead

    drafts the list** (owner: "You make a list for me").

#### OA-19 — ED "For discharge" and "For community follow-up" are recorded outcomes that keep the patient on the

    board until they leave.

#### OA-20 — A referral whose only acceptance was withdrawn is not "declined by all".

#### OA-21 — Bed referrals to an ED show on that ED's lists; the ED drawing gets "Request a bed from this

    referral" (drawing first).

#### OA-22 — A new journey may start after an earlier one closed.

#### OA-23 — Police, ambulance and crisis referrals stay recorded as "community" for now.

#### OA-24 — Community teams can cancel transport

(owner: "Yes they can") — reverses the recommendation.

#### OA-25 — GP referrals: the GP is told by phone or letter for now; add "GP" as a referral source.

#### OA-26 — Nobody refers a patient to an emergency department as part of discharge planning

(owner: "No!").

#### OA-27 — A sent referral's history is not editable; corrections are added as new notes.

### C. Journeys, beds and transport

#### OA-28 — CLARIFY

— a journey with no transport.

#### OA-29 — Diversion on the way: a person records the new destination and reason; the ward is told; the bed

    stays held until released by **the coordinator, the ward, or the original referrer** (owner's
    addition).

#### OA-30 — Cancelling transport while a bed is held: no automatic rebooking; a person books again.

#### OA-31 — Transport officer "Arrived" becomes "Delivered"; stopping transport records where the patient is

    and tells the officer.

#### OA-32 — Release times get a Today/Tomorrow chooser ("Tomorrow" = calendar day); live screens rolling 24

    hours, reports calendar days.

### D. Settings

#### OA-33 — ED waiting target adjustable 12–36 hours, default 24.

#### OA-34 — Wards referred at once adjustable 1–3, default 3.

#### OA-35 — Pulled-bed hold: **default 4 hours** (owner). Prompt when it runs out; nothing released

    automatically.

#### OA-36 — Demo remembers itself after reload but stops saving once anyone types free text.

### E. Screens and wording

#### OA-37 — Queue order: urgent flag, then tier, then longest wait; the flag records who and when; legal status

    does not rank by itself. **Ward Lead chooses the four further urgent reasons** (owner: "You decide").

#### OA-38 — Other wards in the ward switcher: coordinators only.

#### OA-39 — CLARIFY

— which Settings look is the approved drawing and which is Gemini's.

#### OA-40 — Keep the real 48-hour movements chart.

#### OA-41 — Retire the Morning screen; its tests move to Capacity.

#### OA-42 — The five extra drawings are reference only; the ED "third edition" is the ED drawing.

#### OA-43 — Unconnected top-bar buttons show "Not wired in this prototype."

#### OA-44 — Service chooser: wire it up now and build anything required

(owner) — replaces the "Not wired"
recommendation.

#### OA-45 — Community team screen labelled as the coordinator's view.

#### OA-46 — CLARIFY

— the Command drawing and what it shows.

#### OA-47 — CLARIFY

— which drawing lacks the Search-row statistics link.

#### OA-48 — Notices count as read only when marked; sent for a withdrawn acceptance, a revoked examination, and

    an ED to community referral.

#### OA-49 — CLARIFY

— what the ward "limiting admissions" box is.

#### OA-50 — Follow-ups recorded by the ward only, for now.

#### OA-51 — Bed board scrolls sideways on narrow screens; no columns dropped.

#### OA-52 — The chosen-service bar gets a word as well as a colour.

#### OA-53 — No "Occupied" word on bed tiles.

#### OA-54 — Ward page panels kept as drawn; the print-only panel decided later.

#### OA-55 — Wording lists confirmed; "Another reason — needs follow-up" means the same from an ED.

#### OA-56 — Write more realistic example referral histories, without faking links.

#### OA-57 — Leave the 2,000-character history limit until measured.

#### OA-58 — Internal patient codes in addresses: fine for synthetic data; decide again before real data.

#### OA-59 — Non-ED admissions: community-direct next, transfers later; multi-leg regional transport out of scope.

### F. Tidying up

#### OA-60 — Delete the two old scratch test files, the orphaned Codex worktree registration, and the duplicate

    Patient search drawing (back up first).

#### OA-61 — Move the 28 request files to a Ward Flow folder, keeping every file.

#### OA-62 — Close the already-answered records and the two rulings about things that no longer exist.

### G. Before real data

#### OA-63 — Park the outside reviews (cultural safety, TGA, clinical safety officer, privacy, legal advice,

    catchment data, post-incident review) and log them as high priority.

### H. Not Ward Flow

#### OA-64 — Leave all four

(owner: "they are not related"). Nothing is done about them from Ward Flow.

## Second round — 17 September 2026, afternoon

Ward Lead put 24 questions to Josh in chat, each with a recommendation (numbered as below). His reply,
**verbatim**:

> 2. No. they actually can. make smallest possible fix to enable this
> 3. No i meant 3D whhich is further examination up to 72 hours
> 4. Stop asking and add to ledger... i have deferred
> 5. A referral will not go to the community team if a patient is referred for an inpatient ward, but let the referrer withdrawl the community part and allow it to happen, it just wouldnt happen very often
> 6. I want to keep the gemini rebuild if that is most up to date one
>    17 send screenshot
> 7. show them
>    go ahead with all recommendations as you state them if not listed above. if listed above go ahead with what i told you for the numbers i addressed

**Decisions, as Ward Lead reads them (a reading, not his words):**

#### R2-1 — Recommendation accepted. For a patient on a legal form, "For discharge" from the ED needs the examination outcome recorded first, the same as a community referral.

#### R2-2 — **Reversed.** A non-binary patient CAN be placed on a single-gender ward when a coordinator records the reason and the ward check. Make the smallest fix that enables this.

#### R2-3 — **Form 3D is the one he meant**: an order for further examination, up to 72 hours. The official register title for 3D stands. No duration is computed or shown (D5).

#### R2-4 — Recommendation accepted. Remove the day count from the Form 3A drawing label.

#### R2-5 — Recommendation accepted. Refuse collection while a withdrawn examination still holds the bed; arrival can always be recorded.

#### R2-6 — **Deferred by the owner. Do not ask again.** The Aboriginal cultural safety review goes on the ledger as deferred. It stays a hard gate before any real-patient use.

#### R2-7 — Recommendation accepted. Diversions are recorded by the transport officer or the coordinator, with the four listed reasons.

#### R2-8 — Recommendation accepted. A stop after collection keeps the bed held until the coordinator, the ward or the referrer releases it. Build the "Stop transport" control.

#### R2-9 — Recommendation accepted. Only the community team that booked transport may cancel it.

#### R2-10 — Recommendation accepted. "No transport needed" is recorded at pull, booking is skipped, and the ward records the arrival.

#### R2-11 — **His framing.** A referral normally doesn't go to a community team when a ward is sought. If it does, the referrer may withdraw the community part alone; it's rare.

#### R2-12 — Recommendation accepted. Antigravity's drawing swap stands. Re-check the ward and handover screens against the new drawings, and redo the ward panel order (F2) against the new panels.

#### R2-13 — Recommendation accepted. The Tier cell goes back to bold, dark text.

#### R2-14 — Recommendation accepted. Chase the officer-screen print loss.

#### R2-15 — **Keep the Gemini rebuild of Settings** if it is the most up-to-date one.

#### R2-16 — Recommendation accepted. The Command "Statewide flow" panel shows every real ward from the data.

#### R2-17 — **Send him a screenshot** of the drawing whose side menu lacks the Statistics link.

#### R2-18 — Recommendation accepted. Replace the free-text "limiting who can come in" box with a fixed list; Ward Lead drafts it.

#### R2-19 — Recommendation accepted. The print-only ward panel waits until printing is tested.

#### R2-20 — Recommendation accepted, kept as built. Referral lists narrow by sending and receiving service, never home area.

#### R2-21 — Recommendation accepted, kept as built. Rail counts and drawers stay whole-network, and the rail names the service.

#### R2-22 — **Show him** the ward-request withdrawal reasons and the urgent-flag reasons.

#### R2-23 — Recommendation accepted. Fix the stray control characters in the two lesson notes.

#### R2-24 — Recommendation accepted. Fix the old broken document links.

## OA-65 — Third ruling, transport booking (17 Sept 2026, verbatim)

> for transport... there is no screen that books transport.. instead you click a botton saying it is
> booked and a popup pops up and you enter the CAD transport number, state voluntary or involuntary,
> state estimated time as well. This is the booking. it is logging the booking you made over the
> phone.

**Reading.** Booking in Ward Flow LOGS a booking already made by phone — it is never an in-app
booking. The control is a button ("Transport booked") that opens a popup asking for the CAD
transport number, whether the transport is voluntary or involuntary, and the estimated time — all
three answered by the person logging the call, none derived or defaulted. The logging roles include
community teams (answers 9 and 24), and a community team may cancel only a booking it logged.

## OA-66 — Fourth ruling, 17 September evening — the last two questions

Put to the owner: (1) "Should the Statistics link be added to the side menu of the patient search drawing? I recommend yes." (2) "Is the wording of the placeholder prompt for an urgent reason right?"

Owner, verbatim: "go ahead now and do this with smallest required fix"

**Reading.** (1) Yes: a Statistics link is added to the side menu of `mockups/patient-search-third-edition.html`, pointing at `statistics-third-edition.html`; nothing else in the drawing changes. (2) The drafted urgent-reason placeholder wording is accepted as it stands; no change.
