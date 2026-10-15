// Where the shared Ward Flow notes live (sign-out log, gate board, failure artefacts).
// WARD_FLOW_LOGS wins. Otherwise Josh's Windows PC keeps its historical D: folder, and every other
// machine uses ~/ward-flow-logs, so a Mac or Linux checkout never writes a literal "D:" folder.
import os from "node:os";
import path from "node:path";

/** @param {Record<string, string | undefined>} [env] @param {string} [platform] */
export function wardFlowLogsRoot(env = process.env, platform = process.platform) {
  if (env.WARD_FLOW_LOGS) return env.WARD_FLOW_LOGS;
  return platform === "win32" ? "D:/Repos/ward-flow-logs" : path.join(os.homedir(), "ward-flow-logs");
}

/** @param {Record<string, string | undefined>} [env] @param {string} [platform] */
export function wardSignOutFile(env = process.env, platform = process.platform) {
  return env.WARD_SIGNOUT_FILE || path.join(wardFlowLogsRoot(env, platform), "sign-out.md").replace(/\\/g, "/");
}
