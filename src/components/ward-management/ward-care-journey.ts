import { communityTeamById } from "./community/community-derivations";
import type { Admission } from "./ward-admissions";
import type { Instant } from "./ward-clock";

/** Closed, synthetic workflow facts. No narrative, patient identifiers or computed legal clocks. */
export const CARE_CONTACTS = [
  { id: "demo-adult-clinician", label: "Dr Alex Taylor — demonstration adult clinician" },
  { id: "demo-camhs-clinician", label: "Dr Sam Morgan — demonstration CAMHS clinician" },
] as const;
export const CARE_PLAN_ITEMS = [
  "crisis_plan",
  "medicines_reconciled",
  "patient_involved",
  "carer_involved",
  "housing",
  "cultural_support",
  "interpreter",
  "handover",
] as const;
export const CARE_DOCUMENTS = [
  "triage",
  "risk",
  "assessment",
  "physical",
  "appearance",
  "treatment_support_discharge",
  "transfer_summary",
] as const;
export const CARE_STATUSES = ["not_started", "in_progress", "completed", "not_applicable"] as const;
export const CONTACT_OUTCOMES = ["attempted", "completed", "unable_to_contact", "declined"] as const;
export const APPOINTMENT_MODES = ["clinic", "home", "telephone", "video"] as const;
export const TRANSPORT_MODES = ["private_vehicle", "taxi", "service_vehicle", "ambulance", "police", "rfds"] as const;
export const RECEIVING_CLASSES = [
  "acute_hospital",
  "psychiatric_hospital",
  "aged_care_new",
  "aged_care_usual",
  "other_health_care",
  "community_or_custody",
  "not_applicable",
] as const;
export const EPISODE_TYPES = ["mental_health", "general_care", "rehabilitation", "palliative_care"] as const;
export const SEPARATION_CODES = ["10", "21", "22", "30", "40", "50", "60", "70", "80", "90"] as const;
export type CareStatus = (typeof CARE_STATUSES)[number];
type Stamp = { recordedAt: Instant; recordedBy: string };
export type CareChange =
  | {
      kind: "follow_up";
      contactId: (typeof CARE_CONTACTS)[number]["id"];
      serviceId: string;
      appointmentAt: Instant;
      mode: (typeof APPOINTMENT_MODES)[number];
    }
  | { kind: "contact"; outcome: (typeof CONTACT_OUTCOMES)[number]; contactedAt: Instant }
  | { kind: "plan"; item: (typeof CARE_PLAN_ITEMS)[number]; status: CareStatus }
  | { kind: "document"; cohort: "adult" | "camhs"; document: (typeof CARE_DOCUMENTS)[number]; status: CareStatus }
  | {
      kind: "coding";
      receivingClass: (typeof RECEIVING_CLASSES)[number];
      separationCode: (typeof SEPARATION_CODES)[number];
      dischargedFromLeave: boolean;
    }
  | { kind: "episode"; episodeType: (typeof EPISODE_TYPES)[number] }
  | {
      kind: "transport";
      mode: (typeof TRANSPORT_MODES)[number];
      region: "metro" | "country";
      riskDocument: boolean;
      authority: "none" | "4A" | "7D";
      escortSuitable: boolean;
      leastRestrictiveReviewed: boolean;
      regionalServiceConfirmed: boolean;
    }
  | { kind: "transfer"; receivingUnitId: string; step: "accepted" | "handover" | "arrived" }
  | { kind: "legal"; authority: "revocation" | "5A" | "5B"; writtenAt: Instant; paperChecked: true };
export type CareJourney = {
  followUp?: Extract<CareChange, { kind: "follow_up" }> & Stamp & { appointmentVersion: number };
  contacts: (Extract<CareChange, { kind: "contact" }> & Stamp & { appointmentVersion: number })[];
  plan: Partial<Record<(typeof CARE_PLAN_ITEMS)[number], { status: CareStatus } & Stamp>>;
  documents: Partial<
    Record<(typeof CARE_DOCUMENTS)[number], { status: CareStatus; cohort: "adult" | "camhs" } & Stamp>
  >;
  coding?: Extract<CareChange, { kind: "coding" }> & Stamp;
  episodes: (Extract<CareChange, { kind: "episode" }> & Stamp)[];
  transport?: Extract<CareChange, { kind: "transport" }> & Stamp;
  transfer?: Extract<CareChange, { kind: "transfer" }> & Stamp;
  legal?: Extract<CareChange, { kind: "legal" }> & Stamp;
};
export const emptyCareJourney = (): CareJourney => ({ contacts: [], plan: {}, documents: {}, episodes: [] });
const member = (choices: readonly string[], value: unknown) => typeof value === "string" && choices.includes(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const exact = (value: object, keys: string[]) => Object.keys(value).sort().join() === keys.sort().join();
export function validCareChange(value: unknown): value is CareChange {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  switch (v.kind) {
    case "follow_up":
      return (
        exact(v, ["kind", "contactId", "serviceId", "appointmentAt", "mode"]) &&
        typeof v.serviceId === "string" &&
        !!communityTeamById(v.serviceId) &&
        member(
          CARE_CONTACTS.map((c) => c.id),
          v.contactId,
        ) &&
        finite(v.appointmentAt) &&
        member(APPOINTMENT_MODES, v.mode)
      );
    case "contact":
      return (
        exact(v, ["kind", "outcome", "contactedAt"]) && member(CONTACT_OUTCOMES, v.outcome) && finite(v.contactedAt)
      );
    case "plan":
      return exact(v, ["kind", "item", "status"]) && member(CARE_PLAN_ITEMS, v.item) && member(CARE_STATUSES, v.status);
    case "document":
      return (
        exact(v, ["kind", "cohort", "document", "status"]) &&
        member(["adult", "camhs"], v.cohort) &&
        member(CARE_DOCUMENTS, v.document) &&
        member(CARE_STATUSES, v.status) &&
        !(v.cohort === "camhs" && ["physical", "appearance"].includes(String(v.document)))
      );
    case "coding":
      return (
        exact(v, ["kind", "receivingClass", "separationCode", "dischargedFromLeave"]) &&
        typeof v.dischargedFromLeave === "boolean" &&
        member(RECEIVING_CLASSES, v.receivingClass) &&
        member(SEPARATION_CODES, v.separationCode)
      );
    case "episode":
      return exact(v, ["kind", "episodeType"]) && member(EPISODE_TYPES, v.episodeType);
    case "transport":
      return (
        exact(v, [
          "kind",
          "mode",
          "region",
          "riskDocument",
          "authority",
          "escortSuitable",
          "leastRestrictiveReviewed",
          "regionalServiceConfirmed",
        ]) &&
        member(TRANSPORT_MODES, v.mode) &&
        member(["metro", "country"], v.region) &&
        member(["none", "4A", "7D"], v.authority) &&
        ["riskDocument", "escortSuitable", "leastRestrictiveReviewed", "regionalServiceConfirmed"].every(
          (k) => typeof v[k] === "boolean",
        )
      );
    case "transfer":
      return (
        exact(v, ["kind", "receivingUnitId", "step"]) &&
        typeof v.receivingUnitId === "string" &&
        !!v.receivingUnitId &&
        member(["accepted", "handover", "arrived"], v.step)
      );
    case "legal":
      return (
        exact(v, ["kind", "authority", "writtenAt", "paperChecked"]) &&
        member(["revocation", "5A", "5B"], v.authority) &&
        finite(v.writtenAt) &&
        v.paperChecked === true
      );
    default:
      return false;
  }
}
/** Validate restored facts independently from their writer; reject added free-text properties. */
export function validCareJourney(value: unknown): value is CareJourney {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).some(
      (k) =>
        !["followUp", "contacts", "plan", "documents", "coding", "episodes", "transport", "transfer", "legal"].includes(
          k,
        ),
    )
  )
    return false;
  const fact = (f: unknown, kind: string) => {
    if (!f || typeof f !== "object") return false;
    const { recordedAt, recordedBy, ...stored } = f as Record<string, unknown>;
    const { appointmentVersion, ...versionedChange } = stored;
    const versioned = kind === "contact" || kind === "follow_up";
    const change = versioned ? versionedChange : stored;
    if (
      versioned &&
      !(typeof appointmentVersion === "number" && Number.isSafeInteger(appointmentVersion) && appointmentVersion > 0)
    )
      return false;
    return (
      finite(recordedAt) &&
      member(["Ward manager", "Flow coordinator", "Community service"], recordedBy) &&
      change.kind === kind &&
      validCareChange(change)
    );
  };
  const statusMap = (m: unknown, choices: readonly string[], document = false) => {
    if (!m || typeof m !== "object" || Array.isArray(m)) return false;
    return Object.entries(m).every(
      ([key, f]) =>
        choices.includes(key) &&
        f &&
        typeof f === "object" &&
        exact(
          f,
          document ? ["cohort", "status", "recordedAt", "recordedBy"] : ["status", "recordedAt", "recordedBy"],
        ) &&
        (() => {
          const { recordedAt, recordedBy, ...body } = f as Record<string, unknown>;
          return fact(
            {
              ...body,
              kind: document ? "document" : "plan",
              [document ? "document" : "item"]: key,
              recordedAt,
              recordedBy,
            },
            document ? "document" : "plan",
          );
        })(),
    );
  };
  const shapeValid =
    Array.isArray(v.contacts) &&
    v.contacts.every((f) => fact(f, "contact")) &&
    Array.isArray(v.episodes) &&
    v.episodes.every((f) => fact(f, "episode")) &&
    statusMap(v.plan, CARE_PLAN_ITEMS) &&
    statusMap(v.documents, CARE_DOCUMENTS, true) &&
    [
      ["followUp", "follow_up"],
      ["coding", "coding"],
      ["transport", "transport"],
      ["transfer", "transfer"],
      ["legal", "legal"],
    ].every(([key, kind]) => v[key] === undefined || fact(v[key], kind));
  if (!shapeValid) return false;
  const care = value as CareJourney;
  if (!care.followUp) return care.contacts.length === 0;
  return care.contacts.every(
    (contact) =>
      contact.appointmentVersion <= care.followUp!.appointmentVersion &&
      (contact.appointmentVersion !== care.followUp!.appointmentVersion ||
        contact.outcome !== "completed" ||
        contact.contactedAt >= care.followUp!.appointmentAt),
  );
}
export function codingCode(
  admission: Pick<Admission, "state" | "leavingDestination">,
  receivingClass: (typeof RECEIVING_CLASSES)[number],
  dischargedFromLeave = false,
): string | null {
  if (admission.state !== "departed") return null;
  if (dischargedFromLeave)
    return ["did-not-return", "discharged-to-the-community"].includes(admission.leavingDestination ?? "") &&
      (receivingClass === "community_or_custody" ||
        (admission.leavingDestination === "did-not-return" && receivingClass === "not_applicable"))
      ? "70"
      : null;
  switch (admission.leavingDestination) {
    case "died-on-the-ward":
      return receivingClass === "not_applicable" ? "80" : null;
    case "left-against-advice":
      return "60";
    case "did-not-return":
      return receivingClass === "community_or_custody" || receivingClass === "not_applicable" ? "90" : null;
    case "discharged-to-the-community":
    case "transferred-to-custody":
      return receivingClass === "community_or_custody" ? "90" : null;
    case "moved-to-residential-aged-care":
      return receivingClass === "aged_care_new" ? "21" : null;
    case "returned-to-residential-aged-care":
      return receivingClass === "aged_care_usual" ? "22" : null;
    case "transferred-to-another-psychiatric-ward":
      return receivingClass === "acute_hospital" ? "10" : receivingClass === "psychiatric_hospital" ? "30" : null;
    case "transferred-to-a-general-hospital":
      return receivingClass === "acute_hospital" ? "10" : null;
    case "transferred-to-other-health-care":
      return receivingClass === "other_health_care" ? "40" : null;
    case "moved-to-residential-care":
      return receivingClass === "aged_care_new"
        ? "21"
        : receivingClass === "aged_care_usual"
          ? "22"
          : receivingClass === "other_health_care"
            ? "40"
            : null;
    default:
      return null;
  }
}
export function careChangeRefusal(admission: Admission, change: CareChange, now: Instant): string | null {
  const care = admission.careJourney ?? emptyCareJourney();
  if (change.kind === "coding")
    return change.separationCode === codingCode(admission, change.receivingClass, change.dischargedFromLeave)
      ? null
      : "Choose a separation code consistent with the recorded departure and receiving establishment class. Statistical changes use the episode control.";
  if (change.kind === "episode")
    return admission.state === "occupied" ? null : "A statistical episode change requires an occupied bed.";
  if (admission.leavingDestination === "died-on-the-ward")
    return "Care actions are unavailable after a recorded death.";
  if (["transport", "transfer"].includes(change.kind) && admission.state !== "occupied")
    return "Transport and transfer changes require the current occupied stay.";
  if (
    change.kind === "contact" &&
    (change.contactedAt > now || (admission.arrivedAt !== null && change.contactedAt < admission.arrivedAt))
  )
    return "The contact time must belong to this stay or its follow-up and cannot be in the future.";
  if (change.kind === "contact")
    return !care.followUp || admission.followUp?.state !== "arranged"
      ? "Record responsibility and an appointment first. The current arrangement must be marked arranged."
      : change.contactedAt > now || (change.outcome === "completed" && change.contactedAt < care.followUp.appointmentAt)
        ? "An appointment cannot be completed before its recorded time."
        : null;
  if (change.kind === "follow_up" && (care.followUp?.appointmentVersion ?? 0) >= Number.MAX_SAFE_INTEGER)
    return "Appointment version is unavailable.";
  if (change.kind === "follow_up")
    return admission.arrivedAt !== null && change.appointmentAt < admission.arrivedAt
      ? "The appointment must belong to the current stay or its follow-up."
      : null;
  if (change.kind === "transport") {
    if (!change.leastRestrictiveReviewed || !change.escortSuitable || !change.regionalServiceConfirmed)
      return "Confirm the least restrictive option, escort suitability and the regional service arrangement.";
    if (["ambulance", "police", "rfds", "service_vehicle"].includes(change.mode) && !change.riskDocument)
      return "Record the transport risk document before confirming this arrangement.";
    if (change.mode === "police" && change.authority === "none")
      return "Record the checked transport authority for a police arrangement.";
  }
  if (change.kind === "transfer") {
    if (change.receivingUnitId === admission.unitId) return "Choose a different receiving ward.";
    const previous = care.transfer;
    if (change.step === "accepted") return previous ? "A transfer acceptance is already recorded." : null;
    if (
      !previous ||
      previous.receivingUnitId !== change.receivingUnitId ||
      previous.step !== (change.step === "handover" ? "accepted" : "handover")
    )
      return "Record acceptance, handover and arrival in order for the same receiving ward.";
  }
  if (change.kind === "legal") {
    if (admission.state !== "occupied" || change.writtenAt > now)
      return "Record paper authority for the current occupied admission with a written time no later than now.";
    if (change.authority !== "revocation" && !care.followUp)
      return "Record the community clinician and appointment before a community treatment order transition.";
  }
  return null;
}
export function applyCareChange(
  care: CareJourney,
  change: CareChange,
  recordedAt: Instant,
  recordedBy: string,
): CareJourney {
  const stamped = { ...change, recordedAt, recordedBy };
  switch (change.kind) {
    case "follow_up":
      return {
        ...care,
        followUp: {
          ...change,
          recordedAt,
          recordedBy,
          appointmentVersion: (care.followUp?.appointmentVersion ?? 0) + 1,
        },
      };
    case "contact":
      return care.followUp
        ? {
            ...care,
            contacts: [
              ...care.contacts,
              { ...change, recordedAt, recordedBy, appointmentVersion: care.followUp.appointmentVersion },
            ],
          }
        : care;
    case "plan":
      return { ...care, plan: { ...care.plan, [change.item]: { status: change.status, recordedAt, recordedBy } } };
    case "document":
      return {
        ...care,
        documents: {
          ...care.documents,
          [change.document]: { status: change.status, cohort: change.cohort, recordedAt, recordedBy },
        },
      };
    case "coding":
      return { ...care, coding: stamped as CareJourney["coding"] };
    case "episode":
      return { ...care, episodes: [...care.episodes, stamped as CareJourney["episodes"][number]] };
    case "transport":
      return { ...care, transport: stamped as CareJourney["transport"] };
    case "transfer":
      return { ...care, transfer: stamped as CareJourney["transfer"] };
    case "legal":
      return { ...care, legal: stamped as CareJourney["legal"] };
  }
}
/** A review handoff only. It never claims PAS/HMDC submission or external acceptance. */
export function separationHandoff(
  admission: Pick<Admission, "id" | "leftAt" | "state" | "leavingDestination" | "careJourney">,
) {
  const coding = admission.careJourney?.coding;
  if (!coding || coding.separationCode !== codingCode(admission, coding.receivingClass, coding.dischargedFromLeave))
    return null;
  return {
    schemaVersion: 1,
    kind: "separation-review",
    admissionId: admission.id,
    separationCode: coding.separationCode,
    receivingClass: coding.receivingClass,
    dischargedFromLeave: coding.dischargedFromLeave,
    leftAt: admission.leftAt,
    externalSubmission: "not_connected",
    requires: ["verified_receiving_establishment_code", "authorised_PAS_adapter"],
  } as const;
}

/** Completion applies to the current appointment, never an earlier arrangement. */
export function currentCareContact(care: CareJourney | undefined) {
  if (!care?.followUp) return undefined;
  return care.contacts.findLast((c) => c.appointmentVersion === care.followUp!.appointmentVersion);
}
export function currentCareContactCompleted(care: CareJourney | undefined): boolean {
  return (
    !!care?.followUp &&
    care.contacts.some((c) => c.outcome === "completed" && c.appointmentVersion === care.followUp!.appointmentVersion)
  );
}

/** A declared current paper transition; no legal expiry or statutory authority is inferred. */
export function recordedCommunityTransition(
  admission: Admission,
  lastStatusChangeAt: number | undefined,
  destination: Admission["leavingDestination"],
): boolean {
  const legal = admission.careJourney?.legal;
  if (!legal || (lastStatusChangeAt !== undefined && lastStatusChangeAt > legal.writtenAt)) return false;
  if (legal.authority === "revocation") return true;
  return (
    destination === "discharged-to-the-community" &&
    admission.followUp?.state === "arranged" &&
    !!admission.careJourney?.followUp
  );
}
