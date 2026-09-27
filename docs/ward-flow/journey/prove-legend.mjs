/* Two probes. A colour with no sentence, and a lane on the map the legend never names. Both must
   make the build refuse, and name the offender.

   🔴 AND A PROBE MUST NOT BE ABLE TO LEAVE ITS OWN DAMAGE BEHIND — fixed 2026-09-22 after it did.
   This used to read `stages.json` off disk, inject a `mystery` lane, and afterwards write that
   snapshot back. If an earlier run had crashed between the injection and the restore, the file on
   disk ALREADY held `mystery` — so the snapshot taken as "the good copy" was the damaged one, and
   the restore faithfully put the damage back. The proof then failed on contamination it had
   preserved itself, every run, for ever. A generated artefact is never its own restore point.

   Two changes close it. The probe REFUSES TO START if the file already carries either marker,
   rather than quietly adopting a broken file as its baseline. And it restores by REGENERATING from
   `rebuild-map.mjs`, which is the authored source the map is built from — the only copy that
   cannot have been damaged by a previous probe. */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { restore, writeStubbornly } from "./probe-io.mjs";
const T = "explorer-template.html",
  S = "stages.json";
const tpl = fs.readFileSync(T, "utf8");

const MARKERS = ["mystery", '"probe"'];
{
  const onDisk = fs.readFileSync(S, "utf8");
  const found = MARKERS.filter((m) => onDisk.includes(m));
  if (found.length) {
    console.error(
      `REFUSING TO PROVE — ${S} already contains ${found.join(" and ")}, which only this probe writes.\n` +
        "  A previous run was interrupted after injecting and before restoring, so the map on disk is\n" +
        "  damaged. Do NOT let this probe adopt it as a baseline — run `npm run ward:journey` to\n" +
        "  regenerate the map from rebuild-map.mjs, then prove again.",
    );
    process.exit(1);
  }
}
/* The authored source, not the generated file, is what a restore goes back to. */
const regenerate = () => {
  /* The rebuild itself writes stages.json, so it meets the same transient lock the probes do. If it
     is not retried, a lock here leaves the injected lane on disk — the exact damage this rewrite
     exists to prevent, reintroduced at the last step. */
  for (let i = 1; i <= 12; i++) {
    try {
      return execFileSync("node", ["rebuild-map.mjs"], { encoding: "utf8", stdio: "pipe" });
    } catch (e) {
      if (i === 12) {
        console.error(
          "\n🔴 COULD NOT REGENERATE stages.json — the probe's lane may still be on disk.\n" +
            "   Run `npm run ward:journey` before trusting the map.\n",
        );
        process.exit(1);
      }
      const until = Date.now() + 150;
      while (Date.now() < until) {}
    }
  }
};
const run = () => {
  try {
    execFileSync("node", ["build-explorer.mjs"], { encoding: "utf8" });
    return "";
  } catch (e) {
    return (e.stderr || "") + (e.stdout || "");
  }
};
let pass = 0;

/* probe 1 — a filter colour with no sentence saying what it means.
   Injected after the opening bracket, not after a particular row: pinning a row's exact spacing
   made this probe stop injecting the moment the repository's formatter reindented the file, and a
   probe that injects nothing reports "not proven" for the wrong reason. */
const OPEN = "const LANES = [";
if (!tpl.includes(OPEN)) throw new Error("probe 1 could not find the lane table to inject into");
const injected = tpl.replace(
  OPEN,
  `${OPEN}\n  { id: "probe", label: "Probe", colour: "var(--warn)", covers: ["diversion"] },`,
);
if (injected === tpl) throw new Error("probe 1 injected nothing, so it would prove nothing");
writeStubbornly(T, injected);
const a = run();
restore(T, tpl);
if (a.includes("no sentence saying what they mean") && a.includes("probe")) {
  pass++;
  console.log("PROVEN 1: a colour with no meaning is refused, and named.");
} else console.log("NOT PROVEN 1:\n" + a);

/* probe 2 — a lane on a box that the legend never names */
const j = JSON.parse(fs.readFileSync(S, "utf8"));
j.nodes[0].lane = "mystery";
writeStubbornly(S, JSON.stringify(j, null, 1));
const b = run();
regenerate();
if (b.includes("the legend never names") && b.includes("mystery")) {
  pass++;
  console.log("PROVEN 2: a lane the legend never names is refused, and named.");
} else console.log("NOT PROVEN 2:\n" + b);

execFileSync("node", ["build-explorer.mjs"], { encoding: "utf8" });
process.exit(pass === 2 ? 0 : 1);
