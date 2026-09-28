import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const agents = readFileSync(join(repoRoot, "AGENTS.md"), "utf8");
const releasePath = join(repoRoot, ".agents", "skills", "release", "SKILL.md");
const handoverPath = join(repoRoot, ".agents", "skills", "handover", "SKILL.md");
const hookPath = join(repoRoot, ".claude", "hooks", "pr-handoff-stop.sh");

describe("bare PR publication policy", () => {
  it("separates an explicit open-PR request from local readiness work", () => {
    expect(agents).toContain("## Bare PR publication is not readiness work");
    expect(agents).toContain("Do **not** run or wait for `npm run format`");
    expect(agents).toContain("`npm run verify:pr-local`");
    expect(agents).toContain("publish with `git commit --no-verify` and that guard's own scoped override");
    expect(agents).toContain("instead of `git push --no-verify`");
    expect(agents).toContain(
      "Never skip the push hook wholesale — the auto-merge ownership guard has no override and must never be bypassed",
    );
    expect(agents).toContain("Do not babysit CI");
    expect(agents).toContain("overrides generic branch-bundling, handover, review, and babysit instructions");
  });

  it("keeps normal formatting policy from overriding bare publication", () => {
    expect(agents).toContain("This rule does not apply to the explicit bare PR publication route above.");
    expect(agents).toContain("never an explicit bare PR publication");
  });

  it("prevents the release workflow from being selected for bare publication", () => {
    if (!existsSync(releasePath) && !existsSync(handoverPath)) {
      expect(existsSync(join(repoRoot, ".agents"))).toBe(false);
      return;
    }
    const releaseSkill = readFileSync(releasePath, "utf8");
    const handoverSkill = readFileSync(handoverPath, "utf8");
    expect(releaseSkill).toContain("Do not use this skill merely because the user asks to open or publish a PR.");
    expect(releaseSkill).toContain("publish without local readiness work");
    expect(handoverSkill).toContain("Do not use this skill merely because the user asks to open or publish a PR.");
  });

  it("makes handoff the post-PR default instead of inviting CI babysitting", () => {
    if (!existsSync(hookPath)) {
      expect(existsSync(join(repoRoot, ".claude"))).toBe(false);
      expect(agents).toContain("Do not babysit CI");
      return;
    }
    const prHandoffHook = readFileSync(hookPath, "utf8");
    expect(prHandoffHook).toContain("hand over its URL and stop");
    expect(prHandoffHook).toContain("unless the user expressly asks to babysit or continue PR work");
  });
});
