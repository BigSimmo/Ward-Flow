#!/usr/bin/env node
// Maintenance only. Never launches work, kills a process, or alters admission limits.
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  createBootBaseline,
  readScopeReview,
  readWindowsBootObservation,
  validateBootBoundary,
} from "./recovery-boot-proof.mjs";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const identity = (value) => path.resolve(value).replaceAll("\\", "/").toLowerCase();
const digest = (value) => hash(JSON.stringify(value));
const fail = (message) => {
  throw new Error(message);
};
const json = (bytes) => JSON.parse(bytes.toString("utf8"));
const date = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) &&
  Number.isFinite(Date.parse(value));
const pid = (value) => Number.isInteger(value) && value > 0;
const text = (value) => typeof value === "string" && value.length > 0;
function keys(record, allowed, label) {
  if (
    !record ||
    typeof record !== "object" ||
    Array.isArray(record) ||
    Object.keys(record).some((key) => !allowed.includes(key))
  )
    fail(`Unknown ${label} schema`);
}
function validateOwner(record, token, repositoryIdentity, sentinel = false) {
  keys(
    record,
    [
      "pid",
      "token",
      "mode",
      "command",
      "worktree",
      "repositoryIdentity",
      "requestedAt",
      "startedAt",
      ...(sentinel ? ["holderPid", "coordinator"] : []),
    ],
    "owner",
  );
  if (
    !pid(record.pid) ||
    !uuid.test(record.token) ||
    (token && record.token !== token) ||
    !["shared", "exclusive"].includes(record.mode) ||
    !text(record.command) ||
    !text(record.worktree) ||
    !text(record.repositoryIdentity) ||
    identity(record.repositoryIdentity) !== repositoryIdentity ||
    !date(record.requestedAt) ||
    (record.startedAt !== undefined && !date(record.startedAt))
  )
    fail("Malformed or mismatched owner/ticket record");
  if (
    sentinel &&
    (record.coordinator !== true || !pid(record.holderPid) || record.pid !== (process.platform === "win32" ? 4 : 1))
  )
    fail("Unknown compatibility sentinel");
}
function validateChild(record, token) {
  keys(
    record,
    [
      "token",
      "guardianPid",
      "childPid",
      "startedAt",
      "state",
      "cancellation",
      "childResult",
      "reason",
      "recoveryIdentity",
    ],
    "child",
  );
  if (
    record.token !== token ||
    !pid(record.guardianPid) ||
    (record.childPid !== null && !pid(record.childPid)) ||
    !date(record.startedAt) ||
    !["running", "complete"].includes(record.state)
  )
    fail("Malformed child record");
  if (record.cancellation !== undefined && !["SIGINT", "SIGTERM"].includes(record.cancellation))
    fail("Unknown child cancellation");
  if (record.reason !== undefined && !text(record.reason)) fail("Malformed child reason");
  if (record.childResult !== undefined) {
    keys(record.childResult, ["status", "signal", "error"], "child result");
    if (record.childResult.status !== null && !Number.isInteger(record.childResult.status))
      fail("Malformed child result");
    if (
      record.childResult.signal !== undefined &&
      record.childResult.signal !== null &&
      !text(record.childResult.signal)
    )
      fail("Malformed child signal");
    if (record.childResult.error !== undefined) {
      keys(record.childResult.error, ["message"], "child error");
      if (!text(record.childResult.error.message)) fail("Malformed child error");
    }
  }
  if (record.recoveryIdentity !== undefined) {
    keys(
      record.recoveryIdentity,
      ["version", "platform", "contract", "adapterSha256", "guardianIdentity", "adapterIdentity"],
      "launch attestation",
    );
    for (const entry of [record.recoveryIdentity.guardianIdentity, record.recoveryIdentity.adapterIdentity]) {
      keys(entry, ["pid", "createdAt"], "creation identity");
      if (!pid(entry.pid) || !date(entry.createdAt)) fail("Missing process creation identity");
    }
  }
}

function validateRecords(entries, repositoryIdentity) {
  const records = new Map();
  const directories = new Set(entries.filter((entry) => entry.directory).map((entry) => entry.file));
  if (!directories.has("leases") || !directories.has("queue")) fail("Missing coordinator directories");
  for (const entry of entries) {
    if (entry.directory) {
      if (entry.file === "leases" || entry.file === "queue") continue;
      const parts = entry.file.split("/");
      if (
        parts[0] !== "leases" ||
        !parts[1]?.endsWith(".lock") ||
        !uuid.test(parts[1].slice(0, -5)) ||
        (parts.length !== 2 && !(parts.length === 3 && parts[2] === "children"))
      )
        fail(`Unknown evidence directory: ${entry.file}`);
      continue;
    }
    const record = json(Buffer.from(entry.bytes, "base64"));
    if (entry.file === "coordinator.json") {
      keys(record, ["version", "sharedLeaseLimit"], "coordinator");
      if (record.version !== 1 || record.sharedLeaseLimit !== 2) fail("Unknown coordinator contract");
    } else if (entry.file === "owner.json") validateOwner(record, null, repositoryIdentity, true);
    else {
      const parts = entry.file.split("/");
      if (parts[0] === "queue" && parts.length === 2 && parts[1].endsWith(".json") && uuid.test(parts[1].slice(0, -5)))
        validateOwner(record, parts[1].slice(0, -5), repositoryIdentity);
      else if (
        parts[0] === "leases" &&
        uuid.test(parts[1]?.slice(0, -5)) &&
        parts[1].endsWith(".lock") &&
        parts.length === 3 &&
        parts[2] === "owner.json"
      ) {
        validateOwner(record, parts[1].slice(0, -5), repositoryIdentity);
        if (!date(record.startedAt)) fail("Missing lease start");
      } else if (
        parts[0] === "leases" &&
        uuid.test(parts[1]?.slice(0, -5)) &&
        parts[1].endsWith(".lock") &&
        parts.length === 4 &&
        parts[2] === "children" &&
        parts[3].endsWith(".json") &&
        uuid.test(parts[3].slice(0, -5))
      )
        validateChild(record, parts[1].slice(0, -5));
      else fail(`Unknown evidence file: ${entry.file}`);
    }
    records.set(entry.file, record);
  }
  if (!records.has("coordinator.json") || !records.has("owner.json")) fail("Missing coordinator records");
  for (const directory of directories)
    if (/^leases\/[^/]+\.lock$/u.test(directory) && !records.has(`${directory}/owner.json`))
      fail("Missing lease owner");
  return records;
}

// Directory topology is part of CAS too; empty directories occupy admission.
export function snapshot(root, relative = "") {
  if (lstatSync(root).isSymbolicLink()) fail("Coordinator symlink refused");
  const entries = [];
  for (const name of readdirSync(path.join(root, relative)).sort()) {
    if (!relative && name === "gate.lock") continue;
    const file = relative ? `${relative}/${name}` : name;
    const stats = lstatSync(path.join(root, file));
    if (stats.isSymbolicLink() || (!stats.isDirectory() && !stats.isFile())) fail(`Unknown filesystem entry: ${file}`);
    if (stats.isDirectory()) entries.push({ file, directory: true }, ...snapshot(root, file));
    else {
      const bytes = readFileSync(path.join(root, file));
      entries.push({ file, sha256: hash(bytes), bytes: bytes.toString("base64") });
    }
  }
  return entries;
}

export function readWindowsProcesses() {
  if (process.platform !== "win32")
    fail("Only the Windows owned-job contract is supported; other platforms require their own descendant proof");
  const output = execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$ErrorActionPreference='Stop'; $rows=@(Get-CimInstance Win32_Process | ForEach-Object { if (!$_.CreationDate) { throw 'Unknown creation time' }; @{pid=[int]$_.ProcessId; createdAt=$_.CreationDate.ToUniversalTime().ToString('o'); name=$_.Name} }); ConvertTo-Json -InputObject $rows -Compress",
    ],
    { encoding: "utf8", timeout: 15000, windowsHide: true },
  );
  const rows = JSON.parse(output.replace(/^\uFEFF/u, ""));
  if (
    !Array.isArray(rows) ||
    !rows.length ||
    rows.some((row) => !Number.isInteger(row.pid) || !Number.isFinite(Date.parse(row.createdAt)))
  )
    fail("Unknown process enumeration");
  return rows;
}

function proveDead(pid, startedAt, processes, role, expectedCreatedAt) {
  if (!Number.isInteger(pid) || pid <= 0 || !Number.isFinite(Date.parse(startedAt))) fail(`Unknown ${role} identity`);
  const matches = processes.filter((row) => row.pid === pid);
  if (matches.length > 1) fail(`Ambiguous ${role} process identity`);
  if (!matches.length) return { role, pid, evidence: "absent" };
  const created = Date.parse(matches[0].createdAt);
  // A later creation proves reuse. Older/equal live identities remain reserved.
  const boundary = Date.parse(expectedCreatedAt ?? startedAt);
  if (!Number.isFinite(boundary) || !Number.isFinite(created) || created <= boundary)
    fail(`Active or unknown ${role} PID ${pid}`);
  return { role, pid, evidence: "reused", createdAt: matches[0].createdAt };
}

// A launch-time attestation must be written by the owned guardian BEFORE work starts.
// No CLI switch or retrospective user-written manifest can manufacture this proof.
// The guardian persists this identity before acknowledging native root resume.
export function windowsJobAttestation(adapterBytes, guardianIdentity, adapterIdentity) {
  return {
    version: 1,
    platform: "win32",
    contract: "ward-kill-on-job-close-no-breakaway-v1",
    adapterSha256: hash(adapterBytes),
    guardianIdentity,
    adapterIdentity,
  };
}

export function inspectRecovery({ lockPath, repositoryIdentity, run, ticket, processes, adapterSha256, bootContext }) {
  const report = {
    version: 1,
    repositoryIdentity: identity(repositoryIdentity),
    run,
    ticket: ticket ?? null,
    eligible: false,
    blockers: [],
  };
  try {
    if (!uuid.test(run) || (ticket && !uuid.test(ticket))) fail("Exact UUID run/ticket required");
    const expectedName = `${hash(path.resolve(repositoryIdentity).toLowerCase()).slice(0, 20)}.lock`;
    if (path.basename(lockPath) !== expectedName) fail("Coordinator belongs to another repository");
    if (!Array.isArray(processes)) fail("Unknown process evidence");
    const entries = snapshot(lockPath);
    report.snapshot = entries;
    const records = validateRecords(entries, report.repositoryIdentity);
    const lease = `leases/${run}.lock`;
    const owner = records.get(`${lease}/owner.json`);
    if (
      owner?.token !== run ||
      identity(owner.repositoryIdentity) !== report.repositoryIdentity ||
      !["exclusive", "shared"].includes(owner.mode)
    )
      fail("Unknown or mismatched lease owner");
    report.proofs = [proveDead(owner.pid, owner.startedAt, processes, "owner")];
    const children = [...records].filter(([file]) => file.startsWith(`${lease}/children/`));
    if (!children.length) fail("Missing descendant evidence");
    if (bootContext) {
      const targetSnapshot = entries.filter(
        (entry) =>
          entry.file === lease ||
          entry.file.startsWith(`${lease}/`) ||
          (ticket && entry.file === `queue/${ticket}.json`),
      );
      const targetTimes = [
        owner.startedAt,
        ...children.map(([, child]) => child.startedAt),
        ...(ticket ? [records.get(`queue/${ticket}.json`)?.requestedAt] : []),
      ];
      const proof = validateBootBoundary({
        ...bootContext,
        repositoryIdentity,
        run,
        ticket: ticket ?? null,
        targetSnapshot,
        targetTimes,
      });
      const targetPids = new Set([
        owner.pid,
        ...children.flatMap(([, child]) => [child.guardianPid, child.childPid]),
        ...(ticket ? [records.get(`queue/${ticket}.json`)?.pid] : []),
      ]);
      if (
        processes.some(
          (row) => targetPids.has(row.pid) && Date.parse(row.createdAt) < Date.parse(proof.lastBootUpTime) - 2000,
        )
      )
        fail("Boot proof: current target PID identity predates verified kernel boot");
      report.proofs.push(proof);
      // Preserve reviewed historical scope and original baseline in immutable audit.
      report.bootContext = {
        baseline: bootContext.baseline,
        baselineExpect: bootContext.baselineExpect,
        scope: bootContext.scope,
        scopeExpect: bootContext.scopeExpect,
      };
    }
    for (const [file, child] of children) {
      if (!/^leases\/[^/]+\/children\/[^/]+\.json$/u.test(file) || child.token !== run) fail("Unknown child evidence");
      if (!["running", "complete"].includes(child.state)) fail("Unknown child state");
      if (bootContext) {
        report.proofs.push(proveDead(child.guardianPid, child.startedAt, processes, "guardian"));
        if (child.childPid === null) fail("Unknown legacy adapter identity");
        report.proofs.push(proveDead(child.childPid, child.startedAt, processes, "adapter"));
        continue;
      }
      const attestation = child.recoveryIdentity;
      if (
        !adapterSha256 ||
        attestation?.version !== 1 ||
        attestation.platform !== "win32" ||
        attestation.contract !== "ward-kill-on-job-close-no-breakaway-v1" ||
        attestation.adapterSha256 !== adapterSha256
      )
        fail(
          "Missing or unknown launch-time Windows job attestation; legacy PID absence does not prove descendant termination",
        );
      for (const [role, pid, recorded] of [
        ["guardian", child.guardianPid, attestation.guardianIdentity],
        ["adapter", child.childPid, attestation.adapterIdentity],
      ]) {
        if (recorded?.pid !== pid || !Number.isFinite(Date.parse(recorded.createdAt)))
          fail(`Missing ${role} creation identity`);
        report.proofs.push(proveDead(pid, child.startedAt, processes, role, recorded.createdAt));
      }
    }
    if (ticket) {
      const queued = records.get(`queue/${ticket}.json`);
      if (
        queued?.token !== ticket ||
        identity(queued.repositoryIdentity) !== report.repositoryIdentity ||
        identity(queued.worktree) !== identity(owner.worktree) ||
        queued.command !== owner.command
      )
        fail("Ticket is not attributable to this interrupted task");
      report.proofs.push(proveDead(queued.pid, queued.requestedAt, processes, "waiter"));
    }
    report.eligible = true;
  } catch (error) {
    report.blockers.push(error.message);
  }
  report.planHash = digest(report);
  return report;
}

function durableExclusive(file, bytes) {
  const descriptor = openSync(file, "wx");
  try {
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function publishProgress(root, name, value, fault = () => {}) {
  const temporary = path.join(root, `${name}.${randomUUID()}.tmp`);
  durableExclusive(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fault(`progress-written:${name}`);
  // Unique immutable sequence names; rename never replaces an earlier receipt.
  const destination = path.join(root, name);
  try {
    lstatSync(destination);
    fail("Progress receipt already exists");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  renameSync(temporary, destination);
  fault(`progress-published:${name}`);
}

function gate(root, operation, fault = () => {}) {
  const directory = path.join(root, "gate.lock");
  mkdirSync(directory); // Refuse any existing gate, including stale/partial owners.
  const token = randomUUID();
  // Existing coordinator versions understand these two fail-closed mechanisms:
  // the OS lifetime compatibility PID, and an unfinished registered child.
  // Neither is reclaimed when this recovery process exits or throws. Establish
  // both before moving ANY shared record; no normal coordinator edits needed.
  const bytes = Buffer.from(
    JSON.stringify({
      pid: process.platform === "win32" ? 4 : 1,
      holderPid: process.pid,
      token,
      startedAt: new Date().toISOString(),
      recovery: true,
    }),
  );
  const file = path.join(directory, "owner.json");
  durableExclusive(file, bytes);
  mkdirSync(path.join(directory, "children"));
  const barrierFile = path.join(directory, "children", `${token}.json`);
  const barrierBytes = Buffer.from(
    JSON.stringify({
      token,
      state: "running",
      reason: "Recovery transaction requires explicit terminal receipt before release",
    }),
  );
  durableExclusive(barrierFile, barrierBytes);
  fault("gate-established");
  // Intentionally NO finally-unlock. Any failure retains durable exclusion.
  const result = operation({ token, ownerHash: hash(bytes), barrierHash: hash(barrierBytes) });
  fault("before-gate-release");
  if (
    !readFileSync(file).equals(bytes) ||
    !readFileSync(barrierFile).equals(barrierBytes) ||
    readdirSync(directory).sort().join(",") !== "children,owner.json" ||
    readdirSync(path.dirname(barrierFile)).join(",") !== `${token}.json`
  )
    fail("Recovery gate changed; retain exclusion for owner review");
  unlinkSync(barrierFile);
  rmdirSync(path.dirname(barrierFile));
  unlinkSync(file);
  rmdirSync(directory);
  return result;
}

export function applyRecovery({
  plan,
  expect,
  lockPath,
  backupRoot,
  processProbe = readWindowsProcesses,
  adapterSha256,
  bootProofProbe,
  fault = () => {},
}) {
  if (!plan.eligible || expect !== plan.planHash) fail("Eligible exact dry-run hash required");
  if (plan.bootContext && typeof bootProofProbe !== "function") fail("Fresh boot and scope evidence probe required");
  const unsigned = { ...plan };
  delete unsigned.planHash;
  if (digest(unsigned) !== expect) fail("Dry-run report changed");
  if (path.dirname(path.resolve(backupRoot)) !== path.dirname(path.resolve(lockPath)))
    fail("Backup must be a sibling on the coordinator filesystem");
  return gate(
    lockPath,
    (gateIdentity) => {
      const firstBootContext = plan.bootContext ? bootProofProbe() : undefined;
      const fresh = inspectRecovery({
        ...plan,
        lockPath,
        processes: processProbe(),
        adapterSha256,
        ...(firstBootContext ? { bootContext: firstBootContext } : {}),
      });
      if (fresh.planHash !== expect) fail("State or process evidence changed since dry-run; obtain a fresh dry-run");
      mkdirSync(backupRoot); // Never overwrite an older audit.
      mkdirSync(path.join(backupRoot, "progress"));
      const bootObservations = [];
      const preserveBootObservation = (context) => {
        const file = `boot-observation-${bootObservations.length + 1}.json`;
        const bytes = Buffer.from(`${JSON.stringify(context.current, null, 2)}\n`);
        durableExclusive(path.join(backupRoot, file), bytes);
        bootObservations.push({ file, sha256: hash(bytes) });
        fault(`boot-observation-written:${file}`);
        if (!readFileSync(path.join(backupRoot, file)).equals(bytes)) fail("Boot observation backup changed");
      };
      if (firstBootContext) preserveBootObservation(firstBootContext);
      const manifestPath = path.join(backupRoot, "original-manifest.json");
      const manifestBytes = Buffer.from(
        `${JSON.stringify({ version: 2, coordinator: identity(lockPath), plan, gateIdentity, ...(firstBootContext ? { firstBootObservation: bootObservations[0] } : {}) }, null, 2)}\n`,
      );
      // The ONLY original-byte manifest is never rewritten. Flush and reread it
      // before any shared mutation. Mutable progress cannot destroy this evidence.
      durableExclusive(manifestPath, manifestBytes);
      fault("manifest-written");
      if (!readFileSync(manifestPath).equals(manifestBytes)) fail("Original-byte backup changed");
      const manifestHash = hash(manifestBytes);
      const journal = {
        version: 2,
        manifestHash,
        plan,
        phase: "prepared",
        outcome: "interrupted",
        moved: [],
        completedAt: null,
      };
      const progressRoot = path.join(backupRoot, "progress");
      let sequence = 0;
      const persist = () =>
        publishProgress(progressRoot, `${String(sequence++).padStart(4, "0")}.json`, journal, fault);
      persist();
      if (digest(snapshot(lockPath)) !== digest(plan.snapshot)) fail("Coordinator changed while backing up");
      const secondBootContext = plan.bootContext ? bootProofProbe() : undefined;
      const again = inspectRecovery({
        ...plan,
        lockPath,
        processes: processProbe(),
        adapterSha256,
        ...(secondBootContext ? { bootContext: secondBootContext } : {}),
      });
      if (again.planHash !== expect) fail("Process identity changed before reconciliation");
      if (secondBootContext) {
        preserveBootObservation(secondBootContext);
        const evidenceBytes = Buffer.from(
          `${JSON.stringify({ version: 1, manifestHash, planHash: expect, observations: bootObservations }, null, 2)}\n`,
        );
        durableExclusive(path.join(backupRoot, "boot-evidence.json"), evidenceBytes);
        journal.bootEvidenceSha256 = hash(evidenceBytes);
        fault("boot-evidence-written");
        verifyBootEvidence(backupRoot, journal, manifestBytes);
        persist();
      }
      const moves = [`leases/${plan.run}.lock`, ...(plan.ticket ? [`queue/${plan.ticket}.json`] : [])];
      let expectedSnapshot = plan.snapshot;
      for (const relative of moves) {
        if (!readFileSync(manifestPath).equals(manifestBytes)) fail("Original-byte backup changed");
        fault(`before-move:${relative}`);
        if (plan.bootContext) verifyBootEvidence(backupRoot, journal, manifestBytes);
        if (digest(snapshot(lockPath)) !== digest(expectedSnapshot))
          fail("Coordinator changed before move; retain exclusion");
        const destination = path.join(backupRoot, path.basename(relative));
        renameSync(path.join(lockPath, relative), destination);
        expectedSnapshot = expectedSnapshot.filter(
          (entry) => entry.file !== relative && !entry.file.startsWith(`${relative}/`),
        );
        fault(`after-move:${relative}`);
        if (digest(snapshot(lockPath)) !== digest(expectedSnapshot))
          fail("Coordinator changed after move; retain exclusion");
        journal.moved.push(relative);
        persist();
      }
      // Keep archived original bytes untouched; publish derived terminal records
      // separately. Interrupted never means passed, even if a progress write fails.
      mkdirSync(path.join(backupRoot, "terminal"));
      const archivedChildren = path.join(backupRoot, `${plan.run}.lock`, "children");
      for (const name of readdirSync(archivedChildren)) {
        const file = path.join(archivedChildren, name);
        const original = plan.snapshot.find((entry) => entry.file === `leases/${plan.run}.lock/children/${name}`);
        if (!original || hash(readFileSync(file)) !== original.sha256)
          fail("Archived original child changed; retain exclusion");
        const child = json(readFileSync(file));
        if (child.state === "running")
          durableExclusive(
            path.join(backupRoot, "terminal", name),
            JSON.stringify({
              ...child,
              state: "complete",
              outcome: "interrupted",
              childResult: { status: null },
              recoveryPlanHash: expect,
              recoveredAt: new Date().toISOString(),
            }),
          );
        fault(`terminal-written:${name}`);
      }
      // Keep coordinator and sentinel intact. The normal admission path updates them.
      journal.phase = "complete";
      if (plan.bootContext) verifyBootEvidence(backupRoot, journal, manifestBytes);
      journal.completedAt = new Date().toISOString();
      journal.postSnapshot = snapshot(lockPath);
      if (digest(journal.postSnapshot) !== digest(expectedSnapshot))
        fail("Coordinator changed during reconciliation; retain exclusion");
      persist();
      const journalPath = path.join(backupRoot, "journal.json");
      publishProgress(backupRoot, "journal.json", journal, fault);
      return { recovered: true, outcome: "interrupted", journalPath };
    },
    fault,
  );
}

function verifyBootEvidence(root, journal, manifestBytes) {
  const bytes = readFileSync(path.join(root, "boot-evidence.json"));
  const evidence = json(bytes);
  const manifest = json(manifestBytes);
  if (
    hash(bytes) !== journal.bootEvidenceSha256 ||
    evidence.version !== 1 ||
    evidence.manifestHash !== hash(manifestBytes) ||
    evidence.planHash !== journal.plan.planHash ||
    !Array.isArray(evidence.observations) ||
    evidence.observations.length !== 2 ||
    digest(evidence.observations[0]) !== digest(manifest.firstBootObservation)
  )
    fail("Boot evidence backup changed");
  for (const [index, entry] of evidence.observations.entries()) {
    if (
      entry.file !== `boot-observation-${index + 1}.json` ||
      hash(readFileSync(path.join(root, entry.file))) !== entry.sha256
    )
      fail("Boot observation backup changed");
  }
}

// Restores only exact pre-recovery bytes and only if the entire coordinator has
// stayed unchanged. A later lease/ticket, sentinel update, or ambiguous partial
// transaction always blocks rollback. No caller-specified overwrite option.
export function rollbackRecovery({ lockPath, journalPath, fault = () => {} }) {
  if (path.dirname(path.dirname(path.resolve(journalPath))) !== path.dirname(path.resolve(lockPath)))
    fail("Rollback journal must be in the sibling audit directory");
  const journal = json(readFileSync(journalPath));
  if (journal.version !== 2 || journal.phase !== "complete")
    fail("Partial recovery requires owner review; automatic rollback refused");
  const manifestBytes = readFileSync(path.join(path.dirname(journalPath), "original-manifest.json"));
  const manifest = json(manifestBytes);
  if (
    hash(manifestBytes) !== journal.manifestHash ||
    manifest.version !== 2 ||
    manifest.coordinator !== identity(lockPath) ||
    digest(manifest.plan) !== digest(journal.plan)
  )
    fail("Original-byte backup changed or belongs to another coordinator");
  const unsigned = { ...journal.plan };
  delete unsigned.planHash;
  if (
    digest(unsigned) !== journal.plan.planHash ||
    !uuid.test(journal.plan.run) ||
    (journal.plan.ticket && !uuid.test(journal.plan.ticket))
  )
    fail("Unknown rollback manifest");
  if (journal.plan.bootContext) verifyBootEvidence(path.dirname(journalPath), journal, manifestBytes);
  for (const entry of journal.plan.snapshot) {
    if (
      path.isAbsolute(entry.file) ||
      entry.file.includes("\\") ||
      entry.file.split("/").some((part) => !part || part === "." || part === "..")
    )
      fail("Unsafe rollback path");
    if (!entry.directory && hash(Buffer.from(entry.bytes, "base64")) !== entry.sha256) fail("Rollback bytes changed");
  }
  return gate(
    lockPath,
    () => {
      if (journal.plan.bootContext) verifyBootEvidence(path.dirname(journalPath), journal, manifestBytes);
      if (digest(snapshot(lockPath)) !== digest(journal.postSnapshot))
        fail("Later coordinator changes: rollback refused");
      const targets = [
        `leases/${journal.plan.run}.lock`,
        ...(journal.plan.ticket ? [`queue/${journal.plan.ticket}.json`] : []),
      ];
      for (const relative of targets) {
        try {
          lstatSync(path.join(lockPath, relative));
          fail("Rollback target exists");
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      for (const entry of journal.plan.snapshot.filter((entry) =>
        targets.some((target) => entry.file === target || entry.file.startsWith(`${target}/`)),
      )) {
        const file = path.join(lockPath, entry.file);
        if (entry.directory) mkdirSync(file);
        else writeFileSync(file, Buffer.from(entry.bytes, "base64"), { flag: "wx" });
        fault(`rollback-restored:${entry.file}`);
      }
      publishProgress(
        path.dirname(journalPath),
        "rollback.json",
        { version: 2, manifestHash: journal.manifestHash, phase: "rolled-back", restoredAt: new Date().toISOString() },
        fault,
      );
      return { restored: true };
    },
    fault,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    const options = {};
    const allowed = new Set([
      "--repository",
      "--run",
      "--ticket",
      "--output",
      "--apply",
      "--expect",
      "--backup",
      "--rollback",
      "--prepare-boot",
      "--boot-baseline",
      "--expect-baseline",
      "--scope-review",
      "--expect-scope",
    ]);
    for (let index = 0; index < args.length; index++) {
      const key = args[index];
      if (!allowed.has(key) || options[key]) fail(`Unknown or repeated option: ${key}`);
      const value = args[++index];
      if (!value || value.startsWith("--")) fail(`Value required: ${key}`);
      options[key] = value;
    }
    const root = options["--repository"];
    if (!root) fail("--repository is required");
    const git = (argv) => execFileSync("git", argv, { cwd: root, encoding: "utf8" }).trim();
    for (const argv of [
      ["remote", "get-url", "origin"],
      ["remote", "get-url", "--push", "origin"],
    ])
      if (git(argv) !== "https://github.com/BigSimmo/Ward-Flow.git") fail("Verified Ward Flow remote required");
    const repositoryIdentity = git(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
    const lockPath = path.join(
      process.env.TEMP,
      "clinical-kb-heavy-locks",
      `${hash(path.resolve(repositoryIdentity).toLowerCase()).slice(0, 20)}.lock`,
    );
    const adapterSha256 = hash(readFileSync(path.join(root, "scripts/owned-child-windows.ps1")));
    const bootOptions = ["--boot-baseline", "--expect-baseline", "--scope-review", "--expect-scope"];
    if (
      bootOptions.some((key) => options[key]) &&
      (!bootOptions.every((key) => options[key]) || options["--prepare-boot"] || options["--rollback"])
    )
      fail("Complete exact boot/scope options required for inspection or application only");
    const bootProofProbe = options["--boot-baseline"]
      ? () => {
          if (!lstatSync(options["--boot-baseline"]).isFile() || lstatSync(options["--boot-baseline"]).isSymbolicLink())
            fail("Regular baseline file required");
          const baseline = json(readFileSync(options["--boot-baseline"]));
          return {
            baseline,
            baselineExpect: options["--expect-baseline"],
            scope: readScopeReview(options["--scope-review"], options["--expect-scope"]),
            scopeExpect: options["--expect-scope"],
            current: readWindowsBootObservation(baseline.before.events.at(-1).recordId),
          };
        }
      : undefined;
    if (options["--prepare-boot"]) {
      if (options["--apply"] || options["--rollback"] || !options["--output"] || !options["--run"])
        fail("Baseline preparation requires exact run, owner task and new output only");
      const outputIdentity = identity(options["--output"]);
      if (outputIdentity === identity(lockPath) || outputIdentity.startsWith(`${identity(lockPath)}/`))
        fail("Baseline output must stay outside coordinator");
      const entries = snapshot(lockPath);
      const records = validateRecords(entries, identity(repositoryIdentity));
      const lease = `leases/${options["--run"]}.lock`;
      const owner = records.get(`${lease}/owner.json`);
      if (!owner || (options["--ticket"] && !records.get(`queue/${options["--ticket"]}.json`)))
        fail("Missing exact baseline target");
      const targetTimes = [
        owner.startedAt,
        ...[...records].filter(([file]) => file.startsWith(`${lease}/children/`)).map(([, child]) => child.startedAt),
      ];
      if (targetTimes.length < 2) fail("Missing descendant evidence for baseline");
      if (options["--ticket"]) targetTimes.push(records.get(`queue/${options["--ticket"]}.json`).requestedAt);
      const baseline = createBootBaseline({
        repositoryIdentity,
        run: options["--run"],
        ticket: options["--ticket"] ?? null,
        ownerTask: options["--prepare-boot"],
        snapshot: entries,
        targetTimes,
        observation: readWindowsBootObservation(),
      });
      if (digest(snapshot(lockPath)) !== digest(entries))
        fail("Coordinator changed during read-only baseline preparation");
      durableExclusive(options["--output"], `${JSON.stringify(baseline, null, 2)}\n`);
      console.log(
        JSON.stringify({
          baselineSha256: baseline.baselineSha256,
          eligible: false,
          message:
            "Baseline only; no restart or recovery authority. Independently reviewed postboot scope evidence remains mandatory.",
        }),
      );
    } else if (options["--rollback"])
      console.log(JSON.stringify(rollbackRecovery({ lockPath, journalPath: options["--rollback"] })));
    else if (options["--apply"])
      console.log(
        JSON.stringify(
          applyRecovery({
            lockPath,
            plan: json(readFileSync(options["--apply"])),
            expect: options["--expect"],
            backupRoot: options["--backup"],
            adapterSha256,
            bootProofProbe,
          }),
        ),
      );
    else {
      const report = inspectRecovery({
        lockPath,
        repositoryIdentity,
        run: options["--run"],
        ticket: options["--ticket"],
        processes: readWindowsProcesses(),
        adapterSha256,
        ...(bootProofProbe ? { bootContext: bootProofProbe() } : {}),
      });
      if (options["--output"]) writeFileSync(options["--output"], JSON.stringify(report, null, 2), { flag: "wx" });
      console.log(JSON.stringify({ ...report, snapshot: undefined }, null, 2));
      if (!report.eligible) process.exitCode = 2;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
