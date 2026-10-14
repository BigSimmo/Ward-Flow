import { createHash } from "node:crypto";
import { posix } from "node:path";

export const TOOL_VERSION = "2";
export const SYSTEMS = [
  "behaviour",
  "data-content",
  "documentation-knowledge",
  "issue-health",
  "safety-governance",
  "change-recovery",
];
export const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function buildReport(observation, registry, previousSnapshot = null) {
  const findings = new Map();
  const add = (code, identity, severity, label, reference = "docs/ward-flow-task-ledger.md") => {
    const id = digest(`${code}:${identity}`).slice(0, 20);
    findings.set(id, { id, code, severity, label, reference });
  };
  const evaluatedAt = observation.evaluatedAt;
  const now = Date.parse(evaluatedAt);
  const valid = validateRegistry(registry);
  const entries = observation.entries ?? [];
  const coverage = {
    discovered: observation.discovered ?? entries.length,
    inScope: 0,
    admitted: 0,
    restricted: 0,
    excluded: observation.outsideScope ?? 0,
    unavailable: 0,
    unresolved: 0,
  };
  for (const code of valid) add(code, "registry", "incomplete", "Registry cannot be interpreted safely");
  if (!completeObservation(observation, entries, now))
    add("incomplete-input", "scope", "incomplete", "Required scope was not completely checked");
  const rows = valid.length ? [] : collectClassifiedRows(entries, { registry, now, add, coverage });
  if (!valid.length) collectDeclaredSourceFindings(observation, registry, entries, { add, now });
  rows.sort((a, b) => a.id.localeCompare(b.id));
  const baseline = snapshotBaseline(previousSnapshot, observation);
  const changes =
    baseline === "incompatible-or-missing"
      ? { added: [], deleted: [], changed: [] }
      : snapshotChanges(previousSnapshot, rows, registry);
  const sorted = [...findings.values()].sort((a, b) => a.id.localeCompare(b.id));
  const snapshot = Object.fromEntries(
    Object.entries(observation).filter(([key]) => !["entries", "references"].includes(key)),
  );
  return {
    schemaVersion: 1,
    product: "ward-flow",
    generation: null,
    snapshot,
    baseline,
    analysis: "full-declared-scope",
    scope: (registry.roots ?? []).map((root) => (contentDenied(root, registry) ? "[restricted source scope]" : root)),
    exclusions: [
      "Ignored files, caches, dependencies and other worktrees",
      "PsychSift content outside registered shared boundaries",
      "Design references: metadata only",
      "Unknown or denied content: metadata only; null hashes do not prove content freshness",
      "No semantic, clinical, runtime or continuous freshness claim",
    ],
    coverage,
    rows,
    findings: sorted,
    changes,
    exitCode: reportExitCode(sorted),
  };
}
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

// Reject Windows aliases, alternate streams and non-portable spellings before resolving paths.
export function safePath(value, pattern = false) {
  return (
    nonempty(value) &&
    !/[\\:\x00-\x1f\x7f<>"|?]/u.test(value) &&
    (pattern || !value.includes("*")) &&
    !value.startsWith("/") &&
    value.split("/").every(safePathPart)
  );
}

export function matches(path, pattern) {
  const expression = pattern
    .split("**")
    .map((part) =>
      part
        .split("*")
        .map((text) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
        .join("[^/]*"),
    )
    .join(".*");
  return new RegExp(`^${expression}$`, "u").test(path);
}

// Non-negotiable classes also protect the registry bootstrap. Registry denials can only add to these.
export function deniedPath(path) {
  return (
    /(^|\/)(?:\.git|node_modules|\.next|\.cache|private|secrets?|credentials?|patient-data|exports?|uploads?)(\/|$)/iu.test(
      path,
    ) ||
    /(^|\/)\.env(?:\.|$)/iu.test(path) ||
    /(?:\.secret\.|\.(?:pem|key|pfx|p12|sqlite|db|csv|xlsx?|zip)$)/iu.test(path)
  );
}

// Denials are conservative across Windows case aliases; ownership selectors stay exact.
export function contentDenied(path, registry) {
  return deniedPath(path) || registry.denials.some((pattern) => matches(path.toLowerCase(), pattern.toLowerCase()));
}

export function validateRegistry(registry) {
  if (!registry || registry.schemaVersion !== 1) return ["unsupported-registry-version"];
  const errors = [];
  validateRegistryHeader(registry, errors);
  if (errors.length) return errors;
  validateRegistryShapes(registry, errors);
  if (errors.length) return errors;
  validateRegistrySelectors(registry, errors);
  validateSourceClasses(registry, errors);
  validateRegistryRecords(registry, errors);
  validateDuplicateSelectors(registry, errors);
  return [...new Set(errors)];
}

export function classifyEntry(entry, registry) {
  const id = digest(String(entry.path)).slice(0, 20);
  const base = {
    id,
    path: null,
    label: `Restricted artifact ${id}`,
    owner: "unknown",
    module: null,
    system: null,
    source: null,
    sourceClass: null,
    canonicalLinks: [],
    admission: "restricted",
    reasons: [],
  };
  const restricted = restrictEntry(entry, registry, base);
  if (restricted) return restricted;
  const sourceClass =
    registry.sourceClasses.find((c) => c.extensions.includes(posix.extname(entry.path).toLowerCase()))?.id ?? null;
  const exact = registry.exceptions.find((r) => r.path === entry.path);
  const rename = registry.renames.find((r) => r.to === entry.path);
  const inherited = rename && registry.exceptions.find((r) => r.id === rename.exceptionId);
  const rules = registry.rules.filter((r) => matches(entry.path, r.pattern)).sort((a, b) => b.priority - a.priority);
  if (conflictingRules(exact, inherited, rules)) return { ...base, sourceClass, reasons: ["conflicting-rules"] };
  const rule = exact ?? inherited ?? rules[0];
  if (!rule) return { ...base, sourceClass, reasons: ["unclassified"] };
  const known = {
    ...base,
    owner: rule.owner,
    module: rule.module,
    system: rule.system,
    source: rename && !exact ? rename.id : rule.id,
    sourceClass,
    canonicalLinks: [rule.reference],
  };
  return admitKnownEntry(known, entry);
}

function collectClassifiedRows(entries, context) {
  const { registry, now, add, coverage } = context;
  return entries.map((entry) => {
    const row = classifiedRow(entry, registry);
    recordCoverage(row, coverage);
    const debt = registry.unresolved.find((d) => matchesRowDebt(d, entry, row, now));
    collectRowFindings(row, debt, add);
    return row;
  });
}

function collectDeclaredSourceFindings(observation, registry, entries, context) {
  const { add, now } = context;
  const byPath = new Map(entries.map((e) => [e.path, e]));
  // Exact selectors must still name an existing source; wildcard rules may reserve future paths.
  checkRuleTargets(registry, byPath, add);
  const references = new Set();
  for (const record of [
    ...registry.rules,
    ...registry.exceptions,
    ...registry.renames,
    ...registry.unresolved,
    ...registry.canonicalSources,
  ])
    checkReferenceRecord(record, { references, add, now });
  for (const source of registry.canonicalSources) checkCanonicalSource(source, { references, byPath, add });
  checkReferenceTargets(references, observation, add);
}

function priorRowHasSafePath(row) {
  return row.path === null
    ? row.label === `Restricted artifact ${row.id}`
    : safePath(row.path) && row.label === row.path;
}

function hashOrNull(value) {
  return value === null || (typeof value === "string" && /^[a-f0-9]{64}$/u.test(value));
}

function validPriorRow(row) {
  return (
    row &&
    /^[a-f0-9]{20}$/u.test(row.id) &&
    priorRowHasSafePath(row) &&
    hashOrNull(row.contentHash) &&
    hashOrNull(row.metadataHash) &&
    (row.source === null || typeof row.source === "string") &&
    ["admitted", "restricted", "excluded", "unavailable"].includes(row.admission)
  );
}

function validPriorSnapshotRows(old) {
  return (
    old?.schemaVersion === 1 &&
    old.product === "ward-flow" &&
    Array.isArray(old.rows) &&
    old.rows.every(validPriorRow) &&
    new Set(old.rows.map((row) => row.id)).size === old.rows.length
  );
}

function compatibleSnapshot(old, observation) {
  return (
    validPriorSnapshotRows(old) &&
    old.snapshot?.worktreeId === observation.worktreeId &&
    old.snapshot?.repositoryId === observation.repositoryId &&
    old.snapshot?.source === observation.source
  );
}

function snapshotBaseline(old, observation) {
  if (!compatibleSnapshot(old, observation)) return "incompatible-or-missing";
  return old.snapshot.registryHash === observation.registryHash && old.snapshot.toolHash === observation.toolHash
    ? "compatible"
    : "registry-or-tool-changed";
}

function snapshotChanges(old, rows, registry) {
  const changes = { added: [], deleted: [], changed: [] };
  const before = new Map(old.rows.map((r) => [r.id, r]));
  const after = new Map(rows.map((r) => [r.id, r]));
  for (const row of rows) collectRowChange(row, before.get(row.id), changes);
  changes.deleted = old.rows.filter((row) => !after.has(row.id)).map((row) => deletedRowLabel(row, registry));
  for (const values of Object.values(changes)) values.sort();
  return changes;
}

function validateRegistryHeader(registry, errors) {
  if (registry.product !== "ward-flow") errors.push("wrong-product");

  if (
    !Array.isArray(registry.systems) ||
    JSON.stringify([...registry.systems].sort()) !== JSON.stringify([...SYSTEMS].sort())
  )
    errors.push("invalid-systems");

  for (const key of [
    "roots",
    "sourceClasses",
    "denials",
    "rules",
    "exceptions",
    "canonicalSources",
    "renames",
    "unresolved",
  ]) {
    if (!Array.isArray(registry[key])) errors.push(`invalid-${key}`);
  }
}

function validateRegistryShapes(registry, errors) {
  for (const key of ["sourceClasses", "rules", "exceptions", "canonicalSources", "renames", "unresolved"]) {
    if (registry[key].some((record) => !registryRecordObject(record))) errors.push(`invalid-${key}-record`);
  }
}

function validateRegistrySelectors(registry, errors) {
  if (!registry.roots.length || registry.roots.some((p) => !permittedRootPattern(p))) errors.push("invalid-roots");

  if (registry.denials.some((p) => !safePath(p, true))) errors.push("invalid-denials");
}

function validateSourceClasses(registry, errors) {
  const extensions = new Set();
  for (const sourceClass of registry.sourceClasses) validateSourceClass(sourceClass, extensions, errors);
}

function validateClassificationRecord(kind, record, errors) {
  if (!validRecordClassification(record)) errors.push("invalid-classification");

  if (
    kind === "rules"
      ? !safePath(record.pattern, true) || !Number.isSafeInteger(record.priority)
      : !safePath(record.path)
  )
    errors.push("invalid-selector");
}

function validateRenameRecord(record, registry, errors) {
  if (!validRecordRename(record, registry)) errors.push("invalid-rename");
}

function validateSourceRecord(kind, record, registry, errors) {
  if (!safePath(record.path)) errors.push("invalid-record-path");
  if (kind === "unresolved" && !validUnresolvedRecord(record, registry)) errors.push("invalid-unresolved-scope");
  if (kind === "canonicalSources" && invalidExpectedHash(record)) errors.push("invalid-source-hash");
}

function validateRegistryRecord(kind, record, context) {
  const { registry, ids, errors } = context;
  validateRecordId(record, ids, errors);
  if (!recordIsReviewed(record)) {
    errors.push("unreviewed-record");
    return;
  }
  validateRecordMetadata(record, errors);
  if (kind === "rules" || kind === "exceptions") validateClassificationRecord(kind, record, errors);
  else if (kind === "renames") validateRenameRecord(record, registry, errors);
  else validateSourceRecord(kind, record, registry, errors);
}

function validateRegistryRecords(registry, errors) {
  const ids = new Set();
  for (const [kind, records] of Object.entries({
    rules: registry.rules,
    exceptions: registry.exceptions,
    canonicalSources: registry.canonicalSources,
    renames: registry.renames,
    unresolved: registry.unresolved,
  })) {
    for (const record of records) validateRegistryRecord(kind, record, { registry, ids, errors });
  }
}

function validateDuplicateSelectors(registry, errors) {
  for (const key of ["exceptions", "unresolved", "canonicalSources"]) {
    const paths = registry[key].map((r) => r.path);
    if (new Set(paths).size !== paths.length) errors.push(`duplicate-${key}`);
  }

  if (new Set(registry.renames.map((r) => r.to)).size !== registry.renames.length) errors.push("duplicate-renames");
}

function classifiedRow(entry, registry) {
  const classification = classifyEntry(entry, registry);
  const row = {
    ...classification,
    contentHash: classification.admission === "admitted" ? (entry.contentHash ?? null) : null,
    metadataHash: entry.metadataHash ?? null,
  };
  if (row.admission === "admitted" && !row.contentHash) {
    row.admission = "unavailable";
    row.reasons = ["unreadable-source"];
  }
  return row;
}

function recordCoverage(row, coverage) {
  coverage.inScope++;
  coverage[row.admission]++;
  if (row.reasons.length && row.admission !== "excluded") coverage.unresolved++;
}

function matchesRowDebt(d, entry, row, now) {
  return (
    d.path === entry.path &&
    (!d.expiresAt || Date.parse(d.expiresAt) > now) &&
    !d.supersededBy &&
    d.scope.sourceClass === row.sourceClass &&
    d.scope.contentHash === row.contentHash &&
    JSON.stringify([...d.scope.reasons].sort()) === JSON.stringify([...row.reasons].sort())
  );
}

function collectRowFindings(row, debt, add) {
  for (const reason of row.reasons) {
    if (reason === "outside-scope") continue;
    add(reason, row.id, rowFindingSeverity(row, reason, debt), row.label, debt?.reference);
  }
}

function rowFindingSeverity(row, reason, debt) {
  if (row.admission === "unavailable") return "incomplete";
  return debt || reason === "content-denied" ? "review" : "blocking";
}

function checkRuleTargets(registry, byPath, add) {
  for (const rule of registry.rules) {
    if (!rule.pattern.includes("*") && !byPath.has(rule.pattern))
      add("missing-rule-target", rule.id, "blocking", rule.id, rule.reference);
  }
}

function checkReferenceRecord(record, context) {
  const { references, add, now } = context;
  references.add(record.reference);
  if (record.expiresAt && Date.parse(record.expiresAt) <= now)
    add("expired-record", record.id, "blocking", record.id, record.reference);
  if (record.supersededBy) {
    references.add(record.supersededBy);
    add("superseded-record", record.id, "review", record.id, record.reference);
  }
}

function checkCanonicalSource(source, context) {
  const { references, byPath, add } = context;
  references.add(source.path);
  const entry = byPath.get(source.path);
  if (source.expectedHash && entry?.contentHash !== source.expectedHash)
    add("declared-source-changed", source.id, "blocking", source.id, source.reference);
}

function checkReferenceTargets(references, observation, add) {
  for (const target of references) {
    const found = observation.references?.[target];
    if (found !== "present")
      add(
        found === "unsafe" ? "unsafe-reference" : "missing-reference",
        digest(target),
        found === "unsafe" ? "incomplete" : "blocking",
        `Canonical reference ${digest(target).slice(0, 12)}`,
      );
  }
}

function restrictEntry(entry, registry, base) {
  if (unsafeEntry(entry)) return { ...base, admission: "unavailable", reasons: ["unsafe-path"] };
  if (!registry.roots.some((p) => matches(entry.path, p)))
    return { ...base, admission: "excluded", reasons: ["outside-scope"] };
  if (contentDenied(entry.path, registry)) return { ...base, reasons: ["content-denied"] };
  if (entry.kind !== "file") return { ...base, admission: "unavailable", reasons: ["unavailable-source"] };
  return null;
}

function conflictingRules(exact, inherited, rules) {
  return !exact && !inherited && rules.length > 1 && rules[0].priority === rules[1].priority;
}

function safePathPart(part) {
  return (
    part &&
    part !== "." &&
    part !== ".." &&
    !/[. ]$/u.test(part) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part)
  );
}

function rowChanged(row, prior) {
  return (
    row.contentHash !== prior.contentHash ||
    row.metadataHash !== prior.metadataHash ||
    row.source !== prior.source ||
    row.admission !== prior.admission
  );
}

function collectRowChange(row, prior, changes) {
  if (!prior) changes.added.push(row.label);
  else if (rowChanged(row, prior)) changes.changed.push(row.label);
}

function deletedRowLabel(row, registry) {
  return row.path && contentDenied(row.path, registry) ? `Restricted artifact ${row.id}` : row.label;
}

function validateSourceClass(sourceClass, extensions, errors) {
  if (!declaredSourceClass(sourceClass)) {
    errors.push("invalid-source-class");
    return;
  }
  for (const ext of sourceClass.extensions) validateExtension(ext, extensions, errors);
}

function validateExtension(ext, extensions, errors) {
  if (!/^\.[a-z0-9]+$/u.test(ext) || extensions.has(ext)) errors.push("invalid-extension");
  extensions.add(ext);
}

function validUnresolvedRecord(record, registry) {
  return nonempty(record.reason) && nonempty(record.owner) && validUnresolvedScope(record.scope, registry);
}

function validUnresolvedScope(scope, registry) {
  return (
    scope &&
    Array.isArray(scope.reasons) &&
    scope.reasons.length &&
    knownSourceClass(scope.sourceClass, registry) &&
    validScopeHash(scope.contentHash)
  );
}

function validScopeHash(value) {
  return value === null || /^[a-f0-9]{64}$/u.test(value);
}

function knownSourceClass(id, registry) {
  return id === null || registry.sourceClasses.some((c) => c.id === id);
}

function invalidExpectedHash(record) {
  return record.expectedHash !== undefined && !/^[a-f0-9]{64}$/u.test(record.expectedHash);
}

function recordIsReviewed(record) {
  return record && nonempty(record.reviewedBy) && safePath(record.reference);
}

function validateRecordMetadata(record, errors) {
  if (record.expiresAt !== undefined && !Number.isFinite(Date.parse(record.expiresAt))) errors.push("invalid-expiry");
  if (record.supersededBy !== undefined && !safePath(record.supersededBy)) errors.push("invalid-supersession");
}

function validateRecordId(record, ids, errors) {
  if (!uniqueRecordId(record, ids)) errors.push("invalid-record-id");
  ids.add(record?.id);
}

function reportExitCode(findings) {
  if (findings.some((f) => f.severity === "incomplete")) return 2;
  return findings.some((f) => f.severity === "blocking") ? 1 : 0;
}

function completeObservation(observation, entries, now) {
  return observation.complete && entries.length && Number.isFinite(now);
}

function admitKnownEntry(known, entry) {
  if (["excluded", "design-reference"].includes(known.owner))
    return { ...known, path: entry.path, label: entry.path, admission: "excluded" };
  if (!known.sourceClass) return { ...known, reasons: ["unknown-source-class"] };
  return { ...known, path: entry.path, label: entry.path, admission: "admitted" };
}

function registryRecordObject(record) {
  return record && typeof record === "object" && !Array.isArray(record);
}

function permittedRootPattern(pattern) {
  return safePath(pattern, true) && pattern !== "**" && pattern !== "*";
}

function validRecordClassification(record) {
  return (
    ["ward-flow", "shared", "mixed", "excluded", "design-reference"].includes(record.owner) &&
    (record.system === null || SYSTEMS.includes(record.system)) &&
    (record.module === null || nonempty(record.module))
  );
}

function validRecordRename(record, registry) {
  return (
    safePath(record.from) &&
    safePath(record.to) &&
    record.from !== record.to &&
    registry.exceptions.some((e) => e.id === record.exceptionId && e.path === record.from)
  );
}

function unsafeEntry(entry) {
  return !safePath(entry.path) || entry.contained === false || entry.kind === "link";
}

function declaredSourceClass(sourceClass) {
  return nonempty(sourceClass.id) && Array.isArray(sourceClass.extensions) && sourceClass.extensions.length;
}

function uniqueRecordId(record, ids) {
  return record && /^[a-z0-9][a-z0-9-]*$/u.test(record.id) && !ids.has(record.id);
}
