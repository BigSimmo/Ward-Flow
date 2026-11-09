import { fitLine, fitLineText } from "@/components/ward-management/coordinator/shortlist-fit-line";
import type { GateResult } from "@/components/ward-management/ward-eligibility";
import shortlistStyles from "./shortlist-panel.module.css";

/** Smart bed match as a plain fit line (Josh, 9 Nov 2026): words, never a score or an order. */
export function CandidateFit({ unitId, gates }: { unitId: string; gates: readonly GateResult[] }) {
  const fit = fitLineText(fitLine(gates));
  if (!fit) return null;
  return (
    <span className={shortlistStyles.candidateFit} data-testid={`ward-shortlist-fit-${unitId}`}>
      {fit}
    </span>
  );
}
