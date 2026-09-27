/* Rebuilds the route map from a declarative spec: nodes, and edges as {from,to,route}.
   Paths are COMPUTED, so the line-follows-destination rule and the anchoring checks hold by
   construction instead of by hand-editing forty path strings.

   What this adds over the previous map: who actually raises a referral (seven sources), and
   all three destination arms drawn as parallel routes with their own behaviour — the community
   team arm and the emergency department's, neither of which appeared at all before. */
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

/* columns */
const CM = { x: 60, w: 460 }; // community team arm
const WD = { x: 700, w: 420 }; // psychiatric ward arm, and the spine below it
const ED = { x: 1300, w: 500 }; // emergency department arm
const LEFT = { x: 60, w: 460 }; // stalls and undos, below the community column
const RIGHT = { x: 1300, w: 500 };
// Clear of the endings row, which runs the full width of the map below the two tracks. At 1900
// this column sat over the last two endings, and the line into the final ending ran behind it.
const REC = { x: 2400, w: 420 }; // recorded alongside

const N = [];
const E = [];
const add = (o) => (N.push(o), o);
const link = (from, to, o = {}) => E.push({ from, to, route: "straight", ...o });

/* ── who raises it ─────────────────────────────────────────────────────────── */
const SOURCES = [
  ["srcCommunity", "A community team"],
  ["srcCrisis", "A crisis service"],
  ["srcPolice", "Police"],
  ["srcAmbulance", "Ambulance"],
  ["srcHospital", "Another hospital"],
  ["srcEd", "A doctor in an ED"],
  ["srcGp", "A GP"],
];
SOURCES.forEach(([id, label], i) => {
  add({ id, lane: "expected", x: 60 + i * 252, y: 66, w: 236, h: 62, label });
  link(id, "raised", { route: "fan" });
});
add({
  id: "hdr-src",
  lane: "heading",
  x: 60,
  y: 14,
  w: 700,
  h: 40,
  label: "Who raises it  ·  seven",
  sub: "A doctor in an ED may only raise it as an ED referral — they cannot claim another source.",
});

add({
  id: "raised",
  lane: "expected",
  x: WD.x,
  y: 200,
  w: WD.w,
  h: 80,
  label: "A referral is raised",
  sub: "Somebody has decided this person needs to go somewhere.",
  patient: "Wherever they already were.",
  bed: "Nothing yet.",
});
add({
  id: "addressed",
  lane: "expected",
  x: WD.x,
  y: 320,
  w: WD.w,
  h: 86,
  label: "Addressed to up to three places at once",
  sub: "Never two of the same kind. Each answers on its own, and cannot see the others.",
  patient: "Still where they were.",
  bed: "Nothing yet.",
});
link("raised", "addressed");

/* ── the three arms ────────────────────────────────────────────────────────── */
add({
  id: "armCommunity",
  lane: "expected",
  x: CM.x,
  y: 460,
  w: CM.w,
  h: 90,
  label: "①  Sent to a community team",
  sub: "Named as free text — there is no register of teams to choose from.",
  patient: "At home, or wherever they were.",
  bed: "Nothing. This arm never involves one.",
});
add({
  id: "armWard",
  lane: "expected",
  x: WD.x,
  y: 460,
  w: WD.w,
  h: 90,
  label: "②  Sent to a psychiatric ward",
  sub: "Carries what the bed must be: sex, gender, secure, involuntary, high-acuity nursing.",
  patient: "Still waiting.",
  bed: "Nothing reserved.",
});
add({
  id: "armEd",
  lane: "expected",
  x: ED.x,
  y: 460,
  w: ED.w,
  h: 90,
  label: "③  Sent to an emergency department",
  sub: "Must say what it is FOR: a bed, a psychiatric review, or a medical assessment.",
  patient: "On their way to, or already in, that department.",
  bed: "Nothing.",
});
for (const a of ["armCommunity", "armWard", "armEd"]) link("addressed", a, { route: "fan" });

/* ── ① the community team arm ──────────────────────────────────────────────── */
add({ id: "cmhtAnswers", lane: "expected", x: CM.x, y: 600, w: CM.w, h: 70, label: "The team answers" });
add({
  id: "cmhtAccepted",
  lane: "end",
  x: CM.x,
  y: 720,
  w: CM.w,
  h: 90,
  label: "Accepted — community follow-up",
  sub: "The arm ends here. It never becomes a bed search.",
});
add({
  id: "cmhtDeclined",
  lane: "end",
  x: CM.x,
  y: 860,
  w: CM.w,
  h: 112,
  label: "Declined — four reasons",
  sub: "Outside the team's catchment · needs inpatient care, not community follow-up · the client declined or could not be contacted · already open to another team.",
});
add({
  id: "cmhtNothing",
  lane: "stall",
  x: CM.x,
  y: 1012,
  w: CM.w,
  h: 104,
  label: "No answer at all — and nothing can close it",
  sub: "No acceptance anywhere cancels a queued community arm, so unlike the other two it can only end by the team answering or the referrer taking this arm back. Nothing escalates, and there is no clock.",
});
add({
  id: "cmhtWithdrawn",
  lane: "stall",
  x: CM.x,
  y: 1152,
  w: CM.w,
  h: 110,
  label: "The referrer withdraws just this arm",
  sub: "A narrow exception added 17 September 2026, and only while the arm is still queued — a team that has already answered keeps its answer. The bed request stands.",
});
add({
  id: "cmhtFromSearch",
  lane: "diversion",
  x: CM.x,
  y: 1298,
  w: CM.w,
  h: 110,
  label: "It can also begin part-way through a bed search",
  sub: "Redirecting a bed search to a community team raises a real referral of this kind — or reuses a queued arm already asking that same team, rather than asking twice. So this arm does not only start at the front door.",
});
add({
  id: "cmhtExempt",
  lane: "note",
  x: CM.x,
  y: 1444,
  w: CM.w,
  h: 100,
  label: "This arm is exempt from the automatic cancellation",
  sub: "In both directions. A ward accepting does not close it, and it accepting does not close the bed search. It is the only arm that behaves this way.",
});
link("armCommunity", "cmhtAnswers");
link("cmhtAnswers", "cmhtAccepted");
link("cmhtAnswers", "cmhtDeclined");
link("cmhtAnswers", "cmhtNothing");
link("cmhtAnswers", "cmhtWithdrawn");
// The second way in: it arrives at the same "the team answers" step as a front-door arm does.
link("cmhtFromSearch", "cmhtAnswers");

/* ── ② the psychiatric ward arm ────────────────────────────────────────────── */
add({ id: "wardAnswers", lane: "expected", x: WD.x, y: 600, w: WD.w, h: 70, label: "The ward answers" });
add({
  id: "wardAccepted",
  lane: "expected",
  x: WD.x,
  y: 720,
  w: WD.w,
  h: 90,
  label: "Accepted",
  sub: "The only answer anywhere that starts something.",
  patient: "Still waiting.",
  bed: "Still nothing — accepting reserves no bed.",
});
add({
  id: "wardDeclined",
  lane: "end",
  x: WD.x,
  y: 860,
  w: WD.w,
  h: 112,
  label: "Declined — seven reasons",
  sub: "No suitable bed · age band not provided here · no bed of that designation · no secure bed · belongs to another service · referred elsewhere · another reason.",
});
add({
  id: "wardNothing",
  lane: "stall",
  x: WD.x,
  y: 1022,
  w: WD.w,
  h: 96,
  label: "No answer at all",
  sub: "It simply stays waiting. Nothing escalates on its own, and there is no clock on it.",
});
link("armWard", "wardAnswers");
link("wardAnswers", "wardWithdrawn");
link("wardAnswers", "wardBlocked");
link("wardAnswers", "wardAccepted");
link("wardAnswers", "wardDeclined", { route: "fan" });
link("wardAnswers", "wardNothing", { route: "fan" });

add({
  id: "othersCancelled",
  lane: "diversion",
  x: WD.x,
  y: 1168,
  w: WD.w,
  h: 100,
  label: "Every other waiting arm is cancelled",
  sub: "Automatically, the moment a ward OR a department accepts — except the community arm, which is exempt in both directions. The referrer is neither asked nor told.",
});
link("wardAccepted", "othersCancelled", { auto: true });

/* ── ③ the emergency department arm ────────────────────────────────────────── */
add({
  id: "wardWithdrawn",
  lane: "diversion",
  x: WD.x,
  y: 1310,
  w: WD.w,
  h: 130,
  label: "The referrer takes the WHOLE referral back",
  sub: "The default, and the opposite of the community arm's one-arm exception: every still-queued destination goes at once. If a bed search is already running it releases the held bed and cancels the transport, and closes as 'did not proceed'. Refused once transport has collected the patient — that needs a coordinator, not an automatic withdrawal.",
});
add({
  id: "wardBlocked",
  lane: "stall",
  x: WD.x,
  y: 1470,
  w: WD.w,
  h: 116,
  label: "A ward cannot accept while a department's bed search is live",
  sub: "One referral, two arms: if the emergency department already raised the bed search, the ward arm is refused until that movement closes or arrives. Neither arm's screen shows the other.",
});
add({
  id: "edBoard",
  lane: "expected",
  x: ED.x,
  y: 600,
  w: ED.w,
  h: 90,
  label: "It lands on that department's board",
  sub: "And the referrer can see their patient sitting there.",
});
add({
  id: "edExpected",
  lane: "expected",
  x: ED.x,
  y: 740,
  w: ED.w,
  h: 90,
  label: "Expected to arrive",
  sub: "Triaged, and not here yet. It sits on a separate list from the referrals.",
  patient: "Not here yet.",
  bed: "Nothing.",
});
add({
  id: "edNeverArrives",
  lane: "stall",
  x: ED.x,
  y: 880,
  w: ED.w,
  h: 120,
  label: "Expected, and never arrives",
  sub: "A queued ED arm can be declined or withdrawn before arrival, removing this expectation. Otherwise it stays until arrival; past 72 hours the screen adds a reminder but changes no record.",
});
add({
  id: "edArrived",
  lane: "expected",
  x: ED.x,
  y: 1040,
  w: ED.w,
  h: 86,
  label: "Marked present",
  sub: "The only door between the two lists. Stamped once; a repeat keeps the earliest time.",
  patient: "Physically in the department.",
  bed: "Nothing.",
});
add({ id: "edAnswers", lane: "expected", x: ED.x, y: 1176, w: ED.w, h: 70, label: "The department answers, or acts" });
add({
  id: "edAccepted",
  lane: "expected",
  x: ED.x,
  y: 1296,
  w: ED.w,
  h: 104,
  label: "Accepted — the department takes them",
  sub: "And every other destination still waiting is cancelled on the spot, including the ward request sent alongside it. The referrer is not asked.",
  patient: "In the department.",
  bed: "Nothing — accepting reserves none.",
});
add({
  id: "edDeclined",
  lane: "end",
  x: ED.x,
  y: 1450,
  w: ED.w,
  h: 104,
  label: "Declined — three reasons only",
  sub: "Belongs to another service · referred elsewhere · another reason. The four bed-shaped reasons are withheld on purpose: an ED is not being asked for a bed.",
});
add({
  id: "edRaise",
  lane: "expected",
  x: ED.x,
  y: 1604,
  w: ED.w,
  h: 104,
  label: "A doctor raises a bed search from here",
  sub: "This is what creates the record that moves. It can be linked back to the referral that sent them, or raised for somebody nobody referred.",
  patient: "In the department.",
  bed: "Nothing yet.",
});
add({
  id: "edOutcome",
  lane: "end",
  x: ED.x,
  y: 1758,
  w: ED.w,
  h: 112,
  label: "The department decides no bed is needed",
  sub: "Two labels, one behaviour: 'for community follow-up' raises no referral and tells no team — only the separate action below does that. Unwinds a held bed, an uncollected transport job and every live ward request. Refused once transport has collected them.",
});
add({
  id: "edToCommunity",
  lane: "diversion",
  x: ED.x,
  y: 1920,
  w: ED.w,
  h: 124,
  label: "Referred straight to a community team instead",
  sub: "Ends the bed search and creates or reuses a real community referral. Available from the moment the bed search exists until the patient is collected — not only from a department. Refused once they are collected, and while a legal form has no conclusive examination outcome.",
});
add({
  id: "edLeft",
  lane: "end",
  x: ED.x,
  y: 2084,
  w: ED.w,
  h: 90,
  label: "Left the department",
  sub: "Only recordable after an outcome has been recorded first.",
});
link("armEd", "edBoard");
link("edBoard", "edExpected");
link("edExpected", "edArrived");
link("edExpected", "edNeverArrives");
link("edArrived", "edAnswers");
link("edAnswers", "edAccepted");
link("edAnswers", "edDeclined");
link("edAccepted", "edRaise");
// Not only a ward acceptance. A department accepting runs the same cancellation.
link("edAccepted", "othersCancelled", { auto: true });
link("edRaise", "edOutcome");
link("edRaise", "edToCommunity");
link("edOutcome", "edLeft");

/* ── the seam, and the spine ───────────────────────────────────────────────── */
const SPINE_TOP = 1700;
const spine = [
  [
    "seam",
    "seam",
    100,
    "A movement now exists",
    "Accepting a referral starts nothing by itself. This second record is the one that moves.",
    "Unchanged.",
    "Still nothing.",
  ],
  ["placement", "expected", 60, "Placement requested", "", "Waiting, wherever they are.", "Nothing yet."],
  [
    "asked",
    "expected",
    76,
    "Wards are asked",
    "One at a time, or several at once, up to three.",
    "Still waiting.",
    "Nothing yet.",
  ],
  [
    "inPrinciple",
    "expected",
    76,
    "A ward accepts in principle",
    "Still no bed set aside.",
    "Still waiting.",
    "Promised, not reserved.",
  ],
  [
    "pulled",
    "expected",
    90,
    "A bed is pulled and held",
    "Empty, offered to nobody else. Four hours is the default, not a rule — a coordinator can set the hold anywhere between thirty minutes and four hours. The admission this creates now names the movement it came from — a join added by owner ruling on 21 September, and the first pointer of any kind between the patient's track and the bed's; it is empty for the beds seeded as already occupied, so anything reading it has to cope with nothing being there.",
    "Still where they were.",
    "Held.",
  ],
  [
    "booked",
    "expected",
    76,
    "Transport is booked",
    "Five answers, none defaulted — provider, escort, CAD number, voluntary or involuntary, estimated time.",
    "Waiting, with a journey arranged.",
    "Held.",
  ],
  ["handover", "expected", 60, "Handover ready", "", "Ready to be collected.", "Held."],
  ["enroute", "expected", 70, "The crew accepts, and sets off", "", "Still where they were.", "Held."],
  [
    "collected",
    "expected",
    76,
    "The patient is collected",
    "After this point, everything changes.",
    "In a vehicle, between two places.",
    "Held.",
  ],
  [
    "arrived",
    "expected",
    76,
    "The ward says they have arrived",
    "The one step that can never be undone.",
    "On the ward.",
    "Occupied.",
  ],
  ["occupied", "expected", 60, "Occupied — on the ward", "", "Being treated.", "Theirs, through leave and absence."],
  [
    "ready",
    "expected",
    86,
    "Clinically ready to leave",
    "The patient's departure and the named bed-release record proceed on two tracks.",
    "Finished with hospital, possibly still in the bed.",
    "Occupied.",
  ],
];
let y = SPINE_TOP;
spine.forEach(([id, lane, h, label, sub, patient, bed], i) => {
  add({ id, lane, x: WD.x, y, w: WD.w, h, label, sub: sub || undefined, patient, bed });
  if (i) link(spine[i - 1][0], id);
  y += h + 54;
});
link("wardAccepted", "seam", { route: "channel", channel: 660 });
link("edRaise", "placement", { route: "channel", channel: 1240 });

/* ── stalls, undos and diversions off the spine ────────────────────────────── */
const SIDE = [
  [
    "sWardDecline",
    "stall",
    LEFT,
    "asked",
    "A ward declines — seven reasons",
    "No bed · sex mix · no specialling · acuity mix · capability mismatch · bed pulled for an earlier referral · out of catchment.",
    true,
  ],
  [
    "sWithdrawWard",
    "stall",
    LEFT,
    "asked",
    "One ward's request is taken back",
    "Seven reasons. The other wards asked carry on considering.",
    true,
  ],
  [
    "sAcceptWithdrawn",
    "stall",
    LEFT,
    "inPrinciple",
    "The acceptance is withdrawn",
    "Four reasons — recorded in error · the decision changed · the patient's situation changed · the bed was lost. A stepped-back pull still holds its bed, so withdrawal is refused until the pull is restored and released.",
    true,
  ],
  [
    "sAbandoned",
    "end",
    LEFT,
    "inPrinciple",
    "The bed search is abandoned",
    "Pulled from every ward still considering it, or — once a ward has accepted — the acceptance revoked and any held bed given back. It closes as 'did not proceed'. This is also where an examination outcome of a community order, or a revocation, lands while no bed is held yet.",
    false,
  ],
  [
    "sPullReleased",
    "stall",
    LEFT,
    "pulled",
    "The held bed is given back — four reasons",
    "NINE different actions delete that admission, not one — releasing the pull (four reasons of its own), releasing a held bed after transport was stopped, abandoning the bed search, the referrer withdrawing it, the department deciding no bed is needed, sending them to a community team instead, an examination outcome that ends it, releasing the bed a diverted journey held, and releasing the bed while reopening the search. Whichever it was, the admission record is deleted outright: nobody was ever in this bed.",
    true,
  ],
  [
    "sCancelTransport",
    "stall",
    LEFT,
    "booked",
    "Transport cancelled before collection",
    "Four reasons. The job is deleted and nothing is rebooked. Whether the bed is still held depends on how far the record has got — and the notice works that out from the stage, not from the bed.",
    true,
  ],
  [
    "sStopTransport",
    "diversion",
    LEFT,
    "collected",
    "The journey is stopped after collection",
    "Three reasons, and somebody must say where the patient now is. The movement closes and the bed stays held.",
    false,
  ],
  [
    "sAbscond",
    "absent",
    LEFT,
    "occupied",
    "The patient absconds",
    "No state exists for this. They are still admitted, the bed is still theirs, and nothing anywhere can say they are missing.",
    false,
  ],
];
// Never above the previous box's bottom. Two of these hang off the same step of the spine
// ("wards are asked" can be declined AND taken back), and taking the anchor's y for both put
// one squarely on top of the other — invisible, because the second simply covered the first.
let sy = 0;
for (const [id, lane, col, anchor, label, sub, back] of SIDE) {
  const a = N.find((n) => n.id === anchor);
  const h = Math.max(a.h, 96);
  const y = Math.max(a.y, sy);
  add({ id, lane, x: col.x, y, w: col.w, h, label, sub });
  link(anchor, id, { route: "sideL", ...(back ? { both: true } : {}) });
  sy = y + h + 40;
}

const RIGHTSIDE = [
  [
    "dForced",
    "forced",
    "asked",
    "A coordinator places them anyway",
    "Eight of the bed checks can be passed by recording one of five reasons — the receiving team has agreed despite the mismatch · clinical urgency outweighs it · the bed information is known to be out of date · continuity with an earlier admission here · closer to home or family. Running out of one-to-one nursing or of high-acuity capacity can be passed the same way, and passing the acuity one also demands that the nurse unit manager was consulted.",
    null,
  ],
  [
    "dGenderHard",
    "stall",
    "asked",
    "The one refusal nothing can override",
    "If the ward is designated for one gender and the patient's recorded gender is the other, no reason passes it and the app will not even offer the list. Non-binary, Different term, and not-recorded genders can use the coordinator-reviewed exception. Every other bed check here can be forced; this one cannot.",
    null,
  ],
  [
    "dNonBinary",
    "forced",
    "inPrinciple",
    "A patient with a non-binary, Different term, or unrecorded gender onto a single-gender ward",
    "Only a coordinator, and only with one of six recorded reasons — a single room is available · the patient's stated preference, agreed with the ward · no single room is free and the ward agreed a plan for privacy · the only suitable ready bed, agreed with the ward · they know this ward from an earlier stay · closer to home or supports.",
    null,
  ],
  [
    "dStatutory",
    "absent",
    "inPrinciple",
    "Starting a new legal form from the legal forms screen",
    "A form is issued when the emergency department raises the bed search, and the legal forms screen records when it was written or received and its expiry. Only a form started there is lost: 'Record a form' opens the whole form, and its save button is disabled, so it records nothing.",
    null,
  ],
  [
    "dNoTransport",
    "diversion",
    "pulled",
    "No transport needed",
    "Marked arrived straight from the held bed, with no journey recorded at all.",
    "arrived",
  ],
  [
    "dRepull",
    "diversion",
    "pulled",
    "Pulling again when the bed is already held",
    "Restores the record to 'pulled' and returns before any capacity, specialling, acuity or eligibility check runs. Deliberate — the held bed is one of the things those checks count — but it means a second pull is not a second decision.",
    "back",
  ],
  [
    "dNoLongerSuits",
    "stall",
    "handover",
    "The bed stops suiting them, part-way",
    "Checked again at four separate steps while the bed is held — pulling it, handover ready, the crew accepting, and collection. The refusal says to withdraw the acceptance and refer again — but withdrawing is itself refused while a bed is held, and THAT refusal names the real route: pull it again to restore it, release the pull, then withdraw. Three steps, and only the second message tells you them.",
    null,
  ],
  [
    "dCancelLie",
    "breach",
    "booked",
    "The cancellation can state the wrong thing",
    "Whether a bed is still held is worked out from how far the record has got, not from the bed. A record stepped backwards still holds its bed, and the cancellation then tells everyone no bed is held.",
    null,
  ],
  [
    "dRevoked",
    "breach",
    "enroute",
    "The legal authority is revoked before pick-up",
    "Sending the crew is still allowed; collecting the patient is refused while the bed is held. A crew can be sent to a door it will be turned away from.",
    null,
  ],
  [
    "dAway",
    "diversion",
    "occupied",
    "Away at an ED, or on leave",
    "Two unlike things in one place. Away at an emergency department is recorded against the PATIENT and paired with their return. A leave bed is recorded against the WARD and names the one stay it belongs to (owner ruling, 25 September), but it still carries no reason and no destination.",
    "back",
  ],
  [
    "dClosedRecord",
    "stall",
    "arrived",
    "Once the record closes, nothing can be added to it",
    "Arriving closes it, and so does every other ending. More than thirty checks across the engine then refuse. Three of those matter: the Mental Health Act status, the sex or gender recorded for bed matching, and whether a legal form arrived or when it expires. If any of those is wrong at the moment the record closes, it can never be corrected there, and the refusals name no other route.",
    null,
  ],
  [
    "dRepat",
    "diversion",
    "ready",
    "Sending a country patient home",
    "Logged against the admission once it has been arranged off the system: home hospital, whether its ward agreed, road or flight, provider and tracking number. It books nothing. Only when the home ward agreed does it also open a new movement asking for a bed at home.",
    null,
  ],
];
// This column shares its x with the emergency department arm drawn above it, so it starts
// below that arm's last box — not at whatever y its anchor happens to sit at.
let dy = Math.max(...N.filter((n) => n.x === ED.x).map((n) => n.y + n.h)) + 110;
for (const [id, lane, anchor, label, sub, onward] of RIGHTSIDE) {
  const a = N.find((n) => n.id === anchor);
  const h = Math.max(a.h, 100);
  const y = Math.max(a.y, dy);
  add({ id, lane, x: RIGHT.x, y, w: RIGHT.w, h, label, sub });
  dy = y + h + 40;
  link(anchor, id, { route: "sideR", ...(onward === "back" ? { both: true } : {}) });
  if (onward === "arrived") link(id, "arrived", { route: "channel", channel: 1860 });
  if (!onward) E.push({ from: id, to: id, route: "stub", lane });
}
// A route that stops gets a bar. Applied as ONE rule rather than a list of boxes: any line
// arriving at an ending or at a gap ends in a bar, and any box that stops without one gets a
// stub of its own. A list would need a new entry every time a box is added; this does not.

/* ── the two tracks, and the eight endings ─────────────────────────────────── */
const rdy = N.find((n) => n.id === "ready");
// Below EVERYTHING above it, not just below the spine. This row spans the full width, so taking
// its y from the spine alone let the stalls and diversions columns grow straight through it —
// which they did, the first time three boxes were added to one of them.
const TY = Math.max(rdy.y + rdy.h, ...N.map((n) => n.y + n.h)) + 120;
add({
  id: "personLeaves",
  lane: "expected",
  x: 400,
  y: TY,
  w: 440,
  h: 96,
  label: "Track one — the person leaves",
  sub: "Eight recorded ways out, and one of them frees no bed at all.",
  patient: "Gone.",
  bed: "Both counts move here: empty and allocatable, and a pending release for this person completes.",
});
add({
  id: "bedReleased",
  lane: "expected",
  x: 920,
  y: TY,
  w: 440,
  h: 96,
  label: "Track two — the bed is released",
  sub: "Expected, then confirmed, then discharged — but confirming can be skipped, and expected straight to discharged is allowed on purpose. The last step happens when the named patient is recorded leaving, and moves TWO counts: the beds a ward may allocate, and the beds it has empty.",
  patient: "Names the stay it belongs to, and nothing else about them.",
  bed: "Counted as available again, at the last step only.",
});
link("ready", "personLeaves", { route: "fan" });
link("ready", "bedReleased", { route: "fan" });
add({
  id: "bedStuck",
  lane: "stall",
  x: 1440,
  y: TY,
  w: 400,
  h: 96,
  label: "Stuck, or waiting on something",
  sub: "Seven things it can wait on, nine reasons it can be stuck. Neither is a stage.",
});
link("bedReleased", "bedStuck", { both: true });

const ENDINGS = [
  ["Discharged to the community", true],
  ["Transferred to another psychiatric ward", false],
  ["Transferred to a general hospital", true],
  ["Moved to residential care", true],
  ["Left against advice", true],
  ["Died on the ward", true],
  ["Transferred to police or prison custody", true],
  ["Did not return", true],
];
const EW = 230,
  EG = 22,
  EY = TY + 230;
ENDINGS.forEach(([label, frees], i) => {
  add({
    id: "end" + i,
    lane: frees ? "end" : "diversion",
    x: 60 + i * (EW + EG),
    y: EY,
    w: EW,
    h: 112,
    label,
    sub: frees
      ? "Frees a bed."
      : "Frees THIS ward's bed and gains the state nothing — the only one that is not a release.",
  });
  link("personLeaves", "end" + i, { route: "fan" });
});

/* ── recorded alongside ────────────────────────────────────────────────────── */
const REC_ITEMS = [
  [
    "rkClearance",
    "edArrived",
    "Is the patient medically cleared?",
    "Three answers, not two — unrecorded, cleared, and explicitly not cleared.",
  ],
  [
    "rkDuplicate",
    "raised",
    "Is this the same person already?",
    "Four warnings when somebody is added — the record number already exists · same name and same date of birth · same name where the date of birth does not confirm it · a name one keystroke away from an existing one. All four are warnings. None of them refuses.",
  ],
  [
    "rkIntakeLost",
    "raised",
    "What the form asks for and then discards",
    "Triage category, statutory legal status, Aboriginal and Torres Strait Islander status, address, presenting facility, health service, presenting complaint and clinical intake notes are all collected when a patient is added. Six fields are kept: record number, given name, family name, date of birth, gender, and suburb if one was typed. The model has nowhere to put the rest, so it goes on submit with nothing said. 'Save draft' and 'Print' on the same screen record nothing either.",
    "absent",
  ],
  [
    "rkClock",
    "placement",
    "Nothing on this map expires on its own",
    "The clock only moves when somebody advances it, and advancing it changes one number and nothing else — no hold lapses, no request is cancelled, nothing escalates. Every deadline, every countdown and every 'overdue' on any screen is worked out fresh each time the screen is read.",
    "absent",
  ],
  [
    "rkSettings",
    "placement",
    "Six settings change what is allowed",
    "How long a pulled bed is held (thirty minutes to four hours, default four). How many places one referral may be sent to at once (one to three — a coordinator can only turn this DOWN from three, never up). The department's access target (twelve to thirty-six hours). The morning count deadline, and the two 'due soon' warning times. Saving them replaces all six at once or is refused outright.",
  ],
  [
    "rkQueue",
    "asked",
    "Where they sit in the queue",
    "Flagged urgent first, then the urgency tier, then whoever has waited longest, then the record's own id as a tie-break. Nothing else moves anybody up.",
  ],
  [
    "rkClash",
    "asked",
    "Two patients wanting the same bed",
    "A function can work out which movements are competing for one bed, but no screen calls it, so no clash is shown anywhere today. If it were used it would only name the clash: it never ranks the patients and never arranges an outcome.",
  ],
  [
    "rkUrgent",
    "asked",
    "Flagged urgent",
    "Ten reasons. Lifts the patient above every urgency level, and re-sorts nothing on its own.",
  ],
  ["rkEscalate", "asked", "Escalated", "Which wards were tried and who was rung. Six people it can be escalated to."],
  [
    "rkLegalStatus",
    "inPrinciple",
    "The legal status changes",
    "Four values. Changing it triggers nothing — even if it makes the accepted ward unlawful.",
  ],
  [
    "rkForm",
    "pulled",
    "The legal paperwork arrives",
    "Nine forms can be recorded as received — 1A, 3A, 3C, 3D, 5A, 5B, 6A, 6B, 6C. Receipt can be undone and recorded again; every expiry is a time a clinician typed.",
  ],
  [
    "rkExam",
    "pulled",
    "An examination is recorded",
    "Four outcomes. Only “a further examination is ordered” allows a second one.",
  ],
  [
    "rkNotice",
    "collected",
    "Somebody is told",
    "Twenty-three kinds of notice. Written once, never rewritten, never deleted, never expiring.",
  ],
  [
    "rkDischarge",
    "ready",
    "A discharge recorded the other way",
    "A second event does exactly what recording a departure does, but only for a patient whose identity is linked, and only against the revision number the screen last read. Same result, different door.",
  ],
  [
    "rkPrep",
    "bedReleased",
    "The bed is being prepared",
    "Being cleaned · awaiting maintenance or repair. Since the owner's ruling of 1 September it counts: a bed still being made ready is not open, and a pull is refused when every free bed at the ward is still being made ready.",
  ],
  [
    "rkExpiryShut",
    "arrived",
    "After they arrive, the form's expiry cannot be recorded",
    "Arriving closes the record that moves, and adding an expiry to a closed record is refused. So a patient on the ward under a legal form is past the point where this route can record or extend its expiry, and the refusal names no other way.",
    "stall",
  ],
  [
    "rkAwayRule",
    "occupied",
    "The rule for a bed kept during a medical trip",
    "A threshold exists for how long a general-hospital trip must be expected to last before the ward bed is given up, and a function decides from it. Nothing in the app calls that function, so the rule is neither applied nor shown anywhere. The threshold is set to 24 hours, while the note beside it still describes the owner's figure as 48.",
    "absent",
  ],
  [
    "rkOwnership",
    "bedReleased",
    "Only the ward it belongs to may touch it",
    "Confirming a release, reversing it, flagging it stuck, clearing that flag, marking the bed being cleaned, and finally freeing it are each refused to any other ward. It is what stops one ward's freed bed landing in another ward's figures.",
  ],
  [
    "rkCapacity",
    "asked",
    "A ward states how many beds it can allocate",
    "Set outright rather than counted up, and refused if it claims more beds than the ward physically has. Asking a ward to refresh it records that somebody asked, and moves no number at all.",
  ],
  [
    "rkInbox",
    "occupied",
    "A row appears in the coordinator's inbox",
    "Five live fact categories are acknowledged rather than completed. The engine refuses completion of their real rows, but a fabricated commitment-prefixed ID can be completed because it is not checked against the inbox.",
  ],
  /*
   * Added 2026-09-22. These six carry nineteen actions the engine had grown and this map had never
   * shown — found only when the build learned to check itself against `ward-flow-events.ts` rather
   * than against its own list. They are drawn here, alongside, rather than on the spine, because
   * none of them moves a patient from one step to the next: each records something true while the
   * journey carries on around it.
   */
  [
    "rkDiversion",
    "collected",
    "The journey is diverted while it is under way",
    "Only once the patient is actually in the vehicle — it is refused before collection, after arrival, and a second time on a movement already diverted. It records a reason and where they were taken instead. The held bed does not come back on its own: giving it back is a separate act, and refused unless this movement was in fact diverted.",
  ],
  [
    "rkLegalWritten",
    "pulled",
    "The paperwork is written, continued, or attached",
    "Written and continued forms store clinician-typed start and expiry times and clear the old legal clock. A 3C after arrival on a 3D is refused. A file can be attached by name. The country-extension event is always refused; use the typed-expiry event instead.",
  ],
  [
    "rkLegalMismatch",
    "pulled",
    "The ward's authority does not match the person's status",
    "Two shapes, both named: an involuntary patient on a voluntary ward, and a voluntary patient on a locked one. It can be flagged, and it cannot be overridden: ward authority for an involuntary patient is never overridable (owner ruling, 25 September).",
  ],
  [
    "rkExpectFlag",
    "arrived",
    "A clock somebody starts by hand",
    "Two kinds, forty-eight hours and seven days, raised against a movement and cleared again. Only one can be open at a time — raising a second is refused, and so is clearing one that was never raised. Nothing starts it automatically and nothing expires it; it is a note about time, not a timer.",
  ],
  [
    "rkDischargePlan",
    "occupied",
    "Step-down, and what is holding the discharge up",
    "Two settings on a known admission: step-down candidacy and one discharge barrier. The acting ward must match; a substantive barrier is refused for a stay under seven days. Neither moves a bed figure.",
  ],
  [
    "rkWardDay",
    "bedReleased",
    "The ward's own day, beside the patient's",
    "A morning count a ward confirms, a message it can be sent, and a sweep that works out which beds on leave are worth warning about. None of them belongs to any one patient, which is why they sit off the journey rather than on it.",
  ],
];
let ry = 460;
const anchorY = (id) => (N.find((n) => n.id === id) || { y: 0 }).y;
for (const [id, anchor, label, sub, lane] of [...REC_ITEMS].sort((x, y) => anchorY(x[1]) - anchorY(y[1]))) {
  const at = N.find((n) => n.id === anchor);
  const h = 104;
  const y = Math.max(ry, at ? at.y + at.h / 2 - h / 2 : ry);
  add({ id, lane: lane || "record", x: REC.x, y, w: REC.w, h, label, sub });
  link(anchor, id, { route: "alongside", dashed: true });
  ry = y + h + 24;
}
add({
  id: "hdr-rec",
  lane: "heading",
  x: REC.x,
  y: 380,
  w: REC.w,
  h: 60,
  label: "Recorded alongside  ·",
  sub: "Happens at some point without moving the journey.",
});

/* ── column headings ───────────────────────────────────────────────────────── */
// Each heading sits above the first box of ITS OWN column. One shared line was fine while the
// three columns started together; the front door made them start at three different heights,
// and the shared line landed on top of the emergency department's last step.
const topOf = (id) => N.find((n) => n.id === id).y;
add({
  id: "hdr-left",
  lane: "heading",
  x: LEFT.x,
  y: topOf(SIDE[0][0]) - 76,
  w: LEFT.w,
  h: 56,
  label: "←  Stalls, undos and endings",
  sub: "Grey goes back into the route. Teal does not.",
});
add({
  id: "hdr-spine",
  lane: "heading",
  x: WD.x,
  y: SPINE_TOP - 86,
  w: WD.w,
  h: 56,
  label: "Read down the middle  ↓",
  sub: "Read straight down.",
});
add({
  id: "hdr-right",
  lane: "heading",
  x: RIGHT.x,
  y: topOf(RIGHTSIDE[0][0]) - 76,
  w: RIGHT.w,
  h: 56,
  label: "Diversions  →",
  sub: "It carries on, somewhere other than expected.",
});

// Derived, not listed. The comment above always claimed this was one rule; it was a list of six
// ids, so the seventh box to stop simply had no bar and the build had to catch it. Any box that
// carries the journey and has nothing leaving it stops, and says so with a bar.
const CARRIES = ["expected", "seam", "stall", "diversion", "forced", "end", "breach", "absent"];
for (const n of N)
  if (CARRIES.includes(n.lane) && !E.some((e) => e.from === n.id && e.to !== n.id))
    E.push({ from: n.id, to: n.id, route: "stub" });

/* ── compute the paths ─────────────────────────────────────────────────────── */
const byId = Object.fromEntries(N.map((n) => [n.id, n]));
const G = (n) => ({ x: n.x, y: n.y, w: n.w, h: n.h, r: n.x + n.w, b: n.y + n.h, cx: n.x + n.w / 2, cy: n.y + n.h / 2 });
/*
 * Square corners made a dogleg read as three separate lines meeting by coincidence, which is
 * exactly the wrong impression on a map whose whole point is which box leads to which. Round every
 * corner, with a radius that shrinks rather than overshooting when a segment is short — an arc
 * longer than the segment it sits on produces a loop, and a loop reads as a route.
 */
const R = 12;
const D = (pts) => {
  const P = pts.map(([x, y]) => [Math.round(x), Math.round(y)]);
  if (P.length < 3) return P.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ");
  const out = [`M ${P[0][0]} ${P[0][1]}`];
  for (let i = 1; i < P.length - 1; i++) {
    const [px, py] = P[i - 1],
      [cx, cy] = P[i],
      [nx, ny] = P[i + 1];
    const inLen = Math.hypot(cx - px, cy - py),
      outLen = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(R, inLen / 2, outLen / 2);
    if (r < 1.5) {
      out.push(`L ${cx} ${cy}`);
      continue;
    }
    const a = [cx + ((px - cx) / inLen) * r, cy + ((py - cy) / inLen) * r];
    const b = [cx + ((nx - cx) / outLen) * r, cy + ((ny - cy) / outLen) * r];
    out.push(`L ${Math.round(a[0])} ${Math.round(a[1])}`);
    out.push(`Q ${cx} ${cy} ${Math.round(b[0])} ${Math.round(b[1])}`);
  }
  out.push(`L ${P[P.length - 1][0]} ${P[P.length - 1][1]}`);
  return out.join(" ");
};

// Lanes already taken, so a second dogleg over the same stretch steps further out.
const lanes = [];
const blocked = (x, y0, y1, skip) =>
  N.some(
    (n) =>
      !skip.includes(n) &&
      x > n.x - 14 &&
      x < n.x + n.w + 14 &&
      Math.max(y0, y1) > n.y - 6 &&
      Math.min(y0, y1) < n.y + n.h + 6,
  );
const laneTaken = (x, y0, y1) =>
  lanes.some((l) => Math.abs(l.x - x) < 16 && Math.max(y0, y1) > l.y0 - 10 && Math.min(y0, y1) < l.y1 + 10);

function avoidBoxes(pts, A, B) {
  if (pts.length !== 2) return pts; // already a dogleg of some kind
  const [[x0, y0], [x1, y1]] = pts;
  if (x0 !== x1 || y0 === y1) return pts; // only straight vertical runs
  const skip = [A, B];
  if (!blocked(x0, y0, y1, skip)) return pts;
  const a = G(A),
    b = G(B),
    down = y1 > y0;
  const top = down ? a.b + 22 : b.b + 22,
    bot = down ? b.y - 22 : a.y - 22;
  for (let step = 0; step < 24; step++) {
    const side = step % 2 ? -1 : 1;
    const out = 36 + Math.floor(step / 2) * 22;
    const g = side > 0 ? Math.max(a.r, b.r) + out : Math.min(a.x, b.x) - out;
    if (g < 20) continue;
    if (blocked(g, top, bot, skip) || laneTaken(g, top, bot)) continue;
    lanes.push({ x: g, y0: Math.min(top, bot), y1: Math.max(top, bot) });
    return down
      ? [
          [a.cx, a.b],
          [a.cx, top],
          [g, top],
          [g, bot],
          [b.cx, bot],
          [b.cx, b.y],
        ]
      : [
          [a.cx, a.y],
          [a.cx, bot],
          [g, bot],
          [g, top],
          [b.cx, top],
          [b.cx, b.b],
        ];
  }
  return pts; // the check below will name it
}

const edges = [];
for (const e of E) {
  const A = G(byId[e.from]),
    B = G(byId[e.to]);
  let pts;
  switch (e.route) {
    case "stub": {
      // Point the bar wherever there is room. A fixed direction was fine until the endings
      // sat shoulder to shoulder, and then one box's bar poked into the box beside it —
      // which the colour check caught, because the line then belonged to the wrong box.
      const L = 38;
      const clear = (x, y) =>
        !N.some((n) => n.id !== e.from && x >= n.x - 6 && x <= n.x + n.w + 6 && y >= n.y - 6 && y <= n.y + n.h + 6);
      const options = [
        [
          [A.x, A.cy],
          [A.x - L, A.cy],
        ],
        [
          [A.r, A.cy],
          [A.r + L, A.cy],
        ],
        [
          [A.cx, A.b],
          [A.cx, A.b + L],
        ],
        [
          [A.cx, A.y],
          [A.cx, A.y - L],
        ],
      ];
      pts = options.find((o) => clear(o[1][0], o[1][1])) || options[0];
      break;
    }
    case "fan": {
      const mid = A.b + (B.y - A.b) / 2;
      pts =
        A.cx === B.cx
          ? [
              [A.cx, A.b],
              [B.cx, B.y],
            ]
          : [
              [A.cx, A.b],
              [A.cx, mid],
              [B.cx, mid],
              [B.cx, B.y],
            ];
      break;
    }
    case "channel": {
      const c = e.channel;
      pts = [
        [A.cx, A.b],
        [A.cx, A.b + 26],
        [c, A.b + 26],
        [c, B.cy],
        [B.x <= c ? B.r : B.x, B.cy],
      ];
      break;
    }
    case "sideL": {
      const gate = LEFT.x + LEFT.w + 60;
      pts = [
        [A.x, A.cy],
        [gate, A.cy],
        [gate, B.cy],
        [B.r, B.cy],
      ];
      break;
    }
    case "sideR": {
      const gate = WD.x + WD.w + 60;
      pts = [
        [A.r, A.cy],
        [gate, A.cy],
        [gate, B.cy],
        [B.x, B.cy],
      ];
      break;
    }
    case "bypass": {
      const c = e.channel;
      pts = [
        [A.cx, A.b],
        [A.cx, A.b + 22],
        [c, A.b + 22],
        [c, B.y - 22],
        [B.cx, B.y - 22],
        [B.cx, B.y],
      ];
      break;
    }
    case "alongside": {
      const floor = A.r + 24;
      let gate = REC.x - 46;
      while (gate > floor && blocked(gate, A.cy, B.cy, [byId[e.from], byId[e.to]])) gate -= 22;
      if (gate <= floor) gate = REC.x - 20; // nothing clear; the check below decides
      pts = [
        [A.r, A.cy],
        [gate, A.cy],
        [gate, B.cy],
        [B.x, B.cy],
      ];
      break;
    }
    default:
      pts =
        A.r <= B.x
          ? [
              [A.r, A.cy],
              [B.x, B.cy],
            ]
          : B.r <= A.x
            ? [
                [A.x, A.cy],
                [B.r, B.cy],
              ]
            : A.cy < B.cy
              ? [
                  [A.cx, A.b],
                  [B.cx, B.y],
                ]
              : [
                  [A.cx, A.y],
                  [B.cx, B.b],
                ];
  }
  // THE SECOND RULE: a line never runs behind a box. Take it into the nearest free gutter and
  // back. Gutters are tried outward from the column, and a lane already carrying a line over the
  // same stretch is skipped, so two doglegs never sit on top of each other.
  pts = avoidBoxes(pts, byId[e.from], byId[e.to]);
  // THE RULE: a line is the colour of the box it leads to (a stub, of the box it leaves).
  const owner = e.route === "stub" ? byId[e.from] : byId[e.to];
  // The seam keeps its own colour now. It used to be recoloured as ordinary route, which is
  // exactly the misreading the box exists to correct.
  const lane = owner.lane;
  // A line arriving at an ending, or at a stretch nothing can record, stops in a bar.
  const stops = e.route === "stub" || (e.from !== e.to && ["end", "absent"].includes(byId[e.to].lane) && !e.both);
  edges.push({
    from: e.from,
    to: e.to,
    d: D(pts),
    // The corners the line turns, BEFORE they are rounded. Every check about where a line goes
    // reads these, never the path string: the moment `D` started emitting curves, a check that
    // parsed the path read the control points as corners and quietly stopped meaning anything.
    p: pts.map(([x, y]) => [Math.round(x), Math.round(y)]),
    lane,
    ...(e.auto ? { auto: true } : {}),
    ...(e.both ? { both: true } : {}),
    ...(stops ? { terminal: true } : {}),
    ...(e.dashed ? { dashed: true } : {}),
  });
}

// The catcher for the defect above: a box covering another box reads as one box, so nothing
// about the drawing looks wrong. Refuse to write the map rather than emit it.
const clash = [];
for (let i = 0; i < N.length; i++)
  for (let j = i + 1; j < N.length; j++) {
    const a = N[i],
      b = N[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
      clash.push(`  · "${a.label}" (${a.x},${a.y}) overlaps "${b.label}" (${b.x},${b.y})`);
  }
if (clash.length) {
  console.error(`REFUSING to write the map — ${clash.length} box(es) overlap:\n${clash.join("\n")}`);
  process.exit(1);
}

// A vertical run still behind a box means the gutters ran out, not that it is acceptable.
const behind = [];
for (const [i, ed] of edges.entries()) {
  const pt = ed.p;
  const ends = [E[i].from, E[i].to];
  for (let k = 1; k < pt.length; k++) {
    const [ax, ay] = pt[k - 1],
      [bx, by] = pt[k];
    if (ax !== bx) continue; // horizontal hauls are a separate convention
    for (const n of N) {
      if (ends.includes(n.id)) continue;
      if (bx > n.x + 2 && ax < n.x + n.w - 2 && Math.max(ay, by) > n.y + 2 && Math.min(ay, by) < n.y + n.h - 2)
        behind.push(`  · the line ${E[i].from} → ${E[i].to} runs behind "${n.label}"`);
    }
  }
}
if (behind.length) {
  console.error(`REFUSING to write the map — ${behind.length} line(s) run behind a box:\n${behind.join("\n")}`);
  process.exit(1);
}

// Ordinary-looking steps that behave in a way a reader would not expect. A breach and a stated
// absence are already their own lanes; these are not, so they are named.
const TRAPS = {
  dClosedRecord:
    "Once a record closes, the legal status, the recorded sex or gender, and the legal form can never be corrected on it.",
  dNoLongerSuits:
    "The refusal names a way out that is itself refused; only a second message names the real three steps.",
  dRepull: "Pulling a held bed again skips every capacity and eligibility check.",
  dCancelLie: "The cancellation notice works out whether a bed is held from the stage, not from the bed.",
  cmhtNothing: "Nothing anywhere can close a queued community arm except the team answering or the referrer.",
  edNeverArrives: "A queued ED arm can be declined or withdrawn before arrival; the expectation then disappears without an arrival stamp.",
  rkExpiryShut:
    "Arriving closes the record, so the legal form's expiry can no longer be recorded for exactly the people it is for.",
  rkInbox: "Real fact rows cannot be completed, but a fabricated commitment-prefixed ID can pass the completion guard without a matching inbox row.",
  sCancelTransport:
    "Two of its refusals can never run. Both describe a job already cancelled or a patient already arrived — and every way either happens also closes the movement, which a check above them catches first.",
  sStopTransport:
    "Two of its refusals can never run either, for the same reason. Nobody is less safe; the sentence they would have been given simply names the closure instead of what they just tried to do.",
};
for (const [id, why] of Object.entries(TRAPS)) {
  const n = N.find((x) => x.id === id);
  if (!n) {
    console.error(`REFUSING to write the map — a finding names a box that does not exist: ${id}`);
    process.exit(1);
  }
  n.finding = why;
}

/*
 * Which part of the journey each box belongs to. Derived from the spine, so it cannot go stale:
 * anything above the seam is the front door, anything level with the spine down to "arrived" is the
 * bed search, and the rest is the ward stay and the endings. The recorded-alongside column is its
 * own thing throughout.
 */
{
  const at = (id) => (N.find((n) => n.id === id) || { y: 0 }).y;
  const seamY = at("seam"),
    arrivedY = at("arrived"),
    tracksY = at("personLeaves");
  for (const n of N) {
    n.phase =
      n.x === REC.x ? "alongside" : n.y < seamY ? "front" : n.y < arrivedY ? "bed" : n.y < tracksY ? "ward" : "leaving";
  }
}

// A marked finding with nothing to say is worse than none: the findings page would list a heading
// and no reason. Refuse rather than publish that.
const mute = N.filter((n) => (n.finding || ["breach", "absent"].includes(n.lane)) && !n.sub);
if (mute.length) {
  console.error(
    `REFUSING to write the map — ${mute.length} finding(s) with nothing said about them: ${mute.map((n) => n.label).join("; ")}`,
  );
  process.exit(1);
}

const width = REC.x + REC.w + 60;
const height = Math.max(...N.map((n) => n.y + n.h)) + 80;
const out = { width, height, spineX: WD.x + WD.w / 2, nodes: N, edges };
fs.writeFileSync(path.join(here, "stages.json"), JSON.stringify(out, null, 1));
const tally = {};
for (const n of N) tally[n.lane] = (tally[n.lane] || 0) + 1;
console.log(`map rebuilt: ${N.length} boxes, ${edges.length} lines, ${width}×${height}`);
console.log("boxes by lane:", JSON.stringify(tally));
