// @ts-check
// Compound drill 2 (master audit list, 10 Nov 2026), server half: shift-change load (D-111 item 6:
// 7:00, 15:00 and 21:30 Perth, 100 concurrent synthetic users) plus one service outage plus a
// mass reconnect, against a real local backend and PostgreSQL with a fault proxy in front.
//
// The proxy stands in for the network path to the hosted backend: "up" passes connections through,
// "down" drops every connection (the outage). Each synthetic user reads, saves, keeps the save's
// identity through the outage, and resends it when the proxy comes back, all at once.
//
// What must hold: no server fault (5xx other than a stated "busy"), every accepted save has exactly
// one receipt, the board's revision moves once per accepted save, and the world stays valid.
// Timings are printed as diagnostics only: this machine is not the hosted service, so they are not
// a speed target. A hosted run needs Josh's yes and a spending estimate first.
//
// 07:00 Perth runs by default; WARD_DRILL_ALL_SHIFTS=1 adds 15:00 and 21:30. Synthetic data only.
import assert from "node:assert/strict";
import { once } from "node:events";
import net from "node:net";
import { test } from "node:test";
import { drillDatabaseUrl, drillFixture } from "./ward-audit-drill.test-support.mjs";

const USERS = 100;
const SHIFTS = [
  ["07:00", "2026-11-10T23:00:00Z"],
  ["15:00", "2026-11-11T07:00:00Z"],
  ["21:30", "2026-11-11T13:30:00Z"],
].slice(0, process.env.WARD_DRILL_ALL_SHIFTS === "1" ? 3 : 1);

/** A TCP fault proxy: "up" pipes to the backend, "down" drops every connection, open ones too. */
async function faultProxy(targetPort) {
  let mode = "up";
  const open = new Set();
  const server = net.createServer((socket) => {
    if (mode === "down") return socket.destroy();
    const upstream = net.connect(targetPort, "127.0.0.1");
    open.add(socket).add(upstream);
    const drop = () => {
      open.delete(socket);
      open.delete(upstream);
      socket.destroy();
      upstream.destroy();
    };
    socket.on("error", drop).on("close", drop);
    upstream.on("error", drop).on("close", drop);
    socket.pipe(upstream).pipe(socket);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    base: `http://127.0.0.1:${address.port}`,
    down() {
      mode = "down";
      for (const socket of open) socket.destroy();
      open.clear();
    },
    up() {
      mode = "up";
    },
    close: () => new Promise((resolve) => server.close(() => resolve(undefined))),
  };
}

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0;
};

for (const [shift, instant] of SHIFTS)
  test(
    `real PostgreSQL HTTP: ${shift} Perth shift change, ${USERS} users, an outage and a mass reconnect`,
    { skip: !drillDatabaseUrl, timeout: 240_000 },
    async (t) => {
      const f = await drillFixture(t, { actors: USERS, at: new Date(instant) });
      const backend = await f.startBackend();
      const proxy = await faultProxy(backend.port);
      t.after(() => proxy.close());
      const statuses = new Map();
      const durations = [];
      const accepted = new Set();
      const reasons = new Map();
      const note = (status) => statuses.set(status, (statuses.get(status) ?? 0) + 1);

      /** One request through the proxy; a dropped connection is status 0. */
      async function call(actor, body) {
        const started = performance.now();
        try {
          const answer = await f.request(proxy.base, actor, body, { timeoutMs: 20_000 });
          durations.push(performance.now() - started);
          note(answer.status);
          if (answer.status >= 500) {
            const reason = String(answer.body?.error ?? "no reason");
            reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
          }
          return answer;
        } catch {
          note(0);
          return { status: 0, body: null };
        }
      }

      /**
       * One person's save, as the app makes it: the same identity until the server answers; a
       * conflict (409) means they look again and enter it afresh under a new identity.
       */
      async function save(actor, unitId, held, { attempts = 8 } = {}) {
        let command = held.command;
        for (let attempt = 0; attempt < attempts; attempt++) {
          const answer = await call(actor, command);
          if (answer.status === 200) {
            accepted.add(command.commandId);
            return "accepted";
          }
          if (answer.status === 409 || answer.status === 422) {
            const read = await call(actor);
            if (read.status !== 200) continue;
            command = f.command({ type: "REQUEST_CAPACITY_REFRESH", unitId }, read.body.snapshot.revision);
            continue;
          }
          // Busy, dropped or unavailable: wait a little and resend the same identity.
          await new Promise((resolve) => setTimeout(resolve, 100 + Math.floor(Math.random() * 400)));
        }
        return "unsettled";
      }

      // Shift change: every user opens the board at once, then each saves once.
      const boot = await Promise.all(f.actors.map((actor) => call(actor)));
      assert.ok(
        boot.every((answer) => answer.status === 200),
        "every user's first read succeeds",
      );
      const units = boot[0].body.snapshot.payload.state.units.map((unit) => unit.id);
      const firstRevision = boot[0].body.snapshot.revision;
      const loadStarted = performance.now();
      const firstSaves = await Promise.all(
        f.actors.map((actor, index) => {
          const unitId = units[index % units.length];
          return save(actor, unitId, {
            command: f.command({ type: "REQUEST_CAPACITY_REFRESH", unitId }, boot[index].body.snapshot.revision),
          });
        }),
      );
      const loadMs = performance.now() - loadStarted;
      assert.ok(
        firstSaves.every((result) => result === "accepted"),
        "every shift-change save settles",
      );

      // The outage: each user's next save fails to reach the server and is held with its identity.
      proxy.down();
      const held = await Promise.all(
        f.actors.map(async (actor, index) => {
          const unitId = units[(index + 7) % units.length];
          const read = boot[index].body.snapshot.revision;
          const command = f.command({ type: "REQUEST_CAPACITY_REFRESH", unitId }, read);
          const answer = await call(actor, command);
          assert.equal(answer.status, 0, "the proxy is down");
          return { actor, unitId, command };
        }),
      );

      // The mass reconnect: the proxy comes back and every user resends at the same moment.
      proxy.up();
      const reconnectStarted = performance.now();
      const reconnect = await Promise.all(held.map(({ actor, unitId, command }) => save(actor, unitId, { command })));
      const reconnectMs = performance.now() - reconnectStarted;
      assert.ok(
        reconnect.every((result) => result === "accepted"),
        "every held save settles after the reconnect",
      );

      // No server fault: only success, conflict, a stated busy answer, or the outage's dropped calls.
      for (const status of statuses.keys())
        assert.ok([0, 200, 409, 422, 429, 503].includes(status), `unexpected status ${status}`);
      assert.ok(!statuses.has(500), "no internal server error");

      // Exactly once: one receipt per accepted save, and the revision moved once for each.
      const receipts = await f.receipts();
      for (const id of accepted) assert.equal(receipts.filter((row) => row.id === id && row.status === 200).length, 1);
      const final = (await f.request(backend.base, f.actors[0])).body.snapshot;
      assert.equal(final.revision, firstRevision + accepted.size, "one revision per accepted save");
      assert.ok(f.engine.validWorld(final.payload));
      const live = await fetch(`${backend.base}/healthz`);
      assert.equal(live.status, 200, "the backend process is still serving after the burst");

      t.diagnostic(
        `drill 2 ${shift} Perth: ${USERS} users; shift-change saves ${Math.round(loadMs)} ms, ` +
          `reconnect ${Math.round(reconnectMs)} ms; request p50 ${Math.round(percentile(durations, 50))} ms, ` +
          `p95 ${Math.round(percentile(durations, 95))} ms, max ${Math.round(Math.max(...durations))} ms; ` +
          `statuses ${JSON.stringify(Object.fromEntries([...statuses].sort()))}; accepted ${accepted.size}; ` +
          `server-busy answers ${JSON.stringify(Object.fromEntries(reasons))}`,
      );
    },
  );
