"use client";

import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { WardFlowProvider } from "../ward-flow-provider";
import { WardSharedAccess, useWardShared, type WardSharedConnection } from "../ward-shared-access";
import type { ExecutiveAggregateSnapshot } from "../ward-shared-client";
import { ExecutiveStatisticsProvider, useExecutiveStatisticsControl } from "../statistics/executive-statistics-context";
import { ExecutiveStatisticsUnavailable } from "../statistics/statistics-small-numbers";
import { parseStoredAccess } from "./ward-access-store";
import { WardShellAuthorityProvider, WardShellPublicProvider, executiveShellPlaces } from "./ward-shell-public-context";
import type { WardAccess } from "../ward-role-access";
const ExecutiveChrome = dynamic(() => import("./ward-executive-chrome").then((module) => module.WardExecutiveChrome), {
  loading: ExecutiveStatisticsUnavailable,
});
/** Code-split independently of the operational phone chrome. */
export function WardExecutiveChromeMount({ children }: { children: ReactNode }) {
  return <ExecutiveChrome>{children}</ExecutiveChrome>;
}
/** A local/coordinator preview uses the same public chrome, with its authorised source retained
 * above this selector. Normal desks keep their existing chrome and operational hooks. */
export function WardPreviewChrome({
  executiveChildren,
  children,
}: {
  executiveChildren: ReactNode;
  children: ReactNode;
}) {
  return useExecutiveStatisticsControl().executive ? executiveChildren : children;
}

type WorkspaceHostProps = {
  children: ReactNode;
  initialDayZero?: number;
  /** Supplied only after the existing chrome's public frame/slots are adopted and reviewed. */
  executiveChildren?: ReactNode;
  connection?: WardSharedConnection;
};

/** One stable snapshot for each validity interval. Every getter checks the real clock, while
 * the receipt/deadline pair gives a replacement poll its own current clock sample. */
function executiveReportLifetime(until: number | null, receivedAt: number) {
  const server = { valid: false, now: 0 };
  let sampled: { valid: boolean; now: number } | null = null;
  return {
    current: () => {
      const now = Date.now();
      const valid =
        until !== null &&
        Number.isFinite(until) &&
        Number.isFinite(receivedAt) &&
        receivedAt > 0 &&
        receivedAt <= now &&
        now < until;
      if (sampled === null || sampled.valid !== valid) sampled = { valid, now };
      return sampled;
    },
    server: () => server,
    subscribe: (changed: () => void) => {
      if (until === null || !Number.isFinite(until)) return () => {};
      let timer: ReturnType<typeof setTimeout>;
      const check = () => {
        const remaining = until - Date.now();
        if (remaining <= 0) changed();
        else timer = setTimeout(check, Math.min(remaining, 2_147_483_647));
      };
      check();
      return () => clearTimeout(timer);
    },
  };
}

/** One auth/poll owner, above the operational reducer. Unknown authenticated access never seeds. */
export function WardWorkspaceHost(props: WorkspaceHostProps) {
  return props.connection ? (
    <ConnectedWorkspaceHost {...props} connection={props.connection} />
  ) : (
    <WorkspaceConnection {...props} />
  );
}
function WorkspaceConnection(props: WorkspaceHostProps) {
  const connection = useWardShared(process.env.NEXT_PUBLIC_WARD_SHARED_ENABLED === "true");
  return <ConnectedWorkspaceHost {...props} connection={connection} />;
}
function ConnectedWorkspaceHost({
  connection,
  children,
  executiveChildren,
  initialDayZero,
}: WorkspaceHostProps & { connection: WardSharedConnection }) {
  // One object while the role and place stay the same: a poll hands over a fresh copy every few
  // seconds, and consumers keyed on access (the idle lock's clock) must not restart for it.
  const accessKey = JSON.stringify(connection.access ?? null);
  const access = useMemo(() => parseStoredAccess(accessKey), [accessKey]);
  if (!connection.enabled)
    return (
      <WardFlowProvider sharedConnection={connection} initialDayZero={initialDayZero}>
        {children}
      </WardFlowProvider>
    );
  if (!connection.signedIn || !access) return <WardSharedAccess connection={connection}>{null}</WardSharedAccess>;
  if (access.role !== "executive") {
    return (
      <WardShellAuthorityProvider access={access}>
        <WardFlowProvider sharedConnection={connection} initialDayZero={initialDayZero}>
          {children}
        </WardFlowProvider>
      </WardShellAuthorityProvider>
    );
  }
  const identity = JSON.stringify([
    connection.actorId,
    connection.workingAs,
    access,
    connection.viewEpoch,
    connection.executiveSnapshot?.accessContext,
  ]);
  return (
    <WardShellAuthorityProvider access={access}>
      <WardSharedAccess connection={connection}>
        <ExecutiveWorkspace key={identity} connection={connection} access={access}>
          {executiveChildren}
        </ExecutiveWorkspace>
      </WardSharedAccess>
    </WardShellAuthorityProvider>
  );
}

/** Actual executive input is exclusively the strict aggregate envelope; operational snapshots
 * cannot become a report, even while a role transition or a failed refresh is in progress. */
function ExecutiveWorkspace({
  connection,
  access,
  children,
}: {
  connection: WardSharedConnection;
  access: WardAccess;
  children?: ReactNode;
}) {
  const current = connection.executiveSnapshot ?? null;
  const [held, setHeld] = useState<{ snapshot: ExecutiveAggregateSnapshot; receivedAt: number } | null>(null);
  const selected = held?.snapshot ?? current;
  const selectedReceivedAt = held?.receivedAt ?? connection.receivedAt;
  const currentDeadline = connection.accessUntil;
  const sessionDeadline = connection.sessionEndsAt;
  const finiteSession = sessionDeadline === null || sessionDeadline === undefined || Number.isFinite(sessionDeadline);
  const expiresAt =
    selected && typeof currentDeadline === "number" && Number.isFinite(currentDeadline) && finiteSession
      ? Math.min(selected.accessUntil, currentDeadline, sessionDeadline ?? Number.POSITIVE_INFINITY)
      : null;
  const lifetime = useMemo(
    () => executiveReportLifetime(expiresAt, selectedReceivedAt),
    [expiresAt, selectedReceivedAt],
  );
  const subscribe = useCallback(
    (changed: () => void) =>
      lifetime.subscribe(() => {
        setHeld(null);
        changed();
      }),
    [lifetime],
  );
  const displayLifetime = useSyncExternalStore(subscribe, lifetime.current, lifetime.server);
  const scopeMatches =
    selected !== null &&
    (access.scope.kind === "statewide"
      ? selected.report.network.scope.kind === "statewide"
      : access.scope.kind === "service" &&
        selected.report.network.scope.kind === "service" &&
        selected.report.network.scope.service === access.scope.service);
  const ready =
    selected !== null &&
    current !== null &&
    connection.actorId === selected.actorId &&
    current.actorId === selected.actorId &&
    current.accessContext === selected.accessContext &&
    Number.isSafeInteger(connection.viewEpoch) &&
    connection.viewEpoch! >= 0 &&
    displayLifetime.valid &&
    scopeMatches;
  const binding =
    ready && selected
      ? {
          actorId: selected.actorId,
          accessContext: selected.accessContext,
          epoch: connection.viewEpoch!,
          revision: selected.revision,
        }
      : null;
  const snapshot = ready
    ? { binding: binding!, receivedAt: selectedReceivedAt, expiresAt: expiresAt!, data: selected!.report }
    : null;
  const report = ready && selected ? selected.report : null;
  const publicModel = useMemo(
    () =>
      report
        ? {
            places: executiveShellPlaces(report),
            placeLabel: report.network.scope.kind === "service" ? report.network.scope.service : "Statewide",
            now: report.network.asAt.now,
            authenticated: true,
            switchRole: connection.switchRole,
            accessLifetime: JSON.stringify([
              connection.actorId,
              connection.workingAs,
              current?.accessContext,
              connection.viewEpoch,
            ]),
          }
        : null,
    [
      report,
      connection.switchRole,
      connection.actorId,
      connection.workingAs,
      current?.accessContext,
      connection.viewEpoch,
    ],
  );
  return (
    <ExecutiveStatisticsProvider
      binding={binding}
      snapshot={snapshot}
      now={displayLifetime.now}
      controls={{
        executive: true,
        paused: held !== null,
        togglePause:
          ready && current
            ? () => setHeld((value) => (value ? null : { snapshot: current, receivedAt: connection.receivedAt }))
            : null,
      }}
    >
      {publicModel ? (
        <WardShellPublicProvider value={publicModel}>
          {children ?? <ExecutiveStatisticsUnavailable />}
        </WardShellPublicProvider>
      ) : (
        <ExecutiveStatisticsUnavailable />
      )}
    </ExecutiveStatisticsProvider>
  );
}
