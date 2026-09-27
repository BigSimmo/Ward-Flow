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
  const rows = [];
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
  if (!observation.complete || !entries.length || !Number.isFinite(now))
    add("incomplete-input", "scope", "incomplete", "Required scope was not completely checked");
  if (!valid.length) {
    for (const entry of entries) {
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
      coverage.inScope++;
      coverage[row.admission]++;
      if (row.reasons.length && row.admission !== "excluded") coverage.unresolved++;
      const debt = registry.unresolved.find(
        (d) =>
          d.path === entry.path &&
          (!d.expiresAt || Date.parse(d.expiresAt) > now) &&
          !d.supersededBy &&
          d.scope.sourceClass === row.sourceClass &&
          d.scope.contentHash === row.contentHash &&
          JSON.stringify([...d.scope.reasons].sort()) === JSON.stringify([...row.reasons].sort()),
      );
      for (const reason of row.reasons) {
        if (reason === "outside-scope") continue;
        add(
          reason,
          row.id,
          row.admission === "unavailable" ? "incomplete" : debt || reason === "content-denied" ? "review" : "blocking",
          row.label,
          debt?.reference,
        );
      }
      rows.push(row);
    }
    const byPath = new Map(entries.map((e) => [e.path, e]));
    // Exact rules name existing sources. A removed/renamed target must not silently
    // lose its system classification behind a broader module rule. Wildcard rules
    // may deliberately reserve a location for future work.
    for (const rule of registry.rules) {
      if (!rule.pattern.includes("*") && !byPath.has(rule.pattern))
        add("missing-rule-target", rule.id, "blocking", rule.id, rule.reference);
    }
    const references = new Set();
    for (const record of [
      ...registry.rules,
      ...registry.exceptions,
      ...registry.renames,
      ...registry.unresolved,
      ...registry.canonicalSources,
    ]) {
      references.add(record.reference);
      if (record.expiresAt && Date.parse(record.expiresAt) <= now)
        add("expired-record", record.id, "blocking", record.id, record.reference);
      if (record.supersededBy) {
        references.add(record.supersededBy);
        add("superseded-record", record.id, "review", record.id, record.reference);
      }
    }
    for (const source of registry.canonicalSources) {
      references.add(source.path);
      const entry = byPath.get(source.path);
      if (source.expectedHash && entry?.contentHash !== source.expectedHash)
        add("declared-source-changed", source.id, "blocking", source.id, source.reference);
    }
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
  rows.sort((a, b) => a.id.localeCompare(b.id));
  let baseline = "incompatible-or-missing";
  const old = previousSnapshot;
  const hashOrNull = (value) => value === null || (typeof value === "string" && /^[a-f0-9]{64}$/u.test(value));
  const validPriorRow = (row) =>
    row &&
    /^[a-f0-9]{20}$/u.test(row.id) &&
    (row.path === null
      ? row.label === `Restricted artifact ${row.id}`
      : safePath(row.path) && row.label === row.path) &&
    hashOrNull(row.contentHash) &&
    hashOrNull(row.metadataHash) &&
    (row.source === null || typeof row.source === "string") &&
    ["admitted", "restricted", "excluded", "unavailable"].includes(row.admission);
  const compatible =
    old?.schemaVersion === 1 &&
    old.product === "ward-flow" &&
    Array.isArray(old.rows) &&
    old.rows.every(validPriorRow) &&
    new Set(old.rows.map((row) => row.id)).size === old.rows.length &&
    old.snapshot?.worktreeId === observation.worktreeId &&
    old.snapshot?.repositoryId === observation.repositoryId &&
    old.snapshot?.source === observation.source;
  if (compatible)
    baseline =
      old.snapshot.registryHash === observation.registryHash && old.snapshot.toolHash === observation.toolHash
        ? "compatible"
        : "registry-or-tool-changed";
  const changes = { added: [], deleted: [], changed: [] };
  if (compatible) {
    const before = new Map(old.rows.map((r) => [r.id, r]));
    const after = new Map(rows.map((r) => [r.id, r]));
    for (const row of rows) {
      const prior = before.get(row.id);
      if (!prior) changes.added.push(row.label);
      else if (
        row.contentHash !== prior.contentHash ||
        row.metadataHash !== prior.metadataHash ||
        row.source !== prior.source ||
        row.admission !== prior.admission
      )
        changes.changed.push(row.label);
    }
    for (const row of old.rows)
      if (!after.has(row.id))
        changes.deleted.push(
          row.path && contentDenied(row.path, registry) ? `Restricted artifact ${row.id}` : row.label,
        );
    for (const values of Object.values(changes)) values.sort();
  }
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
    exitCode: sorted.some((f) => f.severity === "incomplete")
      ? 2
      : sorted.some((f) => f.severity === "blocking")
        ? 1
        : 0,
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
    value
      .split("/")
      .every(
        (part) =>
          part &&
          part !== "." &&
          part !== ".." &&
          !/[. ]$/u.test(part) &&
          !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part),
      )
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
  if (errors.length) return errors;
  // Validate record shapes before cross-record lookups or duplicate-path checks.
  // Malformed JSON must produce a validation result, not a TypeError in callers.
  for (const key of ["sourceClasses", "rules", "exceptions", "canonicalSources", "renames", "unresolved"]) {
    if (registry[key].some((record) => !record || typeof record !== "object" || Array.isArray(record)))
      errors.push(`invalid-${key}-record`);
  }
  if (errors.length) return errors;
  if (!registry.roots.length || registry.roots.some((p) => !safePath(p, true) || p === "**" || p === "*"))
    errors.push("invalid-roots");
  if (registry.denials.some((p) => !safePath(p, true))) errors.push("invalid-denials");
  const extensions = new Set();
  const ids = new Set();
  for (const sourceClass of registry.sourceClasses) {
    if (!nonempty(sourceClass.id) || !Array.isArray(sourceClass.extensions) || !sourceClass.extensions.length) {
      errors.push("invalid-source-class");
      continue;
    }
    for (const ext of sourceClass.extensions) {
      if (!/^\.[a-z0-9]+$/u.test(ext) || extensions.has(ext)) errors.push("invalid-extension");
      extensions.add(ext);
    }
  }
  for (const [kind, records] of Object.entries({
    rules: registry.rules,
    exceptions: registry.exceptions,
    canonicalSources: registry.canonicalSources,
    renames: registry.renames,
    unresolved: registry.unresolved,
  })) {
    for (const record of records) {
      if (!record || !/^[a-z0-9][a-z0-9-]*$/u.test(record.id) || ids.has(record.id)) errors.push("invalid-record-id");
      ids.add(record?.id);
      if (!record || !nonempty(record.reviewedBy) || !safePath(record.reference)) {
        errors.push("unreviewed-record");
        continue;
      }
      if (record.expiresAt !== undefined && !Number.isFinite(Date.parse(record.expiresAt)))
        errors.push("invalid-expiry");
      if (record.supersededBy !== undefined && !safePath(record.supersededBy)) errors.push("invalid-supersession");
      if (kind === "rules" || kind === "exceptions") {
        if (
          !["ward-flow", "shared", "mixed", "excluded", "design-reference"].includes(record.owner) ||
          !(record.system === null || SYSTEMS.includes(record.system)) ||
          !(record.module === null || nonempty(record.module))
        )
          errors.push("invalid-classification");
        if (
          kind === "rules"
            ? !safePath(record.pattern, true) || !Number.isSafeInteger(record.priority)
            : !safePath(record.path)
        )
          errors.push("invalid-selector");
      } else if (kind === "renames") {
        if (
          !safePath(record.from) ||
          !safePath(record.to) ||
          record.from === record.to ||
          !registry.exceptions.some((e) => e.id === record.exceptionId && e.path === record.from)
        )
          errors.push("invalid-rename");
      } else {
        if (!safePath(record.path)) errors.push("invalid-record-path");
        if (
          kind === "unresolved" &&
          (!nonempty(record.reason) ||
            !nonempty(record.owner) ||
            !record.scope ||
            !Array.isArray(record.scope.reasons) ||
            !record.scope.reasons.length ||
            !(
              record.scope.sourceClass === null || registry.sourceClasses.some((c) => c.id === record.scope.sourceClass)
            ) ||
            !(record.scope.contentHash === null || /^[a-f0-9]{64}$/u.test(record.scope.contentHash)))
        )
          errors.push("invalid-unresolved-scope");
        if (
          kind === "canonicalSources" &&
          record.expectedHash !== undefined &&
          !/^[a-f0-9]{64}$/u.test(record.expectedHash)
        )
          errors.push("invalid-source-hash");
      }
    }
  }
  for (const key of ["exceptions", "unresolved", "canonicalSources"]) {
    const paths = registry[key].map((r) => r.path);
    if (new Set(paths).size !== paths.length) errors.push(`duplicate-${key}`);
  }
  if (new Set(registry.renames.map((r) => r.to)).size !== registry.renames.length) errors.push("duplicate-renames");
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
  if (!safePath(entry.path) || entry.contained === false || entry.kind === "link")
    return { ...base, admission: "unavailable", reasons: ["unsafe-path"] };
  if (!registry.roots.some((p) => matches(entry.path, p)))
    return { ...base, admission: "excluded", reasons: ["outside-scope"] };
  if (contentDenied(entry.path, registry)) return { ...base, reasons: ["content-denied"] };
  if (entry.kind !== "file") return { ...base, admission: "unavailable", reasons: ["unavailable-source"] };
  const sourceClass =
    registry.sourceClasses.find((c) => c.extensions.includes(posix.extname(entry.path).toLowerCase()))?.id ?? null;
  const exact = registry.exceptions.find((r) => r.path === entry.path);
  const rename = registry.renames.find((r) => r.to === entry.path);
  const inherited = rename && registry.exceptions.find((r) => r.id === rename.exceptionId);
  const rules = registry.rules.filter((r) => matches(entry.path, r.pattern)).sort((a, b) => b.priority - a.priority);
  if (!exact && !inherited && rules.length > 1 && rules[0].priority === rules[1].priority)
    return { ...base, sourceClass, reasons: ["conflicting-rules"] };
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
  if (["excluded", "design-reference"].includes(rule.owner))
    return { ...known, path: entry.path, label: entry.path, admission: "excluded" };
  if (!sourceClass) return { ...known, reasons: ["unknown-source-class"] };
  return { ...known, path: entry.path, label: entry.path, admission: "admitted" };
}
