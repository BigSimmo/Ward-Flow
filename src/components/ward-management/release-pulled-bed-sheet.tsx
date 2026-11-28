"use client";

import { useState } from "react";

import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import {
  RELEASE_PULL_REASONS,
  changeReasonLabels,
  type ReleasePullReason,
} from "@/components/ward-management/ward-change-reasons";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { Button, Field, FormalName, Select, Sheet } from "@/components/wf";

import styles from "./release-pulled-bed-sheet.module.css";

/**
 * Mock-up (simplification R1, 26 Nov 2026): the one "Release pulled bed". Every door that gives a
 * pulled bed back opens this sheet: Home, Alerts, Movements, the ward's arrivals and Home, and ED.
 * One safety model: the reason is asked once, the final button names the patient (CT-19), and the
 * release comes back from the toast's Undo (`UNDO_RELEASE_STEP`).
 *
 * - `pull`: a bed pulled with no journey yet (`RELEASE_PULL`). The reason is chosen here.
 * - `held`: transport was stopped after collection (`RELEASE_HELD_BED`). The reason was recorded
 *   with the stop, so the sheet states it rather than asking again.
 * - `diverted`: the move was diverted elsewhere (`RELEASE_DIVERTED_BED`). The reason was recorded
 *   with the diversion; the release also closes the journey.
 *
 * The parent keeps this mounted with no target once the sheet closes, because the step's outcome
 * (released, or refused with the engine's reason) is said by `useUndoableStep` after the press.
 */
export type ReleasePulledBedKind = "pull" | "held" | "diverted";

export type ReleasePulledBedTarget = {
  movementId: string;
  kind: ReleasePulledBedKind;
  displayName: string;
  umrn?: string;
  /** One line on which bed this is, such as the alert's title or "Bed pulled at Ward 4". */
  context: string;
};

const RECORDED_REASON: Record<Exclude<ReleasePulledBedKind, "pull">, string> = {
  held: "Transport was stopped after collection.",
  diverted: "The move was diverted. Releasing the bed also closes the journey.",
};

const UNDONE: Record<ReleasePulledBedKind, string> = {
  pull: "Undone: The bed is pulled again",
  held: "Undone: The bed is held again",
  diverted: "Undone: The bed is held again and the journey is open",
};

export function ReleasePulledBedSheet({
  target,
  role,
  actingUnitId,
  disabledReason: blockedReason,
  onClose,
  testId = "release-pulled-bed-sheet",
}: {
  target: ReleasePulledBedTarget | undefined;
  /** The desk releasing: the coordinator, the ward holding the bed, or the referring ED. */
  role: WardFlowRole;
  /** A ward names the ward it acts for, as the engine requires. */
  actingUnitId?: string;
  /** Why this desk cannot release here, shown on the button. */
  disabledReason?: string;
  onClose: () => void;
  testId?: string;
}) {
  const { dispatch, rejections } = useWardFlowSelect("dispatch", "rejections");
  const now = useWardFlowClock();
  const [reason, setReason] = useState<ReleasePullReason | "">("");
  const { run } = useUndoableStep({ dispatch, rejections, now, routeRole: role });
  if (!target) return null;
  const { movementId, kind, displayName, umrn, context } = target;
  const acting = role === "ward" && actingUnitId ? { actingUnitId } : {};
  const close = () => {
    setReason("");
    onClose();
  };
  const disabledReason = blockedReason ?? (kind === "pull" && reason === "" ? "Choose a reason first" : undefined);
  const release = (): WardFlowEvent | undefined => {
    if (kind === "pull") {
      if (reason === "") return undefined;
      return { type: "RELEASE_PULL", role, now, movementId, reason, ...acting };
    }
    if (kind === "held") return { type: "RELEASE_HELD_BED", role, now, movementId, ...acting };
    return { type: "RELEASE_DIVERTED_BED", role, now, movementId, ...acting };
  };
  return (
    <Sheet open onClose={close} title="Release pulled bed" mobilePlacement="bottom" testId={testId}>
      <div className={styles.body}>
        <p className={styles.context}>{context}</p>
        <p className={styles.who} data-testid={`${testId}-who`}>
          <span>
            For <FormalName name={displayName} />
          </span>
          {umrn ? <span className={styles.umrn}>{umrn}</span> : null}
        </p>
        {kind === "pull" ? (
          <Field label="Reason for release" id={`${testId}-${movementId}`}>
            <Select value={reason} onChange={(event) => setReason(event.target.value as ReleasePullReason | "")}>
              <option value="">Choose a reason</option>
              {RELEASE_PULL_REASONS.map((option) => (
                <option key={option} value={option}>
                  {changeReasonLabels[option]}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <p data-testid={`${testId}-reason`}>Reason: {RECORDED_REASON[kind]}</p>
        )}
        <div className={styles.action}>
          <Button
            variant="pri"
            disabledReason={disabledReason}
            onClick={() => {
              if (disabledReason !== undefined) return;
              const event = release();
              if (!event) return;
              run(event, {
                success:
                  kind === "diverted"
                    ? `Bed released for ${displayName}. The diverted journey is closed.`
                    : `Bed released for ${displayName}.`,
                // Tier 1 item 6 (Josh, 4 Nov 2026): the release and the ward's notice come back from Undo.
                // D-192 item 3: `run` titles the toast "... · Undo until HH:MM" for every kind, diverted too.
                undo: (at) => ({ type: "UNDO_RELEASE_STEP", role, now: at, movementId, ...acting }),
                undone: UNDONE[kind],
              });
              close();
            }}
          >
            {/* CT-19: the release names its patient at the point of commit. */}
            Release pulled bed for {displayName}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
