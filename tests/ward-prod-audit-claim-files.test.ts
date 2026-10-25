import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { withClaimFiles } from "../scripts/pre-commit-checks.mjs";

// One file per claim beside the shared log, because simultaneous appends to the one log on the
// sync mount overwrite each other.
describe("withClaimFiles", () => {
  let dir = "";
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("adds claim and release lines from claims/*.md after the log, in file-name order", () => {
    dir = mkdtempSync(path.join(tmpdir(), "ward-claim-files-"));
    const log = path.join(dir, "sign-out.md");
    mkdirSync(path.join(dir, "claims"));
    writeFileSync(path.join(dir, "claims", "b.md"), "RELEASED 2026-10-25 | Owner | ward/b | done\n");
    writeFileSync(
      path.join(dir, "claims", "a.md"),
      "## Heading ignored\n- 2026-10-25 | Owner | ward/a | /wt | file.ts\nnote ignored\n",
    );
    writeFileSync(path.join(dir, "claims", "skip.txt"), "- not a claim file\n");
    expect(withClaimFiles(log, "## Active sign-outs\n- old line\n")).toBe(
      "## Active sign-outs\n- old line\n- 2026-10-25 | Owner | ward/a | /wt | file.ts\nRELEASED 2026-10-25 | Owner | ward/b | done\n",
    );
  });

  it("leaves the log text unchanged when there is no claims folder", () => {
    dir = mkdtempSync(path.join(tmpdir(), "ward-claim-files-"));
    expect(withClaimFiles(path.join(dir, "sign-out.md"), "## Active sign-outs\n")).toBe("## Active sign-outs\n");
  });
  it("puts claim-file lines inside the Active section, before the next heading", () => {
    dir = mkdtempSync(path.join(tmpdir(), "ward-claim-files-"));
    mkdirSync(path.join(dir, "claims"));
    writeFileSync(
      path.join(dir, "claims", "20261025T1000Z-a.md"),
      "- 2026-10-25T10:00Z | Owner | ward/a | /wt | a.ts\n",
    );
    expect(
      withClaimFiles(path.join(dir, "sign-out.md"), "## Active sign-outs\n- old line\n\n## History\n- archived\n"),
    ).toBe(
      "## Active sign-outs\n- old line\n- 2026-10-25T10:00Z | Owner | ward/a | /wt | a.ts\n\n## History\n- archived\n",
    );
  });

  it("keeps event order, so an earlier release file does not clear a later log claim", () => {
    dir = mkdtempSync(path.join(tmpdir(), "ward-claim-files-"));
    mkdirSync(path.join(dir, "claims"));
    writeFileSync(
      path.join(dir, "claims", "20261025T1001Z-b.md"),
      "RELEASED 2026-10-25T10:01Z | Owner | ward/b | repo=BigSimmo/Ward-Flow | done\n",
    );
    const log = "## Active sign-outs\n- 2026-10-25T10:02Z | Owner | ward/b | /wt | repo=BigSimmo/Ward-Flow | b.ts\n";
    const merged = withClaimFiles(path.join(dir, "sign-out.md"), log);
    expect(merged.indexOf("RELEASED")).toBeLessThan(merged.indexOf("- 2026-10-25T10:02Z"));
  });

  it("fails closed when the claims folder exists but cannot be read", () => {
    if (process.getuid?.() === 0) return; // root can read any folder
    dir = mkdtempSync(path.join(tmpdir(), "ward-claim-files-"));
    mkdirSync(path.join(dir, "claims"));
    chmodSync(path.join(dir, "claims"), 0o000);
    try {
      expect(() => withClaimFiles(path.join(dir, "sign-out.md"), "## Active sign-outs\n")).toThrow(
        /claims folder unreadable/,
      );
    } finally {
      chmodSync(path.join(dir, "claims"), 0o700);
    }
  });

  it("fails closed when claims is a file rather than a folder", () => {
    dir = mkdtempSync(path.join(tmpdir(), "ward-claim-files-"));
    writeFileSync(path.join(dir, "claims"), "not a folder\n");
    expect(() => withClaimFiles(path.join(dir, "sign-out.md"), "## Active sign-outs\n")).toThrow(
      /claims folder unreadable/,
    );
  });
});
