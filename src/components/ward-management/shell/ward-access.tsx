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
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button, buttonClass, useModalFocus } from "@/components/wf";
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal-lazy";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { supportNotificationsForDesk } from "@/components/ward-management/ward-access-state";
import {
  coordinatorRecordScope,
  scopeBroadcastAlerts,
  scopeWorkspace,
  smallNumberParts,
  smallNumberText,
} from "@/components/ward-management/ward-access-scope";
import type { AuditReview } from "@/components/ward-management/ward-audit";
import type { RecordRead, WardRecordActor } from "@/components/ward-management/ward-discharge-records";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-inbox-reducer";
import {
  WardFlowOverride,
  useWardFlow,
  useWardFlowSelect,
  type WardFlowContextValue,
} from "@/components/ward-management/ward-flow-provider";
import type { Rejection } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { WardGround } from "@/components/ward-management/ward-shell";
import {
  ACCESS_ROLE_LABELS,
  BREAK_GLASS_REASONS,
  accessIsWholeNetwork,
  canBreakGlass,
  edInScope,
  homeHrefFor,
  screenDecision,
  screenForPath,
  unitInScope,
  type BreakGlassReasonId,
  type WardAccess,
} from "@/components/ward-management/ward-role-access";
import { useWardFeatureFlag } from "./ward-feature-flag-store";
import {
  breakGlass,
  endAccessPreview,
  endDueCovers,
  lockWardDesk,
  useEffectiveWardAccess,
  useWardAccessSnapshot,
  type BreakGlassRecord,
} from "./ward-access-store";

import { UnscopedWardFlowContext, useUnscopedWardFlow } from "./ward-access-context";
import { announceToWardShell } from "./ward-live-region";
import { forgetStepUp, useStepUp } from "./ward-step-up";
import { accessPlaceLabel } from "./ward-access-labels";
import { SharedAccessContext } from "./ward-shared-access-context";
import styles from "./ward-access.module.css";

export { useUnscopedWardFlow } from "./ward-access-context";

/** Break glass ids visible only through a grant, so a screen can say the record is read only. */
const BreakGlassContext = createContext<ReadonlySet<string>>(new Set());

function useBreakGlassPatientIds(): ReadonlySet<string> {
  return useContext(BreakGlassContext);
}

/**
 * Whether a ward or ED desk id is in this desk's place, or `undefined` when every desk is. A scoped
 * desk holds only its own acknowledgements, so its counts are against its own desks (review on PR #330).
 */
export function useDeskInScope(): ((deskId: string) => boolean) | undefined {
  const on = useWardFeatureFlag("role-access");
  const access = useEffectiveWardAccess();
  const { units } = useUnscopedWardFlow();
  return useMemo(() => {
    if (!on || accessIsWholeNetwork(access)) return undefined;
    const places = wardPlaceLookup(units);
    return (deskId: string) => unitInScope(access.scope, deskId, places) || edInScope(access.scope, deskId, places);
  }, [on, access, units]);
}

function sameItems(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * The scoped value rebuilds its lists on every change, the clock tick included. Screens read the app
 * state field by field, so a list keeps its previous identity while it holds the same items, and a
 * reader of that field does not re-render for an unrelated change (review on PR #322).
 */
function isSteadyContextKey(value: WardFlowContextValue, key: string): key is keyof WardFlowContextValue {
  return key in value;
}

function copySteadyKey<K extends keyof WardFlowContextValue>(
  target: WardFlowContextValue,
  source: WardFlowContextValue,
  key: K,
): void {
  target[key] = source[key];
}

function useSteadyLists(next: WardFlowContextValue): WardFlowContextValue {
  const [steady, setSteady] = useState(next);
  let changed = false;
  const merged: WardFlowContextValue = { ...next };
  for (const key of Object.keys(merged)) {
    if (!isSteadyContextKey(merged, key)) continue;
    const was = steady[key];
    const now = merged[key];
    if (was !== now && Array.isArray(was) && Array.isArray(now) && sameItems(was, now)) {
      copySteadyKey(merged, steady, key);
    }
    if (merged[key] !== was) changed = true;
  }
  if (Object.keys(steady).length !== Object.keys(merged).length) changed = true;
  const result = changed ? merged : steady;
  if (result !== steady) setSteady(result);
  return result;
}

export type StatisticsCounts = {
  /** The executive desk: Statistics shows counts only, so a list of people is not shown. */
  countsOnly: boolean;
  /** One count of people. Under the line it reads "fewer than 5". */
  small: (count: number) => number | string;
  /** The parts of a breakdown whose total is shown, hidden together (`smallNumberParts`). */
  parts: (counts: readonly number[]) => (number | string)[];
};

/**
 * Executive figures (role access plan, Josh's yes 15 Oct 2026): a count of people under the small
 * number line reads "fewer than 5" on every Statistics figure, table and chart, so a small group
 * cannot be picked out, and lists of people are not shown (plan, medium finding 6). Beds and their
 * states (in use, pulled, ready) stay exact, because the bed count and occupancy beside them would
 * give a hidden one away (review on PR #345). Every other desk sees exact counts and the lists.
 */
export function useStatisticsCounts(): StatisticsCounts {
  const on = useWardFeatureFlag("role-access");
  const access = useEffectiveWardAccess();
  const hide = on && access.role === "executive";
  return useMemo(
    () => ({
      countsOnly: hide,
      // A worded count is a string and an exact one stays a number, so a caller can tell them apart.
      small: (count: number) => {
        if (!hide) return count;
        const text = smallNumberText(count);
        return text === String(count) ? count : text;
      },
      parts: (counts: readonly number[]) => (hide ? smallNumberParts(counts) : [...counts]),
    }),
    [hide],
  );
}

/** The single count form of `useStatisticsCounts`, for the headline figures. */
export function useSmallNumber(): (count: number) => number | string {
  return useStatisticsCounts().small;
}

/**
 * Re-provides the app context, scoped. A statewide coordinator gets the original value back, so the
 * flag costs nothing on the coordinator's own view.
 */
export function WardAccessScope({ children }: { children: ReactNode }) {
  const context = useWardFlow();
  const access = useEffectiveWardAccess();
  const { records, previewOf } = useWardAccessSnapshot();
  const previewing = previewOf !== null;
  const now = context.now;
  // Cover ends by itself at its time, on the demo clock (feature 2).
  useEffect(() => endDueCovers(now), [now]);
  const activeGrants = useMemo(
    () => records.filter((record) => record.role === access.role && record.until > now),
    [records, access.role, now],
  );

  const value = useMemo<{ scoped: WardFlowContextValue; glass: ReadonlySet<string> }>(() => {
    if (accessIsWholeNetwork(access) && activeGrants.length === 0) return { scoped: context, glass: new Set() };
    const places = wardPlaceLookup(context.units);
    const scoped = scopeWorkspace(context, access, { now, places, grants: activeGrants });
    const coordinator = access.role === "coordinator";
    const wholeNetwork = accessIsWholeNetwork(access);
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
    // the reducer, and said aloud. Movement, stay and referral ids are traced to their person, so a
    // write keyed only by one of those is caught too (review on PR #330).
    const glassIds = (items: readonly { id: string; patientId?: string | null }[]) =>
      new Set<string>(
        items.filter((item) => item.patientId && breakGlassPatientIds.has(item.patientId)).map((item) => item.id),
      );
    const glassMovementIds = glassIds(scoped.movements);
    const glassAdmissionIds = glassIds(scoped.admissions);
    const glassReferralIds = glassIds(scoped.referrals);
    // An inbox row id is its category and then the movement or stay it is about, so an inbox
    // action on a read only person is caught too (review on PR #330).
    const inboxNamesGlass = (value: unknown) =>
      typeof value === "string" &&
      Object.values(INBOX_CATEGORIES).some(({ idPrefix }) => {
        if (!value.startsWith(idPrefix)) return false;
        const rest = value.slice(idPrefix.length);
        return glassMovementIds.has(rest) || glassAdmissionIds.has(rest);
      });
    // A coordinator's preview is read only: nothing it does lands in the shared workspace (review on
    // PR #330), so a previewed ward never appears to have acted.
    const dispatch: WardFlowContextValue["dispatch"] = previewing
      ? () => announceToWardShell("Preview only. Nothing was changed.")
      : breakGlassPatientIds.size === 0
        ? context.dispatch
        : (event) => {
            const fields = event as {
              patientId?: unknown;
              movementId?: unknown;
              admissionId?: unknown;
              referralId?: unknown;
              inboxItemId?: unknown;
            };
            const names = (value: unknown, ids: ReadonlySet<string>) => typeof value === "string" && ids.has(value);
            const touchesGlass =
              names(fields.patientId, breakGlassPatientIds) ||
              names(fields.movementId, glassMovementIds) ||
              names(fields.admissionId, glassAdmissionIds) ||
              names(fields.referralId, glassReferralIds) ||
              inboxNamesGlass(fields.inboxItemId);
            if (touchesGlass) {
              announceToWardShell("Read only. This record was opened outside your care.");
              return;
            }
            context.dispatch(event);
          };
    // The record readers close over the whole workspace, so they are narrowed to the desk's own stays
    // too (review on PR #330). Audit and governance records stay the coordinator's.
    const admissionIds = new Set(scoped.admissions.map((admission) => admission.id));
    const denied = { status: "denied" } as const;
    // Audit, governance, refusals and the event log are the coordinator's. A service coordinator
    // keeps only the records about its own service's wards, journeys and referrals (Josh's yes,
    // 15 Oct 2026), so a whole network record or another service's never reaches it.
    const scope = coordinatorRecordScope(
      scoped,
      context.bedReleases,
      unitIn,
      (edId) => edInScope(access.scope, edId, places),
      context.leaveBeds,
    );
    const reviewInScope = (actor: WardRecordActor) => {
      // A review can be of a seeded governance entry, so the governance read is the fuller list.
      const read = context.readGovernanceAuditEvents?.(actor) ?? context.readAuditEvents(actor);
      const kept = new Set(read.status === "allowed" ? scope.auditEvents(read.value).map((event) => event.id) : []);
      return (review: AuditReview) => kept.has(review.eventId);
    };
    // A refusal names its subject: a journey, ward, stay, release, leave bed or ED, or for a
    // community treatment order a person this desk already sees. A refused record command names none, so it follows its own audit row and stays only when that row is in
    // scope, which lets the desk's screen hear its own refusal (reviews on PR #345).
    // The audit log is read only when a refusal is paired with a row, and through the governance read
    // so a refused undo of a review on a seeded entry is still heard.
    const rejectionInScope = (): ((rejection: Rejection) => boolean) => {
      const paired = context.rejections.some((rejection) => rejection.id.startsWith("record-rejection-"));
      const actor = { role: "coordinator" } as const;
      const read = paired ? (context.readGovernanceAuditEvents?.(actor) ?? context.readAuditEvents(actor)) : null;
      return scope.refusals(read?.status === "allowed" ? read.value : []);
    };
    const auditRead = <T,>(
      read: RecordRead<readonly T[]>,
      keep: (items: readonly T[]) => T[],
    ): RecordRead<readonly T[]> => {
      if (!coordinator) return denied;
      if (wholeNetwork || read.status !== "allowed") return read;
      return { status: "allowed", value: keep(read.value) };
    };
    const outsideHandle = { generation: -1, requestId: -1 } as const;
    return {
      glass: breakGlassPatientIds,
      scoped: {
        ...rest,
        dispatch,
        readDischargeRecords: (actor, unitId) => {
          const read = context.readDischargeRecords(actor, unitId);
          return read.status === "allowed"
            ? { status: "allowed", value: read.value.filter((record) => admissionIds.has(record.admissionId)) }
            : read;
        },
        openDischargeRecord: (actor, admissionId) =>
          admissionIds.has(admissionId) ? context.openDischargeRecord(actor, admissionId) : outsideHandle,
        readDischargeRecord: (actor, admissionId, handle) =>
          admissionIds.has(admissionId) ? context.readDischargeRecord(actor, admissionId, handle) : denied,
        readAuditEvents: (actor) => auditRead(context.readAuditEvents(actor), scope.auditEvents),
        readAuditReviews: (actor) =>
          auditRead(context.readAuditReviews(actor), (reviews) => {
            if (wholeNetwork) return [...reviews];
            const keep = reviewInScope(actor);
            return reviews.filter(keep);
          }),
        readGovernanceAuditEvents: (actor) =>
          coordinator && context.readGovernanceAuditEvents
            ? auditRead(context.readGovernanceAuditEvents(actor), scope.auditEvents)
            : denied,
        rejections: wholeNetwork
          ? context.rejections
          : coordinator
            ? context.rejections.filter(rejectionInScope())
            : [],
        eventLog: wholeNetwork ? context.eventLog : coordinator ? (context.eventLog ?? []).filter(scope.logEntry) : [],
        bedReleases: byUnit(context.bedReleases),
        leaveBeds: byUnit(context.leaveBeds),
        refreshRequests: wholeNetwork ? context.refreshRequests : coordinator ? byUnit(context.refreshRequests) : [],
        // Bed calls name the wards they ask, so a desk sees only calls to its own wards. A directive
        // with no named wards is for everyone. Undo records hold whole before and after records, and
        // a saved scenario is the whole workspace, so both stay the statewide desk's. A service
        // coordinator's alerts are scoped like any other desk's (review on PR #330).
        broadcastAlerts: wholeNetwork
          ? context.broadcastAlerts
          : scopeBroadcastAlerts(context.broadcastAlerts, access, context.units, places),
        undoRecords: wholeNetwork ? context.undoRecords : [],
        saveScenarioFile: wholeNetwork ? context.saveScenarioFile : undefined,
        repatriations: coordinator ? context.repatriations : [],
        plannedAdmissions: coordinator ? context.plannedAdmissions : [],
        supportNotifications: supportNotificationsForDesk(context.supportNotifications, {
          coordinator,
          wholeNetwork,
          unitIn,
          role: access.role,
          movements: scoped.movements,
          wholeStay: (admissionId) => admissionIds.has(admissionId) && !scoped.datesOnlyAdmissionIds.has(admissionId),
        }),
        wardReferralInbox: (unitId: string) => (unitIn(unitId) ? context.wardReferralInbox(unitId) : []),
        resolvePatientIdentity: (subject) => resolveSubjectPatient(subject, resolveIndex),
      },
    };
  }, [context, access, activeGrants, now, previewing]);
  const steadyScoped = useSteadyLists(value.scoped);

  return (
    <UnscopedWardFlowContext.Provider value={context}>
      <WardFlowOverride value={steadyScoped}>
        <BreakGlassContext.Provider value={value.glass}>{children}</BreakGlassContext.Provider>
      </WardFlowOverride>
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
  const scoped = useWardFlowSelect("movements", "patients");
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
  // Focus the heading once on arrival, never again on a re-render (review on PR #330), so a reason
  // being chosen or typed below keeps its place.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const { units } = useUnscopedWardFlow();
  const { previewOf } = useWardAccessSnapshot();
  const home = homeHrefFor(access, communityTeamSlug);
  return (
    <WardGround>
      <main className={styles.closed} data-testid="ward-access-closed">
        <h1 tabIndex={-1} ref={headingRef}>
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
        {/* A preview is read only, so it never offers break glass (review on PR #330). */}
        {patientId && canBreakGlass(access.role) && previewOf === null ? (
          <BreakGlassForm access={access} patientId={patientId} />
        ) : null}
        {switching ? <OperatorSwitcherModal isOpen onClose={() => setSwitching(false)} /> : null}
      </main>
    </WardGround>
  );
}

/** Break glass: warn, ask why, then open one record read only for a set time (plan section 7). */
function BreakGlassForm({ access, patientId }: { access: WardAccess; patientId: string }) {
  const { now, units } = useUnscopedWardFlow();
  const [reason, setReason] = useState<BreakGlassReasonId | null>(null);
  const [other, setOther] = useState("");
  const minutes = CLINICAL_VALUES.breakGlassWindow.value;
  const ready = reason !== null && (reason !== "other" || other.trim().length > 0);
  // Opening a record outside your care needs a recent sign-in (feature 9).
  const { guard, dialog } = useStepUp();
  const shared = useContext(SharedAccessContext);
  return (
    <section className={styles.glass} aria-labelledby="ward-break-glass-title">
      <h2 id="ward-break-glass-title">Open this record anyway</h2>
      <p>
        Only if you need it for this person&apos;s care. It opens read only for {minutes} minutes and is listed for the
        coordinator to review in Governance.
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
          void guard(async () => {
            // In the shared workspace the server opens the record, asks for a fresh sign-in and
            // keeps the review record (the reason from the list only, never the typed words).
            if (shared) {
              const refusal = await shared.api.breakGlass(patientId, reason);
              if (refusal !== null) return refusal;
            }
            return breakGlass({
              patientId,
              now,
              windowMinutes: minutes,
              reason,
              otherText: other,
              placeLabel: accessPlaceLabel(access, units),
            }) || shared
              ? null
              : "Not opened.";
          })
        }
      >
        Open read only
      </Button>
      {dialog}
    </section>
  );
}

/** Says a record is open only through break glass, on the patient page. */
function WardBreakGlassNote({ patientId }: { patientId: string }) {
  const glass = useBreakGlassPatientIds();
  if (!glass.has(patientId)) return null;
  return (
    <p className={styles.readOnly} role="status" data-testid="ward-break-glass-note">
      Opened outside your care, read only. It is listed for the coordinator to review.
    </p>
  );
}

/** The coordinator's review list of break glass openings this session (plan section 7). */
export function WardBreakGlassReview() {
  const on = useWardFeatureFlag("role-access");
  const access = useEffectiveWardAccess();
  const { records } = useWardAccessSnapshot();
  const { now } = useUnscopedWardFlow();
  if (!on || access.role !== "coordinator") return null;
  const perShift = CLINICAL_VALUES.breakGlassPerShift.value;
  // One desk is its role at its place, and the pattern counts this shift only (review on PR #330).
  const deskKey = (record: BreakGlassRecord) => `${record.role}|${record.placeLabel}`;
  const shiftStart = currentShiftStartInstant(now);
  const counts = new Map<string, number>();
  for (const record of records)
    if (record.openedAt >= shiftStart) counts.set(deskKey(record), (counts.get(deskKey(record)) ?? 0) + 1);
  return (
    <section aria-labelledby="ward-break-glass-review" data-testid="ward-break-glass-review">
      <h2 id="ward-break-glass-review">Records opened outside care</h2>
      {records.length === 0 ? (
        <p>None this session.</p>
      ) : (
        <ul className={styles.list}>
          {records.map((record: BreakGlassRecord) => {
            const reason = BREAK_GLASS_REASONS.find((option) => option.id === record.reason)?.label ?? "Other";
            const pattern = record.openedAt >= shiftStart && (counts.get(deskKey(record)) ?? 0) > perShift;
            return (
              <li key={record.id}>
                {formatInstantWithDay(record.openedAt, now)}, {record.roleLabel}, {record.placeLabel}. {reason}
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

/**
 * Shared computer lock (feature 10): after the set time with no use, the screen is covered and every
 * break glass grant ends at once. The desk keeps its own access, so unlocking never widens it.
 */
export function WardIdleLock() {
  const on = useWardFeatureFlag("role-access");
  const access = useEffectiveWardAccess();
  const [locked, setLocked] = useState(false);
  const lockRef = useRef<HTMLDivElement | null>(null);
  const minutes = CLINICAL_VALUES.idleLock.value;
  // Escape must not unlock: only the visible button does, so the cover stays until someone acts on it.
  useModalFocus({
    open: locked,
    onClose: () => undefined,
    panelRef: lockRef,
    closeOnEscape: false,
    focusOnOpen: "immediate",
    keyPhase: "capture",
  });
  useEffect(() => {
    // Every desk locks, the statewide coordinator's too: its view is the widest (review on PR #330).
    if (!on) return;
    const lock = () => {
      lockWardDesk();
      forgetStepUp();
      setLocked(true);
    };
    let timer = window.setTimeout(lock, minutes * 60_000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, minutes * 60_000);
    };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, reset, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, reset);
    };
  }, [on, access, minutes]);
  if (!locked) return null;
  return (
    <div ref={lockRef} className={styles.lock} role="dialog" aria-modal="true" aria-labelledby="ward-idle-lock-title">
      <div className={styles.lockCard}>
        <h1 id="ward-idle-lock-title">Locked after {minutes} minutes</h1>
        <p>
          The screen was covered so the next person cannot see this desk&apos;s patients, and any record opened outside
          your care is closed again.
        </p>
        <Button variant="pri" data-testid="ward-idle-unlock" onClick={() => setLocked(false)}>
          Carry on
        </Button>
      </div>
    </div>
  );
}

/** Reused inside isolated paper stacks as well as ordinary page print footers. */
export function WardPrintAttribution({ at, className }: { at?: Instant; className?: string }) {
  const access = useEffectiveWardAccess();
  const { units, now } = useUnscopedWardFlow();
  return (
    <span className={className} data-testid="ward-print-attribution">
      Printed by {ACCESS_ROLE_LABELS[access.role]}, {accessPlaceLabel(access, units)}, at{" "}
      {formatInstantWithDay(at ?? now, now)}. Synthetic data.
    </span>
  );
}

/** Every print names who printed it, from where, and when (feature 11). */
export function WardPrintFooter() {
  return (
    <p className={styles.printFooter} data-testid="ward-print-footer">
      <WardPrintAttribution />
    </p>
  );
}
