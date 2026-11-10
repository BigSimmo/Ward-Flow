#!/usr/bin/env node
// M69 (master audit list, 10 Nov 2026): shift-change load. LOCAL ONLY, synthetic only.
// Starts the real store and HTTP handler (the `--serve` half of backend-memory-load.mjs) against a
// loopback PostgreSQL, then runs the D-111 peak: N desks polling the board the way the browser does
// (every 3 s with `since`), a few desks saving at the same time, and one "Wi-Fi came back" moment where
// every desk reads the whole board in the same second (the browser's `online` handler). It records
// read and save response times and errors, and checks that no confirmed save is lost: the board's
// revision rises by exactly the number of first-time accepted saves, and a resent command replays.
//
//   WARD_TEST_DATABASE_URL=postgresql://...@127.0.0.1:55432/db node scripts/ward-flow/shift-change-load.mjs
//     [--desks 100] [--savers 10] [--seconds 120] [--save-every 10] [--mib 1.5] [--out path.json]
//
// The database URL must be loopback (it is migrated and written to). Never point it at a hosted database.
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ORIGIN = "http://127.0.0.1";
const POLL_MS = 3000;
const server = fileURLToPath(new URL("./backend-memory-load.mjs", import.meta.url));

const { values } = parseArgs({
  options: {
    desks: { type: "string", default: "100" },
    savers: { type: "string", default: "10" },
    seconds: { type: "string", default: "120" },
    "save-every": { type: "string", default: "10" },
    mib: { type: "string", default: "1.5" },
    out: { type: "string" },
  },
});
const url = process.env.WARD_TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Set WARD_TEST_DATABASE_URL to a loopback PostgreSQL reserved for synthetic data");
const desks = Number(values.desks);
const savers = Math.min(Number(values.savers), desks);
const seconds = Number(values.seconds);
const saveEveryMs = Number(values["save-every"]) * 1000;

const percentile = (list, p) => {
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
};
const summary = (list) => ({
  n: list.length,
  p50: percentile(list, 50),
  p95: percentile(list, 95),
  p99: percentile(list, 99),
  max: percentile(list, 100),
});
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const child = fork(server, ["--serve"], {
  env: { ...process.env, WARD_MEMORY_LOAD: JSON.stringify({ desks, bytes: Number(values.mib) * 1048576 }) },
});
const [first] = await once(child, "message");
const base = `http://127.0.0.1:${first.port}`;
const auth = (index) => ({ authorization: `Bearer desk-${index}`, "accept-encoding": "gzip" });

async function read(index, since, context) {
  const started = performance.now();
  const query = since ? `?since=${since}${context ? `&context=${context}` : ""}` : "";
  const reply = await fetch(`${base}/v1/workspace${query}`, { headers: auth(index) });
  const text = await reply.text();
  const ms = performance.now() - started;
  if (!reply.ok) throw Object.assign(new Error(`read ${reply.status}`), { ms });
  const value = JSON.parse(text);
  return {
    ms,
    notModified: Boolean(value.notModified),
    revision: value.snapshot?.revision ?? value.revision,
    context: value.snapshot?.accessContext ?? null,
  };
}

async function send(index, commandId, expectedRevision, unitId) {
  const started = performance.now();
  const reply = await fetch(`${base}/v1/workspace/commands`, {
    method: "POST",
    headers: { ...auth(index), "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify({
      classification: "synthetic",
      commandId,
      expectedRevision,
      reply: "revision",
      event: { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId },
    }),
  });
  const body = await reply.json().catch(() => ({}));
  return { ms: performance.now() - started, status: reply.status, body };
}

const stats = {
  polls: [],
  fullReads: [],
  storm: [],
  saves: [],
  readErrors: 0,
  saveErrors: 0,
  conflicts: 0,
  accepted: 0,
  replays: 0,
  replayMismatches: 0,
  lastError: null,
};
const start = await read(0);
const startRevision = start.revision;
const units = ["rph-adult-secure"];
const until = Date.now() + seconds * 1000;
const stormAt = Date.now() + (seconds * 1000) / 2;

async function poller(index) {
  await pause((index * POLL_MS) / desks);
  let revision = null;
  let context = null;
  let fullAt = 0;
  let stormed = false;
  while (Date.now() < until) {
    try {
      // Halfway through, every desk does what the browser's `online` handler does: read at once.
      if (!stormed && Date.now() >= stormAt) {
        stormed = true;
        const result = await read(index);
        stats.storm.push(result.ms);
        ({ revision, context } = result);
        fullAt = Date.now();
      } else {
        // As the browser does: `since` every 3 s, and a whole read at least once a minute.
        const result = await read(index, revision, Date.now() - fullAt < 60_000 ? context : null);
        (result.notModified ? stats.polls : stats.fullReads).push(result.ms);
        if (!result.notModified) {
          ({ revision, context } = result);
          fullAt = Date.now();
        }
      }
    } catch (error) {
      stats.readErrors += 1;
      stats.lastError = String(error);
    }
    await pause(POLL_MS);
  }
}

async function saver(index) {
  await pause(Math.random() * saveEveryMs);
  let count = 0;
  while (Date.now() < until) {
    const commandId = randomUUID();
    let revision = (await read(index).catch(() => ({ revision: null }))).revision;
    for (let attempt = 0; revision && attempt < 6; attempt++) {
      const result = await send(index, commandId, revision, units[count % units.length]).catch((error) => ({
        ms: 0,
        status: 0,
        body: { error: String(error) },
      }));
      stats.saves.push(result.ms);
      if (result.status === 200) {
        stats.accepted += 1;
        // Every third save simulates a lost reply: the same command is resent and must replay.
        if (count % 3 === 0) {
          const again = await send(index, commandId, revision, units[count % units.length]);
          if (again.status === 200 && again.body.replayed) stats.replays += 1;
          else stats.replayMismatches += 1;
        }
        break;
      }
      if (result.status === 409) {
        stats.conflicts += 1;
        revision = (await read(index)).revision;
        continue;
      }
      stats.saveErrors += 1;
      stats.lastError = `save ${result.status} ${JSON.stringify(result.body).slice(0, 120)}`;
      // Retain the command identity and back off with a spread, as the browser does.
      await pause(500 * 2 ** attempt * (0.75 + Math.random() / 2));
    }
    count += 1;
    await pause(saveEveryMs * (0.75 + Math.random() / 2));
  }
}

const wall = performance.now();
await Promise.all([
  ...Array.from({ length: desks }, (_, index) => poller(index)),
  ...Array.from({ length: savers }, (_, index) => saver(index)),
]);
const elapsed = (performance.now() - wall) / 1000;
const endRevision = (await read(0)).revision;
child.send("stop");
await once(child, "exit");

const reads = stats.polls.length + stats.fullReads.length + stats.storm.length;
const report = {
  at: new Date().toISOString(),
  desks,
  savers,
  seconds: Math.round(elapsed),
  boardTargetMiB: Number(values.mib),
  readsPerSecond: Math.round((reads / elapsed) * 10) / 10,
  pollMs: summary(stats.polls),
  fullReadMs: summary(stats.fullReads),
  reconnectStormMs: summary(stats.storm),
  saveMs: summary(stats.saves),
  readErrors: stats.readErrors,
  saveErrors: stats.saveErrors,
  conflictsRetried: stats.conflicts,
  acceptedSaves: stats.accepted,
  revisionRise: endRevision - startRevision,
  noSaveLost: endRevision - startRevision === stats.accepted,
  lostReplyResends: stats.replays,
  replayMismatches: stats.replayMismatches,
  lastError: stats.lastError,
};
console.log(JSON.stringify(report, null, 2));
if (values.out) writeFileSync(values.out, `${JSON.stringify(report, null, 2)}\n`);
process.exitCode = report.noSaveLost && !report.replayMismatches && !report.readErrors ? 0 : 1;
