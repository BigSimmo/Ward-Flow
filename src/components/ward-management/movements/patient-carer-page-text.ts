/*
 * Patient and carer page (Batch 5, item 40): the fixed words, kept in this one file so they can be
 * reviewed in one place.
 *
 * DRAFT WORDING. Every sentence here is awaiting consumer, carer and cultural review and must not be
 * used with real people before that review signs it off. The page footer says so on paper too.
 *
 * Rules kept (plan item 40): the page names the receiving ward only. It carries no diagnosis, no risk,
 * no legal form or status, no staff names, no UMRN and no patient name. `patientCarerPageModel`
 * takes the ward and its hospital only, so nothing about the person can reach the page.
 *
 * Ward Flow holds no ward address or visiting hours in its synthetic data, so both print as
 * "Not recorded" rather than an invented, real-looking address.
 */

import type { Site, Unit } from "../ward-model";

export const PATIENT_CARER_NOT_RECORDED = "Not recorded";

export const PATIENT_CARER_TEXT = {
  entryTitle: "Patient or carer page",
  entrySub: "One page about the receiving ward in plain words. No health or legal details.",
  button: "Print for patient or carer",
  dialogTitle: "Page for patient or carer",
  dialogDescription: "One page about the ward. It has no health or legal details. Ward Flow does not send it anywhere.",
  printAction: "Print or save PDF",
  eyebrow: "Information for you and the people who support you",
  titleLead: "You are going to",
  addressLabel: "Address",
  visitingLabel: "Visiting hours",
  arriveHeading: "What happens when you arrive",
  arriveSteps: [
    "Someone from the ward will meet you and tell you their name.",
    "They will show you around the ward and where you will sleep.",
    "They will explain how the ward works, including what you can bring.",
    "You can ask questions at any time. If something is not clear, ask again.",
    "You can ask for an interpreter.",
  ],
  supportHeading: "For family, carers and friends",
  supportSteps: [
    "Please phone the ward before you visit to check the visiting hours.",
    "You can ask the ward how you can stay in touch.",
  ],
  draftFooter: "Draft wording: awaiting consumer, carer and cultural review.",
  prototypeFooter: "Ward Flow prototype. Synthetic data, not for use with real patients.",
} as const;

export type PatientCarerPage = {
  wardName: string;
  hospitalName: string;
  address: string;
  visitingHours: string;
};

/**
 * The page's variable facts: the ward's name and its hospital, and nothing about the person. Address
 * and visiting hours are not in Ward Flow's data, so they read "Not recorded".
 */
export function patientCarerPageModel(
  unit: Pick<Unit, "name">,
  site: Pick<Site, "name"> | undefined,
): PatientCarerPage {
  return {
    wardName: unit.name,
    hospitalName: site?.name ?? PATIENT_CARER_NOT_RECORDED,
    address: PATIENT_CARER_NOT_RECORDED,
    visitingHours: PATIENT_CARER_NOT_RECORDED,
  };
}
