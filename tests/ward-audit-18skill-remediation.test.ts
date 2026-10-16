import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findExplanatoryDisabledButtonViolations } from "../scripts/ward-flow/check-explanatory-buttons.mjs";
import { GET as getHealth } from "../src/app/api/health/route";
import { GET as getLocalProjectId } from "../src/app/api/local-project-id/route";

const rootDir = path.resolve(__dirname, "..");

function readRepoFile(relPath: string): string {
  return readFileSync(path.join(rootDir, relPath), "utf8");
}

describe("18-skill audit remediation invariants", () => {
  it("excludes tmp, .worktrees, .claude, and .next-playwright in root TypeScript configs", () => {
    const tsconfig = readRepoFile("tsconfig.json");
    const typecheckConfig = readRepoFile("tsconfig.typecheck.json");

    for (const pattern of ["tmp/**", ".worktrees/**", ".claude/**", ".next-playwright/**"]) {
      expect(tsconfig).toContain(`"${pattern}"`);
      expect(typecheckConfig).toContain(`"${pattern}"`);
    }
  });

  it("pins Australia/Perth timezone in readmissionDetailText date formatting", () => {
    const source = readRepoFile("src/components/ward-management/ward-readmission-flag.tsx");
    expect(source).toMatch(/toLocaleDateString\("en-AU",\s*\{[\s\S]*?timeZone:\s*"Australia\/Perth"/);
  });

  it("checks both pathname and search in WardOfflineLinks before allowing same-page navigation", () => {
    const source = readRepoFile("src/components/ward-management/shell/ward-offline-links.tsx");
    expect(source).toContain("url.pathname === window.location.pathname && url.search === window.location.search");
  });

  it("detects both <button disabled aria-describedby> and <Button disabled disabledReason> violations", () => {
    const lowercaseViolation = findExplanatoryDisabledButtonViolations(
      `<button type="button" disabled aria-describedby="reason-id">Save</button>`,
      "src/example.tsx",
    );
    expect(lowercaseViolation).toHaveLength(1);

    const uppercaseViolation = findExplanatoryDisabledButtonViolations(
      `<Button disabled disabledReason="UMRN not recorded">Save</Button>`,
      "src/example.tsx",
    );
    expect(uppercaseViolation).toHaveLength(1);
  });

  it("emits explicit nosniff and no-store headers from health and local-project-id routes", () => {
    const healthRes = getHealth();
    expect(healthRes.headers.get("Cache-Control")).toBe("no-store");
    expect(healthRes.headers.get("X-Content-Type-Options")).toBe("nosniff");

    const projectRes = getLocalProjectId();
    expect(projectRes.headers.get("Cache-Control")).toBe("no-store");
    expect(projectRes.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("preserves monotonic notice counts in appendNotices and D-38 AWOL danger tone in ward-beds-matrix", () => {
    const reducerSource = readRepoFile("src/components/ward-management/ward-flow-reducer.ts");
    expect(reducerSource).toContain("return { ...state, notices: [...state.notices, ...notifiable] };");

    const bedsMatrixSource = readRepoFile("src/components/ward-management/ward/ward-beds-matrix.tsx");
    expect(bedsMatrixSource).toContain('const isAwol = !atEd && bed.statusText === "Absent without leave"');
    expect(bedsMatrixSource).toContain('const tone = isAwol ? "danger" : "info"');
  });
});
