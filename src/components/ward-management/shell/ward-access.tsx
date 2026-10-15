"use client";

/**
 * **ROLE ACCESS IN THE APP — role access plan PR 1 (Josh's go, 15 Oct 2026).**
 *
 * `WardAccessScope` sits under `WardFlowProvider` in the layout and re-provides the app context
 * scoped to the desk's access, so every screen AND every piece of shell chrome (rail, header,
 * Tasks, Activity, New referral) reads only what the role may see. `WardAccessGate` wraps the page
 * area and shows "Not part of your role" for a closed screen. Both do nothing while the
 * `role-access` flag is off.
 *
 * The table is `ward-role-access.ts`, the scoping is `ward-access-scope.ts`, and the desk is
 * `ward-access-store.ts`. This file only connects them to React.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button, buttonClass } from "@/components/wf";
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { scopeWorkspace } from "@/components/ward-management/ward-access-scope";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { formatInstant } from "@/components/ward-management/ward-clock";
import {
  WardFlowContext,
  useWardFlow,
  type WardFlowContextValue,
} from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import {
  ACCESS_ROLE_LABELS,
  BREAK_GLASS_REASONS,
  accessIsWholeNetwork,
  canBreakGlass,
  homeHrefFor,
  screenDecision,
  screenForPath,
  unitInScope,
  type BreakGlassReasonId,
  type WardAccess,
} from "@/components/ward-management/ward-role-access";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
import { useWardFeatureFlag } from "./ward-feature-flag-store";
import {
  breakGlass,
  endAccessPreview,
  lockWardDesk,
  useEffectiveWardAccess,
  useWardAccessSnapshot,
  type BreakGlassRecord,
} from "./ward-access-store";

export { chromeRoleForAccess, useAccessShellRole, useEffectiveWardAccess } from "./ward-access-store";
import { UnscopedWardFlowContext, useUnscopedWardFlow } from "./ward-access-context";
import { announceToWardShell } from "./ward-live-region";
import styles from "./ward-access.module.css";

export { useUnscopedWardFlow } from "./ward-access-context";

/** Where the desk is, in words: "Ward 6B", "Fiona Stanley ED", "South Metro". */
export function accessPlaceLabel(access: WardAccess, units: readonly Unit[]): string {
  const scope = access.scope;
  switch (scope.kind) {
    case "statewide":
      return "Statewide";
    case "service":
      return scope.service;
    case "site":
      return siteByCode(scope.siteCode)?.name ?? scope.siteCode;
    case "ward":
      return scope.unitIds.map((id) => units.find((unit) => unit.id === id)?.name ?? id).join(", ");
    case "ed":
      return edById(scope.edId)?.name ?? scope.edId;
    case "team":
      return scope.teamName;
    case "jobs":
      return "Assigned transport jobs";
  }
}

/** Break glass ids visible only through a grant, so a screen can say the record is read only. */
const BreakGlassContext = createContext<ReadonlySet<string>>(new Set());

export function useBreakGlassPatientIds(): ReadonlySet<string> {
  return useContext(BreakGlassContext);
}

/**
 * Re-provides the app context, scoped. A statewide coordinator gets the original value back, so the
 * flag costs nothing on the coordinator's own view.
 */
export function WardAccessScope({ children }: { children: ReactNode }) {
  const context = useWardFlow();
  const access = useEffectiveWardAccess();
  const { records } = useWardAccessSnapshot();
  const now = context.now;
  const activeGrants = useMemo(
    () => records.filter((record) => record.role === access.role && record.until > now),
    [records, access.role, now],
  );

  const value = useMemo<{ scoped: WardFlowContextValue; glass: ReadonlySet<string> }>(() => {
    if (accessIsWholeNetwork(access) && activeGrants.length === 0) return { scoped: context, glass: new Set() };
    const places = wardPlaceLookup(context.units);
    const scoped = scopeWorkspace(context, access, { now, places, grants: activeGrants });
    const coordinator = access.role === "coordinator";
    const unitIn = (unitId: string) => unitInScope(access.scope, unitId, places);
    const byUnit = <T extends { unitId: string }>(items: readonly T[]): T[] =>
      items.filter((item) => unitIn(item.unitId));
    const resolveIndex = {
      patients: scoped.patients,
      referrals: scoped.referrals,
      movements: scoped.movements,
      plannedAdmissions: coordinator ? context.plannedAdmissions : [],
    };
    const { breakGlassPatientIds, ...rest } = scoped;
    // Break glass is read only: an event about a person seen only through it is refused here, before
    // the reducer, and said aloud. Movement ids are traced to their person.
    const glassMovementIds = new Set<string>(
      scoped.movements
        .filter((movement) => movement.patientId && breakGlassPatientIds.has(movement.patientId))
        .map((movement) => movement.id),
    );
    const dispatch: WardFlowContextValue["dispatch"] =
      breakGlassPatientIds.size === 0
        ? context.dispatch
        : (event) => {
            const fields = event as { patientId?: unknown; movementId?: unknown };
            const touchesGlass =
              (typeof fields.patientId === "string" && breakGlassPatientIds.has(fields.patientId)) ||
              (typeof fields.movementId === "string" && glassMovementIds.has(fields.movementId));
            if (touchesGlass) {
              announceToWardShell("Read only. This record was opened outside your care.");
              return;
            }
            context.dispatch(event);
          };
    return {
      glass: breakGlassPatientIds,
      scoped: {
        ...rest,
        dispatch,
        rejections: coordinator ? context.rejections : [],
        eventLog: coordinator ? context.eventLog : [],
        bedReleases: byUnit(context.bedReleases),
        leaveBeds: byUnit(context.leaveBeds),
        refreshRequests: coordinator ? context.refreshRequests : [],
        repatriations: coordinator ? context.repatriations : [],
        plannedAdmissions: coordinator ? context.plannedAdmissions : [],
        supportNotifications: coordinator ? context.supportNotifications : [],
        wardReferralInbox: (unitId: string) => (unitIn(unitId) ? context.wardReferralInbox(unitId) : []),
        resolvePatientIdentity: (subject) => resolveSubjectPatient(subject, resolveIndex),
      },
    };
  }, [context, access, activeGrants, now]);

  return (
    <UnscopedWardFlowContext.Provider value={context}>
      <WardFlowContext.Provider value={value.scoped}>
        <BreakGlassContext.Provider value={value.glass}>{children}</BreakGlassContext.Provider>
      </WardFlowContext.Provider>
    </UnscopedWardFlowContext.Provider>
  );
}

/** The nav entry that becomes a desk's own place, and what it is called there. */
const OWN_PLACE_ENTRY: Partial<Record<WardAccess["scope"]["kind"], { id: string; label: string }>> = {
  ward: { id: "wards", label: "My ward" },
  ed: { id: "ed", label: "My ED" },
  team: { id: "community", label: "My team" },
};

/**
 * Nav entries the desk may open. The index entry for the desk's own kind of place (All wards for a
 * ward desk, All EDs for an ED desk, Community for a team) becomes a link to its own place.
 */
export function useAccessNavFilter(): <T extends { href: string; id: string; label: string }>(
  entries: readonly T[],
) => T[] {
  const on = useWardFeatureFlag("role-access");
  const access = useEffectiveWardAccess();
  const { units } = useUnscopedWardFlow();
  return useCallback(
    <T extends { href: string; id: string; label: string }>(entries: readonly T[]): T[] => {
      if (!on || accessIsWholeNetwork(access)) return [...entries];
      const places = wardPlaceLookup(units);
      const own = OWN_PLACE_ENTRY[access.scope.kind];
      return entries.flatMap((entry) => {
        const shown =
          own && entry.id === own.id
            ? { ...entry, href: homeHrefFor(access, communityTeamSlug), label: own.label }
            : entry;
        return screenDecision(access, screenForPath(shown.href), places).open ? [shown] : [];
      });
    },
    [on, access, units],
  );
}

/** One line under the header saying which desk this is, and the way back from a preview. */
export function WardAccessBanner() {
  const on = useWardFeatureFlag("role-access");
  const { access, previewOf } = useWardAccessSnapshot();
  const { units } = useUnscopedWardFlow();
  if (!on || (accessIsWholeNetwork(access) && !previewOf)) return null;
  return (
    <div className={styles.banner} role="status" data-testid="ward-access-banner">
      <span>
        {previewOf ? "Previewing as " : "Desk: "}
        <b>{ACCESS_ROLE_LABELS[access.role]}</b>, {accessPlaceLabel(access, units)}. You see only what this role needs.
      </span>
      {previewOf ? (
        <Button size="sm" variant="sec" onClick={endAccessPreview} data-testid="ward-access-end-preview">
          Back to coordinator
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The page area. A closed screen is replaced, never hidden by style, so its data is not drawn. A
 * patient or movement page outside the desk's care gives the same words whether or not that person
 * exists (review finding 12).
 */
export function WardAccessGate({ children }: { children: ReactNode }) {
  const on = useWardFeatureFlag("role-access");
  const pathname = usePathname() ?? "";
  const access = useEffectiveWardAccess();
  const scoped = useWardFlow();
  const unscoped = useUnscopedWardFlow();
  const glass = useBreakGlassPatientIds();
  if (!on || accessIsWholeNetwork(access)) return <>{children}</>;
  const places = wardPlaceLookup(unscoped.units);
  const address = screenForPath(pathname);
  const decision = screenDecision(access, address, places);
  if (!decision.open) return <ClosedScreen access={access} />;
  if (address?.movementId !== undefined && !scoped.movements.some((movement) => movement.id === address.movementId))
    return <ClosedScreen access={access} />;
  const subject = address?.patientId;
  if (subject === undefined) return <>{children}</>;
  // The patient page takes a person id or a movement id (`people/[patientId]/page.tsx`).
  const seen =
    scoped.patients.some((patient) => patient.id === subject) ||
    scoped.movements.some((movement) => movement.id === subject);
  // Break glass opens the person, so a movement address is traced to its patient first. An address
  // that names nobody gets the same closed page, so the page never confirms who exists.
  const person = subject.startsWith("PT-")
    ? subject
    : unscoped.movements.find((movement) => movement.id === subject)?.patientId;
  if (!seen) return <ClosedScreen access={access} patientId={person ?? subject} />;
  return (
    <>
      {person && glass.has(person) ? <WardBreakGlassNote patientId={person} /> : null}
      {children}
    </>
  );
}

function ClosedScreen({ access, patientId }: { access: WardAccess; patientId?: string }) {
  const [switching, setSwitching] = useState(false);
  const { units } = useUnscopedWardFlow();
  const home = homeHrefFor(access, communityTeamSlug);
  return (
    <main className={styles.closed} data-testid="ward-access-closed">
      <h1 tabIndex={-1} ref={(heading) => heading?.focus()}>
        Not part of your role
      </h1>
      <p>
        {patientId
          ? "This patient is not in your care."
          : "This screen is not part of the " + ACCESS_ROLE_LABELS[access.role] + " desk."}{" "}
        You are working as {ACCESS_ROLE_LABELS[access.role]}, {accessPlaceLabel(access, units)}.
      </p>
      <div className={styles.actions}>
        <Link href={home} className={buttonClass({ variant: "pri" })} data-testid="ward-access-home">
          Go to your home
        </Link>
        <Button variant="sec" onClick={() => setSwitching(true)} data-testid="ward-access-switch">
          Switch desk
        </Button>
      </div>
      {patientId && canBreakGlass(access.role) ? <BreakGlassForm access={access} patientId={patientId} /> : null}
      {switching ? <OperatorSwitcherModal isOpen onClose={() => setSwitching(false)} /> : null}
    </main>
  );
}

/** Break glass: warn, ask why, then open one record read only for a set time (plan section 7). */
function BreakGlassForm({ access, patientId }: { access: WardAccess; patientId: string }) {
  const { now, units } = useUnscopedWardFlow();
  const [reason, setReason] = useState<BreakGlassReasonId | null>(null);
  const [other, setOther] = useState("");
  const minutes = CLINICAL_VALUES.breakGlassWindow.value;
  const ready = reason !== null && (reason !== "other" || other.trim().length > 0);
  return (
    <section className={styles.glass} aria-labelledby="ward-break-glass-title">
      <h2 id="ward-break-glass-title">Open this record anyway</h2>
      <p>
        Only if you need it for this person&apos;s care. It opens read only for {minutes} minutes, the coordinator is
        told straight away, and it is reviewed.
      </p>
      <fieldset>
        <legend>Why do you need it?</legend>
        {BREAK_GLASS_REASONS.map((option) => (
          <label key={option.id} className={styles.reason}>
            <input
              type="radio"
              name="ward-break-glass-reason"
              value={option.id}
              checked={reason === option.id}
              onChange={() => setReason(option.id)}
            />
            {option.label}
          </label>
        ))}
        {reason === "other" ? (
          <input
            className={styles.other}
            type="text"
            aria-label="Reason in your own words"
            maxLength={200}
            autoComplete="off"
            value={other}
            onChange={(event) => setOther(event.target.value)}
          />
        ) : null}
      </fieldset>
      <Button
        variant="danger"
        disabled={!ready}
        data-testid="ward-break-glass-open"
        onClick={() =>
          reason &&
          breakGlass({
            patientId,
            now,
            windowMinutes: minutes,
            reason,
            otherText: other,
            placeLabel: accessPlaceLabel(access, units),
          })
        }
      >
        Open read only
      </Button>
    </section>
  );
}

/** Says a record is open only through break glass, on the patient page. */
export function WardBreakGlassNote({ patientId }: { patientId: string }) {
  const glass = useBreakGlassPatientIds();
  if (!glass.has(patientId)) return null;
  return (
    <p className={styles.readOnly} role="status" data-testid="ward-break-glass-note">
      Opened outside your care, read only. The coordinator has been told.
    </p>
  );
}

/** The coordinator's review list of break glass openings this session (plan section 7). */
export function WardBreakGlassReview() {
  const on = useWardFeatureFlag("role-access");
  const access = useEffectiveWardAccess();
  const { records } = useWardAccessSnapshot();
  if (!on || access.role !== "coordinator") return null;
  const perShift = CLINICAL_VALUES.breakGlassPerShift.value;
  const counts = new Map<string, number>();
  for (const record of records) counts.set(record.placeLabel, (counts.get(record.placeLabel) ?? 0) + 1);
  return (
    <section aria-labelledby="ward-break-glass-review" data-testid="ward-break-glass-review">
      <h2 id="ward-break-glass-review">Records opened outside care</h2>
      {records.length === 0 ? (
        <p>None this session.</p>
      ) : (
        <ul className={styles.list}>
          {records.map((record: BreakGlassRecord) => {
            const reason = BREAK_GLASS_REASONS.find((option) => option.id === record.reason)?.label ?? "Other";
            const pattern = (counts.get(record.placeLabel) ?? 0) > perShift;
            return (
              <li key={record.id}>
                {formatInstant(record.openedAt)}, {record.roleLabel}, {record.placeLabel}. {reason}
                {record.otherText ? `: ${record.otherText}` : ""}
                {pattern ? ". More than " + perShift + " this shift, check with them." : "."}
              </li>
            );
          })}
        </ul>
      )}
      <p>Kept for this session only in the demo. The shared workspace keeps them on the server.</p>
    </section>
  );
}

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/** Shared computer lock (feature 10): no use for the set time, and the desk is put down. */
export function WardIdleLock() {
  const on = useWardFeatureFlag("role-access");
  const access = useEffectiveWardAccess();
  const [locked, setLocked] = useState(false);
  const minutes = CLINICAL_VALUES.idleLock.value;
  useEffect(() => {
    if (!on || accessIsWholeNetwork(access)) return;
    let timer = window.setTimeout(() => setLocked(true), minutes * 60_000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLocked(true), minutes * 60_000);
    };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, reset, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, reset);
    };
  }, [on, access, minutes]);
  if (!locked) return null;
  return (
    <div className={styles.lock} role="dialog" aria-modal="true" aria-labelledby="ward-idle-lock-title">
      <div className={styles.lockCard}>
        <h1 id="ward-idle-lock-title">Locked after {minutes} minutes</h1>
        <p>
          This desk was put down so the next person cannot see the last person&apos;s patients. Choose a desk to carry
          on.
        </p>
        <Button
          variant="pri"
          data-testid="ward-idle-unlock"
          onClick={() => {
            lockWardDesk();
            setLocked(false);
          }}
        >
          Start again
        </Button>
      </div>
    </div>
  );
}

/** Every print names who printed it, from where, and when (feature 11). */
export function WardPrintFooter() {
  const access = useEffectiveWardAccess();
  const { units, now } = useUnscopedWardFlow();
  return (
    <p className={styles.printFooter} data-testid="ward-print-footer">
      Printed by {ACCESS_ROLE_LABELS[access.role]}, {accessPlaceLabel(access, units)}, at {formatInstant(now)}.
      Synthetic data.
    </p>
  );
}
