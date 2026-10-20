# Ward Flow demonstration script

**What this is:** a 10-minute walk-through of one synthetic patient journey, from the morning bed
meeting to arrival on the ward.  
**Audience:** clinical and operational leaders who coordinate psychiatric beds.  
**Run time:** about 10 minutes, plus questions.  
**Data:** 100% synthetic. Every patient, figure and phone number is invented. The app has no
connection to any hospital system.

---

_Updated 2026-10-20 - rewritten to match the app on `main` (Audit 3, demo readiness): real labels,
the seeded Keira Pellingworth journey, true claims only, no endorsement lines; Documentation owns._

## Read this first

- **Ward Flow is a prototype.** It is not validated clinical decision support, not a medical device
  and not approved for clinical use. Say so at the start and at the end.
- **The app never decides.** It never places a patient, scores risk, works out a Mental Health Act
  expiry or releases a held bed. Every step in this script is a person's click.
- **Real hospital names, invented figures.** The app uses real WA hospital and ward names so the
  map is familiar. Every number, patient and rule shown against them is invented. Do not describe
  any real ward's actual rules, staffing or performance.

## Setup (before the audience arrives)

1. Build and start the demo build. Do not use `npm run ensure`: that starts a development server,
   which shows preview data (for example a "Make room" panel with invented full wards) and has role
   access off.

   ```
   npm run build
   npm run start
   ```

2. Open the address it prints in Chrome or Edge, 1440 px wide or wider, 100% zoom. Use one tab for
   the whole demo.
3. Go to **Tools**, then **Scenario, clock and reset**, and press **Reset demo**. Confirm. The
   scenario is **Standard day**. The board clock starts at **10:42**.
4. Check the footer says "Synthetic prototype … Not approved for clinical use".
5. Rehearse once from start to finish, then **Reset demo** again.

### Three rules for the run

- **After you log the transport booking (Act 4), do not reload, press F5 or type an address.** Typed
  text switches demo saving off for that tab (owner rule D-18), so a reload starts the demo again.
  The page says so: "Demonstration state is not saved on this device, so a reload starts it again."
  Move around only with the on-screen links and the left-hand menu.
- **Do not open the TV view or a second tab mid-demo.** A new tab starts from its own copy of the
  data. If you want to show the TV, show it in Act 1 and come back.
- **Wait a second after each page opens** before clicking. Clicks in the first moment after a page
  loads can be ignored.

If something goes wrong: press **Undo** on the message that appears (it lasts a few seconds), or go
to **Tools**, **Reset demo** and start again from Act 2. Acts 1 and 2 change nothing.

## Run of show

| Act | Minutes    | Screen                                        | What the audience sees                            |
| --- | ---------- | --------------------------------------------- | ------------------------------------------------- |
| 1   | 0:00-2:00  | Capacity                                      | The statewide picture and the bed meeting sheet   |
| 2   | 2:00-4:00  | Royal Perth Hospital ED, then Keira's journey | A patient accepted by a ward, waiting for a bed   |
| 3   | 4:00-5:30  | Referrals, then Keira's page                  | How wards are shown, and a person holding the bed |
| 4   | 5:30-8:00  | Keira's page                                  | Clearance, transport booking, and the move        |
| 5   | 8:00-9:30  | Keira's page, then Dabakarn                   | Arrival, and Keira in her bed on the ward page    |
| -   | 9:30-10:00 | Home                                          | Close                                             |

The patient is **Keira Pellingworth, UM100045** (synthetic): 36, at Royal Perth Hospital ED, on a
Form 3B, accepted by Dabakarn and waiting for a bed.

---

## Act 1: The morning picture (0:00-2:00)

**Screen:** **Capacity** in the left-hand menu. The scope control at the top reads **Statewide**.

**Do:** point to the headline "Capacity, 26 beds ready of 304", then "7 Locked beds ready" and
"19 Open beds ready". Scroll to "Where the mismatch is".

**Say:**

> "It's mid-morning. This is the statewide picture a bed coordinator would bring to the bed meeting.
> Everything you'll see today is synthetic: invented patients and figures, under real hospital
> names so the map is familiar.
>
> At the top: 26 beds ready across the state, 7 of them locked. Each ward's number comes from that
> ward confirming its count, and you can see how long ago each ward confirmed. An old count is
> flagged rather than passed off as current.
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

## Act 2: A patient waiting in ED (2:00-4:00)

**Screen:** Royal Perth Hospital ED. In the left-hand menu press **More pages**, then **All EDs**,
then **Enter RPH ED**.

**Do:** point to the board header ("Royal Perth Hospital … on the board") and the tiles ("No bed
yet", "Under a form", "Longest here").

**Say:**

> "This is the emergency department's view: who is waiting for a mental health bed, how long, and
> under which legal form. Patients are identified by a synthetic record number."

**Do:** click **Pellingworth, Keira** in the list. Her record opens. Point to "Accepted, awaiting
bed", "Form 3B" and "Form ends: Not written".

**Say:**

> "Keira, UM100045, is on a Form 3B. Look at 'Form ends': it says 'Not written'. Ward Flow never
> works out when a form expires. If a time is shown, it is the one typed from the paper form. If it
> wasn't written, the app says so rather than guessing."

**Do:** press **Close**. Press **Waiting** in the left-hand menu, click Keira's row, then press
**Journey**. Point to "Stage 3 / 7 · Accepted, awaiting bed" and the seven steps beneath it. Then
point to **Getting ready to move: 0 of 3 clear** and its three rows: **Bed**, **Fit to travel** and
**Transport**.

**Say:**

> "This is her journey page. Dabakarn, a locked ward in the demo data, has accepted her, but no bed
> is held yet. The page shows the seven steps of her journey and what still has to happen before she
> can move: a bed held, the treating team's clearance, and transport.
>
> Each step names who does it, and transport says 'Needs the bed held'. The app will not let a step
> happen out of order."

---

## Act 3: Where could she go, and holding the bed (4:00-5:30)

**Screen:** **Referrals** in the left-hand menu.

**Do:** open **Vallowen, Orla** (Tier 2, from Armadale), then the **Place** tab. Point to
**Available beds**, "8 of 8 criteria met · Show criteria" on one ward, and the **Accept at …**
buttons. Do not press Accept. Press **Esc** to close.

**Say:**

> "When a referral comes in, the coordinator sees which wards have a ready bed and which of the
> ward's criteria the patient meets, with the reasons a ward is not eligible spelled out. The app
> does not pick a ward and does not place anyone. A person decides, and presses Accept."

**Do:** go back to Keira's page with the browser's **Back** button (not the arrow in the page
header, which goes to Movements). Press **Hold the bed**. In the panel that opens, press **Hold the bed** again. Press **Esc**.

**Say:**

> "Dabakarn has a bed, so the coordinator holds it for Keira. Two clicks, so it can't happen by
> accident, and there's an Undo."

**Do:** point to "Bed held, 4h 00m left", the stage now "Stage 4 / 7 · Bed pulled", and the
**Capacity** count in the left-hand menu, which has dropped from 26 to 25.

**Say:**

> "The bed now shows as held, with a four-hour timer. The statewide count has gone down by one.
> When the four hours are up, the hold does not release itself: a person decides."

---

## Act 4: Getting ready and moving (5:30-8:00)

**Screen:** still Keira's page.

**Do:** press **Record clearance**. Choose **Medical clearance provided**, tick "This is the treating
team's stated outcome", and press **Save clearance outcome**.

**Say:**

> "The treating team records that she is medically cleared. The app records what they said. It does
> not judge fitness to travel itself."

**Do:** press **Log booking**. Type a synthetic dispatch number such as `CAD-DEMO-0001`, press
**+30m** for the quoted time, choose **Ambulance service**, answer the clinical escort question, and
press **Save transport booking**.

**Say:**

> "Transport is booked by phone, as it is today, and the booking is recorded here: the dispatch
> number, the quoted time and who is taking her. There is no link to an ambulance or transport
> system. The app records the booking; it does not check it."

**Do:** point to the message "Demonstration state is not saved on this device…". **From here, no
reloads and no typed addresses.**

**Say (optional, one line):**

> "Because I typed text, this demo has stopped saving in the browser. That's deliberate: typed text
> is never kept in the browser."

**Do:** press **Mark handover ready**. Then open **Destination** (Dabakarn accepted · bed hold and
placement) and press, in order, **Provider accepted job**, **Vehicle en route** and **Mark moving ·
patient collected**.

**Do:** a check appears: "Mark moving for this patient? … Form 4A transport order not uploaded".
Choose **Paper copy sighted** and press **Mark moving, record reason**.

**Say:**

> "Here the app stops and asks. No transport order has been uploaded. The person can still go
> ahead, because the paper may be in hand, but they have to say why, and the reason is recorded
> with the step.
>
> Keira is now moving, and her page shows when she is due on the ward."

---

## Act 5: Arrival (8:00-9:30)

**Screen:** still Keira's page, **Destination** panel.

**Do:** press **Confirm arrival · receiving ward**. Point to "Arrived · transfer complete" and "On
ward".

**Say:**

> "The ward confirms she has arrived. The journey is closed, and her page now belongs to the ward."

**Do:** press **Esc** to close the panel. In the left-hand menu press **More pages**, then **All
wards**, then **Enter Dabakarn**. Point to bed 07: "Keira Pellingworth, Occupied".

**Say:**

> "On Dabakarn's own page she is in bed 07. Every screen we visited, the ED, the coordinator's and
> the ward's, showed the same record as it changed. Nobody had to ring around to find out where
> things were up to."

---

## Close (9:30-10:00)

**Do:** press **Home** in the left-hand menu.

**Say:**

> "In ten minutes we followed one synthetic patient from the morning bed picture, through a held
> bed, clearance, transport and the move, to arrival on the ward. At every step a person made the
> decision, and the app showed what was ready and what was missing.
>
> This is a prototype on invented data. It has not been through clinical safety, privacy or legal
> review, and it is not for clinical use. What we'd value most from you is whether this matches how
> the work really happens, and what it gets wrong."

---

## What you can and cannot claim

Say these with confidence:

- **Nobody is placed by the app.** Every refer, accept, hold and move is a person's click. Holding a
  bed takes two clicks and offers Undo.
- **No computed legal times.** Legal expiry is shown only when it was typed from the paper form;
  otherwise the app says the time was not written. It never works out a Mental Health Act duration.
- **Holds never release themselves.** A hold shows a four-hour timer; when it runs out, a person
  decides.
- **Steps happen in order.** Transport needs a held bed; handover ready needs transport; a missing
  transport order asks for a recorded reason.
- **Single-sex wards.** A ward designated single-sex cannot be overridden for a patient of the other
  sex. There is no room or wing model. For a gender-diverse patient, one coordinator records a
  reason and ticks that it was checked with the ward.
- **Overrides are recorded.** The actions that need an override need a reason from a fixed list, and
  recorded overrides show in the governance view. Routine steps do not all record a reason.
- **Alerts.** The Alerts screen watches 12 conditions and shows the quiet ones as well, so silence
  is not mistaken for a fault. Severity labels are Critical, Warning and Advisory.
- **Synthetic data.** Every record is invented. Automated tests check identifiers and phone numbers
  in the seed data. They do not check names against real people.

Do not claim:

- compliance with any clinical safety standard, or that the prototype already meets the conditions
  for a pilot;
- that any policy is implemented, or that any organisation has endorsed or reviewed it;
- any connection to a hospital system, ambulance service or transport provider;
- that other sites see changes in real time in this demo. The demo runs in one browser. A shared
  mode with a backend exists but is not what you are showing;
- anything about a real ward's actual rules, staffing or figures;
- that it "matches", "recommends" or is "intelligent". It shows options; people choose.

## Questions you may be asked

**"Why not do this inside the hospital's existing systems?"**

> "Those systems are the record. This is a coordination view on top: what is ready, who is waiting
> and what is missing, in seconds. Whether it should live inside an existing system is exactly the
> kind of question we want your view on."

**"Does it ever decide for us?"**

> "No. It never places a patient, scores risk or works out a legal time. Every step
> is a person's click, and the steps that need an override need a recorded reason."

**"What happens to the data?"**

> "In this demo everything stays in this browser tab, and it is all invented. Typed text is never
> saved in the browser: once you type, the demo stops saving, which is why I haven't reloaded. A
> shared mode saves through a backend; it is not what you've seen today."

**"How is transport handled?"**

> "The booking is made by phone, as now, and recorded here: dispatch number, quoted time, provider
> and escort. There is no link to an ambulance or transport system, and the app does not check the
> number."

**"What about country sites?"**

> "Country wards are on the same statewide map. A country legal extension is recorded as typed from
> the paper; nothing is calculated. Air transport is not built yet."

**"What would it take to use this with real patients?"**

> "A lot, and none of it has been done. Clinical safety, privacy and legal review, a named clinical
> safety officer, security review and proper hosting. Today it is a prototype for feedback only."

## Quick reference

| Act | Where                             | Press                                                                                                                                     |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Capacity                          | Bed meeting sheet, Close                                                                                                                  |
| 2   | More pages, All EDs, Enter RPH ED | Pellingworth, Keira; Close; Waiting, Keira's row, Journey                                                                                 |
| 3   | Referrals, Vallowen, Orla, Place  | Esc; browser Back; Hold the bed, Hold the bed                                                                                             |
| 4   | Keira's page                      | Record clearance; Log booking; Mark handover ready; Destination: Provider accepted job, Vehicle en route, Mark moving · patient collected |
| 5   | Keira's page, Destination         | Confirm arrival · receiving ward; Esc; More pages, All wards, Enter Dabakarn                                                              |
| -   | Home                              | -                                                                                                                                         |

Before every run: **Tools**, **Scenario, clock and reset**, **Reset demo**. After Act 4 starts: no
reloads, no typed addresses.
