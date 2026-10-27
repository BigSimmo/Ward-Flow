import { useMemo } from "react";
import type { Instant } from "@/components/ward-management/ward-clock";
import { isOpen, isStoppedTransportAwaitingRelease } from "@/components/ward-management/ward-derivations";
import type { BedRelease, DeclineReason, LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";

/**
 * The ward's own lists, read from the shared board: releases still on the ward, beds held for leave,
 * referrals waiting on this ward, accepted and stopped transfers, this ward's recent answers and
 * withdrawn referrals. Moved unchanged from `ward-screen.tsx` (H-0283); every list is empty while
 * the ward is not found.
 */
export function useWardUnitQueues({
  unit,
  bedReleases,
  leaveBeds,
  movements,
}: {
  unit: Unit | undefined;
  bedReleases: readonly BedRelease[];
  leaveBeds: readonly LeaveBed[];
  movements: readonly Movement[];
}) {
  const pendingBedReleases = useMemo(
    () => (!unit ? [] : bedReleases.filter((release) => release.unitId === unit.id && release.state !== "discharged")),
    [bedReleases, unit],
  );
  const unitLeaveBeds = useMemo(
    () => (!unit ? [] : leaveBeds.filter((bed) => bed.unitId === unit.id)),
    [leaveBeds, unit],
  );
  const incoming = useMemo(
    () =>
      !unit
        ? []
        : movements
            .filter(
              (movement) =>
                isOpen(movement) &&
                movement.stage === "destination_review" &&
                movement.referredUnitIds.includes(unit.id),
            )
            .sort((left, right) => left.openedAt - right.openedAt),
    [movements, unit],
  );
  const accepted = useMemo(
    () => (!unit ? [] : movements.filter((movement) => isOpen(movement) && movement.acceptedUnitId === unit.id)),
    [movements, unit],
  );
  const heldAfterStop = useMemo(
    () =>
      !unit
        ? []
        : movements.filter(
            (movement) => isStoppedTransportAwaitingRelease(movement) && movement.acceptedUnitId === unit.id,
          ),
    [movements, unit],
  );
  const recentAnswers = useMemo(
    () =>
      !unit
        ? []
        : movements
            .flatMap((movement) => {
              const wardAnswers: Array<{
                key: string;
                movementId: string;
                outcome: "Accepted" | "Declined";
                at?: Instant;
                reason?: DeclineReason;
              }> = [];

              if (movement.acceptedUnitId === unit.id) {
                wardAnswers.push({
                  key: `${movement.id}-accepted`,
                  movementId: movement.id,
                  outcome: "Accepted",
                  at: movement.acceptedAt,
                });
              }

              movement.declines
                .filter((decline) => decline.unitId === unit.id)
                .forEach((decline, index) => {
                  wardAnswers.push({
                    key: `${movement.id}-declined-${index}`,
                    movementId: movement.id,
                    outcome: "Declined",
                    at: decline.at,
                    reason: decline.reason,
                  });
                });

              return wardAnswers;
            })
            .sort((left, right) => (right.at ?? Number.NEGATIVE_INFINITY) - (left.at ?? Number.NEGATIVE_INFINITY)),
    [movements, unit],
  );
  const withdrawn = useMemo(
    () =>
      !unit
        ? []
        : movements.filter((movement) => movement.withdrawnReferrals.some((entry) => entry.unitId === unit.id)),
    [movements, unit],
  );
  return { pendingBedReleases, unitLeaveBeds, incoming, accepted, heldAfterStop, recentAnswers, withdrawn };
}
