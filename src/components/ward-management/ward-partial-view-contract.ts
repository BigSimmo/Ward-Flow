import { REFERRAL_INFORMATION_NEED_IDS, type ReferralInformationNeed } from "./referrals/referral-information-needs";

/** Display data only. This is a sibling of domain state, never a record property, command,
 * permission or saved-world input. Callers must bind it to the payload's access lifetime and
 * revision before displaying it. Structural validation does not authenticate its claims. */
export type RestrictedPartialView = {
  readonly id: string;
  readonly kind: "restricted";
  readonly restriction: "receiving" | "grant";
};

export type SenderReferralPartialView = {
  readonly id: string;
  readonly kind: "sender";
  readonly state: "queued" | "accepted" | "declined";
  readonly withdrawn: boolean;
  readonly decidedAt: number | null;
  /** Sender-summary lifetime only, inclusive at this world-clock minute. Null means time alone
   * does not end it. This is not total record visibility: receiving fallback is independent.
   * It is never permission to send a command or a saved-state property. */
  readonly visibleUntil: number | null;
  /** Presentation hint only. Every submitted withdrawal is checked against the full source. */
  readonly canWithdraw: boolean;
  /** Distinct open categories, with no requesting ward, request count or recipient handle. */
  readonly informationNeeds: readonly ReferralInformationNeed[];
};

export type SenderMovementPartialView = {
  readonly id: string;
  readonly kind: "sender";
  /** Inclusive sender-summary deadline only, not total record visibility or command permission. */
  readonly visibleUntil: number | null;
  readonly destinationStatus: "not_requested" | "awaiting_answer" | "none_found" | "withdrawn" | "accepted";
  /** Who may perform a step is not conveyed by this display category. */
  readonly nextStep: "refer" | "escalate" | "pull" | "wait" | "none";
  /** Destination progress only; never a contact, recipient or permission to perform the step. */
  readonly progress: SenderMovementPartialView["destinationStatus"] | "escalated";
};

export type WardPartialView = {
  readonly version: 1;
  readonly referrals: readonly (SenderReferralPartialView | RestrictedPartialView)[];
  readonly movements: readonly (SenderMovementPartialView | RestrictedPartialView)[];
};

/** Synthetic/local or coordinator-preview display data has no authenticated response lifetime. */
export type LocalWardPartialDisplay = {
  readonly source: "local" | "coordinator-preview";
  readonly view: WardPartialView | null;
};

const MAX_RECORDS = 10_000;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const id = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 200;
const oneOf = (value: unknown, options: readonly string[]) => typeof value === "string" && options.includes(value);

function denseArray(value: unknown, limit: number): value is unknown[] {
  if (!Array.isArray(value) || value.length > limit) return false;
  // every/map skip holes, including a one-slot array whose only slot is missing.
  for (let index = 0; index < value.length; index++) if (!Object.hasOwn(value, index)) return false;
  return true;
}

function restricted(value: Record<string, unknown>): boolean {
  return exactKeys(value, ["id", "kind", "restriction"]) && oneOf(value.restriction, ["receiving", "grant"]);
}

function referral(value: unknown): boolean {
  if (!record(value) || !id(value.id)) return false;
  if (value.kind === "restricted") return restricted(value);
  if (
    value.kind !== "sender" ||
    !exactKeys(value, [
      "id",
      "kind",
      "state",
      "withdrawn",
      "decidedAt",
      "visibleUntil",
      "canWithdraw",
      "informationNeeds",
    ]) ||
    !oneOf(value.state, ["queued", "accepted", "declined"]) ||
    typeof value.withdrawn !== "boolean" ||
    typeof value.canWithdraw !== "boolean" ||
    !(value.decidedAt === null || (typeof value.decidedAt === "number" && Number.isFinite(value.decidedAt))) ||
    !(value.visibleUntil === null || (typeof value.visibleUntil === "number" && Number.isFinite(value.visibleUntil))) ||
    !denseArray(value.informationNeeds, REFERRAL_INFORMATION_NEED_IDS.length) ||
    !value.informationNeeds.every((need) => oneOf(need, REFERRAL_INFORMATION_NEED_IDS)) ||
    new Set(value.informationNeeds).size !== value.informationNeeds.length
  )
    return false;
  if (value.canWithdraw && (value.state !== "queued" || value.withdrawn)) return false;
  if (value.withdrawn && value.state === "accepted") return false;
  return value.informationNeeds.length === 0 || (value.state === "queued" && !value.withdrawn);
}

function movement(value: unknown): boolean {
  if (!record(value) || !id(value.id)) return false;
  if (value.kind === "restricted") return restricted(value);
  return (
    value.kind === "sender" &&
    exactKeys(value, ["id", "kind", "visibleUntil", "destinationStatus", "nextStep", "progress"]) &&
    (value.visibleUntil === null || (typeof value.visibleUntil === "number" && Number.isFinite(value.visibleUntil))) &&
    oneOf(value.destinationStatus, ["not_requested", "awaiting_answer", "none_found", "withdrawn", "accepted"]) &&
    oneOf(value.nextStep, ["refer", "escalate", "pull", "wait", "none"]) &&
    (value.progress === value.destinationStatus ||
      (value.progress === "escalated" && value.nextStep === "wait" && value.destinationStatus !== "accepted"))
  );
}

function uniqueRows(value: unknown, valid: (row: unknown) => boolean): boolean {
  return (
    denseArray(value, MAX_RECORDS) &&
    value.every(valid) &&
    new Set(value.map((row) => (row as { id: string }).id)).size === value.length
  );
}

/** Reject unknown fields as well as malformed fields: no hidden destination may hitch a ride.
 * A missing or invalid value means unavailable display data, never an empty authoritative record. */
export function isWardPartialView(value: unknown): value is WardPartialView {
  return (
    record(value) &&
    exactKeys(value, ["version", "referrals", "movements"]) &&
    value.version === 1 &&
    uniqueRows(value.referrals, referral) &&
    uniqueRows(value.movements, movement)
  );
}

/** A response sibling bound to one snapshot. Its shape is not proof of server authenticity. */
export type BoundWardPartialView = {
  readonly revision: number;
  readonly accessContext: string;
  readonly view: WardPartialView;
};

export type WardPartialViewLifetime = {
  readonly revision: number | null;
  readonly accessContext: string | null;
};

export function isBoundWardPartialView(value: unknown): value is BoundWardPartialView {
  return (
    record(value) &&
    exactKeys(value, ["revision", "accessContext", "view"]) &&
    Number.isSafeInteger(value.revision) &&
    (value.revision as number) > 0 &&
    typeof value.accessContext === "string" &&
    /^[a-f0-9]{64}$/.test(value.accessContext) &&
    isWardPartialView(value.view)
  );
}

/** Missing, malformed or stale response data is unavailable, not an empty domain record.
 * The caller supplies the lifetime from the actual current snapshot, never from this sibling.
 * Copy/freeze after validation so response mutation cannot alter an adopted display value. */
export function bindWardPartialView(value: unknown, current: WardPartialViewLifetime): BoundWardPartialView | null {
  if (
    !isBoundWardPartialView(value) ||
    value.revision !== current.revision ||
    value.accessContext !== current.accessContext
  )
    return null;
  return Object.freeze({
    revision: value.revision,
    accessContext: value.accessContext,
    view: freezeWardPartialView(value.view),
  });
}

function freezeWardPartialView(view: WardPartialView): WardPartialView {
  const referrals = view.referrals.map((row) =>
    Object.freeze(
      row.kind === "sender" ? { ...row, informationNeeds: Object.freeze([...row.informationNeeds]) } : { ...row },
    ),
  );
  const movements = view.movements.map((row) => Object.freeze({ ...row }));
  return Object.freeze({ version: 1, referrals: Object.freeze(referrals), movements: Object.freeze(movements) });
}

/** Separate local display validation; never manufactures a server revision or access hash. */
export function copyWardPartialView(value: unknown): WardPartialView | null {
  return isWardPartialView(value) ? freezeWardPartialView(value) : null;
}

/** Display-only time filtering of an already validated immutable view. Never restores a record
 * or invents a receiving entitlement. An unavailable clock cannot retain a finite sender hint. */
export function filterWardPartialViewAt(view: WardPartialView, now: unknown): WardPartialView {
  const at = typeof now === "number" && Number.isFinite(now) ? now : null;
  const keep = (row: WardPartialView["referrals"][number] | WardPartialView["movements"][number]) =>
    row.kind !== "sender" ||
    row.visibleUntil === null ||
    (at !== null && Number.isFinite(row.visibleUntil) && at <= row.visibleUntil);
  const keepReferrals = view.referrals.every(keep);
  const keepMovements = view.movements.every(keep);
  if (keepReferrals && keepMovements) return view;
  return Object.freeze({
    ...view,
    referrals: keepReferrals ? view.referrals : Object.freeze(view.referrals.filter(keep)),
    movements: keepMovements ? view.movements : Object.freeze(view.movements.filter(keep)),
  });
}
