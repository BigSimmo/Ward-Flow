import { intakeWindowLine, tonightIntakeWindow } from "@/components/ward-management/ward-intake-window";
import type { Instant } from "@/components/ward-management/ward-clock";
import { wardIntakeConstraintLabels } from "@/components/ward-management/ward-change-reasons";
import type { Unit } from "@/components/ward-management/ward-model";

/**
 * The shortlist's ward-detail intake notes, moved out of `shortlist-panel.tsx` (line cap, 11 Nov 2026).
 * Owner Answer 18 (second round, 2026-09-17): the ward's own fixed-list answer to what is currently
 * limiting who it can accept, chosen labels only, never a code. Feature item 13: tonight's intake
 * hours. Both are information only.
 */
export function WardDetailIntakeNotes({ unit, now, className }: { unit: Unit; now: Instant; className: string }) {
  const tonight = tonightIntakeWindow(unit, now);
  return (
    <>
      {unit.intakeConstraints !== undefined && unit.intakeConstraints.length > 0 ? (
        <span className={className} data-testid={`ward-shortlist-ward-detail-constraints-${unit.id}`}>
          Limiting intake: {unit.intakeConstraints.map((code) => wardIntakeConstraintLabels[code]).join(", ")}
        </span>
      ) : null}
      {tonight ? (
        <span className={className} data-testid={`ward-shortlist-ward-detail-intake-window-${unit.id}`}>
          {intakeWindowLine(tonight)}
        </span>
      ) : null}
    </>
  );
}
