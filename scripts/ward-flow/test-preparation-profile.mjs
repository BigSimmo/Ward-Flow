import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

/** Opt-in aggregate measurements. Never records source text or event payloads. */
export function createPreparationProfile(label, directory = process.env.WARD_TEST_PROFILE_DIR) {
  if (!/^[a-z0-9-]+$/u.test(label)) throw new Error("Invalid preparation profile label");
  const counters = {};
  const milliseconds = {};
  const enabled = Boolean(directory);
  return {
    enabled,
    count(name, amount = 1) {
      if (enabled) counters[name] = (counters[name] ?? 0) + amount;
    },
    measure(name, operation) {
      if (!enabled) return operation();
      const start = performance.now();
      try {
        return operation();
      } finally {
        milliseconds[name] = (milliseconds[name] ?? 0) + performance.now() - start;
      }
    },
    snapshot(metadata = {}) {
      return { schemaVersion: 1, label, counters: { ...counters }, milliseconds: { ...milliseconds }, metadata };
    },
    write(metadata = {}) {
      if (!enabled) return null;
      mkdirSync(directory, { recursive: true });
      const file = path.join(directory, `${label}-${process.pid}-${randomUUID()}.json`);
      const report = this.snapshot({
        commit: process.env.GITHUB_SHA ?? null,
        node: process.version,
        ...metadata,
      });
      writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
      return file;
    },
  };
}
