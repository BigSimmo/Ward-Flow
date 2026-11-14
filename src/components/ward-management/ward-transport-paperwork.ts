/**
 * ONE TRANSPORT PAPERWORK RULE (D-186 item 6, D-187 item 7, D-189 items 8(b) and 9(d); Q6 and Q28
 * of the clinical sign-off sitting, 13 Nov 2026).
 *
 * One rule reads the person's legal status (Legal now, then the booking), their form and both
 * sites, and says whether a transport or transfer order is needed and whether one is on file. The
 * collection check, the forms pack's order slot and the ED booking notice all read it, so there is
 * one order matcher in the app.
 *
 * ⚠️ NOT SIGNED. `TRANSPORT_PAPERWORK` is held as a setting, and its content is today's behaviour
 * until Josh signs the Q28 forms table (D-189 item 8(b)). Every screen that shows the check says
 * "not signed". Its starting content:
 * - a person who is not voluntary, or with no status recorded anywhere, needs an order
 *   (Josh, 9 Oct 2026: a voluntary transfer needs no forms; an unrecorded status still needs them);
 * - a voluntary person needs none;
 * - a same-site move is treated the same as a move between sites (D-187 item 7 leaves it open);
 * - a Form 4A or a Form 4C clears the check, whether it is the recorded form or an uploaded form
 *   (D-187 item 7, D-189 item 9(d)). Form 4B and the forms-pack slot stay open (D-187 item 7).
 *
 * Synthetic prototype. Not legal advice and not validated clinical decision support.
 */
import { isNotVoluntary } from "@/components/ward-management/ward-legal-meaning";
import { currentLegalPosition } from "@/components/ward-management/ward-legal-form-progression";
import type { Movement, MovementUploadedForm, TransportLegalStatus } from "@/components/ward-management/ward-model";

/** Whether a job needs the transport paperwork, read from Legal now first, then the booking. */
export type PackRequirement = "required" | "not_required" | "unknown";

/** How the two ends of a move relate. "not_known" when either site is not recorded. */
type TransportSites = "same_site" | "different_site" | "not_known";

export type TransportPaperworkRow = {
  requirement: PackRequirement;
  sites: TransportSites;
  orderNeeded: boolean;
};

const REQUIREMENTS: readonly PackRequirement[] = ["required", "unknown", "not_required"];
const SITES: readonly TransportSites[] = ["same_site", "different_site", "not_known"];

/**
 * The paperwork table. Not signed (D-189 item 8(b)): every row is today's behaviour, and the site
 * relation changes nothing yet. Josh signs the real table at a later sitting (Q28).
 */
export const TRANSPORT_PAPERWORK: {
  status: "not signed";
  /** The form codes that clear the order check (D-187 item 7). */
  acceptedOrderCodes: readonly string[];
  rows: readonly TransportPaperworkRow[];
} = {
  status: "not signed",
  acceptedOrderCodes: ["4A", "4C"],
  rows: REQUIREMENTS.flatMap((requirement) =>
    SITES.map((sites) => ({ requirement, sites, orderNeeded: requirement !== "not_required" })),
  ),
};

/** The words every screen adds to the check while the table is not signed. */
export const TRANSPORT_PAPERWORK_STATUS_WORDS = "rule not signed";

/** The one order matcher: an uploaded form named for one of the accepted codes. Group 1 is the code. */
export const TRANSPORT_ORDER_PATTERN = new RegExp(
  String.raw`\bForm\s*(${TRANSPORT_PAPERWORK.acceptedOrderCodes.join("|")})\b`,
  "i",
);

/**
 * The transport status the legal form in force gives (Legal now), by the named "not voluntary"
 * rule (D-186 item 4): a voluntary patient travels voluntarily; a person referred, detained or an
 * involuntary inpatient travels involuntarily. Undefined only when the record holds no status.
 */
export function legalNowTransportStatus(movement: Pick<Movement, "legalStatus">): TransportLegalStatus | undefined {
  if (movement.legalStatus === undefined) return undefined;
  return isNotVoluntary(movement.legalStatus) ? "involuntary" : "voluntary";
}

/**
 * Whether this job needs the transport forms pack, read from the legal form in force (Legal now)
 * and the booking. Josh, 9 Oct 2026: a voluntary transfer needs no forms; an unrecorded status
 * still needs the pack. Audit A4-12: Legal now decides first, so an unrecorded booking for a
 * voluntary patient no longer asks for the forms. "unknown" is a job with no status anywhere.
 */
export function packRequirement(movement: Pick<Movement, "legalStatus" | "transport">): PackRequirement {
  const inForce = legalNowTransportStatus(movement);
  const booked = movement.transport?.transportLegalStatus;
  if (inForce === "involuntary" || booked === "involuntary") return "required";
  if (inForce === "voluntary" || booked === "voluntary") return "not_required";
  return "unknown";
}

function transportSites(originSiteCode: string | undefined, destinationSiteCode: string | undefined) {
  if (originSiteCode === undefined || destinationSiteCode === undefined) return "not_known" as const;
  return originSiteCode === destinationSiteCode ? ("same_site" as const) : ("different_site" as const);
}

/**
 * Whether this move needs a transport or transfer order, from the table above: the person's legal
 * status (Legal now, then the booking) and both sites.
 */
export function transportOrderNeeded(
  movement: Pick<Movement, "legalStatus" | "transport">,
  originSiteCode: string | undefined,
  destinationSiteCode: string | undefined,
): boolean {
  const requirement = packRequirement(movement);
  const sites = transportSites(originSiteCode, destinationSiteCode);
  const row = TRANSPORT_PAPERWORK.rows.find((entry) => entry.requirement === requirement && entry.sites === sites);
  // A missing row asks for the order: the check warns rather than decides.
  return row?.orderNeeded ?? true;
}

/** The latest uploaded transport or transfer order, if any. */
function uploadedTransportOrder(movement: Pick<Movement, "uploadedForms">): MovementUploadedForm | undefined {
  const forms = movement.uploadedForms ?? [];
  for (let index = forms.length - 1; index >= 0; index -= 1) {
    if (TRANSPORT_ORDER_PATTERN.test(forms[index]!.formName)) return forms[index];
  }
  return undefined;
}

/** Whether an accepted order is on file: the recorded form, or an uploaded form (D-189 item 9(d)). */
export function transportOrderOnFile(movement: Pick<Movement, "legalForm" | "uploadedForms">): boolean {
  // Audit H4: a form a person recorded as ended is history, so it is not the order on file.
  const position = currentLegalPosition(movement);
  const recorded = position.ended ? undefined : position.form?.code;
  if (recorded !== undefined && TRANSPORT_PAPERWORK.acceptedOrderCodes.includes(recorded)) return true;
  return uploadedTransportOrder(movement) !== undefined;
}

/** Whether the order check is open: an order is needed and none is on file. */
export function transportOrderMissing(
  movement: Pick<Movement, "legalStatus" | "transport" | "legalForm" | "uploadedForms">,
  originSiteCode: string | undefined,
  destinationSiteCode: string | undefined,
): boolean {
  return transportOrderNeeded(movement, originSiteCode, destinationSiteCode) && !transportOrderOnFile(movement);
}
