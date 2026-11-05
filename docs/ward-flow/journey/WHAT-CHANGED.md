# What changed on the ward journey map

**102 change(s) since the last run.**

## Boxes that now say something different (13)

- "No answer at all — and nothing can close it" → "No answer yet"
- "A movement now exists" → "A separate movement is raised"
- "The patient absconds" → "Absent without leave is recorded"
- "Starting a new legal form from the legal forms screen" → "Record a form from the Forms page"
- "The bed stops suiting them, part-way" → "A held destination no longer suits"
- "The cancellation can state the wrong thing" → "Cancellation keeps the bed facts separate"
- "The legal authority is revoked before pick-up" → "The legal authority is revoked before collection"
- "Once the record closes, nothing can be added to it" → "Closure limits corrections; admitted forms have a separate route"
- "What the form asks for and then discards" → "Add patient saves identity; referral saves intake"
- "Nothing on this map expires on its own" → "The display follows wall-clock time"
- "Six settings change what is allowed" → "Settings change current operational defaults"
- "Two patients wanting the same bed" → "Duplicate bed requests are surfaced"
- "After they arrive, the form's expiry cannot be recorded" → "Expiry can be recorded for an admitted patient"

## Boxes that changed meaning (8)

- **Absent without leave is recorded** — was drawn as "absent", now "record".
- **Record a form from the Forms page** — was drawn as "absent", now "record".
- **Pulling again when the bed is already held** — was drawn as "diversion", now "record".
- **Cancellation keeps the bed facts separate** — was drawn as "breach", now "record".
- **The legal authority is revoked before collection** — was drawn as "breach", now "record".
- **Closure limits corrections; admitted forms have a separate route** — was drawn as "stall", now "record".
- **Add patient saves identity; referral saves intake** — was drawn as "absent", now "record".
- **The rule for a bed kept during a medical trip** — was drawn as "absent", now "record".

## Findings that were reworded (8)

- **Transport cancelled before collection**
  - was: "Two of its refusals can never run. Both describe a job already cancelled or a patient already arrived — and every way either happens also closes the movement, which a check above them catches first."
  - now: "The role/booking-place, collected, delivered and closed checks are distinct; an officer delivery can precede ward arrival without closure."
- **The journey is stopped after collection**
  - was: "Two of its refusals can never run either, for the same reason. Nobody is less safe; the sentence they would have been given simply names the closure instead of what they just tried to do."
  - now: "An officer delivery can precede ward arrival without closure, so delivered and closed refusal paths are distinct."
- **Pulling again when the bed is already held**
  - was: "Pulling a held bed again skips every capacity and eligibility check."
  - now: "Restoring a hold does not consume a second bed; staffing, legal, gender and matching-admission checks still run."
- **A held destination no longer suits**
  - was: "The refusal names a way out that is itself refused; only a second message names the real three steps."
  - now: "A held acceptance can now be withdrawn atomically after cancelling a live job; handover-ready/moving still require the supported earlier-stage path."
- **Cancellation keeps the bed facts separate**
  - was: "The cancellation notice works out whether a bed is held from the stage, not from the bed."
  - now: "Cancellation checks both the admission link and stage before describing whether the bed stays held."
- **Closure limits corrections; admitted forms have a separate route**
  - was: "Once a record closes, the legal status, the recorded sex or gender, and the legal form can never be corrected on it."
  - now: "Most movement commands refuse closure, but admitted-ward form and expiry commands have explicit supported post-arrival routes."
- **Expiry can be recorded for an admitted patient**
  - was: "Arriving closes the record, so the legal form's expiry can no longer be recorded for exactly the people it is for."
  - now: "The admitted-patient expiry route is implemented for the ward. Read the current legal-event handler; the old closed-movement gap is retired."
- **A row appears in the coordinator's inbox**
  - was: "Real fact rows cannot be completed, but a fabricated commitment-prefixed ID can pass the completion guard without a matching inbox row."
  - now: "Completion applies to commitment IDs; fact rows use their source condition and bed-meeting actions have a dedicated completion event."

## Boxes that explain themselves differently (29)

- **Addressed to up to three places at once**
  - was: "Never two of the same kind. Each answers on its own, and cannot see the others."
  - now: "Up to the configured recipient cap. Distinct named psychiatric wards can be addressed together; duplicate recipients and mixing a broad ward request with named ward requests are refused."
- **No answer yet**
  - was: "No acceptance anywhere cancels a queued community arm, so unlike the other two it can only end by the team answering or the referrer taking this arm back. Nothing escalates, and there is no clock."
  - now: "The arm remains queued until answered or withdrawn. Other acceptances do not cancel a community arm. Displayed waiting/overdue indicators do not decide or close it."
- **Accepted**
  - was: "The only answer anywhere that starts something."
  - now: "Records the ward answer, with an optional named bed reservation on the referral. It creates no movement or admission."
- **No answer at all**
  - was: "It simply stays waiting. Nothing escalates on its own, and there is no clock on it."
  - now: "The destination remains waiting until answered, withdrawn or cancelled by a competing acceptance. Current target/overdue displays can flag waiting; they do not choose an answer."
- **A separate movement is raised**
  - was: "Accepting a referral starts nothing by itself. This second record is the one that moves."
  - now: "Acceptance does not create the bed-search record. RAISE_REFERRAL creates it separately and can link it to the referral."
- **The ward says they have arrived**
  - was: "The one step that can never be undone."
  - now: "Ward confirmation closes the movement and records the occupied stay. An officer Delivered stamp ends only the transport leg. STEP_BACK_STAGE refuses arrival; a separate scoped, time-limited Undo can correct the latest unchanged arrival snapshot."
- **The acceptance is withdrawn**
  - was: "Four reasons — recorded in error · the decision changed · the patient's situation changed · the bed was lost. A stepped-back pull still holds its bed, so withdrawal is refused until the pull is restored and released."
  - now: "A listed reason records why the acceptance is withdrawn. An uncollected pulled or stepped-back hold is released in the same act; cancel a live job first. Handover-ready and moving are refused."
- **Transport cancelled before collection**
  - was: "Four reasons. The job is deleted and nothing is rebooked. Whether the bed is still held depends on how far the record has got — and the notice works that out from the stage, not from the bed."
  - now: "A listed reason removes the job without moving the stage or automatically rebooking. The held-bed notice checks the admission link as well as stage, including a stepped-back pull."
- **Absent without leave is recorded**
  - was: "No state exists for this. They are still admitted, the bed is still theirs, and nothing anywhere can say they are missing."
  - now: "The occupied stay and held bed remain. The ward records absence, its steps and return against the admission; the current order can also create an action-inbox fact."
- **Record a form from the Forms page**
  - was: "A form is issued when the emergency department raises the bed search, and the legal forms screen records when it was written or received and its expiry. Only a form started there is lost: 'Record a form' opens the whole form, and its save button is disabled, so it records nothing."
  - now: "The form selector and checked paper time reach the supported form-writing handler. Authorised users can save; refusal keeps the draft and shows the reason. This does not issue a legal instrument or calculate its statutory expiry."
- **Pulling again when the bed is already held**
  - was: "Restores the record to 'pulled' and returns before any capacity, specialling, acuity or eligibility check runs. Deliberate — the held bed is one of the things those checks count — but it means a second pull is not a second decision."
  - now: "Restoring an already-linked hold preserves its bed rather than consuming another. Current code rechecks the matching admission, patient placement, observation/high-acuity staffing, legal authority and gender before restoring the pulled stage."
- **A held destination no longer suits**
  - was: "Checked again at four separate steps while the bed is held — pulling it, handover ready, the crew accepting, and collection. The refusal says to withdraw the acceptance and refer again — but withdrawing is itself refused while a bed is held, and THAT refusal names the real route: pull it again to restore it, release the pull, then withdraw. Three steps, and only the second message tells you them."
  - now: "Current gender/legal facts are checked at forward steps. WITHDRAW_ACCEPTANCE can release an uncollected pulled or stepped-back hold atomically after any live job is cancelled; no obsolete three-step sequence should be assumed."
- **Cancellation keeps the bed facts separate**
  - was: "Whether a bed is still held is worked out from how far the record has got, not from the bed. A record stepped backwards still holds its bed, and the cancellation then tells everyone no bed is held."
  - now: "The hold is detected from the linked admission OR the pulled-or-later stage. Cancelling removes the job and preserves the bed and current stage, including after a step back."
- **The legal authority is revoked before collection**
  - was: "Sending the crew is still allowed; collecting the patient is refused while the bed is held. A crew can be sent to a door it will be turned away from."
  - now: "A revoked examination while a bed is held records the examination and flags release without refunding the bed. Acceptance, en-route and collection refuse while that hold is unresolved; physical arrival remains recordable."
- **Away at an ED, or on leave**
  - was: "Two unlike things in one place. Away at an emergency department is recorded against the PATIENT and paired with their return. A leave bed is recorded against the WARD and names the one stay it belongs to (owner ruling, 25 September), but it still carries no reason and no destination."
  - now: "An ED trip and leave name the occupied admission. Return records clear the relevant absence. Leave also records its kind and optional psychiatrist-authorisation answer; the bed stays held while away."
- **Closure limits corrections; admitted forms have a separate route**
  - was: "Arriving closes it, and so does every other ending. More than thirty checks across the engine then refuse. Three of those matter: the Mental Health Act status, the sex or gender recorded for bed matching, and whether a legal form arrived or when it expires. If any of those is wrong at the moment the record closes, it can never be corrected there, and the refusals name no other route."
  - now: "Most movement actions refuse closure. The admitting ward can still record a supported written form or typed expiry for a current occupied stay. STEP_BACK_STAGE refuses arrival, while a separate scoped Undo can reverse the latest unchanged transport/arrival snapshot within its window."
- **Track one — the person leaves**
  - was: "Eight recorded ways out, and one of them frees no bed at all."
  - now: "Eight recorded departure destinations. A psychiatric transfer releases the sending ward bed while taking a receiving bed."
- **Track two — the bed is released**
  - was: "Expected, then confirmed, then discharged — but confirming can be skipped, and expected straight to discharged is allowed on purpose. The last step happens when the named patient is recorded leaving, and moves TWO counts: the beds a ward may allocate, and the beds it has empty."
  - now: "Expected can go directly to discharged or pass through confirmed. The named admission leaving completes its release in the same write; capacity reconciliation prevents counting an already-recorded release or an over-capacity arrival twice."
- **Is this the same person already?**
  - was: "Four warnings when somebody is added — the record number already exists · same name and same date of birth · same name where the date of birth does not confirm it · a name one keystroke away from an existing one. All four are warnings. None of them refuses."
  - now: "Duplicate matching warns about number and demographic similarities. A duplicate record number blocks registration in both form and reducer; name similarity alone remains a review warning."
- **Add patient saves identity; referral saves intake**
  - was: "Triage category, statutory legal status, Aboriginal and Torres Strait Islander status, address, presenting facility, health service, presenting complaint and clinical intake notes are all collected when a patient is added. Six fields are kept: record number, given name, family name, date of birth, gender, and suburb if one was typed. The model has nowhere to put the rest, so it goes on submit with nothing said. 'Save draft' and 'Print' on the same screen record nothing either."
  - now: "The current Add patient form asks for identity, optional gender and Aboriginal or Torres Strait Islander status. Clinical intake and location belong to the referral flow. Obsolete non-working Print/Save draft controls are hidden; the historical silent-discard finding no longer describes this screen."
- **The display follows wall-clock time**
  - was: "The clock only moves when somebody advances it, and advancing it changes one number and nothing else — no hold lapses, no request is cancelled, nothing escalates. Every deadline, every countdown and every 'overdue' on any screen is worked out fresh each time the screen is read."
  - now: "The provider updates elapsed wall-clock time at minute boundaries and catches up when the page becomes visible. A controlled test clock is separate. A display becoming overdue does not by itself prove that a domain action ran; check the event handler for that action."
- **Settings change current operational defaults**
  - was: "How long a pulled bed is held (thirty minutes to four hours, default four). How many places one referral may be sent to at once (one to three — a coordinator can only turn this DOWN from three, never up). The department's access target (twelve to thirty-six hours). The morning count deadline, and the two 'due soon' warning times. Saving them replaces all six at once or is refused outright."
  - now: "WardConfiguration carries twelve fields: access/decision/transfer/booking targets, parallel-recipient cap, pull hold, morning deadline, due-soon warnings and Forecast thresholds. A valid full draft is merged against its baseline or refused for conflicting fields; old optional keys take documented defaults."
- **Duplicate bed requests are surfaced**
  - was: "A function can work out which movements are competing for one bed, but no screen calls it, so no clash is shown anywhere today. If it were used it would only name the clash: it never ranks the patients and never arranges an outcome."
  - now: "The current duplicate-bed-request derivation finds multiple active requests for one linked patient and creates a coordinator fact row. It does not rank patients or choose a winner. This is distinct from a physical double-booking check."
- **The paperwork is written, continued, or attached**
  - was: "Written and continued forms store clinician-typed start and expiry times and clear the old legal clock. A 3C after arrival on a 3D is refused. A file can be attached by name. The country-extension event is always refused; use the typed-expiry event instead."
  - now: "Written and continued forms record paper facts and clear legacy calculated clocks; same-form written-time edits preserve applicable typed facts. An admitted ward has a post-arrival route. A3C after3D is refused. A country1A extension requires a current country setting and a finite typed later paper expiry; no statutory duration is computed."
- **Somebody is told**
  - was: "Twenty-three kinds of notice. Written once, never rewritten, never deleted, never expiring."
  - now: "Twenty-four kinds of notice. Written once, never rewritten, never deleted, never expiring."
- **Expiry can be recorded for an admitted patient**
  - was: "Arriving closes the record that moves, and adding an expiry to a closed record is refused. So a patient on the ward under a legal form is past the point where this route can record or extend its expiry, and the refusal names no other way."
  - now: "The legal-event handler permits the ward to record a typed expiry for its admitted patient even when the movement is closed. This is a recorded time, not a computed legal limit. See ward-flow-record-legal-events.ts."
- **The rule for a bed kept during a medical trip**
  - was: "A threshold exists for how long a general-hospital trip must be expected to last before the ward bed is given up, and a function decides from it. Nothing in the app calls that function, so the rule is neither applied nor shown anywhere. The threshold is set to 24 hours, while the note beside it still describes the owner's figure as 48."
  - now: "The unwired retention helper keeps the bed by default, including above the24-hour threshold; above threshold adds requiresReview. Only an explicit override changes freesBed. The numeric constant is24 while an adjacent historical provenance comment still says48."
- **A row appears in the coordinator's inbox**
  - was: "Five live fact categories are acknowledged rather than completed. The engine refuses completion of their real rows, but a fabricated commitment-prefixed ID can be completed because it is not checked against the inbox."
  - now: "The current inbox derives fact rows from movements, stays, planned bookings and bed-meeting actions. Facts are acknowledged/owned/snoozed, never ticked away. The daily check is a commitment; its day-shaped ID can be completed and reopened."
- **The bed is being prepared**
  - was: "Being cleaned · awaiting maintenance or repair. Since the owner's ruling of 1 September it counts: a bed still being made ready is not open, and a pull is refused when every free bed at the ward is still being made ready."
  - now: "Cleaning/repair is a separate preparation flag. It does not directly rewrite the ward count; the pull handler separately refuses when every free bed is still being made ready."

## 🔴 Actions the engine no longer has (1)

- Release the bed (RELEASE_BED)

## Refusals named, by action (43)

- Raise a referral at the front door: 10 → 6
- Record whether they are medically cleared: 1 → 2
- Accept the referral: 10 → 6
- Ask one or more wards: 5 → 4
- Undo a ward's acceptance: 2 → 3
- Record an escalation: 1 → 2
- Record whether transport is needed: 1 → 2
- The crew accepts the job: 1 → 2
- The patient is picked up: 2 → 3
- Record that they have left the department: 1 → 2
- Mark a form as physically received: 3 → 4
- Record that they are away at an ED: 1 → 2
- Record that they are back: 1 → 2
- Record a bed as on leave: 1 → 2
- End a bed's leave: 1 → 2
- Record what is restricting a ward's intake: 1 → 2
- Change how urgent it is: 1 → 2
- Clear the urgent flag: 1 → 2
- Say nothing is holding it up: 1 → 2
- Acknowledge an inbox row: 1 → 2
- Tick off an inbox row: 2 → 3
- Reopen a completed row: 1 → 2
- Move the demonstration clock: 0 → 1
- Change the coordinator's settings: 1 → 0
- Record a patient’s physical departure: 0 → 1
- Record how and when they are expected: 1 → 2
- Work out whether an expected arrival is late: 1 → 2
- Mark somebody as a step-down candidate: 0 → 2
- Record what is holding a discharge up: 0 → 2
- Record care journey fact: 0 → 3
- Record medical clearance against the movement: 1 → 2
- Attach a file to the movement: 1 → 2
- Record that a form was continued: 1 → 2
- Record a typed country Form 1A extension: 1 → 2
- Start a forty-eight-hour or seven-day clock by hand: 1 → 2
- Clear that hand-set clock: 1 → 2
- Confirm the ward's morning count: 0 → 2
- Send a message to a ward: 0 → 2
- Log a repatriation arranged by phone: 9 → 6
- Sign off the shift handover: 0 → 2
- Send a network-wide alert: 1 → 2
- Acknowledge a network-wide alert: 1 → 2
- Stand down a network-wide alert: 1 → 2

_Written 2026-11-05T05:23:35.253Z by `npm run ward:journey`._
