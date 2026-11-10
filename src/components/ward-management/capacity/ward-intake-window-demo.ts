import type { Instant } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";
import { intakeDayStart, intakeWindowFromClockText } from "./ward-intake-window";

/**
 * Feature item 13 (10 Nov 2026): synthetic intake hours on three wards, set this morning relative to
 * the demo clock, so the ward hero, the Capacity card and Home show a window. Every figure is
 * invented. A ward missing from the seed is left alone, so a changed fixture never breaks it.
 */
const DEMO_WINDOWS: readonly { unitId: string; from: string; to: string; by: string }[] = [
  { unitId: "rph-adult-secure", from: "21:00", to: "02:00", by: "Nurse in charge" },
  { unitId: "scgh-adult-open", from: "19:00", to: "23:00", by: "Nurse in charge" },
  { unitId: "fre-adult-open", from: "22:00", to: "05:00", by: "Bed coordinator" },
];

export function applyIntakeWindowDemoOverlay<T extends { units: Unit[] }>(state: T, now: Instant): T {
  // Set half an hour ago, but never before this morning's day start.
  const at = Math.max(intakeDayStart(now), now - 30);
  const units = state.units.map((unit): Unit => {
    const demo = DEMO_WINDOWS.find((entry) => entry.unitId === unit.id);
    const intake = demo && !unit.intakeWindow ? intakeWindowFromClockText(demo.from, demo.to, now) : undefined;
    return intake && demo ? { ...unit, intakeWindow: { ...intake, at, by: demo.by } } : unit;
  });
  return { ...state, units };
}
