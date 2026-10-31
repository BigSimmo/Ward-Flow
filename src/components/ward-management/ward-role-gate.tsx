"use client";

/**
 * Route-role hooks for action buttons (feature 11). Every screen that offers an action asks
 * `useRoleGate()` rather than reading `EVENT_ROLE` itself; the rule lives in
 * `ward-role-permissions.ts`, and the reducer remains the gate that actually refuses.
 */
import { useCallback, useId, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DisabledReason } from "@/components/wf";
import { wardChromeRole, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { useAccessShellRole, useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { dispatchPermission, type WardFlowEventType } from "@/components/ward-management/ward-role-permissions";

type DeskRoleOverride = {
  pathname: string;
  role: WardChromeRole;
} | null;

let currentDeskOverride: DeskRoleOverride = null;
const deskRoleListeners = new Set<() => void>();

function subscribeDeskRole(listener: () => void): () => void {
  deskRoleListeners.add(listener);
  return () => {
    deskRoleListeners.delete(listener);
    if (deskRoleListeners.size === 0) {
      currentDeskOverride = null;
    }
  };
}

function getDeskRoleSnapshot(): DeskRoleOverride {
  return currentDeskOverride;
}

/** Switch the active desk role in-place for the current route. */
export function setDeskRole(role: WardChromeRole, pathname = ""): void {
  currentDeskOverride = { pathname, role };
  for (const listener of deskRoleListeners) {
    listener();
  }
}

const ROLE_DESK_LABELS: Record<WardChromeRole, string> = {
  coordinator: "Coordinator",
  // D-80: the site bed manager is its own desk, never labelled as the coordinator's. Decision 45
  // (Josh, 31 Oct 2026): called "Site bed manager" everywhere.
  bed_manager: "Site bed manager",
  executive: "Executive",
  ward: "Ward",
  ed: "ED",
  officer: "Transport",
  community: "Community",
};

/** Map a gated event type or permission refusal reason to the required desk role and label. */
export function requiredRoleForPermission(
  eventType: WardFlowEventType,
  reason?: string,
): { role: WardChromeRole; label: string } {
  const text = reason ?? "";
  if (/emergency department|\bed\b/i.test(text) && dispatchPermission("ed", eventType).allowed) {
    return { role: "ed", label: ROLE_DESK_LABELS.ed };
  }
  if (/accepting ward|\bward\b/i.test(text) && dispatchPermission("ward", eventType).allowed) {
    return { role: "ward", label: ROLE_DESK_LABELS.ward };
  }
  if (/transport|officer/i.test(text) && dispatchPermission("officer", eventType).allowed) {
    return { role: "officer", label: ROLE_DESK_LABELS.officer };
  }
  if (/community/i.test(text) && dispatchPermission("community", eventType).allowed) {
    return { role: "community", label: ROLE_DESK_LABELS.community };
  }
  if (/coordinator|bed manager/i.test(text) && dispatchPermission("coordinator", eventType).allowed) {
    return { role: "coordinator", label: ROLE_DESK_LABELS.coordinator };
  }
  const candidates: WardChromeRole[] = ["ed", "ward", "officer", "community", "coordinator"];
  for (const candidate of candidates) {
    if (dispatchPermission(candidate, eventType).allowed) {
      return { role: candidate, label: ROLE_DESK_LABELS[candidate] };
    }
  }
  return { role: "coordinator", label: ROLE_DESK_LABELS.coordinator };
}

/** The role this route gives, or the active in-page desk switch override for this pathname. */
export function useRouteRole(): WardChromeRole {
  const pathname = usePathname() ?? "";
  const override = useSyncExternalStore(subscribeDeskRole, getDeskRoleSnapshot, () => null);
  const routeRole = override && override.pathname === pathname ? override.role : wardChromeRole(pathname);
  // Role access plan: with the flag on, a non-coordinator desk acts only as its own role, whatever
  // the route or an in-page switch says. A coordinator keeps the route-based behaviour.
  return useAccessShellRole(routeRole);
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
  const pathname = usePathname() ?? "";
  const role = useRouteRole();
  // Audit RA-04: under role access a non-coordinator desk acts only as itself (`useRouteRole`), so
  // an in-page desk switch would change nothing. Offer it only where it works: a coordinator's desk,
  // or role access off (the effective access is then the statewide coordinator).
  const canSwitchDesk = useEffectiveWardAccess().role === "coordinator";
  const baseId = useId();
  return useCallback(
    (eventType: WardFlowEventType, key?: string): RoleGate => {
      const permission = dispatchPermission(role, eventType);
      if (permission.allowed) return { allowed: true, buttonProps: {}, note: null };
      const id = `${baseId}-${eventType}${key ? `-${key}` : ""}`;
      const required = requiredRoleForPermission(eventType, permission.reason);
      return {
        allowed: false,
        reason: permission.reason,
        buttonProps: { disabled: true, "aria-describedby": id },
        note: (
          <span className="lockline">
            <DisabledReason id={id}>{permission.reason}</DisabledReason>
            {canSwitchDesk ? (
              <>
                {" "}
                <button
                  type="button"
                  className="lockline"
                  onClick={() => setDeskRole(required.role, pathname)}
                  data-testid={`ward-role-switch-${required.role}`}
                >
                  Switch to {required.label} desk →
                </button>
              </>
            ) : null}
          </span>
        ),
      };
    },
    [role, baseId, pathname, canSwitchDesk],
  );
}
