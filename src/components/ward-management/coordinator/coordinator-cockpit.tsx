"use client";

import React from "react";
import { CoordinatorScreen } from "./coordinator-screen";
import { useWardFlow, useWardFlowClock, WardFlowContext } from "@/components/ward-management/ward-flow-provider";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

export interface CoordinatorCockpitProps {
  className?: string;
  onDispatchAction?: (event: WardFlowEvent) => void;
  children?: React.ReactNode;
}

/**
 * CoordinatorCockpit (WF-A1-15)
 *
 * Operational cockpit for the psychiatric bed flow coordinator.
 * Wraps CoordinatorScreen and ensures all dispatches use `role: 'coordinator'`
 * rather than 'ward' or default roles, enforcing strict coordinator privileges.
 */
export function CoordinatorCockpit({ className, onDispatchAction, children }: CoordinatorCockpitProps) {
  const wardFlow = useWardFlow();
  const now = useWardFlowClock();

  const coordinatorContext = React.useMemo(() => {
    return {
      ...wardFlow,
      dispatch: (event: WardFlowEvent) => {
        const coordinatorEvent: WardFlowEvent = {
          ...event,
          role: "coordinator",
          now: event.now ?? now,
        } as WardFlowEvent;
        if (onDispatchAction) {
          onDispatchAction(coordinatorEvent);
        } else {
          wardFlow.dispatch(coordinatorEvent);
        }
      },
    };
  }, [wardFlow, now, onDispatchAction]);

  return (
    <WardFlowContext.Provider value={coordinatorContext}>
      <div className={className} data-testid="ward-coordinator-cockpit">
        {children ?? <CoordinatorScreen />}
      </div>
    </WardFlowContext.Provider>
  );
}

export default CoordinatorCockpit;
