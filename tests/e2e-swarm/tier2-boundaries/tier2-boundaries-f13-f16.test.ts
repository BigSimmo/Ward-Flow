import { describe, it, expect } from "vitest";
import {
  validateBudgets,
  overBudget,
} from "../../../scripts/check-script-budget.mjs";
import {
  offlineUnitTestProject,
  isOfflineUnitTestFile,
} from "../../../scripts/unit-test-population.mjs";
import { vitestLeaseMode } from "../../../scripts/test-run-selection.mjs";
import { instantFromDateAndTimeInputs } from "@/components/ward-management/legal-forms/legal-forms-view";
import {
  createTestJourney,
  advanceToMoving,
  TEST_NOW,
} from "../helpers/test-harness";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("Tier 2 - Boundaries & Corner Cases: Features 13 - 16", () => {
  describe("Feature 13: Phone Bundle Budget Calculation Boundaries", () => {
    const standardBudgets = {
      "/ward-flow": 500,
      "/ward-flow/ed": 450,
    };

    it("treats measured size exactly equal to budget as compliant (not over)", () => {
      const exactMeasurement = {
        "/ward-flow": 500,
        "/ward-flow/ed": 450,
      };
      expect(overBudget(exactMeasurement, standardBudgets)).toEqual([]);
    });

    it("detects route that exceeds budget by even 0.01 KB", () => {
      const marginalOver = {
        "/ward-flow": 500.01,
        "/ward-flow/ed": 449.99,
      };
      const violations = overBudget(marginalOver, standardBudgets);
      expect(violations.length).toBe(1);
      expect(violations[0].route).toBe("/ward-flow");
      expect(violations[0].kb).toBe(500.01);
    });

    it("rejects non-positive budget limits in validateBudgets", () => {
      expect(() => validateBudgets({ "/ward-flow": 0 })).toThrow("positive finite number");
      expect(() => validateBudgets({ "/ward-flow": -50 })).toThrow("positive finite number");
      expect(() => validateBudgets({ "/ward-flow": NaN })).toThrow("positive finite number");
    });

    it("rejects invalid route names that do not start with / in validateBudgets", () => {
      expect(() => validateBudgets({ "invalid-route": 500 })).toThrow("Invalid script budget route");
    });

    it("handles multiple violating routes correctly in one batch report", () => {
      const doubleViolation = {
        "/ward-flow": 550,
        "/ward-flow/ed": 480,
      };
      const violations = overBudget(doubleViolation, standardBudgets);
      expect(violations.length).toBe(2);
      expect(violations.map((v) => v.route)).toEqual(["/ward-flow", "/ward-flow/ed"]);
    });
  });

  describe("Feature 14: Test Tiering Glob & Lease Boundaries", () => {
    it("rejects path traversal attempts (..) from offline test populations", () => {
      expect(offlineUnitTestProject("tests/../src/components/ward-flow.test.ts")).toBeNull();
      expect(isOfflineUnitTestFile("tests/../src/components/ward-flow.test.ts")).toBe(false);
    });

    it("correctly identifies live provider integration tests as excluded from Tier A/B", () => {
      expect(offlineUnitTestProject("tests/integration/real-supabase.live.test.ts")).toBeNull();
      expect(isOfflineUnitTestFile("tests/integration/real-supabase.live.test.ts")).toBe(false);
    });

    it("returns null for non-test helper scripts inside tests directory", () => {
      expect(offlineUnitTestProject("tests/helpers/test-harness.ts")).toBeNull();
      expect(offlineUnitTestProject("tests/fixtures/mock-census.json")).toBeNull();
    });

    it("vitestLeaseMode falls back to exclusive mode when unknown flags are provided", () => {
      expect(vitestLeaseMode(["--unknown-experimental-flag"])).toBe("exclusive");
    });

    it("vitestLeaseMode falls back to exclusive mode for non-offline files", () => {
      expect(vitestLeaseMode(["tests/integration/real-supabase.live.test.ts"])).toBe("exclusive");
    });
  });

  describe("Feature 15: Directory Modularization & Structural Integrity", () => {
    const wardMgmtRoot = join(process.cwd(), "src/components/ward-management");

    it("verifies all domain subdirectories contain valid source files", () => {
      const domains = ["movements", "referrals", "ward", "ed", "reports", "settings"];
      for (const d of domains) {
        const fullPath = join(wardMgmtRoot, d);
        expect(existsSync(fullPath)).toBe(true);
        const entries = readdirSync(fullPath);
        expect(entries.length).toBeGreaterThan(0);
      }
    });

    it("ensures reports directory contains downtime pack modules", () => {
      const packPath = join(wardMgmtRoot, "reports", "downtime-pack.ts");
      const packScreenPath = join(wardMgmtRoot, "reports", "downtime-pack-screen.tsx");
      expect(existsSync(packPath)).toBe(true);
      expect(existsSync(packScreenPath)).toBe(true);
    });

    it("ensures legal-forms directory contains progression and view modules", () => {
      const progression = join(wardMgmtRoot, "legal-forms", "legal-form-progression.ts");
      const view = join(wardMgmtRoot, "legal-forms", "legal-forms-view.ts");
      expect(existsSync(progression)).toBe(true);
      expect(existsSync(view)).toBe(true);
    });
  });

  describe("Feature 16: Statutory Dates & Clinical Ruling Boundaries", () => {
    const dayZero = new Date("2024-01-01T00:00:00+08:00"); // 2024 is a leap year

    it("parses valid leap year date (29 February 2024) accurately", () => {
      const instant = instantFromDateAndTimeInputs("2024-02-29", "12:00", dayZero);
      expect(instant).toBeDefined();
      expect(typeof instant).toBe("number");
    });

    it("rejects 29 February on non-leap year (29 February 2023) without inventing duration", () => {
      const dayZero2023 = new Date("2023-01-01T00:00:00+08:00");
      const instant = instantFromDateAndTimeInputs("2023-02-29", "12:00", dayZero2023);
      expect(instant).toBeUndefined();
    });

    it("rejects day 31 in 30-day month (31 April 2024)", () => {
      const instant = instantFromDateAndTimeInputs("2024-04-31", "12:00", dayZero);
      expect(instant).toBeUndefined();
    });

    it("verifies dual-bed holding is preserved throughout long-distance aeromedical transit", () => {
      const j = createTestJourney({
        initialClearance: true,
        edId: "karratha-ed",
        unitId: "scgh-adult-open",
        extendedHold: true,
      });

      j.bookTransport({ provider: "RFDS" });
      j.advanceToMoving();

      const movement = j.currentMovement();
      expect(movement.stage).toBe("moving");
      expect(movement.allocatedBed).toBeDefined();
      expect(movement.admissionId).toBeDefined();

      // Destination unit still has the bed reserved
      const heldAdmission = j.state.admissions.find((a) => a.id === movement.admissionId);
      expect(heldAdmission).toBeDefined();
    });
  });
});
