"use client";

import { useMemo, useState } from "react";

import { Segmented } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { deriveStepDownBoard } from "@/components/ward-management/ward-step-down";

import { PlannedAdmissionsPanel } from "./planned-admissions-panel";
import { StepDownBoard } from "./step-down-board";

/**
 * Polish (Josh, 31 Oct 2026): Planned admissions and the Step down board share one card, switched
 * in its title row, so an empty Step down board no longer holds a whole card of its own. Both lists
 * are today's, unchanged; each tab names its count.
 */
export function ComingIn({ now, plannedBooked }: { now: Instant; plannedBooked: number }) {
  const [view, setView] = useState<"planned" | "stepDown">("planned");
  const { admissions, units, movements, patients, referrals } = useWardFlowSelect(
    "admissions",
    "units",
    "movements",
    "patients",
    "referrals",
  );
  const stepDownCount = useMemo(
    () => deriveStepDownBoard({ admissions, units, movements, patients, referrals, now }).length,
    [admissions, units, movements, patients, referrals, now],
  );
  const tabs = (
    <Segmented
      label="Coming in"
      items={[
        { id: "planned" as const, label: "Planned admissions", count: plannedBooked },
        { id: "stepDown" as const, label: "Step down", count: stepDownCount },
      ]}
      value={view}
      onChange={setView}
    />
  );
  return view === "planned" ? (
    <PlannedAdmissionsPanel now={now} titleSlot={tabs} compactActions />
  ) : (
    <StepDownBoard now={now} titleSlot={tabs} />
  );
}
