// @ts-check
// M89: randomised testing beyond one screen. Two clients, each on its own server process sharing
// one real PostgreSQL workspace, queue waiting saves while "offline" and then reconnect in a random
// order, resending some saves as a dropped reply would. Synthetic seed data only; no provider.
//
// Invariants, checked after every seeded run:
//   1. every reply is 200 (applied), 409 (stale) or 422 (refused); nothing else;
//   2. a resent applied or refused save (same command id, same request) replays its first answer
//      and changes nothing (a stale save is not resent; the client sends it again under a new id);
//   3. the workspace revision rises by exactly one per applied save, never for a refusal or replay;
//   4. both servers end on the same revision and the same board.
// A failing run names its seed and the steps it took. Re-run one seed with
// WARD_FUZZ_SEED=<n> npm --prefix backend/ward-flow test.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");

const SEEDS = process.env.WARD_FUZZ_SEED ? [Number(process.env.WARD_FUZZ_SEED)] : [11, 2026, 90210];
const SAVES_PER_CLIENT = 6;

/** Small deterministic generator (mulberry32), the same family the engine fuzz uses. */
/** @param {number} seed */
function seeded(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, /** @param {any[]} items */ pick: (items) => items[Math.floor(next() * items.length)] };
}

/** @param {ReturnType<typeof seeded>} random @param {any} world */
function waitingSave(random, world) {
  const units = world.state.units.map((/** @type {any} */ unit) => unit.id);
  const admissions = world.state.admissions.filter((/** @type {any} */ a) => a.state === "occupied").slice(0, 4);
  const roll = random.next();
  /** @type {Record<string, unknown>} */
  let event;
  if (roll < 0.45) event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId: random.pick(units) };
  else if (roll < 0.9) {
    const admission = random.pick(admissions);
    event = {
      type: "SET_STEP_DOWN_CANDIDATE",
      role: "coordinator",
      admissionId: admission.id,
      stepDownCandidate: random.next() < 0.5,
    };
  } else {
    // A save the engine must refuse: the stay does not exist.
    event = {
      type: "SET_STEP_DOWN_CANDIDATE",
      role: "coordinator",
      admissionId: "AD-NOT-IN-SEED",
      stepDownCandidate: true,
    };
  }
  return { id: randomUUID(), event };
}

test(
  "real PostgreSQL: two clients' waiting saves reconnect in random order without lost, doubled or diverging saves",
  { skip: !url, timeout: 120_000 },
  async () => {
    const engine = await import("./dist/engine.mjs");
    for (const seed of SEEDS) {
      const raw = new Pool({ connectionString: url, max: 4 });
      const workspaceId = randomUUID();
      let at = new Date("2026-11-04T02:42:00Z");
      const clock = () => at;
      const servers = [
        createWorkspaceStore(raw, { workspaceId, engine, clock }),
        createWorkspaceStore(raw, { workspaceId, engine, clock }),
      ];
      const actor = randomUUID();
      /** @type {string[]} */
      const steps = [];
      try {
        await migrate(raw);
        const random = seeded(seed);
        const first = await servers[0].read(actor);
        const start = first.revision;
        // Both clients go offline at the same revision and queue their saves.
        const queues = [0, 1].map(() =>
          Array.from({ length: SAVES_PER_CLIENT }, () => ({ ...waitingSave(random, first.payload), base: start })),
        );
        /** @type {any[]} */
        const sent = [];
        let applied = 0;
        while (queues.some((queue) => queue.length > 0)) {
          const client = queues[0].length === 0 ? 1 : queues[1].length === 0 ? 0 : random.next() < 0.5 ? 0 : 1;
          const save = /** @type {any} */ (queues[client].shift());
          at = new Date(at.getTime() + 60_000);
          const reply = /** @type {any} */ (await servers[client].command(actor, save.id, save.base, save.event));
          steps.push(`client ${client} ${save.event.type} base ${save.base} -> ${reply.status}`);
          assert.ok([200, 409, 422].includes(reply.status), `unexpected status ${reply.status}`);
          if (reply.status === 200 && !reply.body?.replayed) applied += 1;
          sent.push({ client, save, status: reply.status });
          if (reply.status === 409) {
            // A stale save is resent once on the new revision, as the client does after a reload.
            const fresh = await servers[client].read(actor);
            queues[client].unshift({ id: randomUUID(), event: save.event, base: fresh.revision });
          }
          // A dropped reply: the same save is sent again, sometimes through the other server.
          if (reply.status !== 409 && random.next() < 0.3) {
            const again = random.next() < 0.5 ? client : 1 - client;
            const before = (await servers[again].read(actor)).revision;
            const replay = /** @type {any} */ (await servers[again].command(actor, save.id, save.base, save.event));
            steps.push(`  resend via ${again} -> ${replay.status}${replay.body?.replayed ? " (replayed)" : ""}`);
            assert.equal(replay.status, reply.status, "a resent save answers as it did the first time");
            assert.equal((await servers[again].read(actor)).revision, before, "a resent save changes nothing");
          }
        }
        const ends = [await servers[0].read(actor), await servers[1].read(actor)];
        assert.equal(ends[0].revision, start + applied, "revision rises by one per applied save");
        assert.equal(ends[1].revision, ends[0].revision, "both servers end on the same revision");
        assert.deepEqual(ends[1].payload.state, ends[0].payload.state, "both servers end on the same board");
        assert.ok(sent.length >= SAVES_PER_CLIENT * 2);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`M89 two-client save fuzz failed for seed ${seed}: ${detail}\n${steps.join("\n")}`, {
          cause: error,
        });
      } finally {
        await raw.end();
      }
    }
  },
);
