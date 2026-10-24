import { afterEach, describe, expect, it, vi } from "vitest";
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import { formTimeLeft } from "@/components/ward-management/legal-forms/legal-form-time-left";
import {
  isLegalDeadlineBreached,
  legalFormGroupOf,
} from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { buildActionInbox } from "@/components/ward-management/ward-derivations";
import { tryReadDemoState } from "@/components/ward-management/ward-flow-demo-restore";
import { WARD_FLOW_STORED_STATE_VERSION } from "@/components/ward-management/ward-flow-demo-storage-constants";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seed = seedWardFlowStateAt(0);
const base = seed.movements.find((movement) => !movement.closure && !movement.examination)!;
const NOW = NOW_ANCHOR;

/** Deliberately malformed synthetic input, beyond what the static model permits. */
function withExpiry(dueAt: unknown): Movement {
  return { ...base, legalForm: { code: "4A", kind: "transport", dueAt } } as Movement;
}

function expiryAlerts(movement: Movement) {
  return buildActionInbox([movement], NOW, seed.units).filter((item) => item.id === `legal-${movement.id}`);
}

afterEach(() => vi.unstubAllGlobals());

describe("restored recorded legal expiry", () => {
  it.each([null, NaN, Infinity, -Infinity])(
    "does not turn a JSON expiry of %s into an overdue alert after restoration",
    (dueAt) => {
      // JSON stores nonfinite numbers as null. The existing restore fence permits null time fields.
      const state = {
        ...seed,
        movements: seed.movements.map((movement) => (movement.id === base.id ? withExpiry(dueAt) : movement)),
      };
      const dayZero = new Date("2026-10-24T00:00:00+08:00");
      const raw = JSON.stringify({
        version: WARD_FLOW_STORED_STATE_VERSION,
        dayZero: dayZero.getTime(),
        worldGeneration: state.worldGeneration,
        now: NOW,
        savedAtAbsolute: 1000,
        state,
      });
      // The raw override exercises the production reader without browser storage or a provider.
      vi.stubGlobal("window", {});
      const read = tryReadDemoState(dayZero, 1000, raw);
      expect(read.saved, read.recoveryNotice).toBeDefined();
      const restored = read.saved!.state.movements.find((movement) => movement.id === base.id)!;
      expect(restored.legalForm?.dueAt).toBeNull();
      expect(expiryAlerts(restored)).toEqual([]);
      expect(legalFormGroupOf(restored)).toBe("no-deadline");
      expect(formTimeLeft(restored, NOW, DEFAULT_DUE_SOON_THRESHOLDS)).toBeUndefined();
    },
  );

  it.each([undefined, null, NaN, Infinity, -Infinity, "", "0", "642"])(
    "treats malformed or absent expiry %s as unwritten in shared consumers",
    (dueAt) => {
      const movement = withExpiry(dueAt);
      expect(currentLegalDueAt(movement)).toBeUndefined();
      expect(legalFormGroupOf(movement)).toBe("no-deadline");
      expect(isLegalDeadlineBreached(movement, NOW)).toBe(false);
      expect(formTimeLeft(movement, NOW, DEFAULT_DUE_SOON_THRESHOLDS)).toBeUndefined();
      expect(expiryAlerts(movement)).toEqual([]);
    },
  );

  it.each([
    { dueAt: 0, breached: true },
    { dueAt: -120, breached: true },
    { dueAt: 0.5, breached: true },
    { dueAt: NOW, breached: false },
    { dueAt: NOW + 60, breached: false },
  ])("retains recorded finite expiry $dueAt and its actual alert state", ({ dueAt, breached }) => {
    const movement = withExpiry(dueAt);
    expect(currentLegalDueAt(movement)).toBe(dueAt);
    expect(legalFormGroupOf(movement)).toBe("with-deadline");
    expect(isLegalDeadlineBreached(movement, NOW)).toBe(breached);
    expect(expiryAlerts(movement)).toHaveLength(breached ? 1 : 0);
  });

  it.each(["arrival", "examination"])("keeps an ended expiry as history after %s", (endedWhen) => {
    const movement: Movement = {
      ...withExpiry(0),
      legalStatus: "Involuntary inpatient",
      ...(endedWhen === "arrival"
        ? { closure: { at: NOW, outcome: "arrived" as const, reason: "arrived" } }
        : { examination: { at: NOW, outcome: "inpatient_order" as const } }),
    };
    expect(movement.legalForm?.dueAt).toBe(0);
    expect(currentLegalDueAt(movement)).toBeUndefined();
    expect(expiryAlerts(movement)).toEqual([]);
  });

  it.each(["1A", "3B", "6A"])("does not infer a time for Form %s when none was written", (code) => {
    const movement: Movement = { ...base, legalForm: { code, kind: "detention" } };
    expect(currentLegalDueAt(movement)).toBeUndefined();
    expect(expiryAlerts(movement)).toEqual([]);
  });

  it.each(["1A", "3B"])("still honours an explicitly recorded time on Form %s", (code) => {
    const movement: Movement = { ...withExpiry(0), legalForm: { code, kind: "detention", dueAt: 0 } };
    expect(currentLegalDueAt(movement)).toBe(0);
    expect(expiryAlerts(movement)).toHaveLength(1);
  });
});
