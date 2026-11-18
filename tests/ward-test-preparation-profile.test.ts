import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createPreparationProfile } from "../scripts/ward-flow/test-preparation-profile.mjs";

describe("optional test preparation profiles", () => {
  it("keeps disabled measurement transparent without writing files", () => {
    const profile = createPreparationProfile("disabled", "");
    expect(profile.measure("work", () => 42)).toBe(42);
    profile.count("events", 10);
    expect(profile.snapshot().counters).toEqual({});
    expect(profile.write()).toBeNull();
  });

  it("clears counters and timings on reset so a later snapshot is empty", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "ward-preparation-"));
    try {
      const profile = createPreparationProfile("fixture", directory);
      profile.count("events", 4);
      profile.measure("work", () => 1);
      const before = profile.snapshot();
      expect(before.counters).toEqual({ events: 4 });
      expect(Object.keys(before.milliseconds)).toEqual(["work"]);
      profile.reset();
      const after = profile.snapshot();
      expect(after.counters).toEqual({});
      expect(after.milliseconds).toEqual({});
    } finally {
      rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("retains counters, throwing-operation time and distinct worker reports", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "ward-preparation-"));
    try {
      const profile = createPreparationProfile("fixture", directory);
      profile.count("candidates", 3);
      profile.count("candidates", 2);
      expect(() =>
        profile.measure("parse", () => {
          throw new Error("fixture");
        }),
      ).toThrow("fixture");
      profile.write({ synthetic: true });
      profile.write({ synthetic: true });
      const files = readdirSync(directory);
      expect(files).toHaveLength(2);
      const report = JSON.parse(readFileSync(path.join(directory, files[0]), "utf8"));
      expect(report.counters).toEqual({ candidates: 5 });
      expect(report.milliseconds.parse).toBeGreaterThanOrEqual(0);
      expect(report.metadata.synthetic).toBe(true);
      expect(report.metadata.node).toBe(process.version);
    } finally {
      rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
