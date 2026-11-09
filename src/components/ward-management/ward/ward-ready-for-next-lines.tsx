"use client";

import Link from "next/link";
import { useMemo } from "react";
import { StatusGlyph } from "@/components/wf";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { unitHref } from "@/components/ward-management/shell/ward-facade";
import { wardWaitList } from "./ward-wait-list";
import styles from "./ward-ready-for-next-lines.module.css";

/**
 * "<Ward> is ready for next patient · first on its wait list: <patient>" (Josh, 9 Nov 2026). A fact
 * on the coordinator's Home, never a recommendation: it names the wait list's oldest referral only
 * because that is the ward's own first-in, first-out list, and the coordinator still pulls by hand.
 */
export function WardReadyForNextLines() {
  const { units, movements, referrals, patients } = useWardFlowSelect("units", "movements", "referrals", "patients");
  const now = useWardFlowClock();
  const nameFor = usePatientNameDisplay();
  const ready = useMemo(
    () =>
      units
        .filter((unit) => unit.readyForNextAt !== undefined)
        .sort((a, b) => a.readyForNextAt! - b.readyForNextAt! || a.name.localeCompare(b.name)),
    [units],
  );
  if (ready.length === 0) return null;
  const resolverState = { patients, referrals, movements };
  return (
    <ul className={styles.lines} aria-label="Wards ready for their next patient" data-testid="home-ward-ready-lines">
      {ready.map((unit) => {
        const first = wardWaitList(movements, unit.id)[0];
        const who = first ? resolveSubjectPatient(first, resolverState) : undefined;
        return (
          <li key={unit.id} className={styles.line} data-testid={`home-ward-ready-${unit.id}`}>
            <StatusGlyph tone="success" size={8} />
            <span>
              <Link href={`${unitHref(unit.id)}?tab=referrals`} className={styles.ward}>
                {unit.name}
              </Link>{" "}
              is ready for next patient
              <span className={styles.since}> since {formatInstantWithDay(unit.readyForNextAt!, now)}</span>
              {" · "}
              {who ? (
                <>
                  first on its wait list: <b>{nameFor(who.formalName, who.umrn)}</b>
                </>
              ) : (
                "nobody on its wait list"
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
