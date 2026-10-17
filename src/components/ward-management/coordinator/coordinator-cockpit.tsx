"use client";

import React from "react";
import { CoordinatorScreen } from "./coordinator-screen";
import { useWardFlow, useWardFlowClock, WardFlowOverride } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

export interface CoordinatorCockpitProps {
  className?: string;
  onDispatchAction?: WardCommandDispatch;
  children?: React.ReactNode;
}

/**
 * CoordinatorCockpit
 *
 * Operational cockpit for the psychiatric bed flow coordinator.
 * Wraps CoordinatorScreen and ensures all dispatches use `role: 'coordinator'`
 * rather than 'ward' or default roles, enforcing strict coordinator privileges.
 */
export function CoordinatorCockpit({ className, onDispatchAction, children }: CoordinatorCockpitProps) {
  const wardFlow = useWardFlow();
  const now = useWardFlowClock();

  // A stable dispatch: the override gives each field its own context, so a new closure every minute
  // would wake every dispatch reader under the cockpit. The latest inputs are read through a ref.
  const latest = React.useRef({ dispatch: wardFlow.dispatch, now, onDispatchAction });
  React.useLayoutEffect(() => {
    latest.current = { dispatch: wardFlow.dispatch, now, onDispatchAction };
  });
  const coordinatorDispatch = React.useCallback((event: WardFlowEvent) => {
    const inputs = latest.current;
    const coordinatorEvent: WardFlowEvent = {
      ...event,
      // Owner ruling 13 Oct: the cockpit is the coordinator's surface, so every dispatch carries the coordinator role.
      role: "coordinator",
      now: event.now ?? inputs.now,
    } as WardFlowEvent;
    if (inputs.onDispatchAction) {
      return inputs.onDispatchAction(coordinatorEvent);
    } else {
      return inputs.dispatch(coordinatorEvent);
    }
  }, []);

  const coordinatorContext = React.useMemo(
    () => ({ ...wardFlow, dispatch: coordinatorDispatch }),
    [wardFlow, coordinatorDispatch],
  );

  return (
    <WardFlowOverride value={coordinatorContext}>
      <div className={className} data-testid="ward-coordinator-cockpit">
        {children ?? <CoordinatorScreen />}
      </div>
    </WardFlowOverride>
  );
}
