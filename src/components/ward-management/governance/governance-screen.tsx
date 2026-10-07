"use client";

import type { ReactNode } from "react";

import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { GovernanceWorkbench } from "@/components/ward-management/governance-registers";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import type { Instant } from "@/components/ward-management/ward-clock";

import styles from "./governance.module.css";

export interface GovernanceScreenProps {
  movements?: Movement[];
  units?: Unit[];
  now?: Instant;
  children?: ReactNode;
}

/**
 * Clinical governance register. Legacy facts, effectiveness, and the session access record
 * are not part of this screen.
 */
export function GovernanceScreen(props: GovernanceScreenProps = {}) {
  const flow = useWardFlow();
  const movements = props.movements ?? flow.movements;
  const units = props.units ?? flow.units;
  const clockNow = useWardFlowClock();
  const now = props.now ?? clockNow;

  return (
    <div className={styles.governanceScreen} data-testid="ward-governance-screen">
      <main id="main-content" className={styles.main}>
        <GovernanceWorkbench movements={movements} units={units} now={now} api={flow} />
        {props.children}
      </main>
    </div>
  );
}

export default GovernanceScreen;
