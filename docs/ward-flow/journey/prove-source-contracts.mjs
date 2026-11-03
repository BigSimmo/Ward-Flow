/** Synthetic negative proofs; fixture files are outside the checkout and always cleaned up. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSourceContracts, checkDispositions } from "./source-contracts.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const contracts = readSourceContracts(root);
const actions = JSON.parse(fs.readFileSync(path.join(here, "actions.json"), "utf8"));
const dispositions = JSON.parse(fs.readFileSync(path.join(here, "event-dispositions.json"), "utf8"));
assert.equal(checkDispositions(contracts, actions, dispositions, root).length, contracts.catalogue.length);
assert.throws(() => checkDispositions(contracts, actions, dispositions.slice(1), root), /UNACCOUNTED ENGINE EVENT/);
assert.throws(
  () =>
    checkDispositions(
      { ...contracts, catalogue: [...contracts.catalogue, { event: "SYNTHETIC_NEW_COMMAND", sources: [] }] },
      actions,
      dispositions,
      root,
    ),
  /UNACCOUNTED ENGINE EVENT: SYNTHETIC_NEW_COMMAND/,
);
assert.throws(
  () => checkDispositions(contracts, [...actions, { event: "SYNTHETIC_OBSOLETE_COMMAND" }], dispositions, root),
  /Obsolete diagram action/,
);
assert.throws(
  () => checkDispositions(contracts, actions, [...dispositions, dispositions[0]], root),
  /Duplicate event disposition/,
);
assert.throws(
  () =>
    checkDispositions(
      contracts,
      actions,
      [{ ...dispositions[0], source: "src/components/ward-management/no-such-handler.ts" }, ...dispositions.slice(1)],
      root,
    ),
  /does not name a current event\/dispatch module/,
);

// Behaviour notes cannot be replaced by an exclusion or silently blessed after source edits.
const specimen = dispositions[0];
const withModel = (model) => [{ ...specimen, model }, ...dispositions.slice(1)];
assert.throws(
  () => checkDispositions(contracts, actions, [{ ...specimen, reason: 12345 }, ...dispositions.slice(1)], root),
  /Missing behavioural model/,
);
assert.throws(
  () =>
    checkDispositions(contracts, actions, [{ ...specimen, status: "catalogue-only" }, ...dispositions.slice(1)], root),
  /Missing behavioural model/,
);
assert.throws(
  () => checkDispositions(contracts, actions, withModel({ ...specimen.model, guards: [] }), root),
  /Missing model guards/,
);
assert.throws(
  () =>
    checkDispositions(
      contracts,
      actions,
      withModel({ ...specimen.model, tests: ["tests/no-such-model-proof.test.ts"] }),
      root,
    ),
  /Missing or unsafe model test reference/,
);
assert.throws(
  () =>
    checkDispositions(
      contracts,
      actions,
      withModel({ ...specimen.model, sources: [{ path: "src/../private.ts", line: 1 }] }),
      root,
    ),
  /Unsafe review source/,
);
assert.throws(
  () =>
    checkDispositions(
      contracts,
      actions,
      withModel({
        ...specimen.model,
        sources: specimen.model.sources.map((source) => ({ ...source, sha256: "0".repeat(64) })),
      }),
      root,
    ),
  /Stale source review/,
);
assert.throws(
  () => checkDispositions(contracts, [{ ...actions[0], review: undefined }, ...actions.slice(1)], dispositions, root),
  /Missing source review/,
);
assert.throws(
  () => checkDispositions(contracts, [{ ...actions[0], roles: [] }, ...actions.slice(1)], dispositions, root),
  /Stale diagram roles/,
);

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "ward-journey-contract-proof-"));
try {
  const directory = path.join(fixture, "src/components/ward-management");
  fs.mkdirSync(directory, { recursive: true });
  for (const source of [contracts.roleSource, contracts.noticeSource])
    fs.copyFileSync(path.join(root, source), path.join(directory, path.basename(source)));
  const original = path.join(directory, path.basename(contracts.roleSource));
  const roleOriginal = fs.readFileSync(original, "utf8");
  const noticeFile = path.join(directory, path.basename(contracts.noticeSource));
  const noticeOriginal = fs.readFileSync(noticeFile, "utf8");
  fs.writeFileSync(original, roleOriginal.replace(/\n};/, "\n} && OTHER_EVENT_ROLES;"));
  assert.throws(() => readSourceContracts(fixture), /Unsupported EVENT_ROLE initializer suffix/);
  fs.writeFileSync(original, roleOriginal);
  for (const property of [
    "SYNTHETIC_NEW_COMMAND: SOME_ROLE_ARRAY,",
    '"SYNTHETIC_NEW_COMMAND": ["ward"],',
    "...SOME_OTHER_EVENTS,",
  ]) {
    fs.writeFileSync(original, roleOriginal.replace(/\n};/, `\n  ${property}\n};`));
    assert.throws(() => readSourceContracts(fixture), /Unsupported EVENT_ROLE/);
  }
  fs.writeFileSync(original, roleOriginal);
  for (const addition of [" | NoticeAlias", " & SomeIntersection"]) {
    fs.writeFileSync(noticeFile, noticeOriginal.replace(/("bed_pull_released")/, `$1${addition}`));
    assert.throws(() => readSourceContracts(fixture), /Unsupported NoticeKind syntax/);
  }
  fs.writeFileSync(noticeFile, noticeOriginal);
  assert.throws(
    () =>
      checkDispositions(
        contracts,
        actions,
        [
          { ...dispositions[0], source: "src/components/ward-management/ward-flow-subject-id.ts" },
          ...dispositions.slice(1),
        ],
        root,
      ),
    /does not name a current event\/dispatch module/,
  );
  fs.renameSync(original, path.join(directory, "renamed-permissions.ts"));
  assert.equal(readSourceContracts(fixture).catalogue.length, contracts.catalogue.length);
  fs.copyFileSync(path.join(directory, "renamed-permissions.ts"), path.join(directory, "duplicate.ts"));
  assert.throws(() => readSourceContracts(fixture), /exactly one exported EVENT_ROLE declaration/);
  fs.unlinkSync(path.join(directory, "duplicate.ts"));
  fs.unlinkSync(path.join(directory, "renamed-permissions.ts"));
  assert.throws(() => readSourceContracts(fixture), /exactly one exported EVENT_ROLE declaration/);
} finally {
  fs.rmSync(fixture, { recursive: true, force: true, maxRetries: 5 });
}
console.log(
  "PROVEN: new/unaccounted/obsolete/duplicate events, incomplete models, non-text reasons, bad test/source references, missing/stale reviews and role drift refuse; unsupported role properties/spreads and notice aliases/intersections refuse; declaration moves are discovered, missing/ambiguous declarations refuse.",
);
