import { describe, it, expect } from "vitest";
import { existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

describe("Feature 15: Directory Cluster & Domain Structural Boundaries", () => {
  const wardMgmtRoot = join(process.cwd(), "src/components/ward-management");

  it("verifies the core psychiatric bed flow domain directories exist", () => {
    const requiredDomains = [
      "alerts",
      "bed-meeting",
      "board",
      "capacity",
      "community",
      "coordinator",
      "delays",
      "discharges",
      "ed",
      "forecast",
      "handover",
      "legal-forms",
      "movements",
      "officer",
      "out-of-area",
      "patients",
      "referrals",
      "reports",
      "restrictive-practice",
      "settings",
      "shell",
      "statistics",
      "transport",
      "ward",
    ];

    for (const domain of requiredDomains) {
      const dirPath = join(wardMgmtRoot, domain);
      expect(existsSync(dirPath), `Domain directory ${domain} must exist`).toBe(true);
      expect(statSync(dirPath).isDirectory(), `${domain} must be a directory`).toBe(true);
    }
  });

  it("verifies canonical root integration and contract modules exist", () => {
    const canonicalFiles = [
      "ward-flow-reducer.ts",
      "ward-model.ts",
      "ward-scenarios.ts",
      "ward-flow-events.ts",
      "ward-admissions.ts",
      "ward-priority.ts",
      "ward-travel-bands.ts",
      "ward-bed-availability.ts",
    ];

    for (const file of canonicalFiles) {
      const filePath = join(wardMgmtRoot, file);
      expect(existsSync(filePath), `Canonical file ${file} must exist`).toBe(true);
      expect(statSync(filePath).isFile(), `${file} must be a file`).toBe(true);
    }
  });

  it("verifies domain folders contain non-empty component or logic files", () => {
    const sampleDomains = ["reports", "legal-forms", "transport", "ed", "ward"];
    for (const domain of sampleDomains) {
      const dirPath = join(wardMgmtRoot, domain);
      const files = readdirSync(dirPath);
      expect(files.length).toBeGreaterThan(0);
      const tsOrTsx = files.some((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
      expect(tsOrTsx).toBe(true);
    }
  });

  it("ensures reports directory houses downtime pack reporting assets", () => {
    const downtimeLogic = join(wardMgmtRoot, "reports", "downtime-pack.ts");
    const downtimeScreen = join(wardMgmtRoot, "reports", "downtime-pack-screen.tsx");
    expect(existsSync(downtimeLogic)).toBe(true);
    expect(existsSync(downtimeScreen)).toBe(true);
  });

  it("ensures restrictive-practice directory houses seclusion/restraint registers", () => {
    const rpDir = join(wardMgmtRoot, "restrictive-practice");
    const files = readdirSync(rpDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.includes("restrictive") || f.includes("seclusion"))).toBe(true);
  });
});
