import type { ScopableWorkspace } from "./ward-access-scope";
import { retainSenderReadPatients } from "./ward-patient-resolver";
import type { BoundWardPartialView } from "./ward-partial-view-contract";
import { accessIsValid, type WardAccess } from "./ward-role-access";

type ReadRows = Pick<ScopableWorkspace, "referrals" | "patients">;
type ScopedReadRows = ReadRows & { readonly breakGlassPatientIds: ReadonlySet<string> };
type ReadSnapshot = {
  readonly revision: number;
  readonly accessContext?: string;
  readonly payload: { readonly state: ReadRows };
};

/** Supplied by the genuine shared host, not the role store or the status-only world context. */
export type SenderReadSource = { readonly access: WardAccess; readonly snapshot: ReadSnapshot };

/** UI collection only. The authoritative scope and command selectors never consume this
 * adapter or its metadata. It can reuse only rows in the actual already-adopted snapshot;
 * it cannot create a referral, patient, destination, grant or command entitlement. */
export function retainSharedSenderReadCollection({
  source,
  scoped,
  snapshot,
  bound,
  actualAccess,
  effectiveAccess,
  ready,
  now,
}: {
  source: ReadRows;
  scoped: ScopedReadRows;
  snapshot: ReadSnapshot | null | undefined;
  bound: BoundWardPartialView | null;
  actualAccess: WardAccess | null;
  effectiveAccess: WardAccess;
  ready: boolean;
  now: number;
}): ScopedReadRows {
  if (
    !ready ||
    !snapshot ||
    !bound ||
    !actualAccess ||
    !Number.isFinite(now) ||
    (actualAccess.role !== "ward" && actualAccess.role !== "bed_manager") ||
    actualAccess.role !== effectiveAccess.role ||
    !accessIsValid(actualAccess) ||
    !accessIsValid(effectiveAccess) ||
    // Same exact desk comparison used by the existing access store. A role-store transition
    // must not reuse a previous server projection while its effect is still catching up.
    JSON.stringify(actualAccess.scope) !== JSON.stringify(effectiveAccess.scope) ||
    bound.revision !== snapshot.revision ||
    bound.accessContext !== snapshot.accessContext ||
    source.referrals !== snapshot.payload.state.referrals ||
    source.patients !== snapshot.payload.state.patients
  )
    return scoped;

  const senderIds = new Set(
    bound.view.referrals
      .filter(
        (row) =>
          row.kind === "sender" &&
          (row.visibleUntil === null || (Number.isFinite(row.visibleUntil) && now <= row.visibleUntil)),
      )
      .map(({ id }) => id),
  );
  const ownRows = source.referrals.filter(({ id }) => senderIds.has(id));
  if (ownRows.length === 0) return scoped;

  // Preserve snapshot order. Use its safe sender copy rather than reconstructing its removed
  // arms or accidentally re-trimming a still-permitted primary acceptance on a second pass.
  const referralsById = new Map(scoped.referrals.map((row) => [row.id, row]));
  for (const row of ownRows) referralsById.set(row.id, row);
  const referrals = source.referrals.filter(({ id }) => referralsById.has(id)).map(({ id }) => referralsById.get(id)!);
  const patientCollection = retainSenderReadPatients(
    scoped.patients,
    source.patients,
    ownRows,
    scoped.breakGlassPatientIds,
  );
  const sameRows = (a: ReadRows["referrals"], b: ReadRows["referrals"]) =>
    a.length === b.length && a.every((row, index) => row === b[index]);
  return {
    referrals: sameRows(referrals, source.referrals)
      ? source.referrals
      : sameRows(referrals, scoped.referrals)
        ? scoped.referrals
        : referrals,
    ...patientCollection,
  };
}
