"use client";

/**
 * Route-role hooks for action buttons (feature 11). Every screen that offers an action asks
 * `useRoleGate()` rather than reading `EVENT_ROLE` itself; the rule lives in
 * `ward-role-permissions.ts`, and the reducer remains the gate that actually refuses.
 */
import { useCallback, useId, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DisabledReason } from "@/components/wf";
import { wardChromeRole, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { dispatchPermission, type WardFlowEventType } from "@/components/ward-management/ward-role-permissions";

/** The role this route gives. Nothing is stored; a deep link and a navigation agree. */
export function useRouteRole(): WardChromeRole {
  return wardChromeRole(usePathname() ?? "");
}

export type RoleGate = {
  /** True when the route's role may take this action. */
  allowed: boolean;
  /** "Coordinator only" and the like, when not allowed. */
  reason?: string;
  /** Spread onto a native `<button>`: `disabled` and `aria-describedby` when not allowed. */
  buttonProps: { disabled?: true; "aria-describedby"?: string };
  /** The visible reason to render beside the button, or null when allowed. */
  note: ReactNode;
};

/**
 * Returns `gate(eventType, key?)`. `key` keeps the reason's id unique when one screen shows two
 * controls for the same event at once (for example a row per ward).
 */
export function useRoleGate(): (eventType: WardFlowEventType, key?: string) => RoleGate {
  const role = useRouteRole();
  const baseId = useId();
  return useCallback(
    (eventType: WardFlowEventType, key?: string): RoleGate => {
      const permission = dispatchPermission(role, eventType);
      if (permission.allowed) return { allowed: true, buttonProps: {}, note: null };
      const id = `${baseId}-${eventType}${key ? `-${key}` : ""}`;
      return {
        allowed: false,
        reason: permission.reason,
        buttonProps: { disabled: true, "aria-describedby": id },
        note: <DisabledReason id={id}>{permission.reason}</DisabledReason>,
      };
    },
    [role, baseId],
  );
}
