/** Source inventory, not a claim that the diagram models every command's behaviour. Plain Node. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function readSourceContracts(root) {
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.tsx?$/.test(entry.name))
        files.push({ path: path.relative(root, file).replaceAll("\\", "/"), text: fs.readFileSync(file, "utf8") });
    }
  };
  visit(path.join(root, "src/components/ward-management"));
  const declaration = (name, kind) => {
    const matches = files.filter((file) => new RegExp(`^export (?:declare )?${kind} ${name}\\b`, "m").test(file.text));
    if (matches.length !== 1)
      throw new Error(
        `Expected exactly one exported ${name} declaration; found ${matches.length}: ${matches.map((file) => file.path).join(", ")}`,
      );
    return matches[0];
  };
  // Remove comments without confusing comment-like text inside string literals, preserving lines.
  const uncomment = (text) =>
    text.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (token) =>
      token.startsWith("/") ? token.replace(/[^\n]/g, " ") : token,
    );
  const roles = declaration("EVENT_ROLE", "const");
  const roleText = uncomment(roles.text);
  const header = /export const EVENT_ROLE\b[^=]*=\s*\{/.exec(roleText);
  if (!header) throw new Error("Unsupported EVENT_ROLE declaration: expected a literal object initializer");
  const bodyStart = header.index + header[0].length;
  // The supported grammar deliberately forbids nested objects, aliases, spreads, computed keys and
  // expressions. Unsupported TypeScript must fail rather than shrink the alleged complete catalogue.
  const bodyEnd = roleText.indexOf("}", bodyStart);
  if (bodyEnd < 0) throw new Error("Unclosed EVENT_ROLE initializer");
  if (!/^\s*;/.test(roleText.slice(bodyEnd + 1)))
    throw new Error("Unsupported EVENT_ROLE initializer suffix; expected a literal object ending in a semicolon");
  const roleBody = roleText.slice(bodyStart, bodyEnd);
  const events = [];
  let consumed = 0;
  const line = (text, offset) => text.slice(0, offset).split("\n").length;
  while (roleBody.slice(consumed).trim()) {
    const member = /^\s*([A-Z][A-Z0-9_]*):\s*\[\s*("[^"\\]+"(?:\s*,\s*"[^"\\]+")*\s*,?)\s*\]\s*(?:,|$)/.exec(
      roleBody.slice(consumed),
    );
    if (!member)
      throw new Error(`Unsupported EVENT_ROLE member syntax at ${roles.path}:${line(roleText, bodyStart + consumed)}`);
    events.push({
      event: member[1],
      roles: [...member[2].matchAll(/"([^"\\]+)"/g)].map((role) => role[1]),
      permissionSource: { path: roles.path, line: line(roleText, bodyStart + consumed + member[0].search(/[A-Z]/)) },
    });
    consumed += member[0].length;
  }
  if (events.length < 40 || new Set(events.map((event) => event.event)).size !== events.length)
    throw new Error("EVENT_ROLE parse is empty, incomplete or contains duplicate event keys");
  const notices = declaration("NoticeKind", "type");
  const noticeText = uncomment(notices.text);
  const noticeHeader = /export type NoticeKind\s*=/.exec(noticeText);
  const noticeEnd = noticeText.indexOf(";", noticeHeader ? noticeHeader.index + noticeHeader[0].length : 0);
  const union =
    noticeHeader && noticeEnd >= 0 ? noticeText.slice(noticeHeader.index + noticeHeader[0].length, noticeEnd) : "";
  if (!/^\s*\|?\s*"[^"\\]+"(?:\s*\|\s*"[^"\\]+")*\s*$/.test(union))
    throw new Error(`Unsupported NoticeKind syntax in ${notices.path}: expected a fully literal union`);
  const noticeKinds = [...union.matchAll(/"([^"\\]+)"/g)].map((match) => match[1]);
  if (noticeKinds.length < 5 || new Set(noticeKinds).size !== noticeKinds.length)
    throw new Error(`Could not read a unique NoticeKind union in ${notices.path}`);
  const catalogue = events.map((item) => {
    const sources = [];
    for (const file of files) {
      // Case/condition references in audits, subject-id mappers and access-state classifiers do
      // not establish an effect handler. Limit this index to domain event/dispatch modules.
      if (!/(?:-events|-reducer)\.ts$/.test(file.path) || /ward-flow-(?:events|event-roles)\.ts$/.test(file.path))
        continue;
      const match = new RegExp(`(?:case\\s+|\\.type\\s*===?\\s*|type:\\s*)["']${item.event}["']`).exec(file.text);
      if (match) sources.push({ path: file.path, line: line(file.text, match.index) });
    }
    return { ...item, sources };
  });
  // This digest identifies the extracted contract projection, not unrelated screen text or
  // the complete handler implementations. Behaviour still needs source/test review.
  const sha256 = crypto.createHash("sha256").update(JSON.stringify({ catalogue, noticeKinds })).digest("hex");
  return { catalogue, noticeKinds, roleSource: roles.path, noticeSource: notices.path, sha256 };
}

// A source digest detects a later edit; the recorded review still needs human judgement.
// Never refresh these digests during generation: doing so would bless stale prose automatically.
export function checkReview(review, event, root, problems) {
  if (!review || !Array.isArray(review.sources) || !review.sources.length) {
    problems.push(`Missing source review for ${event}`);
    return;
  }
  for (const source of review.sources) {
    if (
      !source ||
      typeof source.path !== "string" ||
      !/^src\/[A-Za-z0-9_./-]+\.tsx?$/.test(source.path) ||
      source.path.split("/").includes("..") ||
      !Number.isInteger(source.line) ||
      source.line < 1
    ) {
      problems.push(`Unsafe review source for ${event}`);
      continue;
    }
    const file = path.join(root, source.path);
    if (!fs.existsSync(file)) {
      problems.push(`Missing reviewed source for ${event}: ${source.path}`);
      continue;
    }
    const body = fs.readFileSync(file, "utf8");
    if (source.line > body.split("\n").length) problems.push(`Review line outside source for ${event}: ${source.path}`);
    const digest = crypto.createHash("sha256").update(body).digest("hex");
    if (source.sha256 !== digest)
      problems.push(
        `Stale source review for ${event}: ${source.path}; compare behaviour and update the prose/review digest explicitly`,
      );
  }
}

export function checkDispositions(contracts, actions, dispositions, root) {
  const represented = new Set(actions.map((action) => action.event));
  if (represented.size !== actions.length) throw new Error("Duplicate diagram action event");
  const events = new Set(contracts.catalogue.map((item) => item.event));
  const seen = new Set();
  const problems = [];
  for (const action of actions) {
    if (!events.has(action.event)) problems.push(`Obsolete diagram action: ${action.event}`);
    const canonical = contracts.catalogue.find((event) => event.event === action.event);
    if (canonical && JSON.stringify([...(action.roles ?? [])].sort()) !== JSON.stringify([...canonical.roles].sort()))
      problems.push(`Stale diagram roles for ${action.event}`);
    checkReview(action.review, action.event, root, problems);
  }
  for (const item of dispositions) {
    if (seen.has(item.event)) problems.push(`Duplicate event disposition: ${item.event}`);
    seen.add(item.event);
    if (!events.has(item.event)) problems.push(`Obsolete event disposition: ${item.event}`);
    if (represented.has(item.event)) problems.push(`Event is both represented and catalogue-only: ${item.event}`);
    if (item.status !== "modelled" || typeof item.reason !== "string" || item.reason.trim().length < 25)
      problems.push(`Missing behavioural model for ${item.event}`);
    const model = item.model;
    if (
      !model ||
      ["subject", "before", "after", "scope"].some((key) => typeof model[key] !== "string" || !model[key].trim())
    )
      problems.push(`Incomplete behavioural model for ${item.event}`);
    for (const key of ["payload", "guards", "effects", "tests"]) {
      if (
        !Array.isArray(model?.[key]) ||
        !model[key].length ||
        model[key].some((value) => typeof value !== "string" || !value.trim())
      )
        problems.push(`Missing model ${key} for ${item.event}`);
    }
    for (const test of Array.isArray(model?.tests) ? model.tests : []) {
      if (
        typeof test !== "string" ||
        !/^tests\/[A-Za-z0-9_./-]+\.tsx?$/.test(test) ||
        test.split("/").includes("..") ||
        !fs.existsSync(path.join(root, test))
      )
        problems.push(`Missing or unsafe model test reference for ${item.event}: ${test}`);
    }
    checkReview(model, item.event, root, problems);
    const canonical = contracts.catalogue.find((event) => event.event === item.event);
    if (
      canonical &&
      (!Array.isArray(model?.sources) ||
        !model.sources.some((reviewed) => canonical.sources.some((source) => source.path === reviewed?.path)))
    )
      problems.push(`Model lacks a reviewed event/dispatch source for ${item.event}`);
    if (!canonical?.sources.some((source) => source.path === item.source))
      problems.push(`Disposition ${item.event} does not name a current event/dispatch module: ${item.source}`);
    if (
      item.source &&
      (!item.source.startsWith("src/components/ward-management/") ||
        item.source.includes("..") ||
        !fs.existsSync(path.join(root, item.source)))
    )
      problems.push(`Missing or unsafe disposition source for ${item.event}`);
  }
  for (const event of events)
    if (!represented.has(event) && !seen.has(event)) problems.push(`UNACCOUNTED ENGINE EVENT: ${event}`);
  if (problems.length) throw new Error(problems.join("\n"));
  return contracts.catalogue.map((item) => ({
    ...item,
    status: represented.has(item.event) ? "diagram-reviewed" : "modelled",
    model: dispositions.find((disposition) => disposition.event === item.event)?.model,
    reason:
      dispositions.find((disposition) => disposition.event === item.event)?.reason ??
      "Diagram action notes reviewed against the recorded source revision. Source digests detect subsequent edits; this is not runtime acceptance.",
  }));
}
