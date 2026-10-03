import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appName, localProjectId } from "../../src/lib/local-server-utils.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export function auditTargetOrigin(value) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    !url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Audit target must be an explicit loopback HTTP origin with a port");
  return url.origin;
}
export function auditTargetIdentity(identity, root) {
  if (
    identity?.appName !== appName ||
    identity?.projectId !== localProjectId(root) ||
    identity?.localServer?.safeLocalOrigin !== true
  )
    throw new Error("Audit target identity is not this safe Ward Flow checkout");
  return identity;
}
/** @param {{root?:string,url?:string,ensure?:()=>string|Promise<string>,request?:Function,source?:()=>{sha:string,dirty:boolean}}} [options] */
export async function resolveAuditTarget({
  root = projectRoot,
  url = process.env.WARD_FLOW_URL || process.env.WARD_URL || process.env.PLAYWRIGHT_BASE_URL,
  ensure = () =>
    execFileSync(process.execPath, [path.join(root, "scripts/ensure-local-server.mjs"), "--print-url"], {
      cwd: root,
      encoding: "utf8",
      timeout: 180000,
    }).trim(),
  request = fetch,
  source = () => ({
    sha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", timeout: 10000 }).trim(),
    dirty: Boolean(
      execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8", timeout: 10000 }).trim(),
    ),
  }),
} = {}) {
  const origin = auditTargetOrigin(url || (await ensure()));
  const response = await request(`${origin}/api/local-project-id`, {
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });
  if (!response.ok || response.redirected) throw new Error("Audit target identity request failed or redirected");
  const identity = auditTargetIdentity(await response.json(), root);
  const result = { url: origin, identity, source: source() };
  // Checkout provenance and runtime identity are separate; this is not a built-SHA assertion.
  console.log(
    `Ward audit target: ${origin}; checkout ${result.source.sha}; dirty=${result.source.dirty}; runtime=${identity.localServer?.runtimeMode ?? identity.runtimeMode ?? "unknown"}`,
  );
  return result;
}
