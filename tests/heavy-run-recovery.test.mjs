import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  inspectRecovery,
  applyRecovery,
  rollbackRecovery,
  snapshot,
  windowsJobAttestation,
} from "../scripts/recover-heavy-run.mjs";
import { testRunLockInternals } from "../scripts/test-run-lock.mjs";
import { registeredWorkIsActive, runOwnedChild } from "../scripts/owned-child.mjs";

const run = "25756bb1-d14d-4c8b-a43b-4a3ba08ba455";
const ticket = "8fc16566-4554-45ce-bbcd-20b0c483e3a0";
const peer = "11111111-1111-4111-8111-111111111111";
const start = "2026-10-05T03:06:20.608Z";
const adapter = Buffer.from("synthetic Windows job contract");
const adapterSha256 = createHash("sha256").update(adapter).digest("hex");
const write = (file, data) => writeFileSync(file, JSON.stringify(data));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
for (const mode of ["release", "cancel", "deadline"]) {
  test(
    `native acknowledgement sharing conflict ${mode} preserves suspended-launch safety`,
    { skip: process.platform !== "win32", timeout: 35000 },
    async () => {
      const base = mkdtempSync(path.join(os.tmpdir(), "ward-native-sharing-test-"));
      const acknowledgeFile = path.join(base, "ack");
      const ready = path.join(base, "held");
      const release = path.join(base, "release");
      const marker = path.join(base, "executed");
      const receipt = path.join(base, "terminal.json");
      const launchReceipt = path.join(base, "launch.json");
      const cancelFile = path.join(base, "cancel");
      writeFileSync(acknowledgeFile, run);
      const holderScript = `$ErrorActionPreference='Stop'; $p=[Console]::In.ReadLine() | ConvertFrom-Json; $s=[IO.File]::Open($p.ack,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None); try { [IO.File]::WriteAllText($p.ready,'held'); $deadline=[DateTime]::UtcNow.AddSeconds(30); while (!(Test-Path -LiteralPath $p.release) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 20 } } finally { $s.Dispose() }`;
      const psArgs = (bytes) => [
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(bytes, "utf16le").toString("base64"),
      ];
      const holder = spawn("powershell.exe", psArgs(holderScript), {
        cwd: base,
        windowsHide: true,
        stdio: ["pipe", "ignore", "pipe"],
      });
      const waitExit = (child) =>
        new Promise((resolve, reject) => {
          child.once("error", reject);
          child.once("close", (status) => resolve(status));
        });
      const holderExit = waitExit(holder);
      holder.stdin.end(`${JSON.stringify({ ack: acknowledgeFile, ready, release })}\n`);
      const waitFile = async (file) => {
        const deadline = Date.now() + 8000;
        while (!existsSync(file) && Date.now() < deadline) await pause(20);
        assert.ok(existsSync(file), `Missing own fixture file ${file}`);
      };
      try {
        await waitFile(ready);
        const bytes = readFileSync(new URL("../scripts/owned-child-windows.ps1", import.meta.url));
        const adapterProcess = spawn("powershell.exe", psArgs(bytes.toString("utf8")), {
          cwd: base,
          windowsHide: true,
          stdio: ["pipe", "ignore", "pipe"],
        });
        const adapterExit = waitExit(adapterProcess);
        adapterProcess.stdin.end(
          `${JSON.stringify({ command: process.execPath, args: ["-e", `require('node:fs').writeFileSync(${JSON.stringify(marker)},'executed');process.exit(7)`], cwd: base, verbatim: false, survivorTimeout: 5000, receipt, cancelFile, cancelToken: run, launchReceipt, acknowledgeFile, launchToken: run, adapterHash: createHash("sha256").update(bytes).digest("hex"), guardianPid: process.pid })}\n`,
        );
        await waitFile(launchReceipt);
        await pause(150);
        assert.equal(existsSync(marker), false, "Root must remain suspended while acknowledgement is locked");
        if (mode === "release") writeFileSync(release, "release");
        if (mode === "cancel") writeFileSync(cancelFile, run);
        assert.equal(await adapterExit, mode === "release" ? 7 : 126);
        const proof = JSON.parse(readFileSync(receipt, "utf8").replace(/^\uFEFF/u, ""));
        assert.equal(proof.completed, mode === "release");
        assert.equal(existsSync(marker), mode === "release");
        if (mode !== "release")
          assert.match(proof.error, mode === "cancel" ? /cancelled before acknowledgement/u : /did not acknowledge/u);
      } finally {
        if (!existsSync(release)) writeFileSync(release, "release");
        assert.equal(await holderExit, 0);
      }
    },
  );
}
for (const mode of ["cancel-with-ack", "guardian-no-ack"]) {
  test(
    `native handshake ${mode} never executes the suspended root`,
    { skip: process.platform !== "win32", timeout: 25000 },
    () => {
      const base = mkdtempSync(path.join(os.tmpdir(), "ward-native-handshake-test-"));
      const bytes = readFileSync(new URL("../scripts/owned-child-windows.ps1", import.meta.url));
      const marker = path.join(base, "must-not-run");
      const receipt = path.join(base, "terminal.json");
      const launchReceipt = path.join(base, "launch.json");
      const acknowledgeFile = path.join(base, "ack");
      const cancelFile = path.join(base, "cancel");
      if (mode === "cancel-with-ack") {
        writeFileSync(acknowledgeFile, run);
        writeFileSync(cancelFile, run);
      }
      const payload = {
        command: process.execPath,
        args: ["-e", `require('node:fs').writeFileSync(${JSON.stringify(marker)},'bad')`],
        cwd: base,
        verbatim: false,
        survivorTimeout: 5000,
        receipt,
        cancelFile,
        cancelToken: run,
        launchReceipt,
        acknowledgeFile,
        launchToken: run,
        adapterHash: createHash("sha256").update(bytes).digest("hex"),
        guardianPid: process.pid,
      };
      const result = spawnSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          Buffer.from(bytes.toString("utf8"), "utf16le").toString("base64"),
        ],
        { cwd: base, input: JSON.stringify(payload) + "\n", encoding: "utf8", timeout: 20000, windowsHide: true },
      );
      assert.equal(result.status, 126, result.stderr);
      assert.equal(existsSync(marker), false);
      assert.equal(existsSync(`${launchReceipt}.tmp`), false);
      assert.equal(JSON.parse(readFileSync(launchReceipt, "utf8")).assigned, true);
      const proof = JSON.parse(readFileSync(receipt, "utf8").replace(/^\uFEFF/u, ""));
      assert.equal(proof.completed, false);
      assert.match(
        proof.error,
        mode === "cancel-with-ack" ? /cancelled before acknowledgement/u : /did not acknowledge/u,
      );
    },
  );
}
test(
  "Windows command creation failure records proven no-process completion without attestation",
  { skip: process.platform !== "win32", timeout: 25000 },
  async () => {
    const f = fixture();
    const result = await runOwnedChild(path.join(f.base, "nonexistent-command.exe"), [], {
      cwd: f.base,
      env: { ...process.env, CLINICAL_KB_HEAVY_LOCK_TOKEN: run, CLINICAL_KB_HEAVY_LOCK_PATH: f.lease },
      stdio: "ignore",
    });
    assert.equal(result.status, 126, JSON.stringify(result));
    const records = readdirSync(path.join(f.lease, "children"))
      .filter((n) => n.endsWith(".json"))
      .map((n) => JSON.parse(readFileSync(path.join(f.lease, "children", n), "utf8")))
      .filter((r) => r.guardianPid !== 12);
    assert.equal(records.length, 1);
    assert.equal(records[0].state, "complete");
    assert.equal(records[0].recoveryIdentity, undefined);
  },
);
test(
  "Windows guardian persists actual assignment identities before contained work starts",
  { skip: process.platform !== "win32", timeout: 25000 },
  async () => {
    const f = fixture();
    const marker = path.join(f.base, "observed-launch.json");
    const realAdapter = readFileSync(new URL("../scripts/owned-child-windows.ps1", import.meta.url));
    const script = `const fs=require('node:fs'),path=require('node:path');const dir=path.join(process.env.CLINICAL_KB_HEAVY_LOCK_PATH,'children');const records=fs.readdirSync(dir).filter(n=>n.endsWith('.json')).map(n=>JSON.parse(fs.readFileSync(path.join(dir,n))));fs.writeFileSync(${JSON.stringify(marker)},JSON.stringify(records.filter(r=>r.guardianPid!==12)));process.exit(7)`;
    const result = await runOwnedChild(process.execPath, ["-e", script], {
      cwd: f.base,
      env: { ...process.env, CLINICAL_KB_HEAVY_LOCK_TOKEN: run, CLINICAL_KB_HEAVY_LOCK_PATH: f.lease },
      stdio: "ignore",
    });
    assert.equal(result.status, 7, JSON.stringify(result));
    const [atLaunch] = JSON.parse(readFileSync(marker, "utf8"));
    assert.equal(atLaunch.state, "running");
    assert.equal(atLaunch.recoveryIdentity.adapterSha256, createHash("sha256").update(realAdapter).digest("hex"));
    assert.equal(atLaunch.recoveryIdentity.guardianIdentity.pid, atLaunch.guardianPid);
    assert.equal(atLaunch.recoveryIdentity.adapterIdentity.pid, atLaunch.childPid);
    for (const identity of [atLaunch.recoveryIdentity.guardianIdentity, atLaunch.recoveryIdentity.adapterIdentity])
      assert.ok(Number.isFinite(Date.parse(identity.createdAt)));
    const final = readdirSync(path.join(f.lease, "children"))
      .filter((n) => n.endsWith(".json"))
      .map((n) => JSON.parse(readFileSync(path.join(f.lease, "children", n), "utf8")))
      .find((r) => r.guardianPid === atLaunch.guardianPid);
    assert.equal(final.state, "complete");
    assert.equal(final.childResult.status, 7);
    assert.deepEqual(final.recoveryIdentity, atLaunch.recoveryIdentity);
  },
);

test(
  "native assignment refuses mismatched acknowledgment before root executes",
  { skip: process.platform !== "win32", timeout: 25000 },
  () => {
    const base = mkdtempSync(path.join(os.tmpdir(), "ward-native-handshake-test-"));
    const bytes = readFileSync(new URL("../scripts/owned-child-windows.ps1", import.meta.url));
    const marker = path.join(base, "must-not-run");
    const receipt = path.join(base, "terminal.json");
    const launchReceipt = path.join(base, "launch.json");
    const acknowledgeFile = path.join(base, "ack");
    writeFileSync(acknowledgeFile, "wrong-token");
    const payload = {
      command: process.execPath,
      args: ["-e", `require('node:fs').writeFileSync(${JSON.stringify(marker)},'bad')`],
      cwd: base,
      verbatim: false,
      survivorTimeout: 5000,
      receipt,
      cancelFile: path.join(base, "cancel"),
      cancelToken: run,
      launchReceipt,
      acknowledgeFile,
      launchToken: run,
      adapterHash: createHash("sha256").update(bytes).digest("hex"),
      guardianPid: process.pid,
    };
    const result = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(bytes.toString("utf8"), "utf16le").toString("base64"),
      ],
      { cwd: base, input: JSON.stringify(payload) + "\n", encoding: "utf8", timeout: 20000, windowsHide: true },
    );
    assert.equal(result.status, 126, result.stderr);
    assert.equal(existsSync(marker), false);
    assert.equal(JSON.parse(readFileSync(launchReceipt, "utf8")).assigned, true);
    const proof = JSON.parse(readFileSync(receipt, "utf8").replace(/^\uFEFF/u, ""));
    assert.equal(proof.completed, false);
    assert.match(proof.error, /acknowledgement mismatch/u);
  },
);
function fixture() {
  // Synthetic roots retained for forensic evidence; never touches shared state.
  const base = mkdtempSync(path.join(os.tmpdir(), "ward-recovery-test-"));
  const repositoryIdentity = path.join(base, "repository", ".git");
  const name = createHash("sha256").update(path.resolve(repositoryIdentity).toLowerCase()).digest("hex").slice(0, 20);
  const lockPath = path.join(base, `${name}.lock`);
  const lease = path.join(lockPath, "leases", `${run}.lock`);
  mkdirSync(path.join(lease, "children"), { recursive: true });
  mkdirSync(path.join(lockPath, "queue"));
  write(path.join(lockPath, "coordinator.json"), { version: 1, sharedLeaseLimit: 2 });
  const owner = {
    pid: 11,
    token: run,
    mode: "exclusive",
    repositoryIdentity,
    worktree: base,
    command: "synthetic test",
    requestedAt: start,
    startedAt: start,
  };
  write(path.join(lockPath, "owner.json"), {
    ...owner,
    pid: process.platform === "win32" ? 4 : 1,
    holderPid: 11,
    coordinator: true,
  });
  write(path.join(lease, "owner.json"), owner);
  const childFile = path.join(lease, "children", `${peer}.json`);
  const child = {
    token: run,
    guardianPid: 12,
    childPid: 13,
    startedAt: start,
    state: "running",
    recoveryIdentity: windowsJobAttestation(
      adapter,
      { pid: 12, createdAt: "2026-10-05T03:06:20.600Z" },
      { pid: 13, createdAt: "2026-10-05T03:06:20.700Z" },
    ),
  };
  write(childFile, child);
  write(path.join(lockPath, "queue", `${ticket}.json`), { ...owner, pid: 14, token: ticket, requestedAt: start });
  const options = { lockPath, repositoryIdentity, run, ticket, processes: [], adapterSha256 };
  return { base, lease, owner, child, childFile, options, plan: () => inspectRecovery(options) };
}
function apply(f, overrides = {}) {
  const plan = f.plan();
  return applyRecovery({
    plan,
    expect: plan.planHash,
    lockPath: f.options.lockPath,
    backupRoot: path.join(f.base, "audit"),
    processProbe: () => f.options.processes,
    adapterSha256,
    ...overrides,
  });
}
for (const [role, pid] of [
  ["owner", 11],
  ["guardian", 12],
  ["adapter", 13],
  ["waiter", 14],
]) {
  test(`preserves active ${role}`, () => {
    const f = fixture();
    const before = snapshot(f.options.lockPath);
    f.options.processes = [{ pid, createdAt: "2026-10-05T03:00:00Z" }];
    assert.equal(f.plan().eligible, false);
    assert.match(f.plan().blockers[0], /Active or unknown/u);
    assert.throws(() => apply(f));
    assert.deepEqual(snapshot(f.options.lockPath), before);
  });
}
test("PID reuse is evidence of a different process, never a kill request", () => {
  const f = fixture();
  f.options.processes = [{ pid: 11, createdAt: "2026-10-05T03:43:21Z" }];
  assert.equal(f.plan().eligible, true);
  assert.equal(f.plan().proofs[0].evidence, "reused");
  assert.equal(apply(f).outcome, "interrupted");
});
test("legacy unfinished record remains blocked even with every PID absent", () => {
  const f = fixture();
  delete f.child.recoveryIdentity;
  write(f.childFile, f.child);
  assert.equal(f.plan().eligible, false);
  assert.match(f.plan().blockers[0], /launch-time/u);
});
test("unknown creation times and ambiguous PID identities block", () => {
  const f = fixture();
  f.options.processes = [{ pid: 12, createdAt: null }];
  assert.equal(f.plan().eligible, false);
  f.options.processes = [
    { pid: 12, createdAt: start },
    { pid: 12, createdAt: start },
  ];
  assert.equal(f.plan().eligible, false);
});
test("exact repository binding prevents recovery in another coordinator", () => {
  const f = fixture();
  assert.equal(inspectRecovery({ ...f.options, repositoryIdentity: path.join(f.base, "other.git") }).eligible, false);
});
test("malformed or partial records never disappear from the queue", () => {
  const f = fixture();
  writeFileSync(path.join(f.options.lockPath, "queue", `${peer}.json`), '{"pid":');
  const before = snapshot(f.options.lockPath);
  assert.equal(f.plan().eligible, false);
  assert.deepEqual(snapshot(f.options.lockPath), before);
});
test("unrelated active leases and exact queue order survive", () => {
  const f = fixture();
  const directory = path.join(f.options.lockPath, "leases", `${peer}.lock`);
  mkdirSync(directory);
  write(path.join(directory, "owner.json"), { ...f.owner, pid: 100, mode: "shared", token: peer });
  const queued = path.join(f.options.lockPath, "queue", `${peer}.json`);
  write(queued, { ...f.owner, pid: 101, token: peer, requestedAt: "2026-10-05T03:00:00Z" });
  f.options.processes = [
    { pid: 100, createdAt: start },
    { pid: 101, createdAt: start },
  ];
  const leaseBytes = readFileSync(path.join(directory, "owner.json"));
  const queueBytes = readFileSync(queued);
  apply(f);
  assert.deepEqual(readFileSync(path.join(directory, "owner.json")), leaseBytes);
  assert.deepEqual(readFileSync(queued), queueBytes);
  assert.deepEqual(readdirSync(path.join(f.options.lockPath, "queue")), [`${peer}.json`]);
});
test("stale ticket must belong to the same task and be explicitly named", () => {
  const f = fixture();
  const file = path.join(f.options.lockPath, "queue", `${ticket}.json`);
  const queued = JSON.parse(readFileSync(file));
  queued.worktree = path.join(f.base, "other");
  write(file, queued);
  assert.equal(f.plan().eligible, false);
  delete f.options.ticket;
  apply(f);
  assert.ok(readFileSync(file));
});
test("default inspection changes no bytes and does not acquire a gate", () => {
  const f = fixture();
  const before = snapshot(f.options.lockPath);
  assert.equal(f.plan().eligible, true);
  assert.deepEqual(snapshot(f.options.lockPath), before);
  assert.ok(!readdirSync(f.options.lockPath).includes("gate.lock"));
});
test("gate exclusion refuses active and partial gates without reclaiming", () => {
  const f = fixture();
  mkdirSync(path.join(f.options.lockPath, "gate.lock"));
  assert.throws(() => apply(f), /EEXIST/u);
  assert.deepEqual(readdirSync(path.join(f.options.lockPath, "gate.lock")), []);
});
test("CAS rejects changed bytes, changed process evidence and tampered report", () => {
  const f = fixture();
  const plan = f.plan();
  writeFileSync(f.childFile, readFileSync(f.childFile).toString() + " ");
  assert.throws(() => apply(f, { plan, expect: plan.planHash }), /changed/u);
  const g = fixture();
  const gplan = g.plan();
  assert.throws(
    () => apply(g, { plan: gplan, expect: gplan.planHash, processProbe: () => [{ pid: 12, createdAt: start }] }),
    /changed/u,
  );
  gplan.run = peer;
  assert.throws(() => apply(g, { plan: gplan, expect: gplan.planHash }), /report changed/u);
});
test("second probe catches a race after exact-byte backup", () => {
  const f = fixture();
  let calls = 0;
  assert.throws(
    () => apply(f, { processProbe: () => (++calls === 1 ? [] : [{ pid: 13, createdAt: start }]) }),
    /identity changed/u,
  );
  assert.ok(readFileSync(f.childFile));
  assert.ok(readFileSync(path.join(f.base, "audit", "original-manifest.json")));
});
test("audit retains original bytes and reconciliation never means passed", () => {
  const f = fixture();
  const before = snapshot(f.options.lockPath);
  const result = apply(f);
  const journal = JSON.parse(readFileSync(result.journalPath));
  assert.deepEqual(journal.plan.snapshot, before);
  const child = JSON.parse(readFileSync(path.join(f.base, "audit", "terminal", `${peer}.json`)));
  assert.equal(child.state, "complete");
  assert.equal(child.outcome, "interrupted");
  assert.equal(child.childResult.status, null);
  assert.deepEqual(rollbackRecovery({ lockPath: f.options.lockPath, journalPath: result.journalPath }), {
    restored: true,
  });
  assert.deepEqual(snapshot(f.options.lockPath), before);
});
test("rollback never overwrites later legitimate leases or tickets", () => {
  const f = fixture();
  const result = apply(f);
  const next = path.join(f.options.lockPath, "queue", `${peer}.json`);
  write(next, { pid: 100, token: peer });
  const before = snapshot(f.options.lockPath);
  assert.throws(
    () => rollbackRecovery({ lockPath: f.options.lockPath, journalPath: result.journalPath }),
    /Later coordinator/u,
  );
  assert.deepEqual(snapshot(f.options.lockPath), before);
});
test("unknown adapter contract and unknown record state abort", () => {
  const f = fixture();
  f.child.recoveryIdentity.adapterSha256 = "unknown";
  write(f.childFile, f.child);
  assert.equal(f.plan().eligible, false);
  f.child.state = "unknown";
  write(f.childFile, f.child);
  assert.equal(f.plan().eligible, false);
});
test("active adapter born after child record timestamp is never treated as PID reuse", () => {
  const f = fixture();
  f.options.processes = [{ pid: 13, createdAt: "2026-10-05T03:06:20.700Z" }];
  assert.equal(f.plan().eligible, false);
  assert.match(f.plan().blockers[0], /Active or unknown adapter/u);
});
test("missing recorded process creation identity aborts even when absent", () => {
  const f = fixture();
  delete f.child.recoveryIdentity.adapterIdentity;
  write(f.childFile, f.child);
  assert.equal(f.plan().eligible, false);
  assert.match(f.plan().blockers[0], /creation identity/u);
});

for (const point of [
  "gate-established",
  "manifest-written",
  "progress-written:0000.json",
  "progress-published:0000.json",
  `before-move:leases/${run}.lock`,
  `after-move:leases/${run}.lock`,
  "progress-written:0001.json",
  "progress-published:0001.json",
  `before-move:queue/${ticket}.json`,
  `after-move:queue/${ticket}.json`,
  "progress-written:0002.json",
  `terminal-written:${peer}.json`,
  "progress-written:0003.json",
  "progress-written:journal.json",
  "progress-published:journal.json",
  "before-gate-release",
]) {
  test(`fault ${point} retains non-stale exclusion and original evidence`, () => {
    const f = fixture();
    const before = snapshot(f.options.lockPath);
    assert.throws(
      () =>
        apply(f, {
          fault: (stage) => {
            if (stage === point) throw new Error(`injected ${point}`);
          },
        }),
      /injected/u,
    );
    const directory = path.join(f.options.lockPath, "gate.lock");
    assert.ok(existsSync(directory));
    const owner = JSON.parse(readFileSync(path.join(directory, "owner.json")));
    assert.equal(owner.pid, process.platform === "win32" ? 4 : 1);
    assert.equal(registeredWorkIsActive(directory, owner.token), true);
    // Simulate the recovery PID's death: the real coordinator still cannot
    // reclaim this gate, even with a probe reporting every PID dead.
    assert.equal(
      testRunLockInternals.ownerDirectoryIsStale(directory, () => false),
      false,
    );
    const manifestFile = path.join(f.base, "audit", "original-manifest.json");
    if (existsSync(manifestFile)) {
      const manifest = JSON.parse(readFileSync(manifestFile));
      assert.deepEqual(manifest.plan.snapshot, before);
      const archived = path.join(f.base, "audit", `${run}.lock`, "children", `${peer}.json`);
      if (existsSync(archived))
        assert.deepEqual(
          readFileSync(archived),
          Buffer.from(
            before.find((entry) => entry.file === `leases/${run}.lock/children/${peer}.json`).bytes,
            "base64",
          ),
        );
    } else assert.deepEqual(snapshot(f.options.lockPath), before);
    assert.throws(() => apply(f), /Eligible|EEXIST/u);
  });
}
test("torn progress write cannot truncate immutable original-byte manifest", () => {
  const f = fixture();
  const before = snapshot(f.options.lockPath);
  let manifestBytes;
  assert.throws(
    () =>
      apply(f, {
        fault: (stage) => {
          if (stage === "manifest-written")
            manifestBytes = readFileSync(path.join(f.base, "audit", "original-manifest.json"));
          if (stage === "progress-written:0001.json") {
            const directory = path.join(f.base, "audit", "progress");
            const temporary = readdirSync(directory).find(
              (name) => name.startsWith("0001.json.") && name.endsWith(".tmp"),
            );
            writeFileSync(path.join(directory, temporary), '{"phase":');
            throw new Error("torn write");
          }
        },
      }),
    /torn write/u,
  );
  assert.deepEqual(readFileSync(path.join(f.base, "audit", "original-manifest.json")), manifestBytes);
  assert.deepEqual(JSON.parse(manifestBytes).plan.snapshot, before);
  const progress = path.join(f.base, "audit", "progress");
  assert.equal(JSON.parse(readFileSync(path.join(progress, "0000.json"))).phase, "prepared");
  assert.equal(existsSync(path.join(progress, "0001.json")), false);
});
test("successful recovery keeps archived bytes immutable and publishes derived terminal state separately", () => {
  const f = fixture();
  const bytes = readFileSync(f.childFile);
  const result = apply(f);
  assert.deepEqual(readFileSync(path.join(f.base, "audit", `${run}.lock`, "children", `${peer}.json`)), bytes);
  assert.equal(JSON.parse(readFileSync(path.join(f.base, "audit", "terminal", `${peer}.json`))).outcome, "interrupted");
  const original = readFileSync(path.join(f.base, "audit", "original-manifest.json"));
  rollbackRecovery({ lockPath: f.options.lockPath, journalPath: result.journalPath });
  assert.deepEqual(readFileSync(path.join(f.base, "audit", "original-manifest.json")), original);
  assert.equal(JSON.parse(readFileSync(result.journalPath)).phase, "complete");
  assert.equal(JSON.parse(readFileSync(path.join(f.base, "audit", "rollback.json"))).phase, "rolled-back");
});
for (const [relative, record] of [
  ["unknown.json", {}],
  [`leases/${run}.lock/unknown.json`, {}],
  [`queue/${peer}.json`, { pid: 99 }],
  [`leases/${run}.lock/children/${peer}.json`, { token: run, state: "running" }],
  ["coordinator.json", { version: 1, sharedLeaseLimit: 2, unexpected: true }],
]) {
  test(`unknown or malformed ${relative} fails closed without a gate`, () => {
    const f = fixture();
    write(path.join(f.options.lockPath, relative), record);
    const before = snapshot(f.options.lockPath);
    assert.equal(f.plan().eligible, false);
    assert.throws(() => apply(f), /Eligible/u);
    assert.deepEqual(snapshot(f.options.lockPath), before);
    assert.equal(existsSync(path.join(f.options.lockPath, "gate.lock")), false);
  });
}
test("unknown extra field on a legitimate peer record fails closed", () => {
  const f = fixture();
  write(path.join(f.options.lockPath, "queue", `${peer}.json`), { ...f.owner, token: peer, unexpected: "unreviewed" });
  assert.equal(f.plan().eligible, false);
  assert.match(f.plan().blockers[0], /schema/u);
});
test("race introduced between moves retains barrier and cannot move another ticket", () => {
  const f = fixture();
  const peerFile = path.join(f.options.lockPath, "queue", `${peer}.json`);
  assert.throws(
    () =>
      apply(f, {
        fault: (stage) => {
          if (stage === `before-move:queue/${ticket}.json`) write(peerFile, { ...f.owner, token: peer });
        },
      }),
    /Coordinator changed before move/u,
  );
  assert.ok(existsSync(path.join(f.options.lockPath, "queue", `${ticket}.json`)));
  assert.ok(existsSync(peerFile));
  assert.equal(
    testRunLockInternals.ownerDirectoryIsStale(path.join(f.options.lockPath, "gate.lock"), () => false),
    false,
  );
});
test("rollback fault retains exclusion and never rewrites immutable manifest", () => {
  const f = fixture();
  const result = apply(f);
  const file = path.join(f.base, "audit", "original-manifest.json");
  const original = readFileSync(file);
  assert.throws(
    () =>
      rollbackRecovery({
        lockPath: f.options.lockPath,
        journalPath: result.journalPath,
        fault: (stage) => {
          if (stage === `rollback-restored:leases/${run}.lock/children/${peer}.json`)
            throw new Error("partial rollback");
        },
      }),
    /partial rollback/u,
  );
  assert.deepEqual(readFileSync(file), original);
  assert.equal(
    testRunLockInternals.ownerDirectoryIsStale(path.join(f.options.lockPath, "gate.lock"), () => false),
    false,
  );
});
test("timezone-free identity timestamps are unknown evidence", () => {
  const f = fixture();
  f.child.recoveryIdentity.adapterIdentity.createdAt = "2026-10-05T03:06:20";
  write(f.childFile, f.child);
  assert.equal(f.plan().eligible, false);
  const g = fixture();
  g.owner.startedAt = "2026-10-05T03:06:20";
  write(path.join(g.lease, "owner.json"), g.owner);
  assert.equal(g.plan().eligible, false);
});
test("actual synthetic recovery process exit after move leaves non-reclaimable gate and exact backups", () => {
  const f = fixture();
  const before = snapshot(f.options.lockPath);
  const configFile = path.join(f.base, "synthetic-input.json");
  write(configFile, {
    plan: f.plan(),
    lockPath: f.options.lockPath,
    backupRoot: path.join(f.base, "audit"),
    adapterSha256,
  });
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import fs from 'node:fs';import {pathToFileURL} from 'node:url';const {applyRecovery}=await import(pathToFileURL(process.argv[1]));const config=JSON.parse(fs.readFileSync(process.argv[2]));applyRecovery({...config,expect:config.plan.planHash,processProbe:()=>[],fault:stage=>{if(stage.startsWith('after-move:leases/'))process.exit(77);}});",
      fileURLToPath(new URL("../scripts/recover-heavy-run.mjs", import.meta.url)),
      configFile,
    ],
    { encoding: "utf8", timeout: 10000, windowsHide: true },
  );
  assert.equal(child.status, 77, child.stderr);
  const directory = path.join(f.options.lockPath, "gate.lock");
  assert.equal(
    testRunLockInternals.ownerDirectoryIsStale(directory, () => false),
    false,
  );
  const manifest = JSON.parse(readFileSync(path.join(f.base, "audit", "original-manifest.json")));
  assert.deepEqual(manifest.plan.snapshot, before);
  assert.ok(existsSync(path.join(f.base, "audit", `${run}.lock`)));
  assert.ok(existsSync(path.join(f.options.lockPath, "queue", `${ticket}.json`)));
  assert.equal(existsSync(path.join(f.base, "audit", "journal.json")), false);
});
