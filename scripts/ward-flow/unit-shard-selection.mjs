import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isOfflineUnitTestFile } from "../unit-test-population.mjs";

// File transport keeps hosted shard populations out of platform command-line limits.
// Config consumes this exact list; the gate still reconciles every executed file.
function validatedFiles(root, files) {
  if (!Array.isArray(files) || files.length === 0 || new Set(files).size !== files.length)
    throw new Error("Unit shard selection must contain unique, nonempty test paths");
  const base = realpathSync(root);
  for (const file of files) {
    if (
      typeof file !== "string" ||
      file.includes("\\") ||
      /[\0*?{}[\]!]/u.test(file) ||
      path.posix.normalize(file) !== file ||
      !isOfflineUnitTestFile(file)
    )
      throw new Error(`Invalid offline unit shard path: ${String(file)}`);
    const absolute = path.join(base, file);
    const relative = path.relative(base, realpathSync(absolute));
    if (!lstatSync(absolute).isFile() || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
      throw new Error(`Unit shard path is not a file inside this checkout: ${file}`);
  }
  return [...files].sort();
}

const identity = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function writeUnitShardSelection(root, files, directory) {
  const payload = { version: 1, root: realpathSync(root), files: validatedFiles(root, files) };
  const digest = identity(payload);
  const file = path.resolve(directory, `selection-${digest}.json`);
  const content = JSON.stringify({ ...payload, identity: digest });
  mkdirSync(directory, { recursive: true });
  try {
    writeFileSync(file, content, { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST" || readFileSync(file, "utf8") !== content) throw error;
  }
  return { file, identity: digest };
}

export function readUnitShardSelection(root, file) {
  if (file === undefined) return null;
  if (typeof file !== "string" || !file.trim()) throw new Error("Unit shard selection path is empty");
  const payload = JSON.parse(readFileSync(file, "utf8"));
  if (payload.version !== 1 || payload.root !== realpathSync(root))
    throw new Error("Unit shard selection version or checkout does not match");
  const files = validatedFiles(root, payload.files);
  if (payload.identity !== identity({ version: 1, root: payload.root, files }))
    throw new Error("Unit shard selection identity does not match its contents");
  return files;
}
