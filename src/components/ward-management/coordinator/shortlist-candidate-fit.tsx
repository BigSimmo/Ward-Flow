import { useId, useState, type ReactNode } from "react";

import { fitDetails, fitLine, fitLineText } from "@/components/ward-management/coordinator/shortlist-fit-line";
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

/** One ward card's list item: the card's own button, then its More fit details beside it. */
export function CandidateItem({
  unit,
  gates,
  children,
}: {
  unit: { id: string; name: string };
  gates: readonly GateResult[];
  children: ReactNode;
}) {
  return (
    <li>
      {children}
      <CandidateFitMore unitId={unit.id} unitName={unit.name} gates={gates} />
    </li>
  );
}

/**
 * More fit details (item 26): a quiet toggle under the ward card listing the other gates already
 * checked, each Met, Not met or To check. It sits beside the card's button, never inside it, and
 * explains only (D-71): no order, tint, score or suggestion.
 */
export function CandidateFitMore({
  unitId,
  unitName,
  gates,
}: {
  unitId: string;
  unitName: string;
  gates: readonly GateResult[];
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const details = fitDetails(gates);
  if (details.length === 0) return null;
  return (
    <div className={shortlistStyles.fitMore}>
      <button
        type="button"
        className={shortlistStyles.fitMoreToggle}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${open ? "Less" : "More"} fit details, ${unitName}`}
        data-testid={`ward-shortlist-fit-more-${unitId}`}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Less" : "More"}
      </button>
      <ul id={listId} hidden={!open} className={shortlistStyles.fitMoreList}>
        {details.map((detail) => (
          <li key={detail.gate} data-gate={detail.gate}>
            {detail.label}: {detail.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
