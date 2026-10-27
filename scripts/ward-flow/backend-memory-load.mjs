#!/usr/bin/env node
// H-0646: backend memory with many desks reading a large shared board. LOCAL ONLY, synthetic only.
// Runs the real store and HTTP handler against a loopback PostgreSQL in a child process, grows the
// seeded board with made-up "ZZ-TEST" history to a target size, then has N desks poll it the way the
// browser does (every 3 s with `since`, a full read once a minute) and samples the child's RSS and heap.
//
//   WARD_TEST_DATABASE_URL=postgresql://...@127.0.0.1:55432/db node scripts/ward-flow/backend-memory-load.mjs
//     [--desks 50] [--minutes 10] [--mib 6] [--csv path]
//
// The database URL must be loopback (it is migrated and written to). Never point it at a hosted database.
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { once } from "node:events";
import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const backend = new URL("../../backend/ward-flow/", import.meta.url);
const ORIGIN = "http://127.0.0.1";
const POLL_MS = 3000;
const FULL_READ_EVERY_MS = 60_000;
const SAMPLE_MS = 2000;

function loopbackUrl() {
  const url = process.env.WARD_TEST_DATABASE_URL;
  if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
    throw new Error("Set WARD_TEST_DATABASE_URL to a loopback PostgreSQL reserved for synthetic data");
  return url;
}

/** Adds made-up departed stays and their people until the board is about `bytes` long. */
function grow(world, bytes) {
  const state = world.state;
  const template = state.admissions.find((admission) => admission.state === "departed");
  const person = state.patients[0];
  let size = JSON.stringify(world).length;
  for (let n = 1; size < bytes; n++) {
    const id = `ZZ-TEST-${n}`;
    const patient = {
      ...person,
      id: `PT-${id}`,
      umrn: `ZZ${String(n).padStart(6, "0")}`,
      givenName: "ZZ-TEST",
      familyName: String(n),
      preferredName: "ZZ-TEST",
    };
    const admission = { ...template, id: `AD-${id}`, patientId: patient.id, referralId: null };
    state.patients.push(patient);
    state.admissions.push(admission);
    size += JSON.stringify(patient).length + JSON.stringify(admission).length + 2;
  }
  return world;
}

async function serve() {
  // `pg` is the backend's own dependency (backend/ward-flow/node_modules).
  const { Pool } = createRequire(new URL("package.json", backend))("pg");
  const [engine, { migrate }, { createWorkspaceStore }, { createHandler, listen }] = await Promise.all([
    import(new URL("dist/engine.mjs", backend).href),
    import(new URL("migrate.mjs", backend).href),
    import(new URL("postgres.mjs", backend).href),
    import(new URL("server.mjs", backend).href),
  ]);
  const { desks, bytes } = JSON.parse(process.env.WARD_MEMORY_LOAD ?? "{}");
  const pool = new Pool({ connectionString: loopbackUrl(), max: 4 });
  await migrate(pool);
  const workspaceId = randomUUID();
  const big = { ...engine, seedWorld: (at) => grow(engine.seedWorld(at), bytes) };
  const store = createWorkspaceStore(pool, { workspaceId, engine: big });
  const actors = Array.from({ length: desks }, () => randomUUID());
  const sessions = actors.map(() => randomUUID());
  const config = { coordinatorIds: actors, origin: ORIGIN, workspaceId, dataMode: "prototype", push: null };
  // Local stand-in for sign-in: each desk is a fresh session, so the 12-hour limit never trips.
  const signedInAt = Date.now();
  /** @param {string | null} header @param {{ session?: { signedInAt?: number, startedAt?: number, sessionId?: string } }} [context] */
  const authenticate = async (header, { session } = {}) => {
    const index = Number(/^Bearer desk-(\d+)$/.exec(header ?? "")?.[1]);
    if (!Number.isInteger(index) || !actors[index]) throw new Error("Unauthorized");
    if (session) {
      session.signedInAt = session.startedAt = signedInAt;
      session.sessionId = sessions[index];
    }
    return actors[index];
  };
  // Only refused or failed requests are logged (closed metadata fields, no board content).
  const logRefusal = (event) => event.status >= 400 && console.error(JSON.stringify(event));
  const server = listen(createHandler({ config, authenticate, sharedStore: store, log: logRefusal }), {
    port: 0,
    host: "127.0.0.1",
    trustedProxyAddresses: [],
  });
  await once(server, "listening");
  const port = /** @type {import("node:net").AddressInfo} */ (server.address()).port;
  const timer = setInterval(() => {
    const { rss, heapUsed, heapTotal, external, arrayBuffers } = process.memoryUsage();
    process.send?.({ memory: { at: Date.now(), rss, heapUsed, heapTotal, external, arrayBuffers } });
  }, SAMPLE_MS);
  process.send?.({ port });
  process.on("message", async (message) => {
    if (message !== "stop") return;
    clearInterval(timer);
    server.close();
    await pool.end();
    process.exit(0);
  });
}

async function desk(index, base, until, stats) {
  let revision = null;
  let context = null;
  let fullAt = 0;
  while (Date.now() < until) {
    const started = performance.now();
    const query =
      revision === null
        ? ""
        : `?since=${revision}${context && Date.now() - fullAt < FULL_READ_EVERY_MS ? `&context=${context}` : ""}`;
    try {
      const reply = await fetch(`${base}/v1/workspace${query}`, {
        headers: { authorization: `Bearer desk-${index}`, "accept-encoding": "gzip" },
      });
      const text = await reply.text();
      const ms = performance.now() - started;
      if (!reply.ok) {
        stats.errors += 1;
        stats.lastError = `${reply.status} ${text.slice(0, 160)}`;
      } else {
        const value = JSON.parse(text);
        if (value.notModified) stats.polls.push(ms);
        else {
          stats.fulls.push(ms);
          stats.fullBytes = text.length;
          revision = value.snapshot?.revision ?? value.revision;
          context = value.snapshot?.accessContext ?? null;
          fullAt = Date.now();
        }
      }
    } catch (error) {
      stats.errors += 1;
      stats.lastError = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
};
const mib = (value) => Math.round((value / 1048576) * 10) / 10;

async function drive() {
  const { values } = parseArgs({
    options: {
      desks: { type: "string", default: "50" },
      minutes: { type: "string", default: "10" },
      mib: { type: "string", default: "6" },
      csv: { type: "string" },
    },
  });
  loopbackUrl();
  const desks = Number(values.desks);
  const bytes = Number(values.mib) * 1048576;
  const child = fork(fileURLToPath(import.meta.url), ["--serve"], {
    env: { ...process.env, WARD_MEMORY_LOAD: JSON.stringify({ desks, bytes }) },
    execArgv: ["--expose-gc"],
  });
  const samples = [];
  const [first] = await once(child, "message");
  const base = `http://127.0.0.1:${first.port}`;
  child.on("message", (message) => message.memory && samples.push(message.memory));
  const idle = await new Promise((resolve) => child.once("message", (message) => resolve(message.memory)));
  const started = Date.now();
  const until = started + Number(values.minutes) * 60_000;
  const stats = {
    polls: [],
    fulls: [],
    errors: 0,
    fullBytes: 0,
    lastError: /** @type {string | undefined} */ (undefined),
  };
  await Promise.all(
    Array.from({ length: desks }, async (_, index) => {
      await new Promise((resolve) => setTimeout(resolve, (index * POLL_MS) / desks));
      return desk(index, base, until, stats);
    }),
  );
  const seconds = (Date.now() - started) / 1000;
  child.send("stop");
  await once(child, "exit");
  const loaded = samples.filter((sample) => sample.at >= started);
  const tail = loaded.slice(Math.floor(loaded.length / 2));
  const peak = (field) => mib(Math.max(...loaded.map((sample) => sample[field])));
  const steady = (field) => mib(tail.reduce((sum, sample) => sum + sample[field], 0) / tail.length);
  if (values.csv)
    writeFileSync(
      values.csv,
      ["secondsFromStart,rssMiB,heapUsedMiB,heapTotalMiB,externalMiB"]
        .concat(
          samples.map((sample) =>
            [
              Math.round((sample.at - started) / 1000),
              mib(sample.rss),
              mib(sample.heapUsed),
              mib(sample.heapTotal),
              mib(sample.external),
            ].join(","),
          ),
        )
        .join("\n") + "\n",
    );
  console.log(
    JSON.stringify(
      {
        desks,
        seconds: Math.round(seconds),
        boardTargetMiB: Number(values.mib),
        fullReplyMiB: mib(stats.fullBytes),
        idleRssMiB: mib(idle.rss),
        idleHeapUsedMiB: mib(idle.heapUsed),
        peakRssMiB: peak("rss"),
        steadyRssMiB: steady("rss"),
        peakHeapUsedMiB: peak("heapUsed"),
        steadyHeapUsedMiB: steady("heapUsed"),
        peakExternalMiB: peak("external"),
        requestsPerSecond: Math.round(((stats.polls.length + stats.fulls.length) / seconds) * 10) / 10,
        polls: stats.polls.length,
        fullReads: stats.fulls.length,
        errors: stats.errors,
        lastError: stats.lastError ?? null,
        pollMs: {
          p50: percentile(stats.polls, 50),
          p95: percentile(stats.polls, 95),
          p99: percentile(stats.polls, 99),
        },
        fullReadMs: {
          p50: percentile(stats.fulls, 50),
          p95: percentile(stats.fulls, 95),
          max: percentile(stats.fulls, 100),
        },
        samples: loaded.length,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await (process.argv.includes("--serve") ? serve() : drive());
