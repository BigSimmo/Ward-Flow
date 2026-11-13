import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { testRunLockInternals } from "../../../scripts/test-run-lock.mjs";
import {
  createIsolatedState,
  createTestJourney,
  TEST_NOW,
} from "../helpers/test-harness";
import { wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { handoverLines } from "@/components/ward-management/legal-forms/legal-forms-view";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { Movement } from "@/components/ward-management/ward-model";

function parseJsonc(content: string) {
  const lines = content.split("\n").filter((line) => !line.trim().startsWith("//"));
  return JSON.parse(lines.join("\n"));
}

describe("Tier 2 - Boundaries & Corner Cases: Features 01 - 04", () => {
  describe("Feature 01: Lock & Process Deadlock Boundaries", () => {
    it("marks coordinator lock directory as stale when holderPid process is dead", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wf-lock-bnd-stale-"));
      try {
        const ownerPath = path.join(tempDir, "owner.json");
        fs.writeFileSync(
          ownerPath,
          JSON.stringify({
            pid: 4,
            holderPid: 99999999, // dead holder
            coordinator: true,
            startedAt: new Date(Date.now() - 3600_000).toISOString(),
          }),
        );
        expect(testRunLockInternals.ownerDirectoryIsStale(tempDir)).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      }
    });

    it("treats owner file with empty or malformed JSON as stale past grace period", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wf-lock-bnd-mal-"));
      try {
        fs.writeFileSync(path.join(tempDir, "owner.json"), "{ invalid json ");
        const past = (Date.now() - 35_000) / 1000;
        fs.utimesSync(tempDir, past, past);
        expect(testRunLockInternals.ownerDirectoryIsStale(tempDir)).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      }
    });

    it("treats owner file with missing PID or NaN PID as stale", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wf-lock-bnd-nan-"));
      try {
        fs.writeFileSync(
          path.join(tempDir, "owner.json"),
          JSON.stringify({ pid: "not-a-number", startedAt: new Date().toISOString() }),
        );
        expect(testRunLockInternals.ownerDirectoryIsStale(tempDir)).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      }
    });

    it("identifies PID 4 as dead when allowSentinel is false", () => {
      expect(testRunLockInternals.processIsAlive(4, { allowSentinel: false })).toBe(false);
    });

    it("identifies living process correctly when current process.pid is checked", () => {
      expect(testRunLockInternals.processIsAlive(process.pid)).toBe(true);
    });
  });

  describe("Feature 02: tsconfig Glob & Path Boundaries", () => {
    const tsconfigPath = path.join(process.cwd(), "tsconfig.typecheck.json");
    const raw = fs.readFileSync(tsconfigPath, "utf-8");
    const tsconfig = parseJsonc(raw);

    it("excludes exact mockup-backup root folders", () => {
      expect(tsconfig.exclude).toContain("mockup-backup-*");
    });

    it("excludes all deep nested mockup assets", () => {
      expect(tsconfig.exclude).toContain("mockups/**");
    });

    it("does not exclude legitimate test files containing 'mock' in the name", () => {
      const excludePatterns = tsconfig.exclude as string[];
      for (const pat of excludePatterns) {
        expect(pat).not.toBe("tests/**");
        expect(pat).not.toBe("*mock*");
      }
    });

    it("retains node_modules and .next/** in exclude list", () => {
      expect(tsconfig.exclude).toContain("node_modules");
      expect(tsconfig.exclude).toContain(".next/**");
    });

    it("verifies include array includes TS/TSX globs", () => {
      expect(tsconfig.include).toContain("**/*.ts");
      expect(tsconfig.include).toContain("**/*.tsx");
    });
  });

  describe("Feature 03: Medical Clearance Gate Boundaries", () => {
    it("handles clearance set to false then updated to true", () => {
      const j = createTestJourney({ initialClearance: false });
      expect(j.currentMovement().medicalClearance?.cleared).toBe(false);

      // Attempt booking - rejected
      j.bookTransport();
      expect(j.currentMovement().transport).toBeUndefined();

      // Clinical team clears pathology
      j.recordClearance(true);
      expect(j.currentMovement().medicalClearance?.cleared).toBe(true);

      // Booking now succeeds
      j.bookTransport();
      expect(j.currentMovement().transport).toBeDefined();
    });

    it("rejects booking if clearance is updated from true back to false (medical deterioration)", () => {
      const j = createTestJourney({ initialClearance: true });
      expect(j.currentMovement().medicalClearance?.cleared).toBe(true);

      // Patient deteriorates in ED (seizure / desaturation)
      j.recordClearance(false);
      expect(j.currentMovement().medicalClearance?.cleared).toBe(false);

      j.bookTransport();
      expect(j.currentMovement().transport).toBeUndefined();
      expect(j.lastRejection()).toContain("Medical clearance");
    });

    it("rejects transport booking when clearance record has empty/null clearance boolean", () => {
      const state = createIsolatedState();
      const movement = state.movements[0];
      const event: WardFlowEvent = {
        type: "BOOK_TRANSPORT",
        role: "ed",
        now: TEST_NOW,
        movementId: movement.id,
        provider: "Ambulance service",
        escortRequired: false,
        cadNumber: "CAD-BND-1",
        transportLegalStatus: "voluntary",
        estimatedAt: TEST_NOW + 60,
      };

      const next = wardFlowReducer(state, event);
      expect(next.rejections.length).toBeGreaterThan(0);
      expect(next.rejections.at(-1)?.reason).toContain("Medical clearance");
    });

    it("permits pull hold without clearance regardless of urgency level", () => {
      const j = createTestJourney(); // unassessed
      expect(j.currentMovement().stage).toBe("pulled");
      expect(j.currentMovement().allocatedBed).toBeDefined();
    });

    it("retains clearance status on movement after bed pull release", () => {
      const j = createTestJourney({ initialClearance: true });
      j.send({
        type: "RELEASE_PULL",
        role: "ward",
        movementId: j.movementId,
        unitId: j.unitId,
        actingUnitId: j.unitId,
        reason: "Clinical priority changed",
      });

      const m = j.currentMovement();
      expect(m.medicalClearance?.cleared).toBe(true);
    });
  });

  describe("Feature 04: Expired Legal Forms Handover Boundaries", () => {
    const nameOf = (m: Movement) => `Patient-${m.id}`;

    const createMockMovement = (id: string, dueAt: number): Movement => ({
      id,
      stage: "pulled",
      legalStatus: "Involuntary",
      legalForm: {
        code: "1A",
        dueAt,
        receivedAt: TEST_NOW - 240,
      },
      flaggedUrgent: false,
      urgency: 2,
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female",
      openedAt: TEST_NOW - 240,
      statusChanges: [],
      urgencyChanges: [],
      overrides: [],
      owner: "ed",
      referredUnitIds: [],
      declines: [],
      blocker: "None",
      observation: "general",
      highAcuity: false,
    } as unknown as Movement);

    it("renders Form 1A expiring in shift window without expired badge", () => {
      const movement = createMockMovement("WF-BND-IMM", TEST_NOW + 60);
      const lines = handoverLines([movement], TEST_NOW, nameOf, 480);
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain("Form 1A");
      expect(lines[0]).not.toContain("⚠️ EXPIRED");
    });

    it("retains Form 1A expired by 1 minute (left = -1) with EXPIRED badge", () => {
      const expiredMovement = createMockMovement("WF-BND-EXP-1", TEST_NOW - 1);
      const lines = handoverLines([expiredMovement], TEST_NOW, nameOf, 480);
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain("⚠️ EXPIRED");
      expect(lines[0]).toContain("Form 1A");
    });

    it("retains Form 1A expired by 24 hours (left = -1440) with EXPIRED badge and hour indicator", () => {
      const expiredMovement = createMockMovement("WF-BND-EXP-24", TEST_NOW - 1440);
      const lines = handoverLines([expiredMovement], TEST_NOW, nameOf, 480);
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain("⚠️ EXPIRED");
      expect(lines[0]).toContain("[24h ago]");
    });

    it("retains Form 1A expired by 7 days (left = -10080) in handover without dropping", () => {
      const expiredMovement = createMockMovement("WF-BND-EXP-7D", TEST_NOW - 10080);
      const lines = handoverLines([expiredMovement], TEST_NOW, nameOf, 480);
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain("⚠️ EXPIRED");
    });

    it("handles movements with no legal form gracefully (omitted from handover lines)", () => {
      const voluntaryMovement = {
        ...createMockMovement("WF-BND-VOL", TEST_NOW + 60),
        legalStatus: "Voluntary" as const,
        legalForm: undefined,
      };
      const lines = handoverLines([voluntaryMovement], TEST_NOW, nameOf, 480);
      expect(lines.length).toBe(0);
    });
  });
});
