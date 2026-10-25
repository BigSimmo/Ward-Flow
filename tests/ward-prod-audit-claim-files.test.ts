import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
});
