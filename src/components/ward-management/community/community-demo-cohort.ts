/**
 * Demonstration cohort for Western Australia Community Mental Health Teams (CMHT)
 * 1:1 parity with perfected V2 Sovereign prototype (community-team-perfected-v2.html).
 * Provides rich clinical data for live browser demonstration when no explicit admissions/referrals props are passed.
 */

import { siteByCode } from "@/components/ward-management/ward-sites";
import { formTitleForCode } from "@/lib/form-register";
import { splitDuration } from "@/components/ward-management/ward-clock";

function makeWaitLabel(minutes: number, isAlert = false): string {
  const dur = splitDuration(minutes);
  return isAlert ? `Wait: ${dur} (alert)` : `Wait: ${dur}`;
}

export interface DemoReferral {
  id: string;
  priorityLabel: string;
  urgency: 1 | 2 | 3;
  isBreach: boolean;
  waitLabel: string;
  patientId: string;
  patientDetails: string;
  legalStatus: string;
  legalStatusTone: "danger" | "warn" | "good" | "neutral";
  origin: string;
  clinicalSummary: string;
  primaryActionLabel: string;
  secActionLabel: string;
  declineActionLabel: string;
  team?: string;
}

export interface DemoInpatient {
  id: string;
  patientId: string;
  patientDetails: string;
  category: "secure" | "open" | "older";
  wardName: string;
  healthService: string;
  bedId: string;
  daysInBed: string;
  legalStatus: string;
  legalStatusTone: "danger" | "warn" | "good" | "neutral";
  keyClinician: string;
  mdtStatus: string;
}

export interface DemoEgress {
  id: string;
  patientId: string;
  patientDetails: string;
  dischargingUnit: string;
  dischargeDatePlan: string;
  destination: string;
  status: "overdue" | "today" | "upcoming";
  kpiStatusLabel: string;
  kpiTone: "danger" | "warn" | "neutral" | "good";
  assignedCoordinator: string;
  actionLabel: string;
  isPrimaryAction: boolean;
}

export interface DemoCaseloadRow {
  id: string;
  umrn: string;
  patientId: string;
  ageSex: string;
  statutoryStatus: string;
  statutoryTone: "danger" | "warn" | "good" | "neutral";
  tier: string;
  category: "cto" | "high" | "depot" | "all";
  keyClinician: string;
  lastContact: string;
  nextReview: string;
}

export interface DemoStaff {
  name: string;
  role: string;
  status: string;
  statusTone: "good" | "warn" | "neutral";
  caseload: number;
  ext: string;
  assignment: string;
}

export const DEMO_COMMUNITY_REFERRALS: DemoReferral[] = [
  {
    id: "RF-8812",
    priorityLabel: "Priority 1 immediate",
    urgency: 1,
    isBreach: true,
    waitLabel: makeWaitLabel(252, true),
    patientId: "PT-4409",
    patientDetails: "Male 34y",
    legalStatus: "Form 1A MHA",
    legalStatusTone: "danger",
    origin: `${siteByCode("FSH")?.name ?? "Hospital not recorded"} ED resus`,
    clinicalSummary: `Origin: ${siteByCode("FSH")?.name ?? "Hospital not recorded"} ED resus. Acute behavioural disturbance secondary to acute psychosis. Non-voluntary admission required, triage review for urgent secure bed or assertive outreach step-down.`,
    primaryActionLabel: "Accept & allocate",
    secActionLabel: "Liaison review",
    declineActionLabel: "Decline / redirect",
    team: "fremantle",
  },
  {
    id: "RF-8819",
    priorityLabel: "Priority 1 immediate",
    urgency: 1,
    isBreach: true,
    waitLabel: makeWaitLabel(345, true),
    patientId: "PT-4512",
    patientDetails: "Female 28y",
    legalStatus: "Voluntary",
    legalStatusTone: "warn",
    origin: "GP urgent referral",
    clinicalSummary:
      "Origin: GP urgent referral. Postpartum depression with acute suicidal ideation and auditory hallucinations. Infant safely in care of maternal grandmother, requires urgent consultant evaluation today.",
    primaryActionLabel: "Accept & allocate",
    secActionLabel: "Urgent home visit",
    declineActionLabel: "Decline / redirect",
    team: "fremantle",
  },
  {
    id: "RF-8824",
    priorityLabel: "Priority 2 urgent",
    urgency: 2,
    isBreach: false,
    waitLabel: makeWaitLabel(90),
    patientId: "PT-4620",
    patientDetails: "Male 45y",
    legalStatus: "Form 1A MHA",
    legalStatusTone: "danger",
    origin: "MHERT / WA Police co-response",
    clinicalSummary:
      "Origin: MHERT / WA Police co-response. Severe paranoid persecutory delusions, barricaded in residence, medication non-adherence x3 months. Community mental health crisis team dispatched for joint assessment.",
    primaryActionLabel: "Accept & allocate",
    secActionLabel: "Dispatch crisis team",
    declineActionLabel: "Decline",
    team: "fremantle",
  },
  {
    id: "RF-8827",
    priorityLabel: "Priority 2 urgent",
    urgency: 2,
    isBreach: false,
    waitLabel: makeWaitLabel(495),
    patientId: "PT-4731",
    patientDetails: "Female 52y",
    legalStatus: "Voluntary",
    legalStatusTone: "warn",
    origin: "SCGH ED psychiatric liaison",
    clinicalSummary:
      "Origin: SCGH ED psychiatric liaison. Major depressive episode following domestic separation. ED medical toxicology clearance completed, referred for acute community outreach and intake case management.",
    primaryActionLabel: "Accept & allocate",
    secActionLabel: "Intake assessment",
    declineActionLabel: "Decline",
    team: "fremantle",
  },
  {
    id: "RF-8831",
    priorityLabel: "Priority 3 routine",
    urgency: 3,
    isBreach: false,
    waitLabel: makeWaitLabel(720),
    patientId: "PT-4805",
    patientDetails: "Male 19y",
    legalStatus: "Voluntary",
    legalStatusTone: "warn",
    origin: "Youth Early Psychosis (EMyU) step-down",
    clinicalSummary:
      "Origin: Youth Early Psychosis (EMyU) step-down. Transition of care from adolescent service to adult CMHT. Established on oral antipsychotic therapy with stable mental state. Handover meeting scheduled.",
    primaryActionLabel: "Accept & allocate",
    secActionLabel: "Assign key clinician",
    declineActionLabel: "Decline",
    team: "fremantle",
  },
  {
    id: "RF-8835",
    priorityLabel: "Priority 2 urgent",
    urgency: 2,
    isBreach: false,
    waitLabel: makeWaitLabel(860),
    patientId: "PT-4918",
    patientDetails: "Female 63y",
    legalStatus: "Form 5A CTO",
    legalStatusTone: "good",
    origin: "Armadale Hospital inpatient egress",
    clinicalSummary:
      "Origin: Armadale Hospital inpatient egress. Transfer of community treatment order supervision to Midland CMHT. 21-day inpatient stabilisation complete, requires supervising psychiatrist and depot allocation.",
    primaryActionLabel: "Accept CTO transfer",
    secActionLabel: "Assign consultant",
    declineActionLabel: "Decline",
    team: "midland",
  },
  {
    id: "RF-8840",
    priorityLabel: "Priority 3 routine",
    urgency: 3,
    isBreach: false,
    waitLabel: makeWaitLabel(1120),
    patientId: "PT-5022",
    patientDetails: "Male 38y",
    legalStatus: "Voluntary",
    legalStatusTone: "warn",
    origin: "City East CMHT cross-catchment",
    clinicalSummary:
      "Origin: City East CMHT cross-catchment. Inter-catchment residential relocation to Midland area. Stable chronic schizophrenia on maintenance depot medication, request for ongoing clinic follow-up.",
    primaryActionLabel: "Accept transfer",
    secActionLabel: "Assign case manager",
    declineActionLabel: "Decline",
    team: "midland",
  },
];

export const DEMO_COMMUNITY_INPATIENTS: DemoInpatient[] = [
  {
    id: "INP-01",
    patientId: "PT-4409",
    patientDetails: "M 34y",
    category: "secure",
    wardName: "Demonstration ward",
    healthService: "SMHS",
    bedId: "Bed 03",
    daysInBed: "14d",
    legalStatus: "Form 5A Invol",
    legalStatusTone: "danger",
    keyClinician: "RN K. Vance",
    mdtStatus: "Joint MDT review 24 Sep",
  },
  {
    id: "INP-02",
    patientId: "PT-4105",
    patientDetails: "M 24y",
    category: "secure",
    wardName: "Demonstration ward",
    healthService: "SMHS",
    bedId: "Bed 04",
    daysInBed: "8d",
    legalStatus: "Form 5A Invol",
    legalStatusTone: "danger",
    keyClinician: "RN T. Bradley",
    mdtStatus: "1:1 specialling active",
  },
  {
    id: "INP-03",
    patientId: "PT-3891",
    patientDetails: "F 41y",
    category: "secure",
    wardName: "Demonstration ward",
    healthService: "NMHS",
    bedId: "Bed 07",
    daysInBed: "28d",
    legalStatus: "Form 5A Invol",
    legalStatusTone: "danger",
    keyClinician: "Dr S. Chen",
    mdtStatus: "Long-stay rehabilitation review",
  },
  {
    id: "INP-04",
    patientId: "PT-3712",
    patientDetails: "M 59y",
    category: "open",
    wardName: "Demonstration ward",
    healthService: "NMHS",
    bedId: "Bed 11",
    daysInBed: "6d",
    legalStatus: "Voluntary",
    legalStatusTone: "warn",
    keyClinician: "SW M. Davies",
    mdtStatus: "Housing coordination active",
  },
  {
    id: "INP-05",
    patientId: "PT-3650",
    patientDetails: "F 31y",
    category: "secure",
    wardName: "RPH Adult Secure",
    healthService: "EMHS",
    bedId: "Bed 02",
    daysInBed: "12d",
    legalStatus: "Form 5A Invol",
    legalStatusTone: "danger",
    keyClinician: "RN C. Davis",
    mdtStatus: "Medication stabilisation",
  },
  {
    id: "INP-06",
    patientId: "PT-3522",
    patientDetails: "M 22y",
    category: "secure",
    wardName: "Bentley Adult Secure",
    healthService: "EMHS",
    bedId: "Bed 05",
    daysInBed: "4d",
    legalStatus: "Form 1A MHA",
    legalStatusTone: "danger",
    keyClinician: "Dr K. Rao",
    mdtStatus: "Acute admission liaison",
  },
  {
    id: "INP-07",
    patientId: "PT-3419",
    patientDetails: "F 71y",
    category: "older",
    wardName: "Demonstration ward",
    healthService: "EMHS",
    bedId: "Bed 08",
    daysInBed: "19d",
    legalStatus: "Form 5A Invol",
    legalStatusTone: "danger",
    keyClinician: "OT E. Wilson",
    mdtStatus: "ACAT assessment pending",
  },
  {
    id: "INP-08",
    patientId: "PT-3304",
    patientDetails: "M 48y",
    category: "open",
    wardName: "Armadale Adult Open",
    healthService: "EMHS",
    bedId: "Bed 14",
    daysInBed: "9d",
    legalStatus: "Voluntary",
    legalStatusTone: "warn",
    keyClinician: "RN K. Vance",
    mdtStatus: "Discharge planning meeting 23 Sep",
  },
  {
    id: "INP-09",
    patientId: "PT-3211",
    patientDetails: "F 27y",
    category: "secure",
    wardName: siteByCode("FSH")?.name ?? "Hospital not recorded",
    healthService: "SMHS",
    bedId: "Bed 12",
    daysInBed: "15d",
    legalStatus: "Form 5A Invol",
    legalStatusTone: "danger",
    keyClinician: "Dr S. Chen",
    mdtStatus: "Forensic liaison review",
  },
  {
    id: "INP-10",
    patientId: "PT-3108",
    patientDetails: "M 36y",
    category: "older",
    wardName: "Demonstration ward",
    healthService: "NMHS",
    bedId: "Bed 06",
    daysInBed: "5d",
    legalStatus: "Voluntary",
    legalStatusTone: "warn",
    keyClinician: "SW M. Davies",
    mdtStatus: "Family conference booked",
  },
  {
    id: "INP-11",
    patientId: "PT-3055",
    patientDetails: "F 54y",
    category: "older",
    wardName: "Demonstration ward",
    healthService: "NMHS",
    bedId: "Bed 03",
    daysInBed: "33d",
    legalStatus: "Form 5A Invol",
    legalStatusTone: "danger",
    keyClinician: "OT E. Wilson",
    mdtStatus: "High acuity placement",
  },
  {
    id: "INP-12",
    patientId: "PT-2980",
    patientDetails: "M 62y",
    category: "open",
    wardName: "RPH Adult Open",
    healthService: "EMHS",
    bedId: "Bed 09",
    daysInBed: "7d",
    legalStatus: "Voluntary",
    legalStatusTone: "warn",
    keyClinician: "RN C. Davis",
    mdtStatus: "Medical comorbidity review",
  },
  {
    id: "INP-13",
    patientId: "PT-2845",
    patientDetails: "M 40y",
    category: "open",
    wardName: "Rockingham Adult Open",
    healthService: "SMHS",
    bedId: "Bed 15",
    daysInBed: "11d",
    legalStatus: "Voluntary",
    legalStatusTone: "warn",
    keyClinician: "RN K. Vance",
    mdtStatus: "Step-down coordination",
  },
  {
    id: "INP-14",
    patientId: "PT-2710",
    patientDetails: "F 29y",
    category: "secure",
    wardName: "Demonstration ward",
    healthService: "SMHS",
    bedId: "Bed 01",
    daysInBed: "3d",
    legalStatus: "Form 1A MHA",
    legalStatusTone: "danger",
    keyClinician: "Dr K. Rao",
    mdtStatus: "Acute admission liaison",
  },
];

export const DEMO_COMMUNITY_EGRESS: DemoEgress[] = [
  {
    id: "EGR-01",
    patientId: "PT-3891",
    patientDetails: "F 41y",
    dischargingUnit: "Demonstration ward",
    dischargeDatePlan: "Discharged 2d ago (19 Sep)",
    destination: "Supported accommodation",
    status: "overdue",
    kpiStatusLabel: "Overdue (priority follow-up)",
    kpiTone: "danger",
    assignedCoordinator: "Dr S. Chen",
    actionLabel: "Urgent outreach",
    isPrimaryAction: true,
  },
  {
    id: "EGR-02",
    patientId: "PT-4102",
    patientDetails: "M 31y",
    dischargingUnit: "Demonstration ward",
    dischargeDatePlan: "Today 10:00",
    destination: "Private residence",
    status: "today",
    kpiStatusLabel: "Due today 3pm",
    kpiTone: "warn",
    assignedCoordinator: "RN T. Bradley",
    actionLabel: "Confirm contact",
    isPrimaryAction: true,
  },
  {
    id: "EGR-03",
    patientId: "PT-3712",
    patientDetails: "M 59y",
    dischargingUnit: "Demonstration ward",
    dischargeDatePlan: "Today 11:30",
    destination: "Community step-down",
    status: "today",
    kpiStatusLabel: "Due today 4pm",
    kpiTone: "warn",
    assignedCoordinator: "SW M. Davies",
    actionLabel: "Confirm contact",
    isPrimaryAction: true,
  },
  {
    id: "EGR-04",
    patientId: "PT-3419",
    patientDetails: "F 71y",
    dischargingUnit: "Demonstration ward",
    dischargeDatePlan: "Tomorrow 14:00 (planned)",
    destination: "Respite aged care",
    status: "upcoming",
    kpiStatusLabel: "Due in 2 days",
    kpiTone: "neutral",
    assignedCoordinator: "OT E. Wilson",
    actionLabel: "Pre-discharge check",
    isPrimaryAction: false,
  },
  {
    id: "EGR-05",
    patientId: "PT-3304",
    patientDetails: "M 48y",
    dischargingUnit: "Armadale Adult Open",
    dischargeDatePlan: "23 Sep 11am (planned)",
    destination: "Private residence",
    status: "upcoming",
    kpiStatusLabel: "Due in 3 days",
    kpiTone: "neutral",
    assignedCoordinator: "RN K. Vance",
    actionLabel: "Review plan",
    isPrimaryAction: false,
  },
  {
    id: "EGR-06",
    patientId: "PT-2980",
    patientDetails: "M 62y",
    dischargingUnit: "RPH Adult Open",
    dischargeDatePlan: "24 Sep 10am (planned)",
    destination: "Independent living",
    status: "upcoming",
    kpiStatusLabel: "Due in 4 days",
    kpiTone: "neutral",
    assignedCoordinator: "RN C. Davis",
    actionLabel: "Review plan",
    isPrimaryAction: false,
  },
];

/**
 * D-39: a synthetic UMRN for each demonstration person who is not on the caseload, so every
 * referral, inpatient and egress row names a distinct person without showing a record number.
 */
export const DEMO_COMMUNITY_UMRNS: Readonly<Record<string, string>> = {
  "PT-3419": "UM960341",
  "PT-3712": "UM960371",
  "PT-4102": "UM960410",
  "PT-4512": "UM960451",
  "PT-4620": "UM960462",
  "PT-4731": "UM960473",
  "PT-4805": "UM960480",
  "PT-4918": "UM960491",
  "PT-5022": "UM960502",
};

export const DEMO_COMMUNITY_CASELOAD: DemoCaseloadRow[] = [
  {
    id: "CL-01",
    umrn: "UM981023",
    patientId: "PT-4409",
    ageSex: "34y Male",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 1 assertive outreach",
    category: "cto",
    keyClinician: "RN K. Vance",
    lastContact: "Yesterday 2pm (home)",
    nextReview: "Tomorrow 10am (depot clinic)",
  },
  {
    id: "CL-02",
    umrn: "UM945201",
    patientId: "PT-4105",
    ageSex: "24y Male",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 1 high acuity",
    category: "cto",
    keyClinician: "RN T. Bradley",
    lastContact: "20 Sep 11am (clinic)",
    nextReview: "Tribunal review 28 Sep",
  },
  {
    id: "CL-03",
    umrn: "UM892410",
    patientId: "PT-3891",
    ageSex: "41y Female",
    statutoryStatus: "Voluntary",
    statutoryTone: "warn",
    tier: "Tier 2 case management",
    category: "depot",
    keyClinician: "Dr S. Chen",
    lastContact: "19 Sep 3pm (telehealth)",
    nextReview: "Depot injection 23 Sep",
  },
  {
    id: "CL-04",
    umrn: "UM778912",
    patientId: "PT-3650",
    ageSex: "31y Female",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 2 case management",
    category: "cto",
    keyClinician: "RN C. Davis",
    lastContact: "18 Sep 9am (home)",
    nextReview: "CTO expiry 12 Oct 2026",
  },
  {
    id: "CL-05",
    umrn: "UM662309",
    patientId: "PT-3522",
    ageSex: "22y Male",
    statutoryStatus: "Form 1A MHA",
    statutoryTone: "danger",
    tier: "Tier 1 crisis monitoring",
    category: "high",
    keyClinician: "Dr K. Rao",
    lastContact: "17 Sep 4pm (clinic)",
    nextReview: "Consultant review 22 Sep",
  },
  {
    id: "CL-06",
    umrn: "UM551980",
    patientId: "PT-3304",
    ageSex: "48y Male",
    statutoryStatus: "Voluntary",
    statutoryTone: "warn",
    tier: "Tier 3 maintenance",
    category: "depot",
    keyClinician: "RN K. Vance",
    lastContact: "15 Sep 10am (clinic)",
    nextReview: "Depot injection 25 Sep",
  },
  {
    id: "CL-07",
    umrn: "UM441290",
    patientId: "PT-3211",
    ageSex: "27y Female",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 1 assertive outreach",
    category: "cto",
    keyClinician: "Dr S. Chen",
    lastContact: "18 Sep 11am (clinic)",
    nextReview: "CTO review 15 Oct 2026",
  },
  {
    id: "CL-08",
    umrn: "UM331089",
    patientId: "PT-3108",
    ageSex: "36y Male",
    statutoryStatus: "Voluntary",
    statutoryTone: "warn",
    tier: "Tier 2 case management",
    category: "depot",
    keyClinician: "SW M. Davies",
    lastContact: "14 Sep 2pm (home)",
    nextReview: "Depot clinic 28 Sep",
  },
  {
    id: "CL-09",
    umrn: "UM221054",
    patientId: "PT-3055",
    ageSex: "54y Female",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 1 high acuity",
    category: "high",
    keyClinician: "OT E. Wilson",
    lastContact: "19 Sep 10am (clinic)",
    nextReview: "Tribunal review 30 Sep",
  },
  {
    id: "CL-10",
    umrn: "UM110982",
    patientId: "PT-2980",
    ageSex: "62y Male",
    statutoryStatus: "Voluntary",
    statutoryTone: "warn",
    tier: "Tier 3 maintenance",
    category: "all",
    keyClinician: "RN C. Davis",
    lastContact: "12 Sep 3pm (telehealth)",
    nextReview: "6-month review Nov 2026",
  },
  {
    id: "CL-11",
    umrn: "UM902341",
    patientId: "PT-2845",
    ageSex: "40y Male",
    statutoryStatus: "Voluntary",
    statutoryTone: "warn",
    tier: "Tier 2 case management",
    category: "all",
    keyClinician: "RN K. Vance",
    lastContact: "16 Sep 9am (clinic)",
    nextReview: "Next appt 29 Sep",
  },
  {
    id: "CL-12",
    umrn: "UM881230",
    patientId: "PT-2710",
    ageSex: "29y Female",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 1 high acuity",
    category: "cto",
    keyClinician: "Dr K. Rao",
    lastContact: "Yesterday 4pm (clinic)",
    nextReview: "Depot clinic 24 Sep",
  },
  {
    id: "CL-13",
    umrn: "UM773412",
    patientId: "PT-2601",
    ageSex: "51y Male",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 2 case management",
    category: "cto",
    keyClinician: "RN T. Bradley",
    lastContact: "17 Sep 11am (home)",
    nextReview: "CTO review 05 Nov 2026",
  },
  {
    id: "CL-14",
    umrn: "UM664120",
    patientId: "PT-2509",
    ageSex: "38y Female",
    statutoryStatus: "Voluntary",
    statutoryTone: "warn",
    tier: "Tier 3 maintenance",
    category: "depot",
    keyClinician: "RN C. Davis",
    lastContact: "11 Sep 10am (clinic)",
    nextReview: "Depot clinic 25 Sep",
  },
  {
    id: "CL-15",
    umrn: "UM552319",
    patientId: "PT-2418",
    ageSex: "44y Male",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 1 assertive outreach",
    category: "high",
    keyClinician: "Dr S. Chen",
    lastContact: "19 Sep 2pm (clinic)",
    nextReview: "MDT review 26 Sep",
  },
  {
    id: "CL-16",
    umrn: "UM441098",
    patientId: "PT-2315",
    ageSex: "30y Female",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 2 case management",
    category: "cto",
    keyClinician: "SW M. Davies",
    lastContact: "18 Sep 3pm (home)",
    nextReview: "CTO review 18 Nov 2026",
  },
  {
    id: "CL-17",
    umrn: "UM330912",
    patientId: "PT-2210",
    ageSex: "67y Male",
    statutoryStatus: "Voluntary",
    statutoryTone: "warn",
    tier: "Tier 3 maintenance",
    category: "all",
    keyClinician: "OT E. Wilson",
    lastContact: "10 Sep 11am (telehealth)",
    nextReview: "Annual review Dec 2026",
  },
  {
    id: "CL-18",
    umrn: "UM220194",
    patientId: "PT-2104",
    ageSex: "25y Female",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 1 high acuity",
    category: "cto",
    keyClinician: "RN T. Bradley",
    lastContact: "20 Sep 9am (clinic)",
    nextReview: "Tribunal review 02 Oct",
  },
];

export const DEMO_COMMUNITY_STAFF: DemoStaff[] = [
  {
    name: "Dr A. Nair",
    role: "Lead Consultant Psychiatrist",
    status: "Available",
    statusTone: "good",
    caseload: 38,
    ext: "4201",
    assignment: "MDT lead",
  },
  {
    name: "Dr K. Rao",
    role: "Consultant Psychiatrist",
    status: "Clinic room 1",
    statusTone: "neutral",
    caseload: 34,
    ext: "4202",
    assignment: "Intake clinic",
  },
  {
    name: "Dr J. Lim",
    role: "Senior Registrar",
    status: "Triage duty",
    statusTone: "warn",
    caseload: 26,
    ext: "4205",
    assignment: "Crisis desk",
  },
  {
    name: "K. Vance",
    role: "Nurse Unit Manager (NUM)",
    status: "Available",
    statusTone: "good",
    caseload: 12,
    ext: "4210",
    assignment: "Bed coordinator",
  },
  {
    name: "T. Bradley",
    role: "Community Mental Health Nurse",
    status: "Response car 1",
    statusTone: "warn",
    caseload: 22,
    ext: "4215",
    assignment: "Home outreach",
  },
  {
    name: "C. Davis",
    role: "Community Mental Health Nurse",
    status: "Clinic room 2",
    statusTone: "neutral",
    caseload: 24,
    ext: "4216",
    assignment: "Depot clinic",
  },
  {
    name: "M. Davies",
    role: "Senior Social Worker",
    status: "Available",
    statusTone: "good",
    caseload: 18,
    ext: "4220",
    assignment: "Housing liaison",
  },
  {
    name: "E. Wilson",
    role: "Senior Occupational Therapist",
    status: "Available",
    statusTone: "good",
    caseload: 16,
    ext: "4225",
    assignment: "Living skills",
  },
];

export interface CommunityTeamConfig {
  name: string;
  campus: string;
  service: string;
  svcDot: "south" | "east" | "north" | "country";
  scope: string;
  caseload: number;
  triage: number;
  urgentTriage: number;
  inpatients: number;
  inpatientsTotal: number;
  egress: number;
  staff: number;
  cto: number;
  crisis: number;
  consultant: string;
  inpatientSites: string;
  outreach: string;
  fleet1: string;
  fleet2: string;
  sector: string;
}

const KNOWN_TEAM_CONFIGS: Record<string, CommunityTeamConfig> = {
  fremantle: {
    name: "Fremantle Adult CMHT (SMHS)",
    campus: "Fremantle Hospital · Alma Street",
    service: "South Metro (SMHS)",
    svcDot: "south",
    scope: "Alma St · 8 suburbs",
    caseload: 128,
    triage: 5,
    urgentTriage: 4,
    inpatients: 14,
    inpatientsTotal: 18,
    egress: 4,
    staff: 7,
    cto: 18,
    crisis: 2,
    consultant: "Dr A. Nair",
    inpatientSites: "4 hospital sites",
    outreach: "Car 2 · Dr Nair & CNS Kowalski",
    fleet1: "Vehicle 1 (Fremantle coastal sector)",
    fleet2: "Vehicle 2 (Cockburn / Melville sector)",
    sector: "Fremantle / South Metro sector catchment",
  },
  "alma-street-fremantle": {
    name: "Fremantle Adult CMHT (SMHS)",
    campus: "Fremantle Hospital · Alma Street",
    service: "South Metro (SMHS)",
    svcDot: "south",
    scope: "Alma St · 8 suburbs",
    caseload: 128,
    triage: 5,
    urgentTriage: 4,
    inpatients: 14,
    inpatientsTotal: 18,
    egress: 4,
    staff: 7,
    cto: 18,
    crisis: 2,
    consultant: "Dr A. Nair",
    inpatientSites: "4 hospital sites",
    outreach: "Car 2 · Dr Nair & CNS Kowalski",
    fleet1: "Vehicle 1 (Fremantle coastal sector)",
    fleet2: "Vehicle 2 (Cockburn / Melville sector)",
    sector: "Fremantle / South Metro sector catchment",
  },
  midland: {
    name: "Midland Adult CMHT (EMHS)",
    campus: "Swan Health Campus · Midland",
    service: "East Metro (EMHS)",
    svcDot: "east",
    scope: "Swan Valley · 12 suburbs",
    caseload: 142,
    triage: 7,
    urgentTriage: 5,
    inpatients: 18,
    inpatientsTotal: 22,
    egress: 6,
    staff: 8,
    cto: 22,
    crisis: 3,
    consultant: "Dr S. Chen",
    inpatientSites: "Swan Ward 1 & St John of God",
    outreach: "Car 1 · Dr Chen & RN Bradley",
    fleet1: "Vehicle 1 (Swan North sector)",
    fleet2: "Vehicle 2 (Swan Hills sector)",
    sector: "Midland / East Metro sector catchment",
  },
  stirling: {
    name: "Stirling Adult CMHT (NMHS)",
    campus: "Mirrabooka Health Hub · Stirling",
    service: "North Metro (NMHS)",
    svcDot: "north",
    scope: "Stirling · 10 suburbs",
    caseload: 135,
    triage: 4,
    urgentTriage: 3,
    inpatients: 12,
    inpatientsTotal: 15,
    egress: 5,
    staff: 7,
    cto: 16,
    crisis: 2,
    consultant: "Dr M. Taylor",
    inpatientSites: "Sir Charles Gairdner (SCGH)",
    outreach: "Car 3 · Dr Taylor & RN Adams",
    fleet1: "Vehicle 1 (Stirling coastal sector)",
    fleet2: "Vehicle 2 (Mirrabooka inland sector)",
    sector: "Stirling / North Metro sector catchment",
  },
  rockingham: {
    name: "Rockingham Adult CMHT (SMHS)",
    campus: "Rockingham General Hospital Campus",
    service: "South Metro (SMHS)",
    svcDot: "south",
    scope: "Kwinana / Rockingham · 9 suburbs",
    caseload: 118,
    triage: 6,
    urgentTriage: 4,
    inpatients: 15,
    inpatientsTotal: 18,
    egress: 3,
    staff: 6,
    cto: 14,
    crisis: 2,
    consultant: "Dr K. O'Connor",
    inpatientSites: "Mimidi Park Acute Unit",
    outreach: "Car 4 · Dr O'Connor & CNS Lee",
    fleet1: "Vehicle 1 (Rockingham foreshore sector)",
    fleet2: "Vehicle 2 (Kwinana industrial sector)",
    sector: "Rockingham / South Metro sector catchment",
  },
  armadale: {
    name: "Armadale Adult CMHT (EMHS)",
    campus: "Armadale Health Service Campus",
    service: "East Metro (EMHS)",
    svcDot: "east",
    scope: "Armadale / Serpentine · 14 suburbs",
    caseload: 156,
    triage: 8,
    urgentTriage: 5,
    inpatients: 20,
    inpatientsTotal: 24,
    egress: 7,
    staff: 9,
    cto: 25,
    crisis: 3,
    consultant: "Dr R. Patel",
    inpatientSites: "Moodjar / Karalbrink wards",
    outreach: "Car 5 · Dr Patel & RN Wilson",
    fleet1: "Vehicle 1 (Armadale central sector)",
    fleet2: "Vehicle 2 (Serpentine / Hills sector)",
    sector: "Armadale / East Metro sector catchment",
  },
  joondalup: {
    name: "Joondalup Adult CMHT (NMHS)",
    campus: siteByCode("JHC")?.name ?? "Hospital not recorded",
    service: "North Metro (NMHS)",
    svcDot: "north",
    scope: "Joondalup / Wanneroo · 16 suburbs",
    caseload: 148,
    triage: 5,
    urgentTriage: 3,
    inpatients: 16,
    inpatientsTotal: 19,
    egress: 4,
    staff: 8,
    cto: 20,
    crisis: 2,
    consultant: "Dr L. Davies",
    inpatientSites: "Joondalup Acute Mental Health",
    outreach: "Car 6 · Dr Davies & CNS Scott",
    fleet1: "Vehicle 1 (Joondalup coastal sector)",
    fleet2: "Vehicle 2 (Wanneroo outer sector)",
    sector: "Joondalup / North Metro sector catchment",
  },
};

export function resolveCommunityTeamConfig(team: { id: string; name: string }): CommunityTeamConfig {
  const normalizedId = team.id.replace(/^alma-street-/, "").replace(/-adult-cmht.*$/, "");
  if (KNOWN_TEAM_CONFIGS[team.id]) return KNOWN_TEAM_CONFIGS[team.id];
  if (KNOWN_TEAM_CONFIGS[normalizedId]) return KNOWN_TEAM_CONFIGS[normalizedId];

  // Match by keyword in id or name
  for (const [key, cfg] of Object.entries(KNOWN_TEAM_CONFIGS)) {
    if (team.id.includes(key) || team.name.toLowerCase().includes(key)) {
      return cfg;
    }
  }

  // Deterministic fallback for any other WA CMHT
  const nameLower = team.name.toLowerCase();
  let service = "WA Country Health Service (WACHS)";
  let svcDot: "south" | "east" | "north" | "country" = "country";
  if (
    nameLower.includes("south") ||
    nameLower.includes("fremantle") ||
    nameLower.includes("peel") ||
    nameLower.includes("rockingham")
  ) {
    service = "South Metro (SMHS)";
    svcDot = "south";
  } else if (
    nameLower.includes("east") ||
    nameLower.includes("midland") ||
    nameLower.includes("armadale") ||
    nameLower.includes("kalamunda")
  ) {
    service = "East Metro (EMHS)";
    svcDot = "east";
  } else if (
    nameLower.includes("north") ||
    nameLower.includes("stirling") ||
    nameLower.includes("joondalup") ||
    nameLower.includes("osborne") ||
    nameLower.includes("graylands") ||
    nameLower.includes("selby")
  ) {
    service = "North Metro (NMHS)";
    svcDot = "north";
  }

  const prefix = team.name.split(" ")[0].replace(/[^a-zA-Z]/g, "") || "Catchment";

  let hash = 0;
  for (let i = 0; i < team.name.length; i++) hash = (hash * 31 + team.name.charCodeAt(i)) & 0xffffffff;
  const absHash = Math.abs(hash);

  const caseload = 110 + (absHash % 45);
  const triage = 4 + (absHash % 5);
  const urgentTriage = Math.max(1, triage - 2);
  const inpatients = 10 + (absHash % 9);
  const inpatientsTotal = inpatients + 3 + (absHash % 4);
  const egress = 3 + (absHash % 5);
  const staff = 6 + (absHash % 4);
  const cto = 12 + (absHash % 12);
  const crisis = 2;

  return {
    name: team.name,
    campus: `${prefix} Health Campus`,
    service,
    svcDot,
    scope: `${prefix} · 8 suburbs`,
    caseload,
    triage,
    urgentTriage,
    inpatients,
    inpatientsTotal,
    egress,
    staff,
    cto,
    crisis,
    consultant: "Dr M. Reynolds",
    inpatientSites: `${prefix} acute unit & satellite`,
    outreach: `Car 1 · ${prefix} outreach team`,
    fleet1: `Vehicle 1 (${prefix} north sector)`,
    fleet2: `Vehicle 2 (${prefix} south sector)`,
    sector: `${team.name} catchment sector`,
  };
}
