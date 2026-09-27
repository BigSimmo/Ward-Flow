// Builds the Ward Flow journey explorer from extracted data.
//
// The build is the guarantee. It refuses to produce a page unless EVERY action in the
// engine is accounted for — either as a transition drawn on a state machine, or as an
// explicit "changes no state, writes this instead" entry. An action nobody mapped is a
// build failure, not a quiet gap on a diagram.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const repoRoot = path.resolve(here, "../../..");
const read = (f) => JSON.parse(fs.readFileSync(path.join(here, f), "utf8"));

/*
 * WHEN THIS PAGE WAS MADE, AND FROM WHAT. A saved copy of a generated document looks exactly like
 * a current one, and this is a document people will keep. So the page carries its own date and the
 * commit it was built from.
 *
 * ⚠️ AND WHETHER THE TREE WAS CLEAN, WHICH IS THE PART THAT MATTERS. A stamp naming a commit while
 * uncommitted edits sat in the tree would name a version that never produced this page — a precise
 * citation of the wrong thing, which is worse than no citation.
 */
function provenance() {
  const git = (args, fallback) => {
    try {
      return execFileSync("git", ["-C", repoRoot, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return fallback;
    }
  };
  const commit = git(["rev-parse", "--short", "HEAD"], "");
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], "");
  // Only the ward source and this folder count: an unrelated edit elsewhere did not affect the page.
  const dirty = git(["status", "--porcelain", "--", "src/components/ward-management", "docs/ward-flow/journey"], "");
  return {
    builtAt: new Date().toISOString(),
    commit,
    branch,
    dirty: dirty.length > 0,
    dirtyCount: dirty ? dirty.split("\n").filter(Boolean).length : 0,
  };
}

const vocab = read("vocabularies.json");
const actions = read("actions.json");
const stages = read("stages.json");
const machines = read("machines.json");

/* ---------------------------------------------------------------------------
   Actions that change a record WITHOUT moving it between states. Each must say
   what it writes; an action in neither this table nor a machine fails the build.
--------------------------------------------------------------------------- */
const WRITES = {
  // Added 2026-09-22 with the nineteen the completeness check found. Each records something true
  // while the journey carries on around it; none of them advances a patient to the next step.
  RECORD_DIVERSION: "That a journey already under way was diverted, with a reason and where the patient went instead.",
  RELEASE_DIVERTED_BED:
    "Gives back the bed a diverted movement was still holding. Refused unless it really was diverted.",
  SET_ARRIVAL_DETAILS: "How and when they are expected, any tracking number, and a cleared pull timer.",
  SET_STEP_DOWN_CANDIDATE: "Whether this admission is a candidate to step down to a lower level of care.",
  SET_DISCHARGE_BARRIER: "The one thing holding this discharge up, or that nothing is.",
  RELEASE_BED:
    "Nothing, in practice: recording the named patient leaving completes their release in the same write, so none is left for this to complete.",
  UPDATE_EXPECTED_DISCHARGE: "When this admission is expected to leave, how many times that date has moved, and when it was set.",
  RECORD_MOVEMENT_MEDICAL_CLEARANCE:
    "The medical-clearance answer on a MOVEMENT — the referral carries its own, separately.",
  UPLOAD_PATIENT_FORM: "That a file was attached to this movement, by name and size. The file itself is not modelled.",
  RECORD_LEGAL_FORM_WRITTEN: "The written form and clinician-typed times; clears the old legal clock.",
  RECORD_COUNTRY_EXTENSION: "Nothing. This event is always refused; record a typed expiry instead.",
  RECORD_LEGAL_FORM_CONTINUATION: "The continued form and clinician-typed times; clears the old legal clock.",
  EVALUATE_ARRIVAL_LATENESS: "When late, stamps the movement and sends ED and ward notices; changes no stage.",
  RELEASE_AND_REOPEN_SEARCH: "Gives the held bed back AND puts the movement back into the search, in one act.",
  RAISE_EXPECT_FLAG: "Starts one of two hand-set clocks on a movement. A second one is refused.",
  CLEAR_EXPECT_FLAG: "Clears that flag. Refused when none is open.",
  FLAG_LEGAL_MISMATCH: "That a ward's authority does not match this person's legal status, in one of two shapes.",
  EVALUATE_LEAVE_BED_WARNINGS: "Sweeps beds held during leave and works out which are worth warning about.",
  CONFIRM_MORNING_ROLLUP: "A ward confirming its own morning count of expected discharges.",
  SEND_WARD_BUZZ: "A message sent to a ward, optionally marked urgent. Belongs to no patient.",
  ADD_PATIENT: "Creates a patient record.",
  RECORD_MEDICAL_CLEARANCE: "The medical-clearance answer, on a referral. Overwritable on purpose.",
  RECORD_ARRIVED_IN_DEPARTMENT: "The arrival time, on a referral. Stamped once; a repeat is harmless.",
  ADD_REFERRAL_CORRECTION: "Appends a correction note to a referral. Never overwrites.",
  RECORD_LOCAL_BED_SOUGHT: "That a closer-to-home bed was looked for, on a referral.",
  RECORD_TRANSPORT_NEED: "Whether transport is needed, on a movement. This is what allows arrival with no journey.",
  RECORD_NO_REFERRAL: "That nobody referred this patient, on a movement.",
  RECORD_ESCALATION: "The wards tried and who was contacted, on a movement.",
  RECORD_LEFT_DEPARTMENT: "The time they physically left the department, on a movement.",
  CHANGE_LEGAL_STATUS: "The Mental Health Act status, on a movement, plus a log entry. Triggers nothing.",
  RECORD_LEGAL_FORM_RECEIVED: "That the Form 1A physically arrived, on a movement.",
  CORRECT_LEGAL_FORM_RECEIPT: "Clears that receipt and appends the correction.",
  RECORD_LEGAL_FORM_EXPIRY: "The expiry a clinician typed, and its history. Nothing is computed.",
  RECORD_MOVEMENT_GENDER: "The recorded gender on a movement, plus a notice if a bed is involved.",
  RECORD_LEAVE_BED: "Creates a leave record against a ward's bed.",
  END_LEAVE_BED: "Removes that leave record.",
  CONFIRM_CAPACITY: "Sets a ward's allocatable count outright — see the two bed counts.",
  RECORD_WARD_INTAKE_CONSTRAINTS: "Replaces a ward's list of intake restrictions.",
  REQUEST_CAPACITY_REFRESH: "Logs that somebody asked a ward to refresh. Moves no count.",
  CHANGE_URGENCY: "The urgency level on a movement, plus a log entry. Re-sorts nothing.",
  FLAG_MOVEMENT_URGENT: "The urgent flag on a movement, and opens a history entry.",
  CLEAR_MOVEMENT_URGENT_FLAG: "Clears that flag and closes the history entry.",
  RECORD_MOVEMENT_BLOCKER: "Free text describing what is holding a movement up.",
  CLEAR_MOVEMENT_BLOCKER: "Writes the sentinel meaning nothing is holding it up.",
  MARK_NOTICE_READ: "Who read a notice, and when.",
  ACKNOWLEDGE_INBOX_ITEM: "Logs that a coordinator has seen an inbox row.",
  COMPLETE_INBOX_ITEM: "Logs an accepted ID as done, even if no inbox row matches it.",
  REOPEN_INBOX_ITEM: "Logs an inbox row as reopened, keeping that it was once done.",
  ADVANCE_CLOCK: "The demonstration clock. Nothing in this prototype moves on its own.",
  RESET_SCENARIO: "Replaces the whole board with the standard starting scenario.",
  SET_SCENARIO: "Replaces the whole board with a different simulated night.",
  SET_CONFIGURATION: "The tunable settings the rest of the system reads.",
  RECORD_PATIENT_DISCHARGE: "Nothing — this branch is unreachable; the real handling runs earlier.",
  OPEN_DISCHARGE_RECORD: "Nothing — this branch is unreachable; the real handling runs earlier.",
  REVIEW_AUDIT_EVENT: "Nothing — this branch is unreachable; the real handling runs earlier.",
  RECORD_REPATRIATION:
    "A phone-logged repatriation. Books nothing. If the home ward agreed, it also opens a new return movement at placement requested.",
  RECORD_HANDOVER_SIGN_OFF: "The role and the time of a handover sign-off. No note, no name.",
  RECORD_CLINICAL_CONTACT: "Which community team was contacted, when, and by which role.",
  DISPATCH_BROADCAST_ALERT: "A network-wide alert, active, with nobody yet acknowledging it. Belongs to no patient.",
  ACKNOWLEDGE_BROADCAST_ALERT: "One more unit on the alert's acknowledged list.",
  STAND_DOWN_BROADCAST_ALERT: "The alert marked stood down, with the time and the role.",
};

/* ---------------------------- integrity checks ---------------------------- */
const problems = [];
const byEvent = new Map(actions.map((a) => [a.event, a]));

// 1. Every transition names a real action, and real states at both ends.
const transitionsOf = new Map();
for (const m of machines.machines) {
  const stateIds = new Set(m.states.map((s) => s.id));
  for (const t of m.transitions) {
    if (!byEvent.has(t.action)) problems.push(`${m.id}: transition names unknown action ${t.action}`);
    if (!stateIds.has(t.from)) problems.push(`${m.id}: transition from unknown state "${t.from}"`);
    if (!stateIds.has(t.to)) problems.push(`${m.id}: transition to unknown state "${t.to}"`);
    const from = m.states.find((s) => s.id === t.from),
      to = m.states.find((s) => s.id === t.to);
    if (from && to) {
      const label = `${m.name}: ${from.label} → ${to.label}`;
      if (!transitionsOf.has(t.action)) transitionsOf.set(t.action, []);
      if (!transitionsOf.get(t.action).includes(label)) transitionsOf.get(t.action).push(label);
    }
  }
}

// 2. Every resource mover names a real action.
for (const c of machines.resources.counts)
  for (const mv of c.moves)
    if (!byEvent.has(mv.action)) problems.push(`resources: ${c.name} names unknown action ${mv.action}`);

// 3. Every map edge must be anchored: either an endpoint lands on a node box, or BOTH
//    endpoints meet another edge's endpoint (a fork's crossbar is a real edge with no box
//    of its own). Stated as a conjunction rather than a rule plus an exemption list — an
//    exemption list is a record of a predicate that does not describe the property, and it
//    decays, because the next legitimate crossbar is not on it.
const nodeBoxes = stages.nodes.map((n) => ({ x: n.x, y: n.y, r: n.x + n.w, b: n.y + (n.h || 60) }));
const touchesBox = (x, y) => nodeBoxes.some((b) => x >= b.x - 3 && x <= b.r + 3 && y >= b.y - 3 && y <= b.b + 3);
const endpointsOf = (d) => {
  const pts = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  return [pts[0], pts[pts.length - 1]];
};
const allEnds = stages.edges.flatMap((e) => endpointsOf(e.d));
const meetsAnotherEdge = (x, y, self) =>
  allEnds.some(([ax, ay], i) => Math.floor(i / 2) !== self && Math.abs(ax - x) < 3 && Math.abs(ay - y) < 3);
stages.edges.forEach((e, i) => {
  const [[sx, sy], [ex, ey]] = endpointsOf(e.d);
  const anchored =
    touchesBox(sx, sy) || touchesBox(ex, ey) || (meetsAnotherEdge(sx, sy, i) && meetsAnotherEdge(ex, ey, i));
  if (!anchored) problems.push(`journey map: an edge is anchored to nothing (${e.d.slice(0, 44)}…)`);
});

// 3b. Every box must be either CONTINUED (a line leaves it) or TERMINATED (a line leaves it
//     ending in a bar). A box with neither is a route somebody stopped drawing — visually
//     indistinguishable from a dead end, which is exactly the confusion this check exists for.
{
  const drawn = stages.nodes.filter((n) => n.lane !== "heading");
  const geo = (n) => ({ x: n.x, y: n.y, r: n.x + n.w, b: n.y + (n.h || 60) });
  const at = (x, y, n) => {
    const g = geo(n);
    return x >= g.x - 4 && x <= g.r + 4 && y >= g.y - 4 && y <= g.b + 4;
  };
  const unfinished = [];
  for (const n of drawn) {
    // This check asks "does this route continue, or does it stop". Two lanes are not routes
    // at all and the question does not apply to them: a `note` is a rule about how something
    // works, and a `record` is something written down beside the journey without moving it.
    // Exempting them is a statement about what they ARE, not a way to quieten the check —
    // every lane that IS a route stays in scope, including any added later.
    if (n.lane === "note" || n.lane === "record") continue;
    let settled = false;
    for (const e of stages.edges) {
      const [[sx, sy], [ex, ey]] = endpointsOf(e.d);
      const startsHere = at(sx, sy, n),
        endsHere = at(ex, ey, n);
      // continued: a line leaves it · terminated: a bar sits at either end of a line touching it
      // · returns: a double-headed line, which says it goes back
      if (startsHere || (e.terminal && (startsHere || endsHere)) || (e.both && endsHere)) {
        settled = true;
        break;
      }
    }
    if (!settled) unfinished.push(n.label);
  }
  if (unfinished.length)
    problems.push(
      `journey map: ${unfinished.length} box(es) are neither continued nor marked as an ending — ${unfinished.join("; ")}`,
    );
}

// 3c. Every filter button must control something. A switch that changes nothing on screen
//     reads as broken, and the "Record-keeping" one controlled nothing at all until the
//     alongside column existed. Read the buttons out of the page rather than keeping a copy.
{
  const tpl = fs.readFileSync(path.join(here, "explorer-template.html"), "utf8");
  const buttons = [
    ...tpl.matchAll(/\{ id: "(\w+)",\s+label: "[^"]+",\s+colour: "var\(--[a-z-]+\)",\s*covers: \[([^\]]+)\]/g),
  ].map((m) => [m[1], m[2].split(",").map((x) => x.trim().replace(/"/g, ""))]);
  if (!buttons.length)
    problems.push("could not read the filter buttons out of the page — the check would pass vacuously");
  for (const [id, covers] of buttons) {
    const n = stages.nodes.filter((x) => covers.includes(x.lane)).length;
    const e = stages.edges.filter((x) => covers.includes(x.lane || "expected")).length;
    if (n + e === 0)
      problems.push(`the "${id}" filter button controls nothing on the map — no box and no line carries that lane`);
  }
}

// 3d. A line takes the colour of the box it leads to. Colour on this map answers "what kind
//     of place does this go to", so a grey line arriving at a teal ending says two different
//     things at once. A terminal stub is the exception: it leaves its box and stops, so it
//     belongs to the box it leaves.
{
  const boxes = stages.nodes
    .filter((n) => !["heading", "note"].includes(n.lane))
    .map((n) => ({ lane: n.lane, x: n.x, y: n.y, r: n.x + n.w, b: n.y + (n.h || 60), label: n.label }));
  const at = (x, y) => boxes.find((b) => x >= b.x - 4 && x <= b.r + 4 && y >= b.y - 4 && y <= b.b + 4);
  const mismatched = [];
  for (const e of stages.edges) {
    const [[sx, sy], [ex, ey]] = endpointsOf(e.d);
    // The box at the far end owns the line. A stub's far end is outside every box, so it
    // falls back to the box it left — which is the same box, and the same answer.
    const owner = at(ex, ey) || at(sx, sy);
    if (!owner) continue;
    // The seam has its own colour now — it no longer borrows the ordinary route's.
    const want = owner.lane;
    if ((e.lane || "expected") !== want)
      mismatched.push(`${owner.label} (line is ${e.lane || "expected"}, box is ${want})`);
  }
  if (mismatched.length)
    problems.push(
      `journey map: ${mismatched.length} line(s) are not the colour of the box they lead to — ${mismatched.slice(0, 4).join("; ")}${mismatched.length > 4 ? "…" : ""}`,
    );
}

// 3f. Every colour on the legend must have a sentence saying what it means, and must be used by
// at least one box. Read out of the page, not out of a second list kept beside it.
{
  const page = fs.readFileSync(path.join(here, "explorer-template.html"), "utf8");
  // Whitespace-tolerant on purpose. The first version pinned the exact indentation, and the
  // repository's formatter reindented the whole script the moment this folder entered the repo.
  // The check refused rather than quietly matching nothing, which is the only reason it was seen.
  const lanesBlock = page.match(/const LANES\s*=\s*\[([\s\S]*?)\n\s*\];/);
  const meansBlock = page.match(/const LANE_MEANS\s*=\s*\{([\s\S]*?)\n\s*\};/);
  if (!lanesBlock || !meansBlock)
    problems.push("legend: could not read the lane table or its meanings out of the page");
  else {
    const declared = [...lanesBlock[1].matchAll(/id:\s*"([a-z]+)"/g)].map((m) => m[1]);
    const explained = new Set([...meansBlock[1].matchAll(/^\s*([a-z]+):/gm)].map((m) => m[1]));
    const covers = Object.fromEntries(
      [...lanesBlock[1].matchAll(/id:\s*"([a-z]+)"[\s\S]*?covers:\s*\[([^\]]*)\]/g)].map((m) => [
        m[1],
        [...m[2].matchAll(/"([a-z]+)"/g)].map((x) => x[1]),
      ]),
    );
    const used = {};
    for (const n of stages.nodes) used[n.lane] = (used[n.lane] || 0) + 1;
    const nameless = declared.filter((id) => !explained.has(id));
    const empty = declared.filter((id) => !(covers[id] || []).some((lane) => used[lane]));
    const unlisted = Object.keys(used).filter(
      (lane) => lane !== "heading" && !Object.values(covers).some((c) => c.includes(lane)),
    );
    if (nameless.length)
      problems.push(
        `legend: ${nameless.length} colour(s) with no sentence saying what they mean — ${nameless.join(", ")}`,
      );
    if (empty.length) problems.push(`legend: ${empty.length} colour(s) nothing on the map uses — ${empty.join(", ")}`);
    if (unlisted.length)
      problems.push(
        `legend: ${unlisted.length} lane(s) on the map that the legend never names — ${unlisted.join(", ")}`,
      );
  }
}

// 3e. Every box an action claims must exist. A renamed box leaves the action pointing at
//     nothing, and a panel listing no actions looks identical to a point where nothing can
//     happen — a silent wrong answer rather than a visible gap.
{
  const boxIds = new Set(stages.nodes.map((n) => n.id));
  for (const a of actions)
    for (const id of a.nodes || [])
      if (!boxIds.has(id)) problems.push(`action ${a.event} points at box "${id}", which is not on the map`);
}

/*
 * 3f. "NO SCREEN CAN DO THIS" MUST BE TRUE, BECAUSE IT GOES TO THE OWNER AS A LIST TO RULE ON.
 *
 * Added 2026-09-25, when the list of twelve unreachable actions was re-checked and found to hold
 * eleven: `RECORD_NO_REFERRAL` had been wired to the ED screen (87118c236a) and the map still said
 * nothing could trigger it. The `screen` field was hand-written and nothing ever compared it to the
 * app, so the owner would have been asked to rule on a feature that already existed.
 *
 * The check reads the app for a dispatch literal (`type: "EVENT"`) anywhere under `src/` outside
 * the three engine files that name every event without dispatching one. Scanning every file rather
 * than screens only is deliberate: a dispatch routed through a provider helper still counts as
 * reachable, so the error can only fall on the side of refusing a NONE claim, never of approving
 * one. A claim that names a screen must name a file that exists.
 */
{
  const srcRoot = path.join(repoRoot, "src");
  const ENGINE = new Set(["ward-flow-reducer.ts", "ward-flow-events.ts", "ward-model.ts"]);
  const sources = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !ENGINE.has(e.name)) sources.push(p);
    }
  };
  walk(srcRoot);
  // A walk that finds almost nothing would clear every NONE claim — refuse instead.
  if (sources.length < 100) {
    problems.push(`only ${sources.length} source files were found under src/, so no screen claim can be checked`);
  } else {
    const text = new Map(sources.map((f) => [f, fs.readFileSync(f, "utf8")]));
    const basenames = new Set(sources.map((f) => path.basename(f)));
    for (const a of actions) {
      const claim = a.screen?.screen;
      if (!claim) {
        problems.push(`action ${a.event} says nothing about which screen can trigger it`);
        continue;
      }
      if (claim === "NONE") {
        const dispatch = new RegExp(String.raw`type:\s*["']${a.event}["']`);
        const callers = sources.filter((f) => dispatch.test(text.get(f))).map((f) => path.relative(repoRoot, f));
        if (callers.length)
          problems.push(
            `action ${a.event} is marked "no screen can trigger this", but it is dispatched from ${callers.join(", ")}`,
          );
      } else {
        const named = /^(\S+\.tsx?)\b/.exec(claim)?.[1];
        if (!named || !basenames.has(named))
          problems.push(`action ${a.event} names screen "${claim}", and no such file exists under src/`);
      }
    }
  }
}

/*
 * 3b. 🔴 THE CHECK THAT SHOULD HAVE BEEN FIRST: does the map know every action the ENGINE has?
 *
 * Added 2026-09-22, after it caught nineteen missing in its first run. Until then this build
 * checked `actions.json` against itself — every action must be a transition or a recorded write —
 * and checked the map against `actions.json`. Nothing anywhere compared either to the engine. So
 * the map's entire claim, that it shows everything the ward can do, was ASSERTED BY ITS OWN README
 * AND NEVER VERIFIED, and the build printed "71 actions" with total confidence while the engine had
 * grown to ninety.
 *
 * ⚠️ AND THE DIRECTION IS THE WHOLE POINT. The existing check catches an action on the map that the
 * engine does not have — a map that says too much, which is embarrassing but visible, because
 * clicking it leads nowhere. This catches a map that says too LITTLE, which is invisible: a reader
 * cannot miss what was never drawn, and every count on the page reads as complete. On a map whose
 * purpose is to show a clinician every route a patient can take, the silent direction is the
 * dangerous one.
 *
 * `EVENT_ROLE` is the authoritative list because the compiler forces it to be exhaustive — it is
 * typed `Record<WardFlowEvent["type"], ...>`, so an event that exists and is missing from it does
 * not build.
 */
/*
 * How many kinds of notice there are is a number the page states in three places, and it said
 * sixteen for days after the engine reached twenty-three. The engine keeps no list of them, only the
 * `NoticeKind` union, so the count is read from that union and every place that states it must
 * agree.
 */
{
  const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
  const word = (n) => (n <= 20 ? NUMBER_WORDS[n] : n < 30 ? "twenty-" + NUMBER_WORDS[n - 20] : String(n));
  const model = fs.readFileSync(path.join(repoRoot, "src/components/ward-management/ward-model.ts"), "utf8");
  // Ends at the first member followed by ";" — comments inside the union carry semicolons of their own.
  const union = model.match(/export type NoticeKind =([\s\S]*?"\s*;)/)?.[1];
  const kinds = union ? [...union.matchAll(/\|\s*"([a-z_]+)"/g)].length : 0;
  if (kinds < 5) {
    problems.push(`only ${kinds} notice kinds were read out of NoticeKind in ward-model.ts, which cannot be right`);
  } else {
    const said = [
      ["the notice machine's subject", machines.machines.find((m) => m.id === "notice")?.subject ?? ""],
      ["the notice machine's labels", JSON.stringify(machines.machines.find((m) => m.id === "notice") ?? {})],
      ["the map", JSON.stringify(stages)],
    ];
    for (const [where, text] of said) {
      const stated = [...text.matchAll(/\b([a-z]+(?:-[a-z]+)?) kinds of (?:message|notice)|one of ([a-z]+(?:-[a-z]+)?) kinds/gi)]
        .map((m) => (m[1] || m[2]).toLowerCase());
      for (const s of stated)
        if (s !== word(kinds))
          problems.push(`${where} says "${s}" kinds of notice; the engine's NoticeKind has ${kinds}`);
    }
  }
}

{
  const EVENTS_FILE = path.join(repoRoot, "src/components/ward-management/ward-flow-events.ts");
  const source = fs.readFileSync(EVENTS_FILE, "utf8");
  const block = source.split("export const EVENT_ROLE")[1]?.split("} as const")[0];
  if (!block) {
    problems.push("could not find EVENT_ROLE in ward-flow-events.ts, so the map's completeness cannot be checked");
  } else {
    const engineEvents = [...block.matchAll(/^ {2}([A-Z][A-Z0-9_]*):/gm)].map((m) => m[1]);
    // A parse that finds almost nothing would report "nothing is missing" — the most reassuring
    // possible way to fail. Refuse instead.
    if (engineEvents.length < 40) {
      problems.push(
        `only ${engineEvents.length} events were read out of EVENT_ROLE, which cannot be right — ` +
          "refusing rather than reporting a map that looks complete",
      );
    } else {
      const known = new Set(actions.map((a) => a.event));
      const missing = engineEvents.filter((e) => !known.has(e));
      if (missing.length)
        problems.push(
          `the engine has ${missing.length} action(s) the map does not show, so the map is not the whole journey: ` +
            missing.join(", "),
        );
      // The other direction. OVERRIDE_LEGAL_MISMATCH was removed from the engine by owner ruling
      // (decisions D-16) and stayed on the map for a day as a working action, because only the
      // direction above was ever checked. A removed action on the map says something can be done
      // that cannot, which for a legal override is the worse of the two errors.
      const engine = new Set(engineEvents);
      const phantom = actions.map((a) => a.event).filter((e) => !engine.has(e));
      if (phantom.length)
        problems.push(
          `the map shows ${phantom.length} action(s) the engine no longer has, so it claims something can be done that cannot: ` +
            phantom.join(", "),
        );
    }
  }
}

// 4. THE ONE THAT MATTERS: every action is modelled somewhere.
const rows = [];
for (const a of actions) {
  const ts = transitionsOf.get(a.event) || [];
  const writes = WRITES[a.event] || "";
  if (!ts.length && !writes)
    problems.push(`UNMODELLED ACTION: ${a.event} is neither a transition nor a recorded write`);
  rows.push({ name: a.name, event: a.event, transitions: ts, writes });
}

if (problems.length) {
  console.error("REFUSING TO BUILD — " + problems.length + " problem(s):");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}

/*
 * How much of the engine's refusing this page actually names. A refusal is a pathway — it is where
 * somebody's intended route stops — and the curated list holds a subset of them. Saying so on the
 * page's face is the difference between a map that is incomplete and a map that pretends not to
 * be. Both numbers are counted here rather than typed, so neither can go stale: one from the
 * reducer's own `return reject(` sites, one from the curated list.
 */
const reducerSrc = fs.readFileSync(
  path.resolve(here, "../../../src/components/ward-management/ward-flow-reducer.ts"),
  "utf8",
);
const refusalsInEngine = (reducerSrc.match(/return reject\(/g) || []).length;
const refusalsNamed = actions.reduce((n, a) => n + (a.refuses || []).length, 0);
if (!refusalsInEngine) {
  console.error("REFUSING TO BUILD — found no refusals in the reducer, so the coverage line would be a lie.");
  process.exit(1);
}

const coverage = {
  total: actions.length,
  mapped: rows.filter((r) => r.transitions.length).length,
  refusalsInEngine,
  refusalsNamed,
  rows,
};

/* A saved coverage result belongs to a specific reducer. A later build must not silently show
   its historical count as though it measured this version. */
const savedCoverage = fs.existsSync(path.join(here, "refusal-coverage.json")) ? read("refusal-coverage.json") : null;
const reducerHash = crypto.createHash("sha256").update(reducerSrc.replace(/\r\n/g, "\n")).digest("hex");
const refusalCoverage = savedCoverage?.input?.reducerSha256 === reducerHash ? savedCoverage : null;
const DATA = JSON.stringify({ vocab, actions, stages, machines, coverage, made: provenance(), refusalCoverage });
const template = fs.readFileSync(path.join(here, "explorer-template.html"), "utf8");

/*
 * 🔴 THE SUBSTITUTION HAS TO BE CHECKED, BECAUSE FAILING IT LOOKS EXACTLY LIKE SUCCEEDING.
 * This was a plain `.replace("/*__DATA__* /null", DATA)`. The repository's formatter put a space
 * after the comment, the literal stopped matching, `String.replace` returned the template
 * unchanged — no error, nothing thrown — and the build printed its usual cheerful summary while
 * writing a page whose data was `null`. Every count in that summary was read from the JSON in
 * memory, so all of them were right; only the file was empty. It was caught by opening the page,
 * which is the one instrument that would have caught it.
 *
 * So: tolerate the whitespace, and REFUSE if the marker was not there to replace.
 */
const MARKER = /\/\*__DATA__\*\/\s*null/;
if (!MARKER.test(template)) {
  console.error(
    "REFUSING TO BUILD — the data marker is missing from explorer-template.html, so the page " +
      "would be written with no data in it and would open blank.",
  );
  process.exit(1);
}
const page = template.replace(MARKER, () => DATA);
if (page.length <= template.length) {
  console.error("REFUSING TO BUILD — the data was not substituted into the page.");
  process.exit(1);
}
fs.writeFileSync(path.join(here, "ward-journey-explorer.html"), page);

console.log(
  `built ward-journey-explorer.html — ${actions.length} actions, ` +
    `${machines.machines.length} state machines, ` +
    `${machines.machines.reduce((n, m) => n + m.transitions.length, 0)} transitions, ` +
    `${stages.nodes.length} map boxes, ${Object.keys(vocab.vocabularies).length} word lists`,
);
console.log(
  `coverage: ${coverage.mapped} of ${coverage.total} actions move a record between states; ` +
    `${coverage.total - coverage.mapped} change a record without changing its state. None unaccounted for.`,
);
