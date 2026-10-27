// Shared-mode drills on synthetic data: two people saving at once, a busy shift, and failure drills
// (network cut, server crash and restart, database restart, sign-in expiry mid-save).
//
// Real parts: the browser's shared client (ward-shared-client.ts), the backend request handler,
// engine, PostgreSQL store and sign-in check. The only stand-in is Supabase's public-key list (the
// drill signs its own sign-in tokens), so nothing leaves the machine. Loopback database only.
//
//   WARD_TEST_DATABASE_URL=postgres://user:pass@127.0.0.1:5432/db \
//     node scripts/run-tsx.mjs scripts/ward-flow/shared-drills/run.mts [--part=all|two-person|load|drills]
//     [--minutes=5] [--users=50] [--shift-commands=1500] [--db-restart] [--out=results.json]
//
// --db-restart restarts the local PostgreSQL with `pg_ctlcluster 16 main restart`; leave it off
// where that cluster is not this drill's own. Exit code 1 when any check fails.
import { createRequire } from "node:module";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { createServer } from "node:net";
import { once } from "node:events";
import { writeFileSync } from "node:fs";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
  SharedWorkspaceClient,
  type SharedView,
  type WardCommandOutcome,
} from "@/components/ward-management/ward-shared-client";
import { WardAuthError } from "@/components/ward-management/ward-auth-link";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { nextEvent, seededRandom } from "../../../tests/helpers/ward-engine-fuzz";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";

const backend = new URL("../../../backend/ward-flow/", import.meta.url);
const { Pool } = createRequire(new URL("package.json", backend))("pg");
const { migrate } = await import(new URL("migrate.mjs", backend).href);
const { createWorkspaceStore } = await import(new URL("postgres.mjs", backend).href);
const { APPROVED_SUPABASE_URL } = await import(new URL("supabase-config.mjs", backend).href);
const engine = await import(new URL("dist/engine.mjs", backend).href);

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [name, value] = arg.replace(/^--/, "").split("=");
    return [name, value ?? "true"];
  }),
);
const PART = args.part ?? "all";
const MINUTES = Number(args.minutes ?? 5);
const USERS = Number(args.users ?? 50);
const SHIFT_COMMANDS = Number(args["shift-commands"] ?? 1500);
const POLL_MS = 3000;

const databaseUrl = process.env.WARD_TEST_DATABASE_URL ?? "";
if (!databaseUrl || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname))
  throw new Error("Set WARD_TEST_DATABASE_URL to a loopback PostgreSQL reserved for tests");

// ---------------------------------------------------------------- results
type Check = { part: string; name: string; pass: boolean; skipped: boolean; detail: string };
const checks: Check[] = [];
const report: Record<string, unknown> = {};
function check(part: string, name: string, pass: boolean, detail = "") {
  checks.push({ part, name, pass, skipped: false, detail });
  console.log(`${pass ? "PASS" : "FAIL"} [${part}] ${name}${detail ? ` - ${detail}` : ""}`);
}
/** Not run: never counted as passed (AGENTS.md hard rule 11). */
function skip(part: string, name: string, detail: string) {
  checks.push({ part, name, pass: true, skipped: true, detail });
  console.log(`SKIP [${part}] ${name} - ${detail}`);
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
}
function summarise(values: number[]) {
  return {
    count: values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    max: percentile(values, 100),
  };
}

// ---------------------------------------------------------------- sign-in tokens
const key = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = { ...key.publicKey.export({ format: "jwk" }), kid: "drill", alg: "ES256", use: "sig" };
const part64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
function signToken(sub: string, { expiresIn = 3600, signedInSecondsAgo = 0 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const data = `${part64({ alg: "ES256", kid: "drill", typ: "JWT" })}.${part64({
    sub,
    iss: `${APPROVED_SUPABASE_URL}/auth/v1`,
    aud: "authenticated",
    role: "authenticated",
    iat: now - 5 - Math.max(0, -expiresIn),
    exp: now + expiresIn,
    amr: [{ method: "password", timestamp: now - signedInSecondsAgo }],
    session_id: randomUUID(),
  })}`;
  return `${data}.${sign("sha256", Buffer.from(data), { key: key.privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}

// ---------------------------------------------------------------- backend processes
const workspaceId = randomUUID();
const coordinatorIds = Array.from({ length: Math.max(60, USERS + 2) }, () => randomUUID());
async function freePort() {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  server.close();
  return port;
}
type ServerLog = {
  event: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  outcome?: string;
};
const serverLogs: ServerLog[] = [];
class BackendProcess {
  child: ChildProcess | null = null;
  constructor(readonly port: number) {}
  get url() {
    return `http://127.0.0.1:${this.port}`;
  }
  async start() {
    const child = spawn(process.execPath, [fileURLToPath(new URL("serve.mjs", import.meta.url))], {
      env: {
        ...process.env,
        DRILL_DATABASE_URL: databaseUrl,
        DRILL_WORKSPACE_ID: workspaceId,
        DRILL_PORT: String(this.port),
        DRILL_COORDINATORS: coordinatorIds.join(","),
        DRILL_JWK: JSON.stringify(jwk),
      },
      stdio: ["ignore", "pipe", "inherit"],
    });
    this.child = child;
    let buffer = "";
    const listening = new Promise<void>((resolve, reject) => {
      child.once("exit", (code) => reject(new Error(`backend exited early (${code})`)));
      child.stdout!.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        let line: string;
        while (buffer.includes("\n")) {
          [line, buffer] = [buffer.slice(0, buffer.indexOf("\n")), buffer.slice(buffer.indexOf("\n") + 1)];
          try {
            const entry = JSON.parse(line) as ServerLog;
            if (entry.event === "drill_listening") resolve();
            else serverLogs.push(entry);
          } catch {
            // Not a log line.
          }
        }
      });
    });
    await listening;
  }
  /** SIGKILL is a crash: no graceful close, in-flight requests are cut. */
  async stop(signal: NodeJS.Signals = "SIGKILL") {
    const child = this.child;
    if (!child || child.exitCode !== null) return;
    const exited = once(child, "exit");
    child.kill(signal);
    await exited;
    this.child = null;
  }
}

// ---------------------------------------------------------------- people
type Timing = { route: string; status: number; ms: number; at: number };
const timings: Timing[] = [];
const routeOf = (url: string) =>
  url.includes("/commands")
    ? "command"
    : url.includes("since=")
      ? "poll"
      : url.includes("/v1/workspace")
        ? "read"
        : "other";
class Person {
  view: SharedView | undefined;
  network: "up" | "down" | "drop-response" = "up";
  /** Overrides the token source for sign-in drills. */
  tokenSource: (() => Promise<string>) | null = null;
  private jwt = "";
  private jwtExpires = 0;
  private timer: NodeJS.Timeout | null = null;
  // The board read a poll started, so stopping can wait for it (PS-09, H-0957).
  private poll: Promise<unknown> = Promise.resolve();
  private polling = false;
  readonly client: SharedWorkspaceClient;
  constructor(
    readonly name: string,
    readonly actorId: string,
    readonly desk: { role: string; unitId?: string; edId?: string },
    baseUrl: string,
  ) {
    this.client = new SharedWorkspaceClient({
      baseUrl,
      token: () => (this.tokenSource ? this.tokenSource() : Promise.resolve(this.token())),
      changed: (view) => {
        this.view = view;
      },
      fetch: (input, init) => this.fetch(String(input), init),
    });
  }
  /** Like the Supabase client: one token, refreshed shortly before it expires. */
  private token() {
    if (Date.now() > this.jwtExpires - 60_000) {
      this.jwt = signToken(this.actorId);
      this.jwtExpires = Date.now() + 3_600_000;
    }
    return this.jwt;
  }
  private async fetch(url: string, init?: RequestInit) {
    if (this.network === "down") throw new TypeError("fetch failed");
    const started = performance.now();
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      timings.push({ route: routeOf(url), status: 0, ms: performance.now() - started, at: Date.now() });
      throw error;
    }
    timings.push({ route: routeOf(url), status: response.status, ms: performance.now() - started, at: Date.now() });
    if (this.network === "drop-response" && url.includes("/commands")) {
      await response.arrayBuffer();
      throw new TypeError("network lost before the reply arrived");
    }
    return response;
  }
  get state() {
    return this.view?.snapshot?.payload.state;
  }
  get revision() {
    return this.view?.snapshot?.revision ?? 0;
  }
  async ready(timeoutMs = 20_000) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      await this.client.refresh();
      if (this.view?.status === "ready") return true;
      await sleep(250);
    }
    return false;
  }
  startPolling() {
    this.polling = true;
    // The next poll is booked once this read settles, so `poll` is always the read in flight. A
    // refresh asked for mid-read returns at once, and would otherwise stand in for the slow read.
    const tick = () => {
      this.timer = null;
      this.poll = this.client.refresh().finally(() => {
        if (this.polling) this.timer = setTimeout(tick, POLL_MS + Math.random() * 400 - 200);
      });
    };
    this.timer = setTimeout(tick, Math.random() * POLL_MS);
  }
  /**
   * Stops the timer and waits for a read already on its way. A refresh asked for while one is in
   * flight does nothing, so without the wait a desk's last refresh could be a read sent before the
   * shift's final changes landed.
   */
  async stopPolling() {
    this.polling = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.poll.catch(() => undefined);
  }
  dispose() {
    void this.stopPolling();
    this.client.dispose();
  }
}

// ---------------------------------------------------------------- server truth
const db = new Pool({ connectionString: databaseUrl, max: 2 });
db.on("error", () => undefined);
const truthStore = createWorkspaceStore(db, { workspaceId, engine });
async function serverWorld() {
  const snapshot = await truthStore.read(coordinatorIds[0]);
  return { revision: Number(snapshot.revision), world: snapshot.payload };
}
async function auditFor(commandIds: string[]) {
  const { rows } = await db.query(
    "SELECT command_id::text AS id, outcome, count(*)::int AS n FROM ward_flow.audit WHERE workspace_id=$1 AND command_id = ANY($2::uuid[]) GROUP BY 1, 2",
    [workspaceId, commandIds],
  );
  return rows as { id: string; outcome: string; n: number }[];
}
async function receiptsFor(commandIds: string[]) {
  const { rows } = await db.query(
    "SELECT command_id::text AS id, status FROM ward_flow.commands WHERE workspace_id=$1 AND command_id = ANY($2::uuid[])",
    [workspaceId, commandIds],
  );
  return rows as { id: string; status: number }[];
}
async function grant(actorId: string, role: string, scope: object) {
  await db.query(
    "INSERT INTO ward_flow.memberships(id, workspace_id, actor_id, role, scope, granted_by, granted_at, expires_at, last_used_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now(), now() + interval '1 day', now())",
    [workspaceId, actorId, role, JSON.stringify(scope), coordinatorIds[0]],
  );
}

/**
 * The no-silent-loss rule for a set of commands: each person was told accepted or refused (with a
 * reason), or told the save may not have gone through; the audit holds each command exactly once;
 * and what the person was told matches what the server kept.
 */
async function reconcile(outcomes: WardCommandOutcome[]) {
  const ids = outcomes.map((outcome) => outcome.commandId);
  const audit = await auditFor(ids);
  const receipts = await receiptsFor(ids);
  const problems: string[] = [];
  const counts = { accepted: 0, refused: 0, failed: 0, cancelled: 0 };
  for (const outcome of outcomes) {
    counts[outcome.status as keyof typeof counts] += 1;
    const rows = audit.filter((row) => row.id === outcome.commandId);
    const total = rows.reduce((sum, row) => sum + row.n, 0);
    const kept = rows.some((row) => row.outcome === "accepted");
    const receipt = receipts.find((row) => row.id === outcome.commandId);
    if (outcome.status === "accepted") {
      if (!kept || total !== 1) problems.push(`told accepted but audit has ${total} rows (accepted ${kept})`);
      if (receipt?.status !== 200) problems.push(`told accepted but receipt ${receipt?.status}`);
    } else if (outcome.status === "refused") {
      if (kept) problems.push("told refused but the server kept it");
      if (!outcome.message) problems.push("refused with no reason shown");
      if (total > 1) problems.push(`refused command audited ${total} times`);
    } else if (outcome.status === "failed") {
      // Unknown outcome: the person is told it may not have saved and to press Retry. Not a loss.
      if (!outcome.message) problems.push("failed with no message");
      if (total > 1) problems.push(`failed command audited ${total} times`);
    } else if (kept) problems.push(`told ${outcome.status} but the server kept it`);
  }
  return { counts, problems, keptIds: new Set(audit.filter((row) => row.outcome === "accepted").map((row) => row.id)) };
}

// ---------------------------------------------------------------- event sampling
const DEMO_TYPES = new Set(["ADVANCE_CLOCK", "RESET_SCENARIO", "SET_SCENARIO"]);
type World = { state: Parameters<typeof nextEvent>[0] };
function acceptedAlone(world: World, event: WardFlowEvent) {
  try {
    return engine.applyCommand(world, event, new Date()).outcome === "accepted";
  } catch {
    return false;
  }
}
function applyLocal(world: World, event: WardFlowEvent): World {
  return engine.applyCommand(world, event, new Date()).world;
}
function sample(world: World, types: ReadonlySet<string> | null, limit: number, seed: number) {
  const random = seededRandom(seed);
  const found: WardFlowEvent[] = [];
  for (let step = 0; step < 6000 && found.length < limit; step += 1) {
    let event: WardFlowEvent;
    try {
      event = nextEvent(world.state, random, step);
    } catch {
      continue;
    }
    if (event.role === "demo" || DEMO_TYPES.has(event.type) || (types && !types.has(event.type))) continue;
    if (acceptedAlone(world, event)) found.push(event);
  }
  return found;
}
function subjectOf(event: WardFlowEvent) {
  const fields = event as unknown as Record<string, unknown>;
  for (const name of ["movementId", "admissionId", "referralId", "releaseId", "patientId", "unitId"])
    if (typeof fields[name] === "string") return `${name}:${fields[name]}`;
  return `type:${event.type}`;
}

// ---------------------------------------------------------------- part 1: two people at once
const KINDS: [string, string[]][] = [
  ["accept", ["ACCEPT_IN_PRINCIPLE", "ACCEPT_REFERRAL"]],
  ["pull", ["PULL_PATIENT"]],
  ["move", ["BOOK_TRANSPORT", "HANDOVER_READY", "PATIENT_COLLECTED", "PATIENT_ARRIVED", "PLACE_IN_BED"]],
  ["discharge", ["RECORD_LEAVING", "RECORD_PATIENT_DISCHARGE", "RELEASE_BED", "CONFIRM_BED_RELEASE"]],
];
async function race(label: string, a: [Person, WardFlowEvent], b: [Person, WardFlowEvent], expect: "one" | "both") {
  const dropped = timings.filter((timing) => timing.status === 0).length;
  await Promise.all([a[0].client.refresh(), b[0].client.refresh()]);
  // Sampling blocks this process for seconds, so a kept-alive connection the server has since
  // closed can fail the first read. The next 3-second poll would follow; do that here.
  if ([a[0], b[0]].some((person) => person.view?.status !== "ready")) {
    console.log(
      `  (first read failed on a stale connection: ${timings.filter((timing) => timing.status === 0).length - dropped} dropped; read again)`,
    );
    await Promise.all([a[0].client.refresh(), b[0].client.refresh()]);
  }
  const before = (await serverWorld()).revision;
  const states = [a[0], b[0]].map(
    (person) => `${person.view?.status}${person.view?.error ? ` "${person.view.error}"` : ""}`,
  );
  const outcomes = await Promise.all([a[0].client.dispatch(a[1]), b[0].client.dispatch(b[1])]);
  const { counts, problems } = await reconcile(outcomes);
  const after = (await serverWorld()).revision;
  await Promise.all([a[0].client.refresh(), b[0].client.refresh()]);
  const synced = a[0].revision === after && b[0].revision === after;
  const expected = expect === "one" ? counts.accepted === 1 : counts.accepted === 2;
  const told = outcomes.map(
    (outcome) => `${outcome.status}${outcome.status === "accepted" ? "" : ` ("${outcome.message}")`}`,
  );
  check(
    "two-person",
    `${label}: ${a[1].type} vs ${b[1].type}`,
    problems.length === 0 && expected && after - before === counts.accepted && synced,
    `${told.join(" / ")}${outcomes.some((outcome) => outcome.status === "cancelled") ? ` [desks before: ${states.join(" / ")}]` : ""}; revision +${after - before}; both screens on revision ${after}: ${synced}${problems.length ? `; PROBLEMS: ${problems.join("; ")}` : ""}${expected ? "" : `; expected ${expect === "one" ? "exactly one" : "both"} accepted`}`,
  );
}
async function twoPerson(serverA: BackendProcess, serverB: BackendProcess) {
  // Two coordinators on different computers (each on its own backend instance, one database).
  const A = new Person("A", coordinatorIds[0], { role: "coordinator" }, serverA.url);
  const B = new Person("B", coordinatorIds[1], { role: "coordinator" }, serverB.url);
  check("two-person", "both desks load the shared board", (await A.ready()) && (await B.ready()));
  let seed = 1;
  for (const [kind, types] of KINDS) {
    let world = (await serverWorld()).world as World;
    const found = sample(world, new Set(types), 30, seed++);
    if (!found.length) {
      check(
        "two-person",
        `${kind}: found a ${types.join("/")} step to race`,
        false,
        "none accepted on the current board",
      );
      continue;
    }
    // 1. Both press the same button on the same patient.
    await race(`${kind}, same button same patient`, [A, found[0]], [B, found[0]], "one");
    // 2. Conflicting steps on the same patient (the second is invalid once the first lands).
    world = (await serverWorld()).world as World;
    const firsts = sample(world, new Set(types), 30, seed++);
    const all = sample(world, null, 400, seed++);
    let pair: [WardFlowEvent, WardFlowEvent] | null = null;
    for (const first of firsts) {
      const after = applyLocal(world, first);
      const second = all.find(
        (event) =>
          event !== first &&
          subjectOf(event) === subjectOf(first) &&
          event.type !== first.type &&
          !acceptedAlone(after, event),
      );
      if (second) {
        pair = [first, second];
        break;
      }
    }
    if (pair) await race(`${kind}, conflicting steps same patient`, [A, pair[0]], [B, pair[1]], "one");
    else skip("two-person", `${kind}, conflicting steps same patient`, "no conflicting pair on this board");
    // 3. Different patients at the same moment: both must keep.
    world = (await serverWorld()).world as World;
    const pool = sample(world, new Set(types), 30, seed++);
    let different: [WardFlowEvent, WardFlowEvent] | null = null;
    for (const first of pool) {
      const second = pool.find(
        (event) =>
          subjectOf(event) !== subjectOf(first) &&
          acceptedAlone(applyLocal(world, first), event) &&
          acceptedAlone(applyLocal(world, event), first),
      );
      if (second) {
        different = [first, second];
        break;
      }
    }
    if (different) await race(`${kind}, different patients`, [A, different[0]], [B, different[1]], "both");
    else check("two-person", `${kind}: found two independent steps`, false, "no independent pair on this board");
  }
  // 4. The last bed: two coordinators pull different patients into the one remaining bed.
  {
    const world = (await serverWorld()).world as World;
    const pulls = sample(world, new Set(["PULL_PATIENT"]), 60, 99);
    let pair: [WardFlowEvent, WardFlowEvent] | null = null;
    for (const first of pulls) {
      const unit = (first as { unitId: string }).unitId;
      const after = applyLocal(world, first);
      const second = pulls.find(
        (event) =>
          (event as { unitId: string }).unitId === unit &&
          subjectOf(event) !== subjectOf(first) &&
          !acceptedAlone(after, event),
      );
      if (second) {
        pair = [first, second];
        break;
      }
    }
    if (pair) await race("last bed, two different patients", [A, pair[0]], [B, pair[1]], "one");
    else
      skip(
        "two-person",
        "last bed, two different patients",
        "no ward with one bed and two waiting on this board; the backend test 'two accounts competing for the last bed' covers it",
      );
  }
  // 5. Two nurses on one ward, on two computers, both accept the same referral.
  {
    const world = (await serverWorld()).world as World;
    const accept = sample(world, new Set(["ACCEPT_IN_PRINCIPLE"]), 30, 7)
      .map((event) => ({ ...event, role: "ward" }) as WardFlowEvent)
      .find((event) => acceptedAlone(world, event));
    if (accept) {
      const unitId = (accept as { unitId: string }).unitId;
      const [n1, n2] = [randomUUID(), randomUUID()];
      await grant(n1, "ward", { kind: "ward", unitIds: [unitId] });
      await grant(n2, "ward", { kind: "ward", unitIds: [unitId] });
      const N1 = new Person("N1", n1, { role: "ward", unitId }, serverA.url);
      const N2 = new Person("N2", n2, { role: "ward", unitId }, serverB.url);
      const ok = (await N1.ready()) && (await N2.ready());
      check("two-person", "two ward nurses load their ward's board", ok, N1.view?.error ?? N2.view?.error ?? "");
      if (ok) await race("two nurses, one ward, same referral", [N1, accept], [N2, accept], "one");
      N1.dispose();
      N2.dispose();
    } else check("two-person", "found a referral for two nurses to accept", false);
  }
  A.dispose();
  B.dispose();
}

// ---------------------------------------------------------------- part 2: a busy shift
type Load = { people: Person[]; outcomes: WardCommandOutcome[]; stop: () => Promise<void> };
async function startLoad(
  server: BackendProcess,
  users: number,
  commandsPerSecond: number,
  seed: number,
): Promise<Load> {
  const world = (await serverWorld()).world as {
    state: { units: { id: string }[]; movements: { originEdId?: string }[] };
  };
  const edIds = [...new Set(world.state.movements.map((movement) => movement.originEdId).filter(Boolean))] as string[];
  const people: Person[] = [];
  const units = world.state.units.map((unit) => unit.id);
  for (let index = 0; index < users; index += 1) {
    if (index < Math.min(units.length, Math.floor(users * 0.45))) {
      const actor = randomUUID();
      await grant(actor, "ward", { kind: "ward", unitIds: [units[index]] });
      people.push(new Person(`ward-${units[index]}`, actor, { role: "ward", unitId: units[index] }, server.url));
    } else if (index < Math.floor(users * 0.45) + Math.min(edIds.length, Math.floor(users * 0.15))) {
      const actor = randomUUID();
      const edId = edIds[index - Math.floor(users * 0.45)];
      await grant(actor, "ed", { kind: "ed", edId });
      people.push(new Person(`ed-${edId}`, actor, { role: "ed", edId }, server.url));
    } else
      people.push(new Person(`coordinator-${index}`, coordinatorIds[2 + index], { role: "coordinator" }, server.url));
  }
  const loaded = await Promise.all(people.map((person) => person.ready(30_000)));
  check(
    "load",
    `${users} desks load their board`,
    loaded.every(Boolean),
    `${loaded.filter(Boolean).length}/${users} ready`,
  );
  for (const person of people) person.startPolling();
  const outcomes: WardCommandOutcome[] = [];
  const inflight = new Set<Promise<unknown>>();
  const random = seededRandom(seed);
  let step = 0;
  let running = true;
  const sendOne = () => {
    // Coordinators send most changes; wards and EDs send their own steps.
    const person = people[Math.floor(random() * people.length)];
    const state = person.state;
    if (!state || person.view?.status !== "ready") return;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      let event: WardFlowEvent;
      try {
        event = nextEvent(state, random, step++);
      } catch {
        continue;
      }
      if (event.role === "demo" || DEMO_TYPES.has(event.type)) continue;
      if (person.desk.role !== "coordinator") {
        if (!(EVENT_ROLE[event.type] as readonly string[]).includes(person.desk.role)) continue;
        event = { ...event, role: person.desk.role } as WardFlowEvent;
      }
      const promise = person.client.dispatch(event).then((outcome) => outcomes.push(outcome));
      inflight.add(promise);
      void promise.finally(() => inflight.delete(promise));
      return;
    }
  };
  const loop = (async () => {
    while (running) {
      sendOne();
      await sleep((-Math.log(1 - random()) * 1000) / commandsPerSecond);
    }
  })();
  return {
    people,
    outcomes,
    stop: async () => {
      running = false;
      await loop;
      await Promise.allSettled([...inflight]);
      await Promise.all(people.map((person) => person.stopPolling()));
    },
  };
}
async function busyShift(server: BackendProcess) {
  const rate = SHIFT_COMMANDS / (MINUTES * 60);
  const lag = monitorEventLoopDelay({ resolution: 20 });
  lag.enable();
  timings.length = 0;
  serverLogs.length = 0;
  const startRevision = (await serverWorld()).revision;
  const load = await startLoad(server, USERS, rate, 2026);
  await sleep(MINUTES * 60_000);
  await load.stop();
  lag.disable();
  const { counts, problems, keptIds } = await reconcile(load.outcomes);
  const end = await serverWorld();
  // After the shift: the server's world still passes the shared-state check, and every statewide
  // coordinator desk, once refreshed, shows exactly the server's revision and stays. (Ward and ED
  // desks are sent their own place only, so their picture is meant to differ.)
  const endState = (end.world as { state: Record<string, unknown> }).state;
  check(
    "load",
    "the server's world after the shift passes the shared-state check",
    isValidSharedWardFlowState(JSON.parse(JSON.stringify(endState))),
  );
  // A desk that never loaded its board (counted above) has no picture to compare.
  const coordinators = load.people.filter((person) => person.desk.role === "coordinator" && person.state);
  await Promise.all(coordinators.map((person) => person.client.refresh()));
  const stays = (state: unknown) => JSON.stringify((state as { admissions: unknown }).admissions);
  const diverged = coordinators.filter(
    (person) => person.revision !== end.revision || stays(person.state) !== stays(endState),
  );
  check(
    "load",
    "every coordinator desk shows the server's picture after refreshing",
    diverged.length === 0,
    `${diverged.length} of ${coordinators.length} desks differ${
      diverged.length
        ? ` (server on revision ${end.revision}; desks on ${diverged.map((person) => `${person.revision}${person.view?.status === "ready" ? "" : ` ${person.view?.status}`}`).join(", ")})`
        : ""
    }`,
  );
  const refusals: Record<string, number> = {};
  for (const outcome of load.outcomes)
    if (outcome.status !== "accepted") {
      const reason = (outcome.message ?? "").replace(/[0-9]+/g, "#").slice(0, 70);
      refusals[reason] = (refusals[reason] ?? 0) + 1;
    }
  const byRoute = (route: string) => timings.filter((timing) => timing.route === route).map((timing) => timing.ms);
  const serverRoutes = [...new Set(serverLogs.map((entry) => `${entry.route} ${entry.method}`))];
  const serverStatuses: Record<string, number> = {};
  for (const entry of serverLogs) serverStatuses[entry.status ?? 0] = (serverStatuses[entry.status ?? 0] ?? 0) + 1;
  const result = {
    minutes: MINUTES,
    users: USERS,
    shiftCommands: SHIFT_COMMANDS,
    commandsPerSecond: Number(rate.toFixed(2)),
    commandsSent: load.outcomes.length,
    outcomes: counts,
    refusals,
    revisions: end.revision - startRevision,
    clientMs: {
      poll: summarise(byRoute("poll")),
      read: summarise(byRoute("read")),
      command: summarise(byRoute("command")),
    },
    serverMs: Object.fromEntries(
      serverRoutes.map((route) => [
        route,
        summarise(
          serverLogs
            .filter((entry) => `${entry.route} ${entry.method}` === route)
            .map((entry) => entry.durationMs ?? 0),
        ),
      ]),
    ),
    serverStatuses,
    harnessEventLoopLagMs: {
      p50: Math.round(lag.percentile(50) / 1e6),
      p99: Math.round(lag.percentile(99) / 1e6),
      max: Math.round(lag.max / 1e6),
    },
    problems,
  };
  report.load = result;
  console.log(JSON.stringify(result, null, 2));
  const errors5xx = serverLogs.filter((entry) => (entry.status ?? 0) >= 500).length;
  check(
    "load",
    "no change silently lost (every reply matches the audit)",
    problems.length === 0,
    problems.slice(0, 5).join("; "),
  );
  check(
    "load",
    "revisions added equal changes accepted",
    end.revision - startRevision === counts.accepted && keptIds.size === counts.accepted,
    `${end.revision - startRevision} revisions, ${counts.accepted} accepted`,
  );
  // A run where nearly every save is refused would prove nothing about saving.
  check(
    "load",
    "enough saves were kept to test saving (at least 20% of those sent)",
    counts.accepted >= Math.max(50, load.outcomes.length * 0.2),
    `${counts.accepted} of ${load.outcomes.length} kept`,
  );
  check("load", "no server errors (5xx)", errors5xx === 0, `${errors5xx} of ${serverLogs.length} requests`);
  check(
    "load",
    "no save left unconfirmed",
    counts.failed === 0 && counts.cancelled === 0,
    `${counts.failed} failed, ${counts.cancelled} cancelled`,
  );
  const p95 = percentile(byRoute("command"), 95) ?? 0;
  check("load", "95% of saves answer within 2 seconds", p95 <= 2000, `p95 ${p95} ms`);
  const pollP95 = percentile(byRoute("poll"), 95) ?? 0;
  check("load", "95% of board refreshes answer within 1 second", pollP95 <= 1000, `p95 ${pollP95} ms`);
  for (const person of load.people) person.dispose();
}

// ---------------------------------------------------------------- part 3: failure drills
async function oneSave(seed: number) {
  const world = (await serverWorld()).world as World;
  return sample(world, null, 1, seed)[0];
}
async function drills(server: BackendProcess) {
  const P = new Person("drill", coordinatorIds[2], { role: "coordinator" }, server.url);
  check("drills", "drill desk loads", await P.ready());
  // D1. Network cut before the save leaves the computer.
  {
    const event = await oneSave(501);
    P.network = "down";
    const first = await P.client.dispatch(event);
    const shown = P.view?.error ?? "";
    P.network = "up";
    await P.client.retry();
    await sleep(500);
    const { counts, problems, keptIds } = await reconcile([first]);
    check(
      "drills",
      "network cut before sending: told it may not have saved, Retry saves it once",
      first.status === "failed" && keptIds.has(first.commandId) && problems.length === 0,
      `first reply ${first.status}; screen said "${shown}"; after Retry kept: ${keptIds.has(first.commandId)}; ${JSON.stringify(counts)} ${problems.join("; ")}`,
    );
  }
  // D2. Network cut after the server saved but before the reply arrived.
  {
    await P.client.refresh();
    const event = await oneSave(502);
    const before = (await serverWorld()).revision;
    P.network = "drop-response";
    const first = await P.client.dispatch(event);
    const shown = P.view?.error ?? "";
    P.network = "up";
    await P.client.retry();
    await sleep(500);
    const after = (await serverWorld()).revision;
    const audit = await auditFor([first.commandId]);
    const total = audit.reduce((sum, row) => sum + row.n, 0);
    check(
      "drills",
      "reply lost after the save: Retry does not save it twice",
      first.status === "failed" && total === 1 && after - before === 1 && P.view?.status === "ready",
      `first reply ${first.status}; screen said "${shown}"; audit rows ${total}; revision +${after - before}; screen now ${P.view?.status}`,
    );
  }
  // D3. Sign-in token expired mid-save; the refresh gives a fresh one.
  {
    await P.client.refresh();
    const event = await oneSave(503);
    let calls = 0;
    P.tokenSource = async () => (calls++ === 0 ? signToken(P.actorId, { expiresIn: -30 }) : signToken(P.actorId));
    const outcome = await P.client.dispatch(event);
    P.tokenSource = null;
    const audit = await auditFor([outcome.commandId]);
    check(
      "drills",
      "token expired mid-save: fresh token, saved once",
      outcome.status === "accepted" && audit.reduce((sum, row) => sum + row.n, 0) === 1,
      `reply ${outcome.status}; token asked ${calls} times; audit rows ${audit.reduce((sum, row) => sum + row.n, 0)}`,
    );
  }
  // D4. Sign-in ended mid-save (refresh token gone): nothing saved, person told to sign in.
  {
    const Q = new Person("drill-q", coordinatorIds[3], { role: "coordinator" }, server.url);
    await Q.ready();
    const event = await oneSave(504);
    let calls = 0;
    Q.tokenSource = async () => {
      if (calls++ === 0) return signToken(Q.actorId, { expiresIn: -30 });
      throw new WardAuthError("session", "Your sign-in has ended. Sign in again.");
    };
    const outcome = await Q.client.dispatch(event);
    const audit = await auditFor([outcome.commandId]);
    check(
      "drills",
      "sign-in ended mid-save: not saved, person told",
      outcome.status !== "accepted" && audit.length === 0 && Q.view?.status === "not-authorised" && !!outcome.message,
      `reply ${outcome.status} ("${outcome.message}"); screen ${Q.view?.status} "${Q.view?.error}"; audit rows ${audit.length}`,
    );
    Q.dispose();
  }
  // D5. The 12-hour sign-in limit passes mid-shift.
  {
    const R = new Person("drill-r", coordinatorIds[4], { role: "coordinator" }, server.url);
    await R.ready();
    const event = await oneSave(505);
    R.tokenSource = async () => signToken(R.actorId, { signedInSecondsAgo: 13 * 3600 });
    const outcome = await R.client.dispatch(event);
    const audit = await auditFor([outcome.commandId]);
    check(
      "drills",
      "12-hour sign-in limit reached mid-save: not saved, person told",
      outcome.status !== "accepted" && audit.length === 0 && R.view?.status === "not-authorised",
      `reply ${outcome.status} ("${outcome.message}"); screen ${R.view?.status} "${R.view?.error}"; audit rows ${audit.length}`,
    );
    R.dispose();
  }
  P.dispose();

  // D6. Backend crash and restart while 15 desks are busy.
  await restartDrill(server, "backend crash and restart", async () => {
    await server.stop("SIGKILL");
    await sleep(5000);
    await server.start();
  });
  // D7. Database restart while 15 desks are busy.
  if (args["db-restart"] === "true")
    await restartDrill(server, "database restart", async () => {
      execFileSync("pg_ctlcluster", ["16", "main", "restart"], { stdio: "ignore" });
    });
  else skip("drills", "database restart", "pass --db-restart to run it on a drill-only cluster");
}
async function restartDrill(server: BackendProcess, label: string, outage: () => Promise<void>) {
  timings.length = 0;
  const load = await startLoad(server, 15, 3, label.length);
  await sleep(15_000);
  const outageStart = Date.now();
  await outage();
  const outageEnd = Date.now();
  // Everyone keeps polling. How long until every desk is back to ready?
  let recovered = -1;
  for (let waited = 0; waited < 60_000; waited += 500) {
    // A desk whose save was cut holds it for the person to Retry (audit A4-03); that is recovered.
    if (load.people.every((person) => person.view?.status === "ready" || person.view?.error?.includes("Press Retry"))) {
      recovered = Date.now() - outageEnd;
      break;
    }
    await sleep(500);
  }
  // A desk left on "Press Retry" presses it, as a person would.
  const waitingOnRetry = load.people.filter((person) => person.view?.error?.includes("Press Retry")).length;
  // Retry is ignored while that desk is mid-refresh, so press again, as a person would.
  for (let press = 0; press < 3; press += 1) {
    for (const person of load.people) if (person.view?.status === "unavailable") await person.client.retry();
    await sleep(1000);
  }
  await sleep(15_000);
  await load.stop();
  const { counts, problems, keptIds } = await reconcile(load.outcomes);
  const stuck = load.people
    .filter((person) => person.view?.status !== "ready")
    .map((person) => `${person.name}: ${person.view?.status} ${person.view?.error ?? ""}`);
  // Retry may have saved a "failed" one: kept once is fine; the audit check above catches twice.
  const failedKept = load.outcomes.filter(
    (outcome) => outcome.status === "failed" && keptIds.has(outcome.commandId),
  ).length;
  const duringOutage = timings.filter((timing) => timing.at >= outageStart && timing.at <= outageEnd + 10_000);
  check(
    "drills",
    `${label}: no change silently lost or saved twice`,
    problems.length === 0,
    `${JSON.stringify(counts)}; ${failedKept} "may not have saved" changes were in fact saved once (Retry or before the cut); ${problems.slice(0, 3).join("; ")}`,
  );
  check(
    "drills",
    `${label}: every desk back to normal without reloading the page`,
    stuck.length === 0,
    `${waitingOnRetry} desks held a cut save for Retry; recovered in ${recovered < 0 ? "more than 60 s" : `${(recovered / 1000).toFixed(1)} s`} after the outage ended (outage ${(outageEnd - outageStart) / 1000} s); ${duringOutage.filter((timing) => timing.status === 0 || timing.status >= 500).length} requests failed around the outage${stuck.length ? `; stuck: ${stuck.slice(0, 4).join(" | ")}` : ""}`,
  );
  report[label] = { counts, problems, failedKept, recoveredMs: recovered, stuck };
  for (const person of load.people) person.dispose();
}

// ---------------------------------------------------------------- main
const servers: BackendProcess[] = [];
try {
  await migrate(db);
  servers.push(new BackendProcess(await freePort()), new BackendProcess(await freePort()));
  await Promise.all(servers.map((server) => server.start()));
  // The first read creates the synthetic workspace.
  const first = new Person("setup", coordinatorIds[0], { role: "coordinator" }, servers[0].url);
  if (!(await first.ready())) throw new Error(`workspace did not load: ${first.view?.error}`);
  first.dispose();
  if (PART === "all" || PART === "two-person") await twoPerson(servers[0], servers[1]);
  if (PART === "all" || PART === "load") await busyShift(servers[0]);
  if (PART === "all" || PART === "drills") await drills(servers[0]);
} catch (error) {
  check(
    "harness",
    "drill ran to the end",
    false,
    error instanceof Error ? `${error.message}\n${error.stack}` : String(error),
  );
} finally {
  await Promise.all(servers.map((server) => server.stop("SIGTERM")));
  await db.end().catch(() => undefined);
  const failed = checks.filter((entry) => !entry.pass);
  const skipped = checks.filter((entry) => entry.skipped).length;
  report.checks = checks;
  if (args.out) writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n${checks.length - failed.length - skipped} passed, ${failed.length} failed, ${skipped} not run`);
  process.exit(failed.length ? 1 : 0);
}
