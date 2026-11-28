"use client";

// Simplification 26 Nov 2026 (area 3, item 3, first slice): two of the Bed board's own tools,
// "Clinically ready since" and the ward's tentative diagnosis, in the Ward bed drawer. They reuse
// the Board's controls and send the same events (SET_CLINICALLY_READY, RECORD_WARD_DIAGNOSIS), so
// the two pages record one fact the same way until /board folds into Ward home.

import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import type { Unit } from "@/components/ward-management/ward-model";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { usePermitFor } from "@/components/ward-management/shell/use-permit";
import type { Change } from "@/components/ward-management/ward-permit";
import { buildOccupants } from "../board/ward-board-model";
import { ClinicallyReadyControl } from "../board/ward-board-clinically-ready";
import { WardDiagnosisControl } from "../board/ward-board-ward-diagnosis";
import styles from "./ward-bed-dossier-drawer.module.css";

export type WardBedBoardTools = {
  raise: WardRaise;
  /** Sends the command and says the outcome on the ward page's toast. */
  record: (record: () => ReturnType<WardCommandDispatch>, success: string) => void;
};

type Which = "ready" | "diagnosis";

export function WardBedBoardTool({
  which,
  unit,
  admissionId,
  tools,
}: {
  which: Which;
  unit: Unit;
  admissionId: string;
  tools: WardBedBoardTools;
}) {
  const { admissions, dayZero, leaveBeds, resolvePatientIdentity } = useWardFlowSelect(
    "admissions",
    "dayZero",
    "leaveBeds",
    "resolvePatientIdentity",
  );
  const now = useWardFlowClock();
  const roleGate = useRoleGate();
  const permitFor = usePermitFor();
  const may = (eventType: "SET_CLINICALLY_READY" | "RECORD_WARD_DIAGNOSIS") =>
    roleGate(eventType).allowed && permitFor({ type: eventType, actingUnitId: unit.id } as Change).kind !== "never";
  const occupant = buildOccupants(unit, admissions, now, leaveBeds).find((entry) => entry.key === admissionId);
  if (!occupant) return null;
  const nameFor = (id: string) => {
    const resolved = resolvePatientIdentity(admissions.find((entry) => entry.id === id) ?? { id });
    return resolved.patient ? resolved.formalName : "the patient (name not recorded)";
  };
  const report = (record: () => ReturnType<WardCommandDispatch>, success: string) => tools.record(record, success);

  if (which === "diagnosis") {
    if (!may("RECORD_WARD_DIAGNOSIS")) return null;
    return (
      <div className={`${styles.cardInner} ${styles.boardTool}`} data-testid="ward-drawer-ward-diagnosis">
        <WardDiagnosisControl
          key={occupant.key}
          occupant={occupant}
          unitId={unit.id}
          raise={tools.raise}
          dispatchAndReport={report}
        />
      </div>
    );
  }
  if (occupant.days === null || !may("SET_CLINICALLY_READY")) return null;
  return (
    <div className={`${styles.cardInner} ${styles.boardTool}`} data-testid="ward-drawer-clinically-ready">
      <ClinicallyReadyControl
        key={`${occupant.key}-${occupant.clinicallyReady?.since ?? ""}-${occupant.clinicallyReady?.reason ?? ""}`}
        occupant={occupant}
        arrivedAt={admissions.find((entry) => entry.id === occupant.key)?.arrivedAt ?? null}
        unitId={unit.id}
        now={now}
        dayZero={dayZero}
        raise={tools.raise}
        dispatchAndReport={report}
        nameFor={nameFor}
      />
    </div>
  );
}
