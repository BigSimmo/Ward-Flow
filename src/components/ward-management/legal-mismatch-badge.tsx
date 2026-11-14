import { Badge } from "@/components/wf";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  hasCurrentLegalMismatch,
  LEGAL_MISMATCH_CHIP,
  LEGAL_MISMATCH_WARNING,
} from "@/components/ward-management/ward-stay-legal";

/**
 * R-LEGAL-4 (Josh, 14 Nov 2026): the one legal-mismatch chip on lists (Search, Movements, the
 * Capacity ward drawer). Amber kit badge, neutral words; the full sentence is its title and is read
 * to screen readers. Display only: nothing is blocked by it (D-16). Renders nothing when the flag
 * no longer describes the journey (`hasCurrentLegalMismatch`).
 */
export function LegalMismatchBadge({
  movement,
}: {
  movement: Pick<Movement, "id" | "legalMismatch" | "acceptedUnitId" | "legalStatus" | "closure">;
}) {
  if (!hasCurrentLegalMismatch(movement)) return null;
  return (
    <span data-testid={`ward-legal-mismatch-chip-${movement.id}`}>
      <Badge tone="warning" size="sm" title={LEGAL_MISMATCH_WARNING}>
        {LEGAL_MISMATCH_CHIP}
        <span className="sr-only">. {LEGAL_MISMATCH_WARNING}</span>
      </Badge>
    </span>
  );
}
