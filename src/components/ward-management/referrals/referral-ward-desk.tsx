"use client";
/*
 * ROLE BRANCH (ward), Josh 31 Oct 2026: the nurse in charge's pieces of the one Referrals board.
 * The scoped workspace holds only this ward's own incoming lines, so the board reads as the ward's
 * requests to answer, and an empty queue says so in one line. Every helper here is a no-op off the
 * ward desk (no own ward, no name).
 */
import Link from "next/link";
import { useMemo } from "react";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { Movement, Unit } from "@/components/ward-management/ward-model";

import desk from "./referral-desk.module.css";
import styles from "./referrals.module.css";

/**
 * The ward desk's own ward name, and the units its Beds ready counts: a ward desk holds only its own
 * stays, so its beds ready are its own ward's. Every other desk gets no name and every unit, unchanged.
 */
export function useWardDeskPlace(units: Unit[]): { ownWardName?: string; bedUnits: Unit[] } {
  const access = useEffectiveWardAccess();
  const ownUnitIds = access.role === "ward" && access.scope.kind === "ward" ? access.scope.unitIds : undefined;
  const bedUnits = useMemo(
    () => (ownUnitIds ? units.filter((unit) => ownUnitIds.includes(unit.id)) : units),
    [units, ownUnitIds],
  );
  const ownWardName = ownUnitIds ? units.find((unit) => ownUnitIds.includes(unit.id))?.name : undefined;
  return { ownWardName, bedUnits };
}

/** The hero title: the ward's own requests, by name. Undefined off the ward desk (no own ward name). */
export function wardDeskTitle(ownWardName: string | undefined, count: number): string | undefined {
  if (ownWardName === undefined) return undefined;
  return count === 0 ? `Nothing for ${ownWardName} to answer` : `${count} for ${ownWardName} to answer`;
}

/** An empty ward queue: what lands here, and the ward's people already on their way. */
export function WardDeskEmptyQueue({
  wardName,
  movements,
}: {
  wardName: string | undefined;
  movements: readonly Movement[];
}) {
  const onTheirWay = movements.filter(isOpen).length;
  return (
    <p className={styles.v6Empty} data-testid="ward-referral-board-own-ward-empty">
      {`No referral or bed offer for ${wardName ?? "your ward"}. `}
      {onTheirWay > 0 ? (
        <Link href="/ward-flow/movements" className={desk.link}>
          {`${onTheirWay} ${onTheirWay === 1 ? "person is" : "people are"} already coming and going`}
        </Link>
      ) : null}
    </p>
  );
}
