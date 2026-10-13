import type { JourneyStage } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * v10 Patient: "The Journey strip in the hero, sized by real duration, with the bed wait hatched."
 *
 * Built only from times the movement actually records: opened, first referred, accepted, collected
 * (or left the department) and arrived. A stage whose start was never recorded is folded into the
 * stage before it rather than given an invented length. The last open stage runs to `now`.
 */
export function patientJourneyStages(movement: Movement, now: Instant): JourneyStage[] {
  const transport = movement.transport;
  const departed = transport?.collectedAt ?? movement.leftDepartmentAt;
  // Audit S-28 (13 Oct 2026): an arrival recorded without a transport job still ends the journey.
  const arrived = transport?.arrivedAt ?? (movement.closure?.outcome === "arrived" ? movement.closure.at : undefined);
  const points: { id: string; label: string; at: Instant | undefined; quiet?: boolean }[] = [
    {
      id: "ed",
      label: movement.referredAt !== undefined ? "In ED" : "Finding a bed",
      at: movement.openedAt,
    },
    { id: "asked", label: "Wards asked", at: movement.referredAt },
    { id: "bed-wait", label: "Bed wait", at: movement.acceptedAt, quiet: true },
    { id: "travel", label: "Travel", at: departed },
  ];
  const recorded = points.filter(
    (point): point is typeof point & { at: Instant } => typeof point.at === "number" && Number.isFinite(point.at),
  );
  // Only the opening time is recorded (every seeded movement): say so rather than name a stage.
  if (recorded.length === 1) recorded[0]!.label = "Since opened · stage times not recorded";
  const end = typeof arrived === "number" && Number.isFinite(arrived) ? arrived : now;
  return recorded.map((point, index) => {
    const next = recorded[index + 1]?.at ?? end;
    const last = index === recorded.length - 1;
    return {
      id: point.id,
      label: point.label,
      minutes: Math.max(0, Math.round(next - point.at)),
      quiet: point.quiet,
      now: last && arrived === undefined ? true : undefined,
    };
  });
}
