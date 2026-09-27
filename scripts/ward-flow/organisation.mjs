import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  buildReport,
  classifyEntry,
  contentDenied,
  digest,
  matches,
  safePath,
  TOOL_VERSION,
  validateRegistry,
} from "./organisation-core.mjs";

export const REGISTRY_PATH = "docs/ward-flow/organisation/registry.json";
export function reportDirectory(root) {
  return path.join(
    git(root, ["rev-parse", "--path-format=absolute", "--git-dir"]).toString("utf8").trim(),
    "ward-organisation",
  );
}
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 96 * 1024 * 1024;
const TOOL_FILES = [fileURLToPath(import.meta.url), fileURLToPath(new URL("organisation-core.mjs", import.meta.url))];

function git(root, args, input) {
  return execFileSync("git", ["--no-optional-locks", "-C", root, ...args], {
    input,
    maxBuffer: MAX_TOTAL_BYTES,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" },
  });
}

// Walk only components of an enumerated name; never recursively walk the filesystem.
// Links/junctions (even inward links) and hardlinked files are conservatively unavailable.
function metadata(root, name) {
  if (!safePath(name)) return { path: name, contained: false, kind: "invalid" };
  let current = root;
  try {
    const parts = name.split("/");
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i]);
      const stat = fs.lstatSync(current, { bigint: true });
      if (stat.isSymbolicLink() || (i < parts.length - 1 && !stat.isDirectory()))
        return { path: name, contained: false, kind: "link" };
      if (i === parts.length - 1) {
        const real = fs.realpathSync.native(current);
        const relative = path.relative(root, real);
        const contained =
          relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) && stat.nlink <= 1n;
        return {
          path: name,
          contained,
          kind: stat.isFile() ? "file" : "other",
          stat,
          metadataHash: digest([stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs, stat.mode].join(":")),
        };
      }
    }
  } catch (error) {
    return { path: name, contained: true, kind: error.code === "ENOENT" ? "missing" : "unavailable" };
  }
}

function readContained(root, item) {
  if (!item.contained || item.kind !== "file" || item.stat.size > BigInt(MAX_FILE_BYTES))
    throw new Error("unavailable-source");
  const fd = fs.openSync(path.join(root, item.path), fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const handle = fs.fstatSync(fd, { bigint: true });
    const before = metadata(root, item.path);
    if (
      !before.contained ||
      before.metadataHash !== item.metadataHash ||
      handle.dev !== item.stat.dev ||
      handle.ino !== item.stat.ino
    )
      throw new Error("changing-input");
    const bytes = fs.readFileSync(fd);
    const after = metadata(root, item.path);
    if (bytes.length > MAX_FILE_BYTES || after.metadataHash !== before.metadataHash || !after.contained)
      throw new Error("changing-input");
    return bytes;
  } finally {
    fs.closeSync(fd);
  }
}

function indexEntries(root) {
  const records = git(root, ["ls-files", "--stage", "-z"]).toString("utf8").split("\0").filter(Boolean);
  const entries = new Map();
  let unmerged = false;
  for (const record of records) {
    const match = /^(\d+) ([a-f0-9]+) (\d)\t([\s\S]+)$/u.exec(record);
    if (!match) throw new Error("invalid-index");
    const [, mode, oid, stage, name] = match;
    if (stage !== "0") unmerged = true;
    entries.set(name, {
      path: name,
      oid,
      contained: safePath(name),
      kind: stage !== "0" ? "unmerged" : mode === "120000" ? "link" : /100(644|755)/u.test(mode) ? "file" : "other",
      metadataHash: digest(`${mode}:${stage}`),
    });
  }
  return { entries, unmerged };
}

function readBlobs(root, entries) {
  if (!entries.length) return new Map();
  const oids = [...new Set(entries.map((e) => e.oid))];
  const sizes = git(
    root,
    ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
    oids.join("\n") + "\n",
  )
    .toString("utf8")
    .trim()
    .split("\n");
  let total = 0;
  for (const line of sizes) {
    const [, type, size] = line.split(" ");
    total += Number(size);
    if (
      type !== "blob" ||
      !Number.isSafeInteger(Number(size)) ||
      Number(size) > MAX_FILE_BYTES ||
      total > MAX_TOTAL_BYTES
    )
      throw new Error("unavailable-object");
  }
  const output = git(root, ["cat-file", "--batch"], oids.join("\n") + "\n");
  const blobs = new Map();
  let offset = 0;
  for (const oid of oids) {
    const newline = output.indexOf(10, offset);
    const [actual, type, size] = output.subarray(offset, newline).toString("utf8").split(" ");
    if (actual !== oid || type !== "blob") throw new Error("unavailable-object");
    const end = newline + 1 + Number(size);
    if (end >= output.length || output[end] !== 10) throw new Error("incomplete-object");
    blobs.set(oid, output.subarray(newline + 1, end));
    offset = end + 1;
  }
  return blobs;
}

function capture(root, source, evaluatedAt) {
  // One git call for both (26 September 2026): rev-parse prints one line per argument, in order.
  // Each check captures twice, so this saves two process starts per check.
  const [repository, head] = git(root, ["rev-parse", "--path-format=absolute", "--git-common-dir", "HEAD"])
    .toString("utf8")
    .trim()
    .split(/\r?\n/u);
  if (!repository || !head) throw new Error("unavailable-head");
  const toolHash = digest(Buffer.concat(TOOL_FILES.map((p) => fs.readFileSync(p))));
  const index = indexEntries(root);
  let registryBytes;
  if (source === "index") {
    const item = index.entries.get(REGISTRY_PATH);
    if (!item || item.kind !== "file") throw new Error("unavailable-registry");
    registryBytes = readBlobs(root, [item]).get(item.oid);
  } else registryBytes = readContained(root, metadata(root, REGISTRY_PATH));
  const registry = JSON.parse(registryBytes.toString("utf8"));
  const errors = validateRegistry(registry);
  if (errors.length) throw new Error(errors.join(","));
  const names =
    source === "index"
      ? [...index.entries.keys()].sort()
      : [
          ...new Set(
            git(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
              .toString("utf8")
              .split("\0")
              .filter(Boolean),
          ),
        ].sort();
  if (!names.length || names.length > 100000) throw new Error("incomplete-inventory");
  const entries = [];
  let outsideScope = 0;
  let deleted = 0;
  let complete = !index.unmerged;
  let total = 0;
  const requiredBlobs = [];
  for (const name of names) {
    if (!registry.roots.some((p) => matches(name, p))) {
      outsideScope++;
      continue;
    }
    const item = source === "index" ? index.entries.get(name) : metadata(root, name);
    if (item.kind === "missing") {
      deleted++;
      continue;
    } // A working-tree deletion, not a read failure.
    const classification = classifyEntry(item, registry);
    const entry = {
      path: name,
      kind: item.kind,
      contained: item.contained,
      metadataHash: item.metadataHash ?? null,
      contentHash: null,
    };
    if (classification.admission === "admitted") {
      if (source === "index") requiredBlobs.push(item);
      else {
        try {
          const bytes = readContained(root, item);
          total += bytes.length;
          if (total > MAX_TOTAL_BYTES) throw new Error("scope-too-large");
          entry.contentHash = digest(bytes);
        } catch {
          complete = false;
        }
      }
    }
    entries.push(entry);
  }
  if (source === "index") {
    const blobs = readBlobs(root, requiredBlobs);
    const byPath = new Map(requiredBlobs.map((e) => [e.path, e]));
    for (const entry of entries)
      if (byPath.has(entry.path)) entry.contentHash = digest(blobs.get(byPath.get(entry.path).oid));
  }
  const references = {};
  const targets = new Set(
    [
      ...registry.rules,
      ...registry.exceptions,
      ...registry.renames,
      ...registry.unresolved,
      ...registry.canonicalSources,
    ]
      .flatMap((r) => [r.reference, r.supersededBy])
      .filter(Boolean),
  );
  registry.canonicalSources.forEach((r) => targets.add(r.path));
  for (const target of targets) {
    const item =
      source === "index" ? index.entries.get(target) : names.includes(target) ? metadata(root, target) : undefined;
    references[target] =
      !item || item.kind === "missing"
        ? "missing"
        : !item.contained || item.kind !== "file" || contentDenied(target, registry)
          ? "unsafe"
          : "present";
  }
  const observation = {
    repositoryId: digest(repository),
    worktreeId: digest(root),
    head,
    source,
    registryHash: digest(registryBytes),
    toolVersion: TOOL_VERSION,
    toolHash,
    fileSetHash: digest(JSON.stringify(names)),
    evaluatedAt,
    discovered: names.length - deleted,
    deleted,
    outsideScope,
    complete,
    entries,
    references,
  };
  observation.fingerprint = digest(JSON.stringify({ ...observation, evaluatedAt: undefined }));
  return { observation, registry };
}

/** @param {{root: string, source: 'working-tree'|'index', previousSnapshot?: object|null, now?: string}} options */
export function checkOrganisation({ root, source, previousSnapshot = null, now = new Date().toISOString() }) {
  if (!["working-tree", "index"].includes(source)) throw new Error("explicit-source-required");
  root = fs.realpathSync.native(root);
  const actualRoot = fs.realpathSync.native(git(root, ["rev-parse", "--show-toplevel"]).toString("utf8").trim());
  if (root !== actualRoot) throw new Error("repository-root-required");
  const first = capture(root, source, now);
  const report = buildReport(first.observation, first.registry, previousSnapshot);
  const second = capture(root, source, now);
  if (first.observation.fingerprint !== second.observation.fingerprint) {
    return buildReport({ ...second.observation, complete: false }, second.registry, previousSnapshot);
  }
  return report;
}

const markdownText = (value) =>
  String(value)
    .replace(/[\r\n]/gu, " ")
    .replace(/[\\`*_{}\[\]()<>#!|]/gu, "\\$&");
export function renderMarkdown(report) {
  const lines = [
    "# Ward Flow organisation — last checked",
    "",
    `Generation: ${report.generation}`,
    `Source fingerprint: ${report.snapshot.fingerprint}`,
    `Last checked: ${report.snapshot.evaluatedAt}`,
    `Input mode: ${report.snapshot.source}`,
    `HEAD: ${report.snapshot.head}`,
    `Worktree identity: ${report.snapshot.worktreeId}`,
    `Registry SHA-256: ${report.snapshot.registryHash}`,
    "",
    `Exit ${report.exitCode}: ${report.exitCode === 0 ? "required checks completed; review findings may remain" : report.exitCode === 1 ? "blocking findings require review" : "incomplete; not acceptance evidence"}.`,
    "",
    "This is a checkpoint, not a live monitor. Edits after last checked need another run.",
    "",
    `Coverage: ${Object.entries(report.coverage)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")}.`,
    `Analysis: ${report.analysis}; prior snapshot: ${report.baseline}.`,
    "",
    "Scope:",
    "",
    ...report.scope.map((s) => `- ${markdownText(s)}`),
    "",
    "Exclusions and limits:",
    "",
    ...report.exclusions.map((s) => `- ${markdownText(s)}`),
    "",
    `Findings (${report.findings.length}; complete rows and findings are in this generation's JSON):`,
    "",
    ...report.findings
      .slice(0, 30)
      .map(
        (f) =>
          `- ${f.severity}: ${f.code} — ${markdownText(f.label)}. Record: ${markdownText(f.reference)}. ID: ${f.id}.`,
      ),
    "",
    `Changes: ${report.changes.added.length} added, ${report.changes.deleted.length} deleted, ${report.changes.changed.length} changed.`,
    "",
    "Use the existing Ward task and decision ledgers. This report does not create tasks or grant approval.",
    "",
  ];
  return lines.join("\n");
}

function outputRoot(directory, create = false) {
  if (create) fs.mkdirSync(directory, { recursive: true });
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("unsafe-report-directory");
  return fs.realpathSync.native(directory);
}

export function readSelectedReport(directory) {
  try {
    directory = outputRoot(directory);
    const pointer = JSON.parse(readContained(directory, metadata(directory, "current.json")).toString("utf8"));
    if (pointer.schemaVersion !== 1 || !/^g-[a-f0-9-]{36}$/u.test(pointer.generation))
      throw new Error("incompatible-report-pointer");
    const json = readContained(directory, metadata(directory, `${pointer.generation}/report.json`));
    const md = readContained(directory, metadata(directory, `${pointer.generation}/report.md`));
    if (digest(json) !== pointer.jsonHash || digest(md) !== pointer.markdownHash) throw new Error("incoherent-report");
    const report = JSON.parse(json.toString("utf8"));
    const markdown = md.toString("utf8");
    if (
      report.schemaVersion !== 1 ||
      report.generation !== pointer.generation ||
      report.snapshot?.fingerprint !== pointer.fingerprint ||
      !markdown.includes(`Generation: ${pointer.generation}\n`) ||
      !markdown.includes(`Source fingerprint: ${pointer.fingerprint}\n`)
    )
      throw new Error("incoherent-report");
    return { pointer, report, markdown };
  } catch (error) {
    if (
      error.code === "ENOENT" ||
      (error.message === "unavailable-source" && !fs.existsSync(path.join(directory, "current.json")))
    )
      return null;
    throw error;
  }
}

function durableWrite(file, bytes) {
  fs.writeFileSync(file, bytes, { flag: "wx", flush: true });
}

function acquirePublication(directory) {
  directory = outputRoot(directory, true);
  const lockPath = path.join(directory, "publication.lock");
  let fd;
  try {
    fd = fs.openSync(lockPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        "publication-locked; verify process identity before manual recovery; no timeout removes this lock",
      );
    throw error;
  }
  const identity = fs.fstatSync(fd);
  const lock = {
    pid: process.pid,
    token: randomUUID(),
    processStartedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
  };
  try {
    fs.writeFileSync(fd, JSON.stringify(lock));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  return () => {
    const current = fs.lstatSync(lockPath);
    if (current.isSymbolicLink() || current.ino !== identity.ino || current.dev !== identity.dev)
      throw new Error("publication-lock-replaced");
    // Only the lock created by this process is removed. Orphan generations and stale locks are retained.
    fs.unlinkSync(lockPath);
  };
}

function publish(directory, report) {
  if (report.exitCode === 2) return;
  const generation = `g-${randomUUID()}`;
  const result = { ...report, generation };
  const generationDirectory = path.join(directory, generation);
  fs.mkdirSync(generationDirectory);
  const json = JSON.stringify(result, null, 2) + "\n";
  const markdown = renderMarkdown(result);
  durableWrite(path.join(generationDirectory, "report.json"), json);
  durableWrite(path.join(generationDirectory, "report.md"), markdown);
  const pointer = {
    schemaVersion: 1,
    generation,
    fingerprint: report.snapshot.fingerprint,
    jsonHash: digest(json),
    markdownHash: digest(markdown),
  };
  const temporary = path.join(directory, `${generation}.pointer.json`);
  durableWrite(temporary, JSON.stringify(pointer) + "\n");
  // One rename is the commit point. Never independently replace/select the two report files.
  fs.renameSync(temporary, path.join(directory, "current.json"));
}

function describeSelected(directory) {
  try {
    const selected = readSelectedReport(directory);
    console.log(
      selected
        ? `Selected generation ${selected.pointer.generation}; source ${selected.pointer.fingerprint}; mode ${selected.report.snapshot.source}; last checked ${selected.report.snapshot.evaluatedAt}`
        : "Selected generation: none",
    );
    return selected;
  } catch {
    console.log("Selected generation: unavailable or incompatible; full declared scope will be checked");
    return null;
  }
}

export function main(args = process.argv.slice(2)) {
  let directory;
  let release;
  let exitCode = 2;
  try {
    exitCode = (() => {
      const options = {};
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (["--check", "--write-report", "--show-report"].includes(arg) && !options.action) options.action = arg;
        else if (["--source", "--root"].includes(arg) && !options[arg] && args[i + 1] && !args[i + 1].startsWith("--"))
          options[arg] = args[++i];
        else
          throw new Error(
            "usage: --check|--write-report --source working-tree|index [--root repository]; or --show-report",
          );
      }
      if (
        !options.action ||
        (options.action !== "--show-report" && !["working-tree", "index"].includes(options["--source"]))
      )
        throw new Error("explicit-action-and-source-required");
      const root = fs.realpathSync.native(options["--root"] ?? fileURLToPath(new URL("../..", import.meta.url)));
      directory = reportDirectory(root);
      const previous = describeSelected(directory);
      if (options.action === "--show-report") {
        if (!previous) return 2;
        console.log(previous.markdown);
        return previous.report.exitCode;
      }
      if (options.action === "--write-report") release = acquirePublication(directory);
      const report = checkOrganisation({ root, source: options["--source"], previousSnapshot: previous?.report });
      if (options.action === "--write-report") {
        publish(directory, report);
        describeSelected(directory);
      }
      console.log(
        `Ward organisation: exit ${report.exitCode}; mode ${report.snapshot.source}; last checked ${report.snapshot.evaluatedAt}; source ${report.snapshot.fingerprint}`,
      );
      console.log(`Coverage: ${JSON.stringify(report.coverage)}; findings ${report.findings.length}`);
      for (const finding of report.findings.filter((f) => f.severity !== "review").slice(0, 15))
        console.log(`${finding.severity}: ${finding.code}; ${finding.label}; ${finding.reference}`);
      return report.exitCode;
    })();
  } catch (error) {
    // Do not echo filesystem/Git error messages: they may contain restricted filenames or bytes.
    console.error(
      error.message.startsWith("publication-locked")
        ? error.message
        : "Ward organisation incomplete: input, schema, source mode or publication unavailable. No acceptance claim.",
    );
    if (directory) describeSelected(directory);
    exitCode = 2;
  } finally {
    if (release) {
      try {
        release();
      } catch {
        console.error(
          "Ward organisation incomplete: publication lock could not be released safely; verify process identity before recovery.",
        );
        if (directory) describeSelected(directory);
        exitCode = 2;
      }
    }
  }
  return exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
