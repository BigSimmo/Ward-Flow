// Read-only Windows evidence and exact-run boot-boundary validation. No reboot API.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";

export const bootProofContract = "ward-reviewed-local-full-boot-v1";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digest = (value) => sha(JSON.stringify(value));
const hex = /^[a-f0-9]{64}$/u;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu;
const utc = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/u.test(value) &&
  Number.isFinite(Date.parse(value));
const requireProof = (condition, message) => {
  if (!condition) throw new Error(`Boot proof: ${message}`);
};
const identity = (value) => path.resolve(value).replaceAll("\\", "/").toLowerCase();
const providers = {
  general: ["Microsoft-Windows-Kernel-General", "a68ca8b7-004f-d7b6-a698-07e2de0f1f5d"],
  boot: ["Microsoft-Windows-Kernel-Boot", "15ca44ff-4d7a-4baa-bba5-0998955e531e"],
  user: ["User32", "b0aa8734-56f7-41cc-b2f4-de228e98b946"],
};
function eventMatches(event, provider, id, version) {
  return (
    event.provider === providers[provider][0] &&
    event.providerId.toLowerCase() === providers[provider][1] &&
    event.id === id &&
    event.version === version
  );
}
function validateObservation(value) {
  requireProof(
    value?.version === 1 && value.platform === "win32" && utc(value.observedAt) && utc(value.lastBootUpTime),
    "unknown observation or UTC time",
  );
  requireProof(
    uuid.test(value.host?.hardwareUuid) &&
      !/^0{8}-/u.test(value.host.hardwareUuid) &&
      typeof value.host.name === "string" &&
      value.host.name.length > 0,
    "unknown host identity",
  );
  requireProof(Number.isSafeInteger(value.bootCounter) && value.bootCounter >= 0, "missing kernel boot counter");
  requireProof(
    Array.isArray(value.events) && value.events.length > 0 && value.events.length <= 8192,
    "incomplete or capped event collection",
  );
  requireProof(
    Number.isSafeInteger(value.oldestRecordId) &&
      value.oldestRecordId > 0 &&
      value.headRecordId === value.events.at(-1).recordId,
    "unknown event-log bounds",
  );
  for (const [index, event] of value.events.entries()) {
    requireProof(
      event.channel === "System" &&
        event.computer.toLowerCase() === value.host.name.toLowerCase() &&
        utc(event.createdAt) &&
        typeof event.provider === "string" &&
        uuid.test(event.providerId),
      "unknown event identity",
    );
    requireProof(
      Number.isSafeInteger(event.recordId) &&
        event.recordId > 0 &&
        Number.isInteger(event.id) &&
        Number.isInteger(event.version),
      "malformed event metadata",
    );
    requireProof(
      typeof event.xml === "string" &&
        event.xml.length > 0 &&
        hex.test(event.sha256) &&
        sha(event.xml) === event.sha256,
      "changed raw event bytes",
    );
    requireProof(
      event.data && typeof event.data === "object" && !Array.isArray(event.data),
      "missing structured event data",
    );
    if (index)
      requireProof(
        event.recordId === value.events[index - 1].recordId + 1,
        "gapped, duplicated or unordered event sequence",
      );
  }
}

// The CLI always obtains current evidence directly from supported read-only CIM
// and Event Log APIs; there is no option to import an asserted post-boot observation.
export function readWindowsBootObservation(anchorRecordId) {
  requireProof(process.platform === "win32", "Windows evidence required");
  if (anchorRecordId !== undefined)
    requireProof(Number.isSafeInteger(anchorRecordId) && anchorRecordId > 0, "invalid event anchor");
  const command = `$ErrorActionPreference='Stop';
function Row($e) {
  $raw=$e.ToXml(); $x=[xml]$raw; $data=@{};
  foreach($d in $x.Event.EventData.Data) { $data[[string]$d.Name]=[string]$d.InnerText }
  $h=[System.Security.Cryptography.SHA256]::Create();
  try { $hash=([BitConverter]::ToString($h.ComputeHash([Text.Encoding]::UTF8.GetBytes($raw)))).Replace('-','').ToLowerInvariant() } finally { $h.Dispose() }
  @{channel=$e.LogName; computer=$e.MachineName; recordId=[long]$e.RecordId; provider=$e.ProviderName; providerId=[string]$e.ProviderId; id=[int]$e.Id; version=[int]$e.Version; createdAt=$e.TimeCreated.ToUniversalTime().ToString('o'); data=$data; xml=$raw; sha256=$hash}
}
$os=Get-CimInstance Win32_OperatingSystem; $product=Get-CimInstance Win32_ComputerSystemProduct;
$oldest=Get-WinEvent -LogName System -Oldest -MaxEvents 1;
$counter=Row (Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='Microsoft-Windows-Kernel-Boot';Id=20} -MaxEvents 1);
if($counter.version -ne 1 -or !$counter.data.ContainsKey('LastBootId')) { throw 'Unsupported boot-counter schema' }
$rows=@(${anchorRecordId === undefined ? "Get-WinEvent -LogName System -MaxEvents 1" : `Get-WinEvent -LogName System -FilterXPath '*[System[EventRecordID >= ${anchorRecordId}]]' -MaxEvents 8193`} | Sort-Object RecordId | ForEach-Object { Row $_ });
@{version=1; platform='win32'; observedAt=[DateTime]::UtcNow.ToString('o'); lastBootUpTime=$os.LastBootUpTime.ToUniversalTime().ToString('o'); host=@{hardwareUuid=[string]$product.UUID; name=[string]$os.CSName}; bootCounter=[long]$counter.data.LastBootId; oldestRecordId=[long]$oldest.RecordId; headRecordId=[long]$rows[-1].recordId; events=$rows} | ConvertTo-Json -Depth 8 -Compress`;
  const output = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  const result = JSON.parse(output.replace(/^\uFEFF/u, ""));
  validateObservation(result);
  return result;
}

export function createBootBaseline({
  repositoryIdentity,
  run,
  ticket = null,
  ownerTask,
  snapshot,
  observation,
  targetTimes,
}) {
  validateObservation(observation);
  requireProof(
    uuid.test(run) && (!ticket || uuid.test(ticket)) && uuid.test(ownerTask),
    "exact target and original owner task required",
  );
  requireProof(observation.events.length === 1 && utc(observation.observedAt), "baseline requires current log head");
  requireProof(
    targetTimes.length > 0 && targetTimes.every((t) => utc(t) && Date.parse(t) < Date.parse(observation.observedAt)),
    "unknown or later possible target launch",
  );
  const targetSnapshot = snapshot.filter(
    (entry) =>
      entry.file === `leases/${run}.lock` ||
      entry.file.startsWith(`leases/${run}.lock/`) ||
      (ticket && entry.file === `queue/${ticket}.json`),
  );
  requireProof(targetSnapshot.length > 0, "missing exact target bytes");
  const baseline = {
    version: 1,
    contract: bootProofContract,
    repositoryIdentity: identity(repositoryIdentity),
    run,
    ticket,
    ownerTask,
    targetSnapshot,
    targetSha256: digest(targetSnapshot),
    coordinatorSnapshot: snapshot,
    targetTimes,
    before: observation,
  };
  return { ...baseline, baselineSha256: digest(baseline) };
}

// Companion evidence must be supplied and reviewed independently. A hash pins
// bytes; it does not prove historical locality or authorize a recovery operation.
export function readScopeReview(file, expect) {
  requireProof(hex.test(expect), "explicit independently reviewed scope hash required");
  requireProof(lstatSync(file).isFile() && !lstatSync(file).isSymbolicLink(), "scope receipt must be a regular file");
  const bytes = readFileSync(file);
  requireProof(sha(bytes) === expect, "scope receipt changed");
  const receipt = JSON.parse(bytes);
  requireProof(Array.isArray(receipt.assessments), "missing scope assessments");
  const artifacts = [];
  const names = new Set();
  for (const assessment of receipt.assessments) {
    requireProof(
      Array.isArray(assessment.artifacts) && assessment.artifacts.length > 0,
      "unsupported scope assertion without evidence",
    );
    for (const artifact of assessment.artifacts) {
      requireProof(
        /^[a-zA-Z0-9_-]+\.(?:json|log|txt|patch)$/u.test(artifact.name) && !names.has(artifact.name),
        "unsafe or duplicate scope artifact",
      );
      names.add(artifact.name);
      const artifactPath = path.join(path.dirname(file), artifact.name);
      requireProof(
        lstatSync(artifactPath).isFile() && !lstatSync(artifactPath).isSymbolicLink(),
        "unknown scope artifact identity",
      );
      const content = readFileSync(artifactPath);
      requireProof(
        content.length > 0 && hex.test(artifact.sha256) && sha(content) === artifact.sha256,
        "missing or changed scope artifact bytes",
      );
      artifacts.push({ ...artifact, bytes: content.toString("base64") });
    }
  }
  return { receipt, receiptSha256: expect, receiptBytes: bytes.toString("base64"), artifacts };
}

export function validateBootBoundary({
  baseline,
  baselineExpect,
  scope,
  scopeExpect,
  current,
  repositoryIdentity,
  run,
  ticket = null,
  targetSnapshot,
  targetTimes,
}) {
  requireProof(baseline?.version === 1 && baseline.contract === bootProofContract, "unknown baseline contract");
  const { baselineSha256, ...unsigned } = baseline;
  requireProof(
    hex.test(baselineExpect) && baselineSha256 === baselineExpect && digest(unsigned) === baselineExpect,
    "baseline changed or unapproved hash",
  );
  requireProof(
    baseline.repositoryIdentity === identity(repositoryIdentity) && baseline.run === run && baseline.ticket === ticket,
    "baseline targets another run or repository",
  );
  requireProof(
    digest(targetSnapshot) === baseline.targetSha256 && digest(baseline.targetSnapshot) === baseline.targetSha256,
    "target bytes changed since baseline",
  );
  requireProof(
    Array.isArray(targetTimes) && digest(targetTimes) === digest(baseline.targetTimes),
    "target launch timestamps changed or omitted",
  );
  validateObservation(baseline.before);
  validateObservation(current);
  const before = baseline.before;
  requireProof(digest(current.host) === digest(before.host), "host identity changed");
  requireProof(
    Date.parse(current.observedAt) > Date.parse(before.observedAt) &&
      Date.parse(current.lastBootUpTime) > Date.parse(before.observedAt) &&
      current.bootCounter > before.bootCounter,
    "no later independent kernel boot boundary",
  );
  requireProof(
    baseline.targetTimes.every((t) => utc(t) && Date.parse(t) < Date.parse(before.observedAt)),
    "ambiguous possible launch time",
  );
  const anchor = before.events.at(-1);
  requireProof(
    current.oldestRecordId <= anchor.recordId &&
      current.events[0].recordId === anchor.recordId &&
      current.events[0].sha256 === anchor.sha256,
    "preboot anchor missing, restored or changed",
  );
  const interval = current.events.slice(1);
  requireProof(
    interval.length > 0 &&
      interval.every(
        (e) =>
          Date.parse(e.createdAt) >= Date.parse(before.observedAt) &&
          Date.parse(e.createdAt) <= Date.parse(current.observedAt),
      ),
    "ambiguous event chronology",
  );
  requireProof(
    !interval.some(
      (e) =>
        (e.provider === providers.general[0] && e.id === 1) ||
        (e.provider === "Microsoft-Windows-Kernel-Power" && [42, 107].includes(e.id)) ||
        (e.provider === "Microsoft-Windows-Power-Troubleshooter" && e.id === 1) ||
        (e.provider === "Microsoft-Windows-Eventlog" && e.id === 104),
    ),
    "clock change, resume, sleep or cleared log",
  );
  const starts = interval.filter((e) => e.provider === providers.general[0] && e.id === 12);
  requireProof(
    starts.length === 1 && eventMatches(starts[0], "general", 12, 0) && utc(starts[0].data.StartTime),
    "ambiguous kernel-start event schema",
  );
  const start = starts[0];
  requireProof(
    Math.abs(Date.parse(start.data.StartTime) - Date.parse(current.lastBootUpTime)) <= 2000,
    "kernel event and CIM boot time disagree",
  );
  const nearStart = (e) => Math.abs(Date.parse(e.createdAt) - Date.parse(start.createdAt)) <= 120000;
  const boots = interval.filter((e) => e.provider === providers.boot[0] && e.id === 27);
  requireProof(
    boots.length === 1 &&
      eventMatches(boots[0], "boot", 27, 1) &&
      boots[0].data.BootType === "0" &&
      nearStart(boots[0]),
    "unknown, fast or hibernation boot type",
  );
  const status = interval.filter((e) => e.provider === providers.boot[0] && e.id === 20);
  requireProof(
    status.length === 1 &&
      eventMatches(status[0], "boot", 20, 1) &&
      status[0].data.LastShutdownGood === "true" &&
      status[0].data.LastBootGood === "true" &&
      Number(status[0].data.LastBootId) === current.bootCounter &&
      nearStart(status[0]),
    "unproven successful shutdown or boot counter",
  );
  const requests = interval.filter((e) => e.provider === providers.user[0] && e.id === 1074);
  requireProof(
    requests.length === 1 &&
      eventMatches(requests[0], "user", 1074, 0) &&
      requests[0].data.param5 === "restart" &&
      Date.parse(requests[0].createdAt) >= Date.parse(before.observedAt) &&
      Date.parse(requests[0].createdAt) < Date.parse(current.lastBootUpTime),
    "missing exact structured restart request",
  );
  const review = scope?.receipt;
  requireProof(
    hex.test(scopeExpect) &&
      scope.receiptSha256 === scopeExpect &&
      sha(Buffer.from(scope.receiptBytes, "base64")) === scopeExpect &&
      digest(JSON.parse(Buffer.from(scope.receiptBytes, "base64"))) === digest(review),
    "scope receipt changed or missing",
  );
  requireProof(
    review.version === 1 &&
      review.contract === bootProofContract &&
      review.baselineSha256 === baselineExpect &&
      review.repositoryIdentity === baseline.repositoryIdentity &&
      review.run === run &&
      review.ticket === ticket &&
      review.kernelBootEventSha256 === start.sha256,
    "scope receipt is not exact-run and exact-boot",
  );
  requireProof(
    review.ownerTask === baseline.ownerTask &&
      uuid.test(review.reviewerTask) &&
      review.reviewerTask !== review.ownerTask &&
      utc(review.reviewedAt) &&
      Date.parse(review.reviewedAt) >= Date.parse(start.createdAt) &&
      Date.parse(review.reviewedAt) <= Date.parse(current.observedAt),
    "missing independent postboot historical-scope review",
  );
  const required = [
    "historical-local-work-only",
    "no-persistent-continuation",
    "no-restore-or-reactivation",
    "participating-runner-compatibility",
  ];
  requireProof(
    review.assessments.length === required.length &&
      required.every(
        (subject) =>
          review.assessments.filter(
            (a) => a.subject === subject && a.conclusion === "verified" && a.artifacts?.length > 0,
          ).length === 1,
      ),
    "unknown locality, continuation, restore or runner compatibility",
  );
  requireProof(
    scope.artifacts.length > 0 &&
      scope.artifacts.every((a) => hex.test(a.sha256) && sha(Buffer.from(a.bytes, "base64")) === a.sha256),
    "scope artifact changed",
  );
  const historical = review.assessments.find((a) => a.subject === "historical-local-work-only");
  requireProof(
    historical.artifacts.some((a) => a.kind === "original-launch-log") &&
      historical.artifacts.some((a) => a.kind === "original-source-snapshot" && /^[a-f0-9]{40}$/u.test(a.sourceCommit)),
    "historical launch provenance missing; current source is insufficient",
  );
  for (const assessment of review.assessments)
    requireProof(
      assessment.artifacts.every((a) => scope.artifacts.some((b) => a.name === b.name && a.sha256 === b.sha256)),
      "scope artifact absent",
    );
  const head = current.events.find((e) => e.recordId === review.reviewedHeadRecordId);
  requireProof(
    head && head.sha256 === review.reviewedHeadSha256 && head.recordId >= start.recordId,
    "reviewed postboot event head missing",
  );
  return {
    kind: bootProofContract,
    baselineSha256: baselineExpect,
    scopeSha256: scopeExpect,
    host: current.host,
    kernelStartEventSha256: start.sha256,
    kernelBootCounter: current.bootCounter,
    lastBootUpTime: current.lastBootUpTime,
  };
}
