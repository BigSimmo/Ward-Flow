/*
 * What changed since the last run.
 *
 * The point of generating this map is that it cannot drift from the engine — but "it was
 * regenerated" and "somebody noticed what moved" are different things. Without this, a box
 * appearing or disappearing looks exactly like a box that was always there, and the only person
 * who would catch it is one who happened to re-read the whole map.
 *
 * So: keep a snapshot of what the map holds, and report the difference every time. The snapshot is
 * committed alongside it, which means the difference also shows up in an ordinary diff — but a diff
 * of a thousand-line JSON file is not something anyone reads, and this is.
 */
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const load = (f) => JSON.parse(fs.readFileSync(path.join(here, f), "utf8"));
const SNAP = path.join(here, "map-snapshot.json");
const REPORT = path.join(here, "WHAT-CHANGED.md");

const stages = load("stages.json");
const actions = load("actions.json");

/*
 * 🔴 WHAT THIS SNAPSHOTS IS WHAT IT CAN NOTICE, AND IT USED TO SNAPSHOT TOO LITTLE.
 *
 * Until 2026-09-22 this kept each box's TITLE and COLOUR and nothing else. So the run that added
 * the admission-to-movement join to a box's explanation, and added two findings saying four
 * refusals in the engine can never run, reported "0 boxes added, 0 removed, 0 reworded,
 * 0 recoloured" — and was telling the truth about the only two things it was looking at.
 *
 * ⚠️ THE FINDINGS ARE THE MOST CONSEQUENTIAL CONTENT ON THE MAP and were the least watched. They
 * are what the "What's wrong" page is built from, so a finding QUIETLY VANISHING means the map
 * stopped saying something is wrong — and that is precisely the shape this file exists to catch:
 * what is gone leaves no mark on the page. Body text matters for the same reason at lower stakes;
 * it is where a box says what it actually does.
 */
const body = (n) => n.sub || "";
const now = {
  boxes: Object.fromEntries(stages.nodes.filter((n) => n.lane !== "heading").map((n) => [n.id, n.label])),
  lanes: Object.fromEntries(stages.nodes.filter((n) => n.lane !== "heading").map((n) => [n.id, n.lane])),
  bodies: Object.fromEntries(stages.nodes.filter((n) => n.lane !== "heading").map((n) => [n.id, body(n)])),
  findings: Object.fromEntries(stages.nodes.filter((n) => n.finding).map((n) => [n.id, n.finding])),
  actions: Object.fromEntries(actions.map((a) => [a.event, a.name])),
  refusals: Object.fromEntries(actions.map((a) => [a.event, (a.refuses || []).length])),
};

const first = !fs.existsSync(SNAP);
const was = first
  ? { boxes: {}, lanes: {}, bodies: {}, findings: {}, actions: {}, refusals: {} }
  : JSON.parse(fs.readFileSync(SNAP, "utf8"));
/*
 * An older snapshot has no `bodies`/`findings` at all. Treating that absence as "every box's text
 * is new" would report a hundred spurious changes on the first run after this fix, and a report
 * that cries wolf once is one nobody reads the second time. So an absent section means "cannot
 * speak for it" — the same discipline the refusal measure uses — and the first run after the
 * upgrade says so plainly instead of inventing a diff.
 */
const bodiesWereKept = !first && was.bodies !== undefined;
const findingsWereKept = !first && was.findings !== undefined;

const keys = (o) => Object.keys(o || {});
const addedBoxes = keys(now.boxes).filter((k) => !(k in (was.boxes || {})));
const goneBoxes = keys(was.boxes).filter((k) => !(k in now.boxes));
const relabelled = keys(now.boxes).filter((k) => k in (was.boxes || {}) && was.boxes[k] !== now.boxes[k]);
const relaned = keys(now.lanes).filter((k) => k in (was.lanes || {}) && was.lanes[k] !== now.lanes[k]);
const addedActions = keys(now.actions).filter((k) => !(k in (was.actions || {})));
const goneActions = keys(was.actions).filter((k) => !(k in now.actions));
const refusalDelta = keys(now.refusals)
  .filter((k) => k in (was.refusals || {}) && was.refusals[k] !== now.refusals[k])
  .map((k) => [k, was.refusals[k], now.refusals[k]]);
const rewritten = bodiesWereKept
  ? keys(now.bodies).filter((k) => k in was.bodies && was.bodies[k] !== now.bodies[k])
  : [];
const findingsAdded = findingsWereKept ? keys(now.findings).filter((k) => !(k in was.findings)) : [];
const findingsGone = findingsWereKept ? keys(was.findings).filter((k) => !(k in now.findings)) : [];
const findingsChanged = findingsWereKept
  ? keys(now.findings).filter((k) => k in was.findings && was.findings[k] !== now.findings[k])
  : [];

const L = [];
L.push("# What changed on the ward journey map");
L.push("");
if (first) {
  L.push("First run — there was nothing to compare against. From the next run this file says what moved.");
} else {
  const total =
    addedBoxes.length +
    goneBoxes.length +
    relabelled.length +
    relaned.length +
    addedActions.length +
    goneActions.length +
    refusalDelta.length +
    rewritten.length +
    findingsAdded.length +
    findingsGone.length +
    findingsChanged.length;
  L.push(total ? `**${total} change(s) since the last run.**` : "Nothing changed since the last run.");
  const section = (title, rows) => {
    if (!rows.length) return;
    L.push("", `## ${title} (${rows.length})`, "");
    for (const r of rows) L.push(`- ${r}`);
  };
  section(
    "🔴 Boxes that disappeared",
    goneBoxes.map((k) => `**${was.boxes[k]}** — a route that used to be on the map is not any more.`),
  );
  section(
    "Boxes that appeared",
    addedBoxes.map((k) => `${now.boxes[k]}`),
  );
  section(
    "Boxes that now say something different",
    relabelled.map((k) => `"${was.boxes[k]}" → "${now.boxes[k]}"`),
  );
  section(
    "Boxes that changed meaning",
    relaned.map((k) => `**${now.boxes[k]}** — was drawn as "${was.lanes[k]}", now "${now.lanes[k]}".`),
  );
  section(
    "🔴 Findings the map no longer makes",
    findingsGone.map(
      (k) =>
        `**${was.boxes[k] || now.boxes[k] || k}** — the map used to say: "${was.findings[k]}". It does not say it any more.`,
    ),
  );
  section(
    "Findings the map now makes",
    findingsAdded.map((k) => `**${now.boxes[k] || k}** — ${now.findings[k]}`),
  );
  section(
    "Findings that were reworded",
    findingsChanged.map(
      (k) => `**${now.boxes[k] || k}**\n  - was: "${was.findings[k]}"\n  - now: "${now.findings[k]}"`,
    ),
  );
  section(
    "Boxes that explain themselves differently",
    rewritten.map((k) => `**${now.boxes[k]}**\n  - was: "${was.bodies[k]}"\n  - now: "${now.bodies[k]}"`),
  );
  if (!bodiesWereKept || !findingsWereKept) {
    L.push(
      "",
      "> The previous snapshot predates this report watching body text and findings, so this run can say " +
        "nothing about whether either changed. From the next run it can.",
    );
  }
  section(
    "🔴 Actions the engine no longer has",
    goneActions.map((k) => `${was.actions[k]} (${k})`),
  );
  section(
    "Actions the engine gained",
    addedActions.map((k) => `${now.actions[k]} (${k})`),
  );
  section(
    "Refusals named, by action",
    refusalDelta.map(([k, a, b]) => `${now.actions[k] || k}: ${a} → ${b}`),
  );
}
L.push("");
L.push(`_Written ${new Date().toISOString()} by \`npm run ward:journey\`._`);

fs.writeFileSync(REPORT, L.join("\n") + "\n");
fs.writeFileSync(SNAP, JSON.stringify(now, null, 1));

// The headline goes to the console too, because a file nobody opens reports nothing.
if (first) console.log("WHAT-CHANGED.md started — first run, nothing to compare against");
else {
  const gone = goneBoxes.length + goneActions.length + findingsGone.length;
  const parts = [
    `${addedBoxes.length} box(es) added`,
    `${goneBoxes.length} removed`,
    `${relabelled.length} retitled`,
    `${relaned.length} recoloured`,
    `${rewritten.length} reworded`,
    `${findingsAdded.length + findingsChanged.length} finding(s) added or reworded`,
  ];
  console.log(`changes since the last run: ${parts.join(", ")} — see WHAT-CHANGED.md`);
  // Something vanishing is the case worth raising your voice about: it is the one that looks like
  // nothing at all, because what is gone leaves no mark on the page.
  if (gone)
    console.log(
      `  🔴 ${gone} thing(s) DISAPPEARED. Check that is intended — a removal shows nowhere on the map itself.`,
    );
}
