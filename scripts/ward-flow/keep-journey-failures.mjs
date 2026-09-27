// Keep each journey shard's failure artefacts (traces, screenshots, error-context.md) before the
// unsharded rerun starts. The rerun writes to the same test-results folder and wipes them, so a
// spec that failed in a shard and passed alone left nothing to diagnose (full-journey:126,
// 26 September 2026). Copies test-results/shard-N/ to <logs>/journey-failures/<stamp>/shard-N/.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * @param {{ projectRoot: string, shardCount: number, logsRoot: string, now?: Date }} options
 * @returns {string | null} the folder the artefacts were copied to, or null when there were none
 */
export function keepJourneyFailures({ projectRoot, shardCount, logsRoot, now = new Date() }) {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const destination = path.join(logsRoot, "journey-failures", stamp);
  let copied = 0;
  for (let index = 1; index <= shardCount; index++) {
    const source = path.join(projectRoot, "test-results", `shard-${index}`);
    if (!existsSync(source) || readdirSync(source).length === 0) continue;
    mkdirSync(destination, { recursive: true });
    cpSync(source, path.join(destination, `shard-${index}`), { recursive: true });
    copied++;
  }
  return copied > 0 ? destination : null;
}
