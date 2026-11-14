# Ward Flow demonstration script

<!-- last-checked: 2026-11-13 -->

**What this is:** an 11-minute walk-through of one synthetic patient journey, from the morning bed
meeting to arrival on the ward, then a short look at what is new.  
**Audience:** clinical and operational leaders who coordinate psychiatric beds.  
**Run time:** about 11 minutes, plus questions.  
**Data:** 100% synthetic. Every patient, figure and phone number is invented. The app has no
connection to any hospital system.

---

_Updated 13 November 2026 from the pre-demo audit, which ran the script three times on a local
production build and once on the public demo (Chromium, 1440 px wide), then again the same day from
Audits 12 and 14, which added the recovery card near the end, and walked again on the PR C build at
1366 x 768. Rehearse once before any audience.
Previous rewrites: 10 November, 24 October and 20 October 2026 (PR #510). Documentation owns._

## Read this first

- **Ward Flow is a prototype on synthetic data.** It is not clinical decision support and not approved for
  clinical use. Say so at the start and at the end. If asked whether it is a medical device, say: "We
  believe it sits outside the medical device definition. No regulatory adviser has confirmed that
  yet." Do not state it as settled.
- **The app never decides.** It never places a patient, scores risk, suggests a best ward, re-sorts
  the ED queue, works out a Mental Health Act time or releases a pulled bed. Every step in this
  script is a person's click.
- **Words.** A bed kept for an incoming patient is **pulled**, with a pull time limit. "Held" is only
  for a bed kept for its own patient while they are on leave or absent.
- **Real hospital names, invented figures.** The app uses real WA hospital and ward names so the
  map is familiar. Every number, patient and rule shown against them is invented. Do not describe
  any real ward's actual rules, staffing or performance.

## Setup (before the audience arrives)

**Backup pack.** Bring a phone hotspot. Ten wrong tries from one network address lock even the right
demo code out for up to 10 minutes, and a shared venue network counts as one address.

1. Open the public demo in Chrome or Edge, 1440 px or wider, 100% zoom, in a new tab. If the
   left-hand menu shows only icons, the zoom is above 100% or the window is under 1201 px wide:
   press **Ctrl+0**. Below a 1920 x 1080 screen you will scroll about a dozen times during the run;
   full screen (**F11**) helps. Type the demo code and press **Open the demo**. If the **Welcome to
   Ward Flow** cards appear, press **Not now**. Open it well before the audience arrives: a first
   open on a slow connection can take over ten seconds behind a "Loading page" notice.
2. Check the footer starts "Synthetic prototype" and says "Not approved for clinical use".
3. Rehearse once from start to finish **in this same tab**, Act 4 included, so every page's code is
   already loaded for the real run. If the connection drops during the transport booking, do not
   reload; if you must reload, book the transport again. Do not press **Lock as TV**: it puts every
   open tab on the TV view at once, keeps it there after a reload, and hides Reset demo until you
   unlock. If the menu vanishes, press **Unlock**, then **Unlock** in the "Unlock this TV" box.
   Time Act 2 and the Close as you go. In the audit run the Close ran past its 30 seconds and
   Act 2 had the least room, so trim your own words there first.
4. As the audience sits down (not earlier), press the **Board time** clock in the header. **Tools**
   opens at **Scenario and clock**, with **Demo clock** and **Reset demo** at the top of the panel and
   **Scenario** below them. Check the scenario is **Standard day**, and pick it first if it is not:
   Reset demo reloads whichever scenario is loaded. Check **Worked examples** shows the button **Hide
   worked examples** (they are on for the demo). If it says **Show worked examples**, press it, then
   **Show worked examples** in the box. Reset demo keeps them on. Press **Reset demo**, then **Reset
   demo** again in the "Reset the demo?" box. Press **Esc**.
5. Touch the app within 15 minutes of starting, and click somewhere harmless now and then while you
   wait for the room. If the screen is covered after 15 minutes untouched ("Locked after 15 minutes
   without use"), press **Carry on**; nothing is lost.

**About the clock.** A new tab opens at 10:42 on today's date and keeps running in real time. Reset
demo takes off any time you added with **+15 min** or **+1 hour**, but not the real time that has
passed: after a 40-minute rehearsal the board reads about 11:20. That is
fine; say it is a demonstration clock, not the time now. **Pause** beside the **Demo clock** holds board time if you need to stop
mid-act; press **Resume** before carrying on. If you want a 10:42 start, close every
Ward Flow tab and open the demo in one new tab just before the audience arrives, then Reset demo (a
new tab opened while another Ward Flow tab is open takes that tab's clock). A reload does not put a
drifted clock back: open a new tab. Do not reload after midnight: the demo starts a fresh day and
loses every click. Keira's planned move is an hour after the last Reset demo; after that she stays
on Home under **Past planned time** instead of **Rest of your shift**.

The left-hand menu is the coordinator's own short menu: **Home**, **Capacity**, **Movements**,
**Waiting**, **All EDs** and **Referrals**, with **More** for every other page. **Handover** is a
button in the card at the top of the menu, not a menu item. On a short laptop screen the menu
scrolls inside itself.

### Three rules for the run

- **Avoid reloads, F5 and typed addresses.** A reload keeps your clicks but not typed text. Avoid one
  unless the "Part of this page did not load" card appears; then press **Reload page** (not **Try
  again**, which does not bring the page back). Move around only with on-screen links, the left-hand
  menu and the browser's Back button.
- **Do not open the TV view in a new tab or a second tab mid-demo.** If you want to show the TV, show
  it in Act 1 and come back.
- **Rehearse Act 4 once in the same browser window** before the audience arrives. If the connection
  drops during the transport booking, do not reload; if you must reload, book the transport again.
- **Wait a second after each page opens** before clicking. Clicks in the first moment after a page
  loads can be ignored.

If something goes wrong after the bed pull: press **Undo** on the "Bed pulled" message. The message
ends "Undo until" and a clock time five minutes after the pull, and stays until then unless you
close it with its **X**. Until that time, the **Destination and placement** panel also keeps **Undo
pull** under its "Bed pulled · … left" line. After that, press the **Destination** row, **Release bed
pull**, choose **Pull made in error**, then **Release pull**. Or press the **Board time** clock,
**Reset demo**, and start again from Act 2. Acts 1 and 2 change nothing.

If the code screen says "Too many tries", someone on the same network has typed wrong codes. A
presenter already inside is not affected. Open the demo from another network (a phone hotspot), or
wait up to 10 minutes and try again.

## Run of show

| Act | Minutes     | Screen                                       | What the audience sees                            |
| --- | ----------- | -------------------------------------------- | ------------------------------------------------- |
| 1   | 0:00-1:30   | Capacity                                     | The statewide picture and the bed meeting sheet   |
| 2   | 1:30-3:30   | Royal Perth Hospital ED, then Keira's page   | A patient accepted by a ward, waiting for a bed   |
| 3   | 3:30-5:00   | Referrals, then Keira's page                 | How wards are shown, and a person pulling the bed |
| 4   | 5:00-7:30   | Keira's page                                 | Clearance, transport booking, and the move        |
| 5   | 7:30-8:30   | Keira's page, then Dabakarn                  | Arrival, and Keira on the ward page               |
| 6   | 8:30-10:30  | A ward's referral, Seclusion, the demo clock | What is new: full referral, seclusion, demo clock |
| -   | 10:30-11:00 | Home                                         | Close                                             |

The patient is **Keira Pellingworth, UM100045** (synthetic): at Royal Perth Hospital ED, accepted by
Dabakarn and waiting for a bed. Her Form 3B is still shown as recorded, and the next form is not
recorded yet.

---

## Act 1: The morning picture (0:00-1:30)

**Screen:** **Capacity** in the left-hand menu.

**Do:** point to the title "Beds ready and short" and the four figures beneath it: "Ready · now",
"Need a bed · now", "Short · now" and "In use · now". Point to the pill "… of … counts confirmed ·
since …", which names a ward still to confirm and the time it last did. Note the beds-ready number
beside **Capacity** in the left-hand menu: you will come back to it in Act 3. Then point to the band
**By bed type · now** (Locked adult, Open adult, Older adult, Youth), where each cell reads "…
waiting · … fit".

**Say:**

> "This is the statewide picture a bed coordinator would bring to the bed meeting.
> Everything you'll see today is synthetic: invented patients and figures, under real hospital
> names so the map is familiar.
>
> At the top: beds ready across the network, and how many people are waiting for them. Each ward's
> number comes from that ward confirming its count. A ward still to confirm is named here, with
> the time it last confirmed, rather than passed off as current.
>
> Below that is where the pressure is: for each kind of bed, how many people are waiting against
> how many beds of that kind are ready."

**Do:** press **Bed meeting sheet**. Show the sheet ("Bed meeting sheet · all services": Ready · now,
Short · now, Discharges · today, Waiting in ED · now, then the lists, including **Held up · by
tomorrow**), point to **Print sheet** (do not press it in front of the audience), then press
**Close**.

**Say:**

> "For the meeting itself, this builds a meeting sheet from the same figures, ready to print or put
> on the screen. Nobody adds anything up by hand."

**Optional:** press **Bed meeting sheet**, then **Open on TV** at the foot of the sheet to show the
large-screen view, then return to Capacity with the browser's Back button. Do this only now, before
Act 3. The TV's discharges figure is the same as the sheet's.

---

## Act 2: A patient waiting in ED (1:30-3:30)

**Screen:** Royal Perth Hospital ED. In the left-hand menu press **All EDs**, then **Enter** on the
RPH ED card.

**Do:** point to the figures at the top ("… on the board", "… no bed yet", "… under a form") and the
filters **Under a form** and **No bed yet**.

**Say:**

> "This is the emergency department's view: who is waiting for a mental health bed, how long, and
> under which legal form. The ED's list stays in the order the ED keeps it. Ward Flow does not
> re-sort it or score anyone."

**Do:** scroll down to **Under 8 hours** and click **Pellingworth, Keira**. A panel opens. Point to **Where the referral is** (Referral
sent, Dabakarn accepted, Bed pulled for this patient: No bed yet, Transport: Not booked yet), then
scroll down inside the panel to its **Legal form** card: Form 3B is still shown as recorded, with the next form to
record. Press **Esc** to close the panel. Then point to **Flint, Oona**'s form column on the same
board (the row just below Keira's):
"Form 1A", "Time not entered".

**Say:**

> "The ED can now see where its referral stands without ringing anyone: sent, accepted
> by Dabakarn, no bed yet, no transport yet.
>
> The app still shows her form as recorded. It shows a form as ended only when a person records
> that it ended, and it is prompting for the next form to be recorded. A person records it; the app
> does not. That rule still needs legal review.
>
> Now look at this patient's form: 'Time not entered'. Ward Flow never works out when a form
> expires. If a time is shown, it is the one typed from the paper form. If it wasn't written, the
> app says so rather than guessing."

**Do:** in the left-hand menu press **Home**. Under **Later today**, scroll down to **Rest of your
shift** and click **Pellingworth, Keira** ("Planned move, bed not pulled yet"); if she is not
listed, press **Show … more** first. After her planned time she moves up to **Past planned time** ("not done yet"). Her page opens. If you cannot find her on Home, press **/**, type `Keira` or
`UM100045` and press **Enter**. Or press **Reset demo** and start Act 2 again. Point to the strip at
the top of her page (In ED, Bed agreed, Moving, On ward, Discharge, Community). Press **Placement
steps**: step 3 of seven is lit. Then press **Hide placement steps**. Then point to the status
card, **Getting ready to move**, and its three rows: **Bed** ("Accepted, no bed pulled yet"), **Fit
to travel** and **Transport** ("Needs the bed pulled").

**Say:**

> "This is her page. Dabakarn, a locked ward in the demo data, has accepted her, but no bed is
> pulled for her yet. The page shows the steps of her journey and what still has to happen before
> she can move: a bed pulled, the treating team's clearance, and transport.
>
> Each row names who does it. The app will not let a step happen out of order: transport waits for
> the pulled bed."

---

## Act 3: Where could she go, and pulling the bed (3:30-5:00)

**Screen:** **Referrals** in the left-hand menu.

**Do:** in the **Queue** list, open **Coldharbour, Cyril**, the last row (not the rows above him,
such as Vallowen, Orla, whose referral names one ward). His referral opens on the **Place** tab.
Scroll down inside the panel and point to the three groups: **Fits, bed ready**, **Fits, no bed
now** and **Needs review**. Each ward reads "Travel time not recorded": the prototype holds no
travel times, so do not quote any. Choose a ward under **Fits, bed ready** to show that **Accept at
…** only appears after a person chooses (until then the button reads "Choose a ward first"); a ward
in the other two groups shows **Clinical override for …** instead. Do not press Accept. Press
**Esc** to close. Ward counts go out of date within the hour, so press **Reset demo** less than an
hour before this act, or the first group can be empty.

**Say:**

> "When a referral comes in, the coordinator sees every ward in one list, grouped by whether it
> fits and has a bed. Nothing is ranked and nothing is picked for you.
> A ward that does not fit says why. A person decides, and presses Accept."

**Do:** go back to Keira's page with the browser's **Back** button. On the **Bed** row press **Pull
the bed**. The **Destination and placement** panel opens. Press **Pull the bed** in the panel. A
"Bed pulled" message appears with **Undo**, ending "Undo until" and a clock time five minutes on.
Press **Esc**.

**Say:**

> "Dabakarn has a bed, so the coordinator pulls it for Keira. Two clicks, so it can't happen by
> accident, and there's an Undo."

**Do:** point to the **Bed** row ("Bed pulled, 4h 00m left"), **Placement steps** (step 4 of seven
is now lit), and the number beside **Capacity** in the left-hand menu, which has dropped by one.

**Say:**

> "The bed now shows as pulled, with a four-hour pull time limit. The statewide count has gone down
> by one. When the limit runs out, the pull does not release itself: the page says it has expired
> and a person decides."

**Optional (demo clock):** press the **Board time** clock and press **+1 hour** next to **Demo
clock**. Close Tools with **Esc**. The pull time left has gone down by an hour. Say: "This is a demo
control only, to show time passing. The clock in a real deployment would be the real one."

---

## Act 4: Getting ready and moving (5:00-7:30)

**Screen:** still Keira's page.

**Do:** on the **Fit to travel** row press **Record clearance**. Choose **Medical clearance
provided**, tick "This is the treating team's stated outcome.", and press **Save clearance
outcome**.

**Say:**

> "The treating team records that she is medically cleared. The app records what they said. It does
> not judge fitness to travel itself."

**Do:** on the **Transport** row press **Log booking**. The **Transport** panel opens. Under **Who
is collecting** choose **Ambulance (St John)**. Type a synthetic number such as `CAD-DEMO-0001` in
**CAD transport number**, press **+30m** for the estimated time, press **No escort required**, then
**Involuntary** for the transport question. Press
**Save transport booking**, then **Esc**.

**Say:**

> "Transport is booked by phone, as it is today, and the booking is recorded here: who is
> collecting her, the CAD number and the estimated time. There is no link to an ambulance or
> transport system. The app records the booking; it does not check it. Her move is inside one
> hospital, so the booking is shown here to demonstrate the step."

**Do:** point to the note at the foot of the window: "Demonstration state is saved on this device,
except typed text." **From here, avoid reloads and typed addresses.**

**Do:** press **Mark handover ready** (**Placement steps** now lights step 5 of seven). The
"Handover ready" and "Bed pulled" messages each stay for five minutes, at the bottom right of the
screen. If they cover the **Destination** row, press the **X** on each. Then press the **Destination**
row ("Dabakarn accepted · bed pulled"); scroll down a little first if it is not in view. The **Destination and placement** panel opens. Press, in order, **Provider
accepted job**, **Vehicle en route** and **Mark moving · patient collected**.

**Do:** a check appears ("Mark moving for … ?") listing what is not recorded yet, here the transport
or transfer order. Under **Reason** choose **Paper copy sighted** and press **Mark moving, record
reason**.

**Say:**

> "Here the app stops and asks. Something is not recorded yet. The person can still go ahead,
> because the paper may be in hand, but they have to say why, and the reason is recorded with the
> step.
>
> Keira is now moving, and her page shows when she is due on the ward."

---

## Act 5: Arrival (7:30-8:30)

**Screen:** still Keira's page, **Destination and placement** panel.

**Do:** press **Confirm arrival · receiving ward**. A check asks "Confirm arrival for Keira
Pellingworth?" and shows her name and UMRN to check against the person. Press **Confirm arrival**.
Press **Esc**, and point to "Arrived · transfer complete" on her page.

**Say:**

> "The ward checks it is the right person and confirms she has arrived. The journey is closed, and
> her page now belongs to the ward."

**Do:** in the left-hand menu press **More**, then **All wards**, then **Open ward** on the
**Dabakarn** card. Point to Keira in the bed grid, and to **Staff on constant obs** in the ward's
**Checking · now** strip, which counts staff assigned to constant observation (none on this ward
just now). Beside it, **Obs not recorded** counts people on the ward with no observation level
recorded. It is a count only: no level is shown or suggested.

**Say:**

> "On Dabakarn's own page she is in a bed. Every screen we visited, the ED, the coordinator's and
> the ward's, showed the same record as it changed.
>
> Observation levels are on the ward page too, from General to Two staff constant. The levels are
> recorded by people. Where none is recorded, the page counts it as not recorded rather than
> guessing. Nothing is scored or suggested from them."

---

## Act 6: What is new (8:30-10:30)

Pick two of these three if time is short. None of them needs typing.

**A. The ward sees the full referral before it answers.** In the left-hand menu press **More**,
then **All wards**, and press **Open ward** on **SJGM Adult Open**. In the **Coming and going**
card, under **Referrals · now**, press **Loxbury, Saoirse** (synthetic). The full referral opens:
reason, risk, legal, observation, medical clearance, physical health, medications, referrer, arrival
and documents. Close it with **Esc**. Do not accept or decline.

> "A ward can't make a safe decision on a referral it can't read. So before it answers, the ward
> sees the whole referral, with the patient's name and record number. What it never sees is which
> other wards were asked. The card also lists the patient checks it ran against this ward, so the
> ward can see why the referral fits."

**B. Seclusion and restraint, operational only.** In the left-hand menu press **More**, then
**Legal forms**, then the **Seclusion** tab. Point to the note at the top, the **in use now**
figure and the **Seclusion rooms** list.

> "This shows what is in use now and whether each seclusion room is available. Times are shown as
> they were typed. It works out no order length, no review time and no legal limit. The legal
> register stays in the health service's own system."

**C. The demo clock.** If you skipped it in Act 3, press the **Board time** clock and show **Demo
clock** with **+15 min** and **+1 hour**, and the **Scenario** list. Close with **Esc**.

> "For a demonstration we can move time forward or load a different day, like a surge. It only
> changes synthetic data."

---

## Close (10:30-11:00)

**Do:** press **Home** in the left-hand menu.

**Say:**

> "In about ten minutes we followed one synthetic patient from the morning bed picture, through a
> pulled bed, clearance, transport and the move, to arrival on the ward. At every step a person made
> the decision, and the app showed what was ready and what was missing.
>
> This is a prototype on invented data. It is not clinical decision support. It has not been
> through clinical safety, privacy or legal review, and it is not for clinical use. What we'd value
> most from you is whether this matches how the work really happens, and what it gets wrong."

**Do:** on any computer that is not yours, press **Leave the demo** before you walk away.

---

## What you can and cannot claim

Say these with confidence:

- **Nobody is placed by the app.** Every refer, accept, pull and move is a person's click. Pulling a
  bed takes two clicks and offers Undo. The coordinator or the accepting ward's desk may pull it, and
  the record names which desk did.
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
- **Asking wards.** For an open community referral, the coordinator can ask more wards, usually up
  to three waiting at once. Wards that declined don't count. An accepted community referral moves through
  the same journey, transport and arrival as an ED one.
- **Role access by desk.** Each desk (coordinator, ward, ED, community team, transport officer, bed
  manager) sees and does only what its role needs. A ward never sees which other wards were asked.
  This is built in the shared version, and its checks are not finished. Today's demo runs as the
  coordinator desk.
- **Single-gender wards.** The check uses the gender recorded at referral, not sex. A single-gender
  ward cannot be overridden for a patient whose recorded gender is the other binary gender. There is
  no room or wing model. For a patient whose gender is not recorded as female or male (non-binary,
  a different term, or not recorded), one coordinator records a reason and ticks that it was checked
  with the ward before the ward can be offered.
- **Overrides are recorded.** The actions that need an override need a reason from a fixed list, and
  recorded overrides show in the governance view. Routine steps do not all record a reason.
- **Alerts.** The Alerts screen shows the quiet conditions as well, so silence is not mistaken for a
  fault, and gives one action per alert. Alerts are sorted into Act now and Waiting. A broadcast is
  marked Critical, Warning or Advisory.
- **Synthetic data.** Every record is invented. Automated tests check identifiers and phone numbers
  in the seed data. They do not check names against real people.

Do not claim:

- compliance with any clinical safety standard, or that the prototype already meets the conditions
  for a pilot;
- that it "is not a medical device" as a settled fact. No regulatory adviser has given a view;
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

If someone wants it in writing, **Settings** has an **About this demo** page that says the same.

**"How is transport handled?"**

> "The booking is made by phone, as now, and recorded here: who is collecting, the CAD number, the
> estimated time and whether an escort is needed. There is no link to an ambulance or transport
> system, and the app does not check the number."

**"What about community teams?"**

> "A community team can send a short referral and see whether a ward accepted. The coordinator
> usually asks up to three wards at once. Once accepted, the journey, transport and arrival work the
> same as from an ED. The journey names the team, never a home address."

**"What about country sites?"**

> "Country wards are on the same statewide map. A country legal extension is recorded as typed from
> the paper; nothing is calculated. RFDS can be recorded as the carrier. Nothing specific to air
> transport is built."

**"What about the triage and risk form?"**

> "It is a prototype form and is not in today's demo. Its suggestions, such as those drawn from
> mental state or risk flags, are prompts a clinician accepts or changes. It does not score risk or
> decide anything, and it has not been through clinical or regulatory review."

**"It says Needs you."** (or **"It says Suggested."**)

> "That list is now headed 'Needs you': the coordinator's own jobs and who to ring next, from fixed
> steps. The ED's 'Next escalation step' is a fixed step too. Nothing suggests a ward or a patient;
> the ward list is in a fixed order and a person chooses."

**"Is that a forecast?"**

> "It is arithmetic on dates the wards have already recorded, which is why Home's link says 'From
> ward dates'. It is shown with its range. Nothing is modelled or learned."

**"What does Tier 1, most urgent mean?"**

> "The tier is what the referrer chose. The app doesn't set it. Some lists, like the transport list, show the most urgent tier first."

**"What are the other desks?"**

> "Each role sees its own part. Today runs as the coordinator; the others can be previewed."

**"Can I open it on my phone?"**

> "Yes. You'll see the code screen, three welcome cards and Home. The tour is optional."

**"Does that button really do it?"**

> "Yes, in this browser only. Nothing leaves this tab, and Reset demo puts it back."

**"What would it take to use this with real patients?"**

> "A lot, and none of it has been done. Clinical safety, privacy and legal review, a named clinical
> safety officer, security review and proper hosting. Today it is a prototype for feedback only."

## Recovery card

Keep this beside you. Each row is a press to avoid on the day, why, and what to do if it happens.

| Don't press                                                                        | Why                                                                               | If it happens                                                                                |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Anything but **Esc** in Keira's ED panel, above all **Record no transport needed** | Act 4's **Log booking** disappears                                                | **Change** on her Transport row brings it back; otherwise **Reset demo**, restart from Act 2 |
| **Mark absent** on Keira's page after arrival                                      | Dabakarn shows her absent without leave                                           | **Record return** on her page                                                                |
| **See it as** in Tools, or any other desk                                          | The desk changes. The other desks are not ready to show                           | **Back to coordinator**, in the bar at the top, or **Reset demo**                            |
| **Open patient** in the ED panel as a way to her page                              | It opens an ED side panel instead                                                 | Press **/**, type `Keira`, **Enter**                                                         |
| The phone numbers on her page                                                      | They are dial links                                                               | Close the chooser. Use the copy button beside each                                           |
| Browser zoom                                                                       | The left-hand menu loses its words                                                | Zoom back to 100% (**Ctrl+0**)                                                               |
| **Esc** in **Record a form** or the ED board's **Log transport booking**           | Esc does nothing there                                                            | Press **Close**                                                                              |
| The body of a ward card on **All wards**                                           | The side panel shows invented "Admits" lines                                      | **Esc**. Press **Open ward** only                                                            |
| **Lock as TV**                                                                     | Every open tab goes to the TV view, and Reset demo is out of reach until unlocked | **Unlock**, then **Unlock**                                                                  |
| **Print sheet** in front of the audience                                           | Two pages, and a longer document than the screen                                  | Close the print box                                                                          |
| **Close this bed** on a ward                                                       | One press, no reason asked                                                        | **Reset demo**                                                                               |
| A row in the slipped dates list on **Discharges**                                  | It asks why you are opening the ward's record, and logs the reason for Governance | **Esc**                                                                                      |
| **Find a bed** in the header **Alerts** panel                                      | It opens another patient's Ask wards step                                         | Browser **Back**                                                                             |
| A Midland team decision                                                            | It survives Reset demo                                                            | Leave it. A fresh browser profile starts clean                                               |
| **Save to file**, **Load from file**, **Receive message** in Tools                 | A download, a file chooser, and a stray message                                   | **Esc**. Delete the download later                                                           |
| **Ask for review**, and **Ask** (a ward to confirm its beds) on Capacity           | Each records in one click: Undo for five minutes, or none on **Ask**. Not Keira   | Leave it. Reset demo clears it                                                               |
| **Pin**, and the ED tiles on Home                                                  | Both outlive Reset demo. Harmless                                                 | Press again to clear                                                                         |
| Inside **Triage**                                                                  | Its see-by windows are unsigned                                                   | **Back**                                                                                     |
| Reload to fix the clock                                                            | A reload does not put a drifted clock back                                        | Close every Ward Flow tab, open one new tab, then **Reset demo**                             |

Things that happen without a wrong press:

- The screen is covered after 15 minutes untouched: press **Carry on**.
- You closed the "Bed pulled" message: until its "Undo until" time, press the **Destination** row,
  then **Undo pull**. After that time, press the **Destination** row, **Release bed pull**, choose
  **Pull made in error**, then **Release pull**.
- Keira has left **Later today**: press **/**, type `Keira`, press **Enter**.
- The CAD number was forgotten in Act 4: carry on. The booking saves without it.
- Already known and still true: Keira's form lines can disagree between the ED board and her page,
  and her ED row can still show "Step 1, Ask wards" after Dabakarn has accepted.

## Quick reference

| Act | Where                                     | Press                                                                                                                                                             |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Capacity                                  | Bed meeting sheet, Close                                                                                                                                          |
| 2   | All EDs, Enter (RPH ED)                   | Pellingworth, Keira; Esc; Home, Later today, Pellingworth, Keira; Placement steps                                                                                 |
| 3   | Referrals, Coldharbour, Cyril (Place tab) | Scroll to the groups; choose a ward under Fits, bed ready (do not accept); Esc; browser Back; Pull the bed, Pull the bed; Esc                                     |
| 4   | Keira's page                              | Record clearance; Log booking; Mark handover ready; X on both messages; Destination row; Provider accepted job, Vehicle en route, Mark moving · patient collected |
| 5   | Destination and placement                 | Confirm arrival · receiving ward, Confirm arrival; Esc; More, All wards, Open ward (Dabakarn)                                                                     |
| 6   | SJGM Adult Open; More, Legal forms; clock | Loxbury, Saoirse, Esc; Seclusion tab; Board time, Demo clock                                                                                                      |
| -   | Home                                      | -                                                                                                                                                                 |

Before every run, as the audience sits down: **Board time** clock, **Reset demo**, confirm. Avoid
reloads and typed addresses; if "Part of this page did not load" appears, press **Reload page**.
