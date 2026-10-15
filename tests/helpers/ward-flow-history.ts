import { execFileSync } from "node:child_process";
import path from "node:path";
import { isPublicWardFlowCheckout, WARD_FLOW_IDENTITY_ANCHOR } from "../../scripts/pre-commit-checks.mjs";

const repositoryRoot = path.resolve(__dirname, "../..");

/**
 * Guard tests build tiny fixture repositories that borrow this checkout's objects so their history
 * descends from the Ward-Flow identity anchor, and some also check this checkout's own identity. That
 * needs the anchor's commit and tree objects plus a verified Ward-Flow checkout (canonical origin, history
 * from the anchor). A shallow or object-filtered clone, or one with another remote, cannot build those
 * fixtures, so the tests skip with this reason rather than fail. CI checks out full history
 * (`fetch-depth: 0`), so on CI a missing prerequisite still fails loudly instead of silently skipping.
 */
function anchorObjectsPresent(): boolean {
  try {
    for (const object of [`${WARD_FLOW_IDENTITY_ANCHOR}^{commit}`, `${WARD_FLOW_IDENTITY_ANCHOR}^{tree}`])
      execFileSync("git", ["-C", repositoryRoot, "cat-file", "-e", object], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export const HAS_WARD_FLOW_HISTORY =
  process.env.CI === "true" || (anchorObjectsPresent() && isPublicWardFlowCheckout(repositoryRoot));

export const NEEDS_WARD_FLOW_HISTORY =
  "needs a full, unfiltered Ward-Flow clone with its canonical origin; run `git fetch --unshallow origin` to include these";
