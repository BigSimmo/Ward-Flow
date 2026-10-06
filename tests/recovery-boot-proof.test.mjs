import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  bootProofContract,
  createBootBaseline,
  validateBootBoundary,
  readScopeReview,
} from "../scripts/recovery-boot-proof.mjs";
import { inspectRecovery, applyRecovery, snapshot, rollbackRecovery } from "../scripts/recover-heavy-run.mjs";
import { testRunLockInternals } from "../scripts/test-run-lock.mjs";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const run = "25756bb1-d14d-4c8b-a43b-4a3ba08ba455";
const childId = "c891104f-6581-460e-b537-4ab747972cd8";
const ownerTask = "01a0fd62-8d8e-71fa-b982-b0f71175f0e5";
const reviewerTask = "01a10a53-63f7-74bd-9756-c9bf8c57100f";
const clone = (value) => JSON.parse(JSON.stringify(value));
const write = (file, value) => writeFileSync(file, JSON.stringify(value));
function event(recordId, provider, providerId, id, version, createdAt, data = {}) {
  const value = {
    channel: "System",
    computer: "synthetic-host",
    recordId,
    provider,
    providerId,
    id,
    version,
    createdAt,
    data,
  };
  const xml = `<synthetic-event>${JSON.stringify(value)}</synthetic-event>`;
  return { ...value, xml, sha256: hash(xml) };
}
function fixture() {
  const base = mkdtempSync(path.join(os.tmpdir(), "ward-boot-proof-test-"));
  const repositoryIdentity = path.join(base, "repository", ".git");
  const lockPath = path.join(base, `${hash(path.resolve(repositoryIdentity).toLowerCase()).slice(0, 20)}.lock`);
  const lease = path.join(lockPath, "leases", `${run}.lock`);
  mkdirSync(path.join(lease, "children"), { recursive: true });
  mkdirSync(path.join(lockPath, "queue"));
  write(path.join(lockPath, "coordinator.json"), { version: 1, sharedLeaseLimit: 2 });
  const owner = {
    pid: 11,
    token: run,
    mode: "exclusive",
    command: "synthetic local-only tests",
    worktree: base,
    repositoryIdentity,
    requestedAt: "2026-10-05T03:06:20.514Z",
    startedAt: "2026-10-05T03:06:20.519Z",
  };
  write(path.join(lease, "owner.json"), owner);
  write(path.join(lockPath, "owner.json"), {
    ...owner,
    pid: process.platform === "win32" ? 4 : 1,
    holderPid: 11,
    coordinator: true,
  });
  write(path.join(lease, "children", `${childId}.json`), {
    token: run,
    guardianPid: 12,
    childPid: 13,
    startedAt: "2026-10-05T03:06:20.608Z",
    state: "running",
  });
  const before = {
    version: 1,
    platform: "win32",
    observedAt: "2026-10-05T10:00:00.000Z",
    lastBootUpTime: "2026-10-04T11:44:11.500Z",
    host: { hardwareUuid: "11111111-1111-4111-8111-111111111111", name: "synthetic-host" },
    bootCounter: 3,
    oldestRecordId: 1,
    headRecordId: 100,
    events: [event(100, "Synthetic", "11111111-1111-4111-8111-111111111111", 1, 0, "2026-10-05T09:59:00.000Z")],
  };
  const baseline = createBootBaseline({
    repositoryIdentity,
    run,
    ownerTask,
    snapshot: snapshot(lockPath),
    observation: before,
    targetTimes: [owner.startedAt, "2026-10-05T03:06:20.608Z"],
  });
  const current = {
    ...clone(before),
    observedAt: "2026-10-05T11:00:00.000Z",
    lastBootUpTime: "2026-10-05T10:30:00.000Z",
    bootCounter: 4,
    headRecordId: 104,
    events: [
      ...clone(before.events),
      event(101, "User32", "b0aa8734-56f7-41cc-b2f4-de228e98b946", 1074, 0, "2026-10-05T10:29:00.000Z", {
        param5: "restart",
      }),
      event(
        102,
        "Microsoft-Windows-Kernel-General",
        "a68ca8b7-004f-d7b6-a698-07e2de0f1f5d",
        12,
        0,
        "2026-10-05T10:30:01.000Z",
        { StartTime: "2026-10-05T10:30:00.000Z" },
      ),
      event(
        103,
        "Microsoft-Windows-Kernel-Boot",
        "15ca44ff-4d7a-4baa-bba5-0998955e531e",
        27,
        1,
        "2026-10-05T10:30:01.001Z",
        { BootType: "0" },
      ),
      event(
        104,
        "Microsoft-Windows-Kernel-Boot",
        "15ca44ff-4d7a-4baa-bba5-0998955e531e",
        20,
        1,
        "2026-10-05T10:30:01.002Z",
        { LastShutdownGood: "true", LastBootGood: "true", LastBootId: "4" },
      ),
    ],
  };
  const kinds = [
    "original-launch-log",
    "original-source-snapshot",
    "persistence-review",
    "restore-review",
    "runner-review",
  ];
  const artifacts = kinds.map((kind, index) => {
    const name = `evidence-${index}.txt`;
    const bytes = Buffer.from(`SYNTHETIC ${kind}; no real evidence or authority`);
    writeFileSync(path.join(base, name), bytes);
    return {
      name,
      kind,
      sha256: hash(bytes),
      ...(kind === "original-source-snapshot" ? { sourceCommit: "a".repeat(40) } : {}),
    };
  });
  const receipt = {
    version: 1,
    contract: bootProofContract,
    baselineSha256: baseline.baselineSha256,
    repositoryIdentity: baseline.repositoryIdentity,
    run,
    ticket: null,
    kernelBootEventSha256: current.events[2].sha256,
    ownerTask,
    reviewerTask,
    reviewedAt: "2026-10-05T10:59:00.000Z",
    reviewedHeadRecordId: 104,
    reviewedHeadSha256: current.events[4].sha256,
    assessments: [
      { subject: "historical-local-work-only", conclusion: "verified", artifacts: artifacts.slice(0, 2) },
      ...[
        ["no-persistent-continuation", 2],
        ["no-restore-or-reactivation", 3],
        ["participating-runner-compatibility", 4],
      ].map(([subject, index]) => ({ subject, conclusion: "verified", artifacts: [artifacts[index]] })),
    ],
  };
  const scopeFile = path.join(base, "scope.json");
  write(scopeFile, receipt);
  const scopeExpect = hash(readFileSync(scopeFile));
  const context = {
    baseline,
    baselineExpect: baseline.baselineSha256,
    scope: readScopeReview(scopeFile, scopeExpect),
    scopeExpect,
    current,
  };
  const options = { lockPath, repositoryIdentity, run, processes: [], bootContext: context };
  return { base, lockPath, lease, context, options, scopeFile, plan: () => inspectRecovery(options) };
}
function validate(f) {
  return validateBootBoundary({
    ...f.context,
    repositoryIdentity: f.options.repositoryIdentity,
    run,
    ticket: null,
    targetTimes: ["2026-10-05T03:06:20.519Z", "2026-10-05T03:06:20.608Z"],
    targetSnapshot: snapshot(f.lockPath).filter(
      (e) => e.file === `leases/${run}.lock` || e.file.startsWith(`leases/${run}.lock/`),
    ),
  });
}
test("positive synthetic boot proof retains original legacy bytes and yields interrupted recovery only", () => {
  const f = fixture();
  const before = snapshot(f.lockPath);
  assert.equal(validate(f).kind, bootProofContract);
  const plan = f.plan();
  assert.equal(plan.eligible, true, JSON.stringify(plan.blockers));
  const backupRoot = path.join(f.base, "audit");
  applyRecovery({
    plan,
    expect: plan.planHash,
    lockPath: f.lockPath,
    backupRoot,
    processProbe: () => [],
    bootProofProbe: () => f.context,
  });
  assert.deepEqual(JSON.parse(readFileSync(path.join(backupRoot, "original-manifest.json"))).plan.snapshot, before);
  const terminal = JSON.parse(readFileSync(path.join(backupRoot, "terminal", `${childId}.json`)));
  assert.equal(terminal.outcome, "interrupted");
  assert.equal(terminal.childResult.status, null);
  rollbackRecovery({ lockPath: f.lockPath, journalPath: path.join(backupRoot, "journal.json") });
  assert.deepEqual(snapshot(f.lockPath), before);
});
for (const [label, change] of [
  [
    "LastBootUpTime alone",
    (f) => {
      f.context.current.events = clone(f.context.baseline.before.events);
      f.context.current.headRecordId = 100;
    },
  ],
  [
    "same kernel counter",
    (f) => {
      f.context.current.bootCounter = 3;
    },
  ],
  [
    "other host",
    (f) => {
      f.context.current.host.name = "other-host";
    },
  ],
  [
    "fast startup",
    (f) => {
      f.context.current.events[3].data.BootType = "1";
    },
  ],
  [
    "hibernation",
    (f) => {
      f.context.current.events[3].data.BootType = "2";
    },
  ],
  [
    "unknown provider GUID",
    (f) => {
      f.context.current.events[3].providerId = reviewerTask;
    },
  ],
  [
    "unknown event version",
    (f) => {
      f.context.current.events[3].version = 99;
    },
  ],
  [
    "shutdown request",
    (f) => {
      f.context.current.events[1].data.param5 = "shutdown";
    },
  ],
  [
    "failed shutdown",
    (f) => {
      f.context.current.events[4].data.LastShutdownGood = "false";
    },
  ],
  [
    "counter disagrees",
    (f) => {
      f.context.current.events[4].data.LastBootId = "7";
    },
  ],
  [
    "missing anchor",
    (f) => {
      f.context.current.events.shift();
    },
  ],
  [
    "retention lost anchor",
    (f) => {
      f.context.current.oldestRecordId = 101;
    },
  ],
  [
    "event gap",
    (f) => {
      f.context.current.events.splice(1, 1);
    },
  ],
  [
    "duplicate event",
    (f) => {
      f.context.current.events[1].recordId = 100;
    },
  ],
  [
    "CIM disagrees",
    (f) => {
      f.context.current.lastBootUpTime = "2026-10-05T10:25:00.000Z";
    },
  ],
  [
    "boot before baseline",
    (f) => {
      f.context.current.lastBootUpTime = "2026-10-05T09:00:00.000Z";
    },
  ],
  [
    "timezone ambiguity",
    (f) => {
      f.context.current.observedAt = "2026-10-05T11:00:00";
    },
  ],
  [
    "unknown scope",
    (f) => {
      f.context.scope = undefined;
    },
  ],
  [
    "scope hash race",
    (f) => {
      f.context.scopeExpect = "b".repeat(64);
    },
  ],
  [
    "baseline hash race",
    (f) => {
      f.context.baseline.ownerTask = reviewerTask;
    },
  ],
])
  test(`boot proof refuses ${label}`, () => {
    const f = fixture();
    change(f);
    assert.throws(() => validate(f));
    assert.equal(f.plan().eligible, false);
    assert.equal(existsSync(path.join(f.lockPath, "gate.lock")), false);
  });
for (const subject of [
  "historical-local-work-only",
  "no-persistent-continuation",
  "no-restore-or-reactivation",
  "participating-runner-compatibility",
])
  test(`unverified ${subject} refuses even with valid cold boot`, () => {
    const f = fixture();
    const receipt = f.context.scope.receipt;
    receipt.assessments.find((a) => a.subject === subject).conclusion = "unknown";
    write(f.scopeFile, receipt);
    f.context.scopeExpect = hash(readFileSync(f.scopeFile));
    f.context.scope = readScopeReview(f.scopeFile, f.context.scopeExpect);
    assert.throws(() => validate(f), /unknown locality/u);
  });
test("current source alone is insufficient historical launch provenance", () => {
  const f = fixture();
  const receipt = f.context.scope.receipt;
  receipt.assessments[0].artifacts[0].kind = "current-source";
  write(f.scopeFile, receipt);
  f.context.scopeExpect = hash(readFileSync(f.scopeFile));
  f.context.scope = readScopeReview(f.scopeFile, f.context.scopeExpect);
  assert.throws(() => validate(f), /historical launch provenance/u);
});
test("scope companion artifact changed bytes refuses", () => {
  const f = fixture();
  writeFileSync(path.join(f.base, "evidence-0.txt"), "changed");
  assert.throws(() => readScopeReview(f.scopeFile, f.context.scopeExpect), /changed scope artifact/u);
});
test("new target bytes after baseline refuse", () => {
  const f = fixture();
  writeFileSync(path.join(f.lease, "owner.json"), "{}");
  assert.throws(() => validate(f), /target bytes changed/u);
});
test("postboot unrelated lease is preserved and fresh CAS includes it", () => {
  const f = fixture();
  const peer = "11111111-1111-4111-8111-111111111111";
  const peerLease = path.join(f.lockPath, "leases", `${peer}.lock`);
  mkdirSync(peerLease);
  const old = JSON.parse(readFileSync(path.join(f.lease, "owner.json")));
  write(path.join(peerLease, "owner.json"), { ...old, pid: 99, token: peer, startedAt: "2026-10-05T10:45:00.000Z" });
  const bytes = readFileSync(path.join(peerLease, "owner.json"));
  const plan = f.plan();
  assert.equal(plan.eligible, true);
  applyRecovery({
    plan,
    expect: plan.planHash,
    lockPath: f.lockPath,
    backupRoot: path.join(f.base, "audit"),
    processProbe: () => [],
    bootProofProbe: () => f.context,
  });
  assert.deepEqual(readFileSync(path.join(peerLease, "owner.json")), bytes);
});
test("boot recovery cannot apply without fresh evidence probe", () => {
  const f = fixture();
  const plan = f.plan();
  assert.throws(
    () =>
      applyRecovery({
        plan,
        expect: plan.planHash,
        lockPath: f.lockPath,
        backupRoot: path.join(f.base, "audit"),
        processProbe: () => [],
      }),
    /Fresh boot/u,
  );
  assert.equal(existsSync(path.join(f.lockPath, "gate.lock")), false);
});
test("scope evidence race under exclusion retains barrier without moving lease", () => {
  const f = fixture();
  const plan = f.plan();
  const changed = clone(f.context);
  changed.scopeExpect = "f".repeat(64);
  assert.throws(
    () =>
      applyRecovery({
        plan,
        expect: plan.planHash,
        lockPath: f.lockPath,
        backupRoot: path.join(f.base, "audit"),
        processProbe: () => [],
        bootProofProbe: () => changed,
      }),
    /State or process evidence/u,
  );
  assert.ok(existsSync(f.lease));
  assert.equal(
    testRunLockInternals.ownerDirectoryIsStale(path.join(f.lockPath, "gate.lock"), () => false),
    false,
  );
});
test("scope companion is reread before mutation and immutable backup survives second-probe race", () => {
  const f = fixture();
  const plan = f.plan();
  const backupRoot = path.join(f.base, "audit");
  let calls = 0;
  assert.throws(
    () =>
      applyRecovery({
        plan,
        expect: plan.planHash,
        lockPath: f.lockPath,
        backupRoot,
        processProbe: () => [],
        bootProofProbe: () => {
          calls++;
          if (calls === 2) writeFileSync(path.join(f.base, "evidence-0.txt"), "race");
          return { ...f.context, scope: readScopeReview(f.scopeFile, f.context.scopeExpect) };
        },
      }),
    /changed scope artifact/u,
  );
  assert.equal(calls, 2);
  assert.ok(existsSync(f.lease));
  const manifest = JSON.parse(readFileSync(path.join(backupRoot, "original-manifest.json")));
  assert.deepEqual(manifest.plan.bootContext.scope, plan.bootContext.scope);
  assert.equal(
    testRunLockInternals.ownerDirectoryIsStale(path.join(f.lockPath, "gate.lock"), () => false),
    false,
  );
});
test("boot recovery interruption after lease move retains original bytes and non-reclaimable barrier", () => {
  const f = fixture();
  const before = snapshot(f.lockPath);
  const plan = f.plan();
  const backupRoot = path.join(f.base, "audit");
  assert.throws(
    () =>
      applyRecovery({
        plan,
        expect: plan.planHash,
        lockPath: f.lockPath,
        backupRoot,
        processProbe: () => [],
        bootProofProbe: () => f.context,
        fault: (stage) => {
          if (stage === `after-move:leases/${run}.lock`) throw new Error("synthetic interruption");
        },
      }),
    /synthetic interruption/u,
  );
  assert.deepEqual(JSON.parse(readFileSync(path.join(backupRoot, "original-manifest.json"))).plan.snapshot, before);
  assert.ok(existsSync(path.join(backupRoot, `${run}.lock`)));
  assert.equal(existsSync(path.join(backupRoot, "journal.json")), false);
  assert.equal(
    testRunLockInternals.ownerDirectoryIsStale(path.join(f.lockPath, "gate.lock"), () => false),
    false,
  );
});
test("preboot live identity is contradictory evidence; postboot PID reuse is preserved", () => {
  const f = fixture();
  f.options.processes = [{ pid: 12, createdAt: "2026-10-05T10:20:00.000Z" }];
  assert.equal(f.plan().eligible, false);
  f.options.processes = [{ pid: 12, createdAt: "2026-10-05T10:45:00.000Z" }];
  assert.equal(f.plan().eligible, true);
});
test("postboot peer tickets retain exact bytes and order, and later ticket blocks rollback", () => {
  const f = fixture();
  const owner = JSON.parse(readFileSync(path.join(f.lease, "owner.json")));
  const tickets = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
  for (const [index, token] of tickets.entries())
    write(path.join(f.lockPath, "queue", `${token}.json`), {
      ...owner,
      pid: 99 + index,
      token,
      requestedAt: `2026-10-05T10:4${index}:00.000Z`,
    });
  const before = snapshot(f.lockPath).filter((e) => e.file.startsWith("queue/"));
  const plan = f.plan();
  assert.equal(plan.eligible, true);
  const backupRoot = path.join(f.base, "audit");
  applyRecovery({
    plan,
    expect: plan.planHash,
    lockPath: f.lockPath,
    backupRoot,
    processProbe: () => [],
    bootProofProbe: () => f.context,
  });
  assert.deepEqual(
    snapshot(f.lockPath).filter((e) => e.file.startsWith("queue/")),
    before,
  );
  write(path.join(f.lockPath, "queue", `${tickets[0]}.json`), {
    ...owner,
    pid: 200,
    token: tickets[0],
    requestedAt: "2026-10-05T11:01:00.000Z",
  });
  assert.throws(
    () => rollbackRecovery({ lockPath: f.lockPath, journalPath: path.join(backupRoot, "journal.json") }),
    /Later coordinator changes/u,
  );
});
for (const [provider, id] of [
  ["Microsoft-Windows-Kernel-General", 1],
  ["Microsoft-Windows-Kernel-Power", 42],
  ["Microsoft-Windows-Kernel-Power", 107],
  ["Microsoft-Windows-Power-Troubleshooter", 1],
  ["Microsoft-Windows-Eventlog", 104],
])
  test(`transition ${provider}/${id} blocks cold-boot recovery`, () => {
    const f = fixture();
    f.context.current.events.push(event(105, provider, reviewerTask, id, 0, "2026-10-05T10:35:00.000Z"));
    f.context.current.headRecordId = 105;
    assert.throws(() => validate(f), /clock change, resume, sleep or cleared log/u);
  });
test("truncated event collection fails closed", () => {
  const f = fixture();
  for (let id = 105; id <= 8292; id++)
    f.context.current.events.push(event(id, "Synthetic", reviewerTask, 1, 0, "2026-10-05T10:35:00.000Z"));
  f.context.current.headRecordId = 8292;
  assert.throws(() => validate(f), /capped event/u);
});

test("both fresh boot observations survive harmless head changes and bind immutable transaction evidence", () => {
  const f = fixture();
  const plan = f.plan();
  const second = clone(f.context);
  second.current.observedAt = "2026-10-05T11:00:05.000Z";
  second.current.headRecordId = 105;
  second.current.events.push(event(105, "Synthetic", reviewerTask, 1, 0, "2026-10-05T11:00:01.000Z"));
  const backupRoot = path.join(f.base, "audit");
  let calls = 0;
  applyRecovery({
    plan,
    expect: plan.planHash,
    lockPath: f.lockPath,
    backupRoot,
    processProbe: () => [],
    bootProofProbe: () => (++calls === 1 ? f.context : second),
  });
  const evidenceBytes = readFileSync(path.join(backupRoot, "boot-evidence.json"));
  const evidence = JSON.parse(evidenceBytes);
  const manifestBytes = readFileSync(path.join(backupRoot, "original-manifest.json"));
  const journal = JSON.parse(readFileSync(path.join(backupRoot, "journal.json")));
  assert.equal(journal.bootEvidenceSha256, hash(evidenceBytes));
  assert.equal(evidence.manifestHash, hash(manifestBytes));
  assert.equal(evidence.planHash, plan.planHash);
  assert.deepEqual(JSON.parse(manifestBytes).firstBootObservation, evidence.observations[0]);
  for (const [index, context] of [f.context, second].entries()) {
    const bytes = readFileSync(path.join(backupRoot, `boot-observation-${index + 1}.json`));
    assert.equal(bytes.toString(), `${JSON.stringify(context.current, null, 2)}\n`);
    assert.equal(evidence.observations[index].sha256, hash(bytes));
  }
  writeFileSync(path.join(backupRoot, "boot-observation-2.json"), "tampered");
  assert.throws(
    () => rollbackRecovery({ lockPath: f.lockPath, journalPath: path.join(backupRoot, "journal.json") }),
    /Boot observation backup changed/u,
  );
  assert.equal(existsSync(f.lease), false);
});

for (const stage of [
  "boot-observation-written:boot-observation-1.json",
  "boot-observation-written:boot-observation-2.json",
  "boot-evidence-written",
  "progress-published:0001.json",
])
  test(`interruption at ${stage} retains target bytes and durable exclusion`, () => {
    const f = fixture();
    const before = snapshot(f.lockPath);
    const plan = f.plan();
    const backupRoot = path.join(f.base, "audit");
    assert.throws(
      () =>
        applyRecovery({
          plan,
          expect: plan.planHash,
          lockPath: f.lockPath,
          backupRoot,
          processProbe: () => [],
          bootProofProbe: () => f.context,
          fault: (point) => {
            if (point === stage) throw new Error("synthetic publication interruption");
          },
        }),
      /synthetic publication interruption/u,
    );
    assert.deepEqual(snapshot(f.lockPath), before);
    assert.equal(existsSync(path.join(backupRoot, "journal.json")), false);
    assert.equal(
      testRunLockInternals.ownerDirectoryIsStale(path.join(f.lockPath, "gate.lock"), () => false),
      false,
    );
  });

test("boot observation tampering before the first move retains exclusion without touching targets", () => {
  const f = fixture();
  const before = snapshot(f.lockPath);
  const plan = f.plan();
  const backupRoot = path.join(f.base, "audit");
  assert.throws(
    () =>
      applyRecovery({
        plan,
        expect: plan.planHash,
        lockPath: f.lockPath,
        backupRoot,
        processProbe: () => [],
        bootProofProbe: () => f.context,
        fault: (point) => {
          if (point.startsWith("before-move:")) writeFileSync(path.join(backupRoot, "boot-observation-1.json"), "race");
        },
      }),
    /Boot observation backup changed/u,
  );
  assert.deepEqual(snapshot(f.lockPath), before);
  assert.equal(
    testRunLockInternals.ownerDirectoryIsStale(path.join(f.lockPath, "gate.lock"), () => false),
    false,
  );
});
