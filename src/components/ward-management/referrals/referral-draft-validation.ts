import {
  ATS_CATEGORIES,
  COHORTS,
  HEALTH_SERVICES,
  HOME_REGIONS,
  RECORDED_SEXES,
  REFERRAL_GENDERS,
} from "../ward-model";
import { NOT_ON_SENDING_WARD_REASONS } from "../ward-change-reasons";
import { COMMUNITY_REFERRAL_PURPOSES } from "../ward-model-referral-parts";
import {
  CLEARANCE_CHECKS,
  CLEARANCE_STATUSES,
  FIRST_CONTACT_TARGETS,
  SAVED_ED_ARRIVAL_MODES,
  REFERRAL_GENDER_NOT_RECORDED,
} from "./referral-submission";
import type { KeptDraft } from "./ward-referral-drawer-model";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const oneOf = (value: unknown, choices: readonly unknown[]) => choices.includes(value);
const strings = (record: Record<string, unknown>, keys: readonly string[]) =>
  keys.every((key) => typeof record[key] === "string");
const only = (record: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(record).every((key) => keys.includes(key));
const optional = (value: unknown, valid: (value: unknown) => boolean) => value === undefined || valid(value);
const boolean = (value: unknown) => typeof value === "boolean";
const string = (value: unknown) => typeof value === "string";
const textFields = [
  "activePatientKey",
  "selectedRecipient",
  "catchmentSuburb",
  "catchmentTeam",
  "originSiteCode",
  "sendingTeam",
  "arrivalEta",
  "legalStatus",
  "urgency",
  "security",
  "provisionalDiag",
  "doctorNote",
  "clinicalSummary",
  "transport",
  "transitNote",
];

/** Complete version-1 session projection. Never trust a JSON cast to the form's state shape. */
export function isRecoverableReferralDraft(value: unknown): value is KeptDraft {
  if (!isRecord(value) || !strings(value, textFields)) return false;
  if (
    !only(value, [
      ...textFields,
      "destType",
      "activeSection",
      "ageBand",
      "selectedUnitIds",
      "documentation",
      "contact",
      "catchmentService",
      "catchmentConfirmed",
      "homeRegion",
      "sourceKind",
      "referralSex",
      "referralGender",
      "highAcuity",
      "atsCategory",
      "riskFlags",
      "clearanceChecks",
      "communityNeeds",
      "edNeeds",
      "unidentified",
      "notOnWard",
      "needsChartReattachment",
      "communityPurpose",
    ])
  )
    return false;
  if (
    !oneOf(value.destType, ["ward", "ed", "community"]) ||
    !oneOf(value.activeSection, ["patient", "referral", "documentation", "placement"]) ||
    !oneOf(value.ageBand, ["", ...COHORTS]) ||
    !oneOf(value.catchmentService, ["", ...HEALTH_SERVICES]) ||
    !oneOf(value.homeRegion, ["", ...HOME_REGIONS]) ||
    !oneOf(value.sourceKind, ["ed", "community"]) ||
    !oneOf(value.referralSex, RECORDED_SEXES) ||
    !oneOf(value.referralGender, ["", REFERRAL_GENDER_NOT_RECORDED, ...REFERRAL_GENDERS]) ||
    !optional(value.atsCategory, (item) => oneOf(item, ATS_CATEGORIES)) ||
    !optional(value.communityPurpose, (item) => oneOf(item, COMMUNITY_REFERRAL_PURPOSES)) ||
    !optional(value.unidentified, (item) => item === null || string(item)) ||
    !optional(value.needsChartReattachment, boolean) ||
    !boolean(value.highAcuity) ||
    !boolean(value.catchmentConfirmed) ||
    !Array.isArray(value.selectedUnitIds) ||
    !value.selectedUnitIds.every(string)
  )
    return false;
  const { contact, documentation, riskFlags, clearanceChecks, communityNeeds, edNeeds, notOnWard } = value;
  const contactKeys = ["name", "email", "phone", "role", "location"];
  if (!isRecord(contact) || !only(contact, contactKeys) || !strings(contact, contactKeys)) return false;
  if (
    !isRecord(documentation) ||
    !only(documentation, [
      "medical",
      "expectedAt",
      "contactName",
      "contactPhone",
      "triage",
      "additional",
      "charts",
      "toFollow",
    ]) ||
    !strings(documentation, ["expectedAt", "contactName", "contactPhone"]) ||
    ![documentation.medical, documentation.triage, documentation.additional].every((item) =>
      oneOf(item, ["", "yes", "no"]),
    ) ||
    !Array.isArray(documentation.charts) ||
    documentation.charts.length !== 0 ||
    (documentation.toFollow !== undefined &&
      (!Array.isArray(documentation.toFollow) ||
        !documentation.toFollow.every((kind) => oneOf(kind, ["medication", "observation"]))))
  )
    return false;
  if (
    !isRecord(riskFlags) ||
    !Object.values(riskFlags).every(boolean) ||
    !isRecord(clearanceChecks) ||
    !Object.entries(clearanceChecks).every(
      ([key, item]) => oneOf(key, CLEARANCE_CHECKS) && oneOf(item, CLEARANCE_STATUSES),
    )
  )
    return false;
  if (
    !isRecord(communityNeeds) ||
    !only(communityNeeds, ["firstContact", "homeVisit", "interpreter", "carerContact"]) ||
    !optional(communityNeeds.firstContact, (item) => oneOf(item, FIRST_CONTACT_TARGETS)) ||
    ![communityNeeds.homeVisit, communityNeeds.interpreter, communityNeeds.carerContact].every((item) =>
      optional(item, boolean),
    )
  )
    return false;
  if (
    !isRecord(edNeeds) ||
    !only(edNeeds, ["comingBy", "medicalReviewFirst", "expectedArrival"]) ||
    !optional(edNeeds.comingBy, (item) => oneOf(item, SAVED_ED_ARRIVAL_MODES)) ||
    !optional(edNeeds.medicalReviewFirst, boolean) ||
    !optional(edNeeds.expectedArrival, string)
  )
    return false;
  return optional(
    notOnWard,
    (item) =>
      isRecord(item) &&
      only(item, ["unitId", "reason"]) &&
      string(item.unitId) &&
      oneOf(item.reason, NOT_ON_SENDING_WARD_REASONS),
  );
}
