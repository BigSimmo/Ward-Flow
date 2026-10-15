import { execFileSync } from "node:child_process";
import { WARD_FLOW_IDENTITY_ANCHOR } from "../../scripts/pre-commit-checks.mjs";

/**
 * Guard tests build tiny fixture repositories that borrow this checkout's objects so their history
 * descends from the Ward-Flow identity anchor. A shallow clone (cloud containers, `--depth 1` CI
 * checkouts) does not hold that commit, so those fixtures cannot be built. Skip them with this reason
 * rather than fail. CI checks out full history (`fetch-depth: 0`), so on CI a missing anchor still fails
 * loudly instead of silently skipping.
 */
function anchorReachable(): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", `${WARD_FLOW_IDENTITY_ANCHOR}^{commit}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export const HAS_WARD_FLOW_HISTORY = anchorReachable() || process.env.CI === "true";

export const NEEDS_WARD_FLOW_HISTORY =
  "needs full Ward-Flow history (shallow clone); run `git fetch --unshallow origin` to include these";
