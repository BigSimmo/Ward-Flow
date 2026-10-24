# Ward Flow demonstration script

**What this is:** an 11-minute walk-through of one synthetic patient journey, from the morning bed
meeting to arrival on the ward, then a short look at what is new.  
**Audience:** clinical and operational leaders who coordinate psychiatric beds.  
**Run time:** about 11 minutes, plus questions.  
**Data:** 100% synthetic. Every patient, figure and phone number is invented. The app has no
connection to any hospital system.

---

_Updated 24 October 2026, checked against source at `d1e61c1`. Button names, screens and the flow
were read from the source code; this update was not rehearsed in a browser. Rehearse once before any
audience. Previous rewrite: 20 October 2026 (PR #510). Documentation owns._

## Read this first

- **Ward Flow is a prototype on synthetic data.** It is not clinical decision support, not a medical
  device and not approved for clinical use. Say so at the start and at the end.
- **The app never decides.** It never places a patient, scores risk, suggests a best ward, re-sorts
  the ED queue, works out a Mental Health Act time or releases a pulled bed. Every step in this
  script is a person's click.
- **Words.** A bed kept for an incoming patient is **pulled**, with a pull time limit. "Held" is only
  for a bed kept for its own patient while they are on leave or absent.
- **Real hospital names, invented figures.** The app uses real WA hospital and ward names so the
  map is familiar. Every number, patient and rule shown against them is invented. Do not describe
  any real ward's actual rules, staffing or performance.

## Setup (before the audience arrives)

1. Build and start the demo build. Do not use `npm run ensure`: that starts a development server,
   which has role access off.

   ```
   npm run build
   npm run start
   ```

2. Open the address it prints in Chrome or Edge, 1440 px wide or wider, 100% zoom. Use one tab for
   the whole demo.
3. In the header, press the **Synthetic prototype** pill. The **Demo** menu opens (scenario, clock
   and reset). Press **Reset demo**, then **Reset demo** again in the confirm box. The scenario is
   **Standard day**. The demo clock starts at **10:42**.
4. Check the footer ends "… synthetic demonstration figures · Not approved for clinical use".
5. Rehearse once from start to finish, then **Reset demo** again.

The left-hand menu is the coordinator's own short menu: **My list**, **Capacity**, **Movements**,
**Referrals** and **Handover**. Every other page is under **More**.

### Three rules for the run

- **Avoid reloads, F5 and typed addresses after Act 4.** Once you type text, the page shows
  "Demonstration state is saved on this device, except typed text." A reload keeps the clicks but
  blanks what you typed, such as the dispatch number. Move around only with on-screen links, the
  left-hand menu and the browser's Back button.
- **Do not open the TV view in a new tab or a second tab mid-demo.** If you want to show the TV, show
  it in Act 1 and come back.
- **Wait a second after each page opens** before clicking. Clicks in the first moment after a page
  loads can be ignored.

If something goes wrong: press **Undo** on the message that appears (it lasts a few seconds), or
open the **Synthetic prototype** pill, press **Reset demo** and start again from Act 2. Acts 1 and 2
change nothing.

## Run of show

| Act | Minutes     | Screen                                      | What the audience sees                            |
| --- | ----------- | ------------------------------------------- | ------------------------------------------------- |
| 1   | 0:00-1:30   | Capacity                                    | The statewide picture and the bed meeting sheet   |
| 2   | 1:30-3:30   | Royal Perth Hospital ED, then Keira's page  | A patient accepted by a ward, waiting for a bed   |
| 3   | 3:30-5:00   | Referrals, then Keira's page                | How wards are shown, and a person pulling the bed |
| 4   | 5:00-7:30   | Keira's page                                | Clearance, transport booking, and the move        |
| 5   | 7:30-8:30   | Keira's page, then Dabakarn                 | Arrival, and Keira on the ward page               |
| 6   | 8:30-10:30  | A ward's referral, Seclusion, the demo menu | What is new: full referral, seclusion, demo clock |
| -   | 10:30-11:00 | My list                                     | Close                                             |

The patient is **Keira Pellingworth, UM100045** (synthetic): at Royal Perth Hospital ED, on a
Form 3B, accepted by Dabakarn and waiting for a bed.

---

## Act 1: The morning picture (0:00-1:30)

**Screen:** **Capacity** in the left-hand menu.

**Do:** point to the headline "… beds ready of …", then **Locked beds ready**, **Open beds ready**
and **Beds pulled**. Note the beds-ready number beside **Capacity** in the left-hand menu: you will
come back to it in Act 3. Scroll to "Where the mismatch is".

**Say:**

> "It's mid-morning. This is the statewide picture a bed coordinator would bring to the bed meeting.
> Everything you'll see today is synthetic: invented patients and figures, under real hospital
> names so the map is familiar.
>
> At the top: beds ready across the state, and how many are locked. Each ward's number comes from
> that ward confirming its count, and you can see how long ago each ward confirmed. An old
> count is flagged rather than passed off as current.
>
> Below that is where the pressure is: how many people are waiting for each kind of bed, against
> how many beds of that kind are ready."

**Do:** press **Bed meeting sheet**. Show the sheet, point to **Print sheet**, then press **Close**.

**Say:**

> "For the meeting itself, this builds a one-page sheet from the same figures, ready to print or put
> on the screen. Nobody adds anything up by hand."

**Optional:** press **Open on TV** to show the large-screen view, then return to Capacity with the
browser's Back button. Do this only now, before Act 4.

---

## Act 2: A patient waiting in ED (1:30-3:30)

**Screen:** Royal Perth Hospital ED. In the left-hand menu press **More**, then **All EDs**, then
**Enter** on the Royal Perth Hospital row.

**Do:** point to the board header ("… on the board") and the chips **No bed yet** and **Under a
form**.

**Say:**

> "This is the emergency department's view: who is waiting for a mental health bed, how long, and
> under which legal form. The ED's list stays in the order the ED keeps it. Ward Flow does not
> re-sort it or score anyone."

**Do:** click **Pellingworth, Keira**. A panel opens. Point to **Where the referral is** (Referral
sent, Dabakarn accepted, Pulled bed: none yet, Transport: Not booked yet), then to
**Form ends: Not written**.

**Say:**

> "The ED can now see where its referral stands without ringing anyone: sent, accepted
> by Dabakarn, no bed yet, no transport yet.
>
> Look at 'Form ends': it says 'Not written'. Ward Flow never works out when a form expires. If a
> time is shown, it is the one typed from the paper form. If it wasn't written, the app says so
> rather than guessing."

**Do:** press **Esc** to close the panel. In the left-hand menu press **More**, then **Waiting**.
Click Keira's row, then press **Journey**. Point to "Stage 3 / 7 · Accepted, awaiting bed" and the
seven steps beneath it. Then point to the status card, **Getting ready to move**, and its three
cells: **Bed** ("Accepted, no bed pulled yet"), **Fit to travel** and **Transport** ("Needs the bed
pulled").

**Say:**

> "This is her journey page. Dabakarn, a locked ward in the demo data, has accepted her, but no bed
> is pulled for her yet. The page shows the seven steps of her journey and what still has to happen
> before she can move: a bed pulled, the treating team's clearance, and transport.
>
> Each step names who does it. The app will not let a step happen out of order: transport waits for
> the pulled bed."

---

## Act 3: Where could she go, and pulling the bed (3:30-5:00)

**Screen:** **Referrals** in the left-hand menu.

**Do:** open **Vallowen, Orla** (from Armadale), then the **Place** tab. Point to the three groups:
**Fits, bed ready**, **Fits, no bed now** and **Needs review**. Choose one ward to show that **Accept
at …** only appears after a person chooses. Do not press Accept. Press **Esc** to close.

**Say:**

> "When a referral comes in, the coordinator sees every ward in one list, in the network's fixed
> order, grouped by whether it fits and has a bed. Nothing is ranked and nothing is picked for you.
> A ward that does not fit says why, and can only be chosen through a clinical override with a
> recorded reason. A person decides, and presses Accept."

**Do:** go back to Keira's page with the browser's **Back** button. On the **Bed** cell press **Pull
the bed**. The **Destination and placement** panel opens. Press **Pull the bed** in the panel. A
"Bed pulled" message appears with **Undo**. Press **Esc**.

**Say:**

> "Dabakarn has a bed, so the coordinator pulls it for Keira. Two clicks, so it can't happen by
> accident, and there's an Undo."

**Do:** point to the **Bed** cell ("Bed pulled, … left"), the stage now "Stage 4 / 7 · Bed pulled",
and the number beside **Capacity** in the left-hand menu, which has dropped by one.

**Say:**

> "The bed now shows as pulled, with a four-hour pull time limit. The statewide count has gone down
> by one. When the limit runs out, the pull does not release itself: the page says it has expired
> and a person decides."

**Optional (demo clock):** press the **Synthetic prototype** pill and press **+1 hour** next to
**Demo clock**. Close the menu with **Esc**. The pull time left has gone down by an hour. Say: "This
is a demo control only, to show time passing. The clock in a real deployment would be the real one."

---

## Act 4: Getting ready and moving (5:00-7:30)

**Screen:** still Keira's page.

**Do:** on the **Fit to travel** cell press **Record clearance**. Choose **Medical clearance
provided**, tick "This is the treating team's stated outcome", and press **Save clearance
outcome**.

**Say:**

> "The treating team records that she is medically cleared. The app records what they said. It does
> not judge fitness to travel itself."

**Do:** on the **Transport** cell press **Log booking**. The **Transport** panel opens. Type a
synthetic dispatch number such as `CAD-DEMO-0001`, press **+30m** for the quoted time, choose
**Ambulance service**, check **Transport legal status** reads from Legal now, answer **Clinical
escort required for transfer**, and press **Save transport booking**. Press **Esc**.

**Say:**

> "Transport is booked by phone, as it is today, and the booking is recorded here: the dispatch
> number, the quoted time and who is taking her. There is no link to an ambulance or transport
> system. The app records the booking; it does not check it."

**Do:** point to the note under the header: "Demonstration state is saved on this device, except
typed text." **From here, avoid reloads and typed addresses.**

**Do:** press **Mark handover ready**. Then, in the seven-step strip, click the current step and
press **Review stage actions**. The **Destination and placement** panel opens. Press, in order,
**Provider accepted job**, **Vehicle en route** and **Mark moving · patient collected**.

**Do:** if a check appears ("Mark moving for … ?") listing what is not recorded yet, such as the
transport order, choose **Paper copy sighted** and press **Mark moving, record reason**.

**Say:**

> "Here the app stops and asks. Something is not recorded yet. The person can still go ahead,
> because the paper may be in hand, but they have to say why, and the reason is recorded with the
> step.
>
> Keira is now moving, and her page shows when she is due on the ward."

---

## Act 5: Arrival (7:30-8:30)

**Screen:** still Keira's page, **Destination and placement** panel.

**Do:** press **Confirm arrival · receiving ward**. If a check appears, choose a reason and confirm.
Point to "Arrived · transfer complete".

**Say:**

> "The ward confirms she has arrived. The journey is closed, and her page now belongs to the ward."

**Do:** press **Esc** to close the panel. In the left-hand menu press **More**, then **All wards**,
then open the **Dabakarn** card. Point to Keira in the bed list, and to the line under the ward name
that counts staff on constant observation.

**Say:**

> "On Dabakarn's own page she is in a bed. Every screen we visited, the ED, the coordinator's and
> the ward's, showed the same record as it changed.
>
> That line also shows observation levels at work. Each patient has a level, from General to Two
> staff constant, and the ward sees how many staff that takes. The levels are recorded by people.
> Nothing is scored or suggested from them."

---

## Act 6: What is new (8:30-10:30)

Pick two of these three if time is short. None of them needs typing.

**A. The ward sees the full referral before it answers.** In the left-hand menu press **More**,
then **All wards**, and open **SJGM Adult Open**. Open the **Referrals** tab. Under **Awaiting your
answer**, click the patient's name (**Saoirse Loxbury**, synthetic). The full referral opens: reason,
risk, legal, observation, medical clearance, medications, referrer and attached documents. Close it
with **Esc**. Do not accept or decline.

> "A ward can't make a safe decision on a referral it can't read. So before it answers, the ward
> sees the whole referral, with the patient's name and record number. What it never sees is which
> other wards were asked. The card also splits the patient's checks from the ward's own state, so a
> stale bed count doesn't read as the patient failing."

**B. Seclusion and restraint, operational only.** In the left-hand menu press **More**, then
**Seclusion**. Point to the note at the top, **In use now** and the ward's seclusion room status.

> "This shows what is in use now and whether each seclusion room is available. Times are shown as
> they were typed. It works out no order length, no review time and no legal limit. The legal
> register stays in the health service's own system."

**C. The demo clock.** If you skipped it in Act 3, press the **Synthetic prototype** pill and show
**Demo clock** with **+15 min** and **+1 hour**, and the scenario list. Close with **Esc**.

> "For a demonstration we can move time forward or load a different day, like a surge. It only
> changes synthetic data."

---

## Close (10:30-11:00)

**Do:** press **My list** in the left-hand menu.

**Say:**

> "In about ten minutes we followed one synthetic patient from the morning bed picture, through a
> pulled bed, clearance, transport and the move, to arrival on the ward. At every step a person made
> the decision, and the app showed what was ready and what was missing.
>
> This is a prototype on invented data. It is not clinical decision support. It has not been
> through clinical safety, privacy or legal review, and it is not for clinical use. What we'd value
> most from you is whether this matches how the work really happens, and what it gets wrong."

---

## What you can and cannot claim

Say these with confidence:

- **Nobody is placed by the app.** Every refer, accept, pull and move is a person's click. Pulling a
  bed takes two clicks and offers Undo.
- **No ranking.** Wards are listed in a fixed network order, never ranked or suggested. The ED's
  list is not re-sorted.
- **No computed legal times.** Legal expiry is shown only when it was typed from the paper form;
  otherwise the app says the time was not written. It never works out a Mental Health Act duration.
- **Pulls never release themselves.** A pulled bed shows its pull time limit; when it runs out, a
  person decides.
- **Steps happen in order.** Transport needs a pulled bed; handover ready needs transport; a missing
  record asks for a recorded reason.
- **One decline list.** Wards and coordinators decline from the same list of reasons, with a few
  kept for wards only.
- **Asking wards.** For an open community referral, the coordinator can ask more wards, up to three
  waiting at once. Wards that declined don't count. An accepted community referral moves through
  the same journey, transport and arrival as an ED one.
- **Role access by desk.** Each desk (coordinator, ward, ED, community team, transport officer, bed
  manager) sees and does only what its role needs. A ward never sees which other wards were asked.
  Today's demo runs as the coordinator desk.
- **Single-gender wards.** The check uses the gender recorded at referral, not sex. A single-gender
  ward cannot be overridden for a patient whose recorded gender is the other binary gender, and it
  refuses when gender has not been recorded. There is no room or wing model. For a non-binary
  patient, one coordinator records a reason and ticks that it was checked with the ward.
- **Overrides are recorded.** The actions that need an override need a reason from a fixed list, and
  recorded overrides show in the governance view. Routine steps do not all record a reason.
- **Alerts.** The Alerts screen shows the quiet conditions as well, so silence is not mistaken for a
  fault, and gives one action per alert. Severity labels are Critical, Warning and Advisory.
- **Synthetic data.** Every record is invented. Automated tests check identifiers and phone numbers
  in the seed data. They do not check names against real people.

Do not claim:

- compliance with any clinical safety standard, or that the prototype already meets the conditions
  for a pilot;
- that any policy is implemented, or that any organisation has endorsed or reviewed it;
- any connection to a hospital system, ambulance service or transport provider;
- that other sites see changes in real time in this demo. The demo runs in one browser. A shared
  mode with a backend exists but is not what you are showing;
- risk or acuity scores, a "best match" ward, automatic placement or automatic release of a bed;
- anything about a real ward's actual rules, staffing or figures;
- that it "matches", "recommends" or is "intelligent". It shows options; people choose.

## Questions you may be asked

**"Why not do this inside the hospital's existing systems?"**

> "Those systems are the record. This is a coordination view on top: what is ready, who is waiting
> and what is missing, in seconds. Whether it should live inside an existing system is exactly the
> kind of question we want your view on."

**"Does it ever decide for us?"**

> "No. It never places a patient, scores risk, picks a ward or works out a legal time. Every step is
> a person's click, and the steps that need an override need a recorded reason."

**"What happens to the data?"**

> "In this demo everything stays in this browser, and it is all invented. The demo keeps its clicks
> on this device but not the text I typed. A shared mode saves through a backend. There, a change
> only shows as saved once the server confirms it, and if it doesn't, the screen offers Retry rather
> than pretending. That is not what you've seen today."

**"How is transport handled?"**

> "The booking is made by phone, as now, and recorded here: dispatch number, quoted time, provider
> and escort. There is no link to an ambulance or transport system, and the app does not check the
> number."

**"What about community teams?"**

> "A community team can send a short referral and see whether a ward accepted. The coordinator can
> ask up to three wards at once. Once accepted, the journey, transport and arrival work the same as
> from an ED. The journey names the team, never a home address."

**"What about country sites?"**

> "Country wards are on the same statewide map. A country legal extension is recorded as typed from
> the paper; nothing is calculated. Air transport is not built yet."

**"What would it take to use this with real patients?"**

> "A lot, and none of it has been done. Clinical safety, privacy and legal review, a named clinical
> safety officer, security review and proper hosting. Today it is a prototype for feedback only."

## Quick reference

| Act | Where                                  | Press                                                                                                                                                            |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Capacity                               | Bed meeting sheet, Close                                                                                                                                         |
| 2   | More, All EDs, Enter (Royal Perth)     | Pellingworth, Keira; Esc; More, Waiting, Keira's row, Journey                                                                                                    |
| 3   | Referrals, Vallowen, Orla, Place       | Choose a ward (do not accept); Esc; browser Back; Pull the bed, Pull the bed; Esc                                                                                |
| 4   | Keira's page                           | Record clearance; Log booking; Mark handover ready; current step, Review stage actions; Provider accepted job, Vehicle en route, Mark moving · patient collected |
| 5   | Destination and placement              | Confirm arrival · receiving ward; Esc; More, All wards, Dabakarn                                                                                                 |
| 6   | SJGM Adult Open; More, Seclusion; pill | Referrals tab, patient's name, Esc; Seclusion; Synthetic prototype, Demo clock                                                                                   |
| -   | My list                                | -                                                                                                                                                                |

Before every run: **Synthetic prototype** pill, **Reset demo**, confirm. After Act 4 starts: avoid
reloads and typed addresses.
