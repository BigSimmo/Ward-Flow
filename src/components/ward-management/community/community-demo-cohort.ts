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
  return isAlert ? `Wait: ${dur} (Alert)` : `Wait: ${dur}`;
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
    priorityLabel: "Priority 1 Immediate",
    urgency: 1,
    isBreach: true,
    waitLabel: makeWaitLabel(252, true),
    patientId: "PT-4409",
    patientDetails: "Male 34y",
    legalStatus: "Form 1A MHA",
    legalStatusTone: "danger",
    origin: `${siteByCode("FSH")?.name ?? "Hospital not recorded"} ED Resus`,
    clinicalSummary: `Origin: ${siteByCode("FSH")?.name ?? "Hospital not recorded"} ED Resus. Acute behavioural disturbance secondary to acute psychosis. Non-voluntary admission required, triage review for urgent secure bed or assertive outreach step-down.`,
    primaryActionLabel: "Accept & Allocate",
    secActionLabel: "Liaison Review",
    declineActionLabel: "Decline / Redirect",
    team: "fremantle",
  },
  {
    id: "RF-8819",
    priorityLabel: "Priority 1 Immediate",
    urgency: 1,
    isBreach: true,
    waitLabel: makeWaitLabel(345, true),
    patientId: "PT-4512",
    patientDetails: "Female 28y",
    legalStatus: "Voluntary",
    legalStatusTone: "warn",
    origin: "GP Urgent Referral",
    clinicalSummary:
      "Origin: GP Urgent Referral. Postpartum depression with acute suicidal ideation and auditory hallucinations. Infant safely in care of maternal grandmother, requires urgent consultant evaluation today.",
    primaryActionLabel: "Accept & Allocate",
    secActionLabel: "Urgent Home Visit",
    declineActionLabel: "Decline / Redirect",
    team: "fremantle",
  },
  {
    id: "RF-8824",
    priorityLabel: "Priority 2 Urgent",
    urgency: 2,
    isBreach: false,
    waitLabel: makeWaitLabel(90),
    patientId: "PT-4620",
    patientDetails: "Male 45y",
    legalStatus: "Form 1A MHA",
    legalStatusTone: "danger",
    origin: "MHERT / WA Police Co-response",
    clinicalSummary:
      "Origin: MHERT / WA Police Co-response. Severe paranoid persecutory delusions, barricaded in residence, medication non-adherence x3 months. Community mental health crisis team dispatched for joint assessment.",
    primaryActionLabel: "Accept & Allocate",
    secActionLabel: "Dispatch Crisis Team",
    declineActionLabel: "Decline",
    team: "fremantle",
  },
  {
    id: "RF-8827",
    priorityLabel: "Priority 2 Urgent",
    urgency: 2,
    isBreach: false,
    waitLabel: makeWaitLabel(495),
    patientId: "PT-4731",
    patientDetails: "Female 52y",
    legalStatus: "Voluntary",
    legalStatusTone: "warn",
    origin: "SCGH ED Psychiatric Liaison",
    clinicalSummary:
      "Origin: SCGH ED Psychiatric Liaison. Major depressive episode following domestic separation. ED medical toxicology clearance completed, referred for acute community outreach and intake case management.",
    primaryActionLabel: "Accept & Allocate",
    secActionLabel: "Intake Assessment",
    declineActionLabel: "Decline",
    team: "fremantle",
  },
  {
    id: "RF-8831",
    priorityLabel: "Priority 3 Routine",
    urgency: 3,
    isBreach: false,
    waitLabel: makeWaitLabel(720),
    patientId: "PT-4805",
    patientDetails: "Male 19y",
    legalStatus: "Voluntary",
    legalStatusTone: "warn",
    origin: "Youth Early Psychosis (EMyU) Step-Down",
    clinicalSummary:
      "Origin: Youth Early Psychosis (EMyU) Step-Down. Transition of care from adolescent service to adult CMHT. Established on oral antipsychotic therapy with stable mental state. Handover meeting scheduled.",
    primaryActionLabel: "Accept & Allocate",
    secActionLabel: "Assign Key Clinician",
    declineActionLabel: "Decline",
    team: "fremantle",
  },
  {
    id: "RF-8835",
    priorityLabel: "Priority 2 Urgent",
    urgency: 2,
    isBreach: false,
    waitLabel: makeWaitLabel(860),
    patientId: "PT-4918",
    patientDetails: "Female 63y",
    legalStatus: "Form 5A CTO",
    legalStatusTone: "good",
    origin: "Armadale Hospital Inpatient Egress",
    clinicalSummary:
      "Origin: Armadale Hospital Inpatient Egress. Transfer of Community Treatment Order supervision to Midland CMHT. 21-day inpatient stabilization complete, requires supervising psychiatrist and depot allocation.",
    primaryActionLabel: "Accept CTO Transfer",
    secActionLabel: "Assign Consultant",
    declineActionLabel: "Decline",
    team: "midland",
  },
  {
    id: "RF-8840",
    priorityLabel: "Priority 3 Routine",
    urgency: 3,
    isBreach: false,
    waitLabel: makeWaitLabel(1120),
    patientId: "PT-5022",
    patientDetails: "Male 38y",
    legalStatus: "Voluntary",
    legalStatusTone: "warn",
    origin: "City East CMHT Cross-Catchment",
    clinicalSummary:
      "Origin: City East CMHT Cross-Catchment. Inter-catchment residential relocation to Midland area. Stable chronic schizophrenia on maintenance depot medication, request for ongoing clinic follow-up.",
    primaryActionLabel: "Accept Transfer",
    secActionLabel: "Assign Case Manager",
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
    mdtStatus: "Joint MDT Review 24 Sep",
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
    mdtStatus: "1:1 Specialling Active",
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
    mdtStatus: "Long-Stay Rehabilitation Review",
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
    mdtStatus: "Housing Coordination Active",
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
    mdtStatus: "Medication Stabilization",
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
    mdtStatus: "Acute Admission Liaison",
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
    mdtStatus: "ACAT Assessment Pending",
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
    mdtStatus: "Discharge Planning Meeting 23 Sep",
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
    mdtStatus: "Forensic Liaison Review",
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
    mdtStatus: "Family Conference Booked",
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
    mdtStatus: "High Acuity Placement",
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
    mdtStatus: "Medical Comorbidity Review",
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
    mdtStatus: "Step-Down Coordination",
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
    mdtStatus: "Acute Admission Liaison",
  },
];

export const DEMO_COMMUNITY_EGRESS: DemoEgress[] = [
  {
    id: "EGR-01",
    patientId: "PT-3891",
    patientDetails: "F 41y",
    dischargingUnit: "Demonstration ward",
    dischargeDatePlan: "Discharged 2d ago (19 Sep)",
    destination: "Supported Accommodation",
    status: "overdue",
    kpiStatusLabel: "Overdue (Priority Follow-up)",
    kpiTone: "danger",
    assignedCoordinator: "Dr S. Chen",
    actionLabel: "Urgent Outreach",
    isPrimaryAction: true,
  },
  {
    id: "EGR-02",
    patientId: "PT-4102",
    patientDetails: "M 31y",
    dischargingUnit: "Demonstration ward",
    dischargeDatePlan: "Today 10:00",
    destination: "Private Residence",
    status: "today",
    kpiStatusLabel: "Due Today 3pm",
    kpiTone: "warn",
    assignedCoordinator: "RN T. Bradley",
    actionLabel: "Confirm Contact",
    isPrimaryAction: true,
  },
  {
    id: "EGR-03",
    patientId: "PT-3712",
    patientDetails: "M 59y",
    dischargingUnit: "Demonstration ward",
    dischargeDatePlan: "Today 11:30",
    destination: "Community Step-Down",
    status: "today",
    kpiStatusLabel: "Due Today 4pm",
    kpiTone: "warn",
    assignedCoordinator: "SW M. Davies",
    actionLabel: "Confirm Contact",
    isPrimaryAction: true,
  },
  {
    id: "EGR-04",
    patientId: "PT-3419",
    patientDetails: "F 71y",
    dischargingUnit: "Demonstration ward",
    dischargeDatePlan: "Tomorrow 14:00 (Planned)",
    destination: "Respite Aged Care",
    status: "upcoming",
    kpiStatusLabel: "Due in 2 Days",
    kpiTone: "neutral",
    assignedCoordinator: "OT E. Wilson",
    actionLabel: "Pre-Discharge Check",
    isPrimaryAction: false,
  },
  {
    id: "EGR-05",
    patientId: "PT-3304",
    patientDetails: "M 48y",
    dischargingUnit: "Armadale Adult Open",
    dischargeDatePlan: "23 Sep 11am (Planned)",
    destination: "Private Residence",
    status: "upcoming",
    kpiStatusLabel: "Due in 3 Days",
    kpiTone: "neutral",
    assignedCoordinator: "RN K. Vance",
    actionLabel: "Review Plan",
    isPrimaryAction: false,
  },
  {
    id: "EGR-06",
    patientId: "PT-2980",
    patientDetails: "M 62y",
    dischargingUnit: "RPH Adult Open",
    dischargeDatePlan: "24 Sep 10am (Planned)",
    destination: "Independent Living",
    status: "upcoming",
    kpiStatusLabel: "Due in 4 Days",
    kpiTone: "neutral",
    assignedCoordinator: "RN C. Davis",
    actionLabel: "Review Plan",
    isPrimaryAction: false,
  },
];

export const DEMO_COMMUNITY_CASELOAD: DemoCaseloadRow[] = [
  {
    id: "CL-01",
    umrn: "UMRN-981023",
    patientId: "PT-4409",
    ageSex: "34y Male",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 1 Assertive Outreach",
    category: "cto",
    keyClinician: "RN K. Vance",
    lastContact: "Yesterday 2pm (Home)",
    nextReview: "Tomorrow 10am (Depot Clinic)",
  },
  {
    id: "CL-02",
    umrn: "UMRN-945201",
    patientId: "PT-4105",
    ageSex: "24y Male",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 1 High Acuity",
    category: "cto",
    keyClinician: "RN T. Bradley",
    lastContact: "20 Sep 11am (Clinic)",
    nextReview: "Tribunal Review 28 Sep",
  },
  {
    id: "CL-03",
    umrn: "UMRN-892410",
    patientId: "PT-3891",
    ageSex: "41y Female",
    statutoryStatus: "Voluntary",
    statutoryTone: "warn",
    tier: "Tier 2 Case Management",
    category: "depot",
    keyClinician: "Dr S. Chen",
    lastContact: "19 Sep 3pm (Telehealth)",
    nextReview: "Depot Injection 23 Sep",
  },
  {
    id: "CL-04",
    umrn: "UMRN-778912",
    patientId: "PT-3650",
    ageSex: "31y Female",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 2 Case Management",
    category: "cto",
    keyClinician: "RN C. Davis",
    lastContact: "18 Sep 9am (Home)",
    nextReview: "CTO Expiry 12 Oct 2026",
  },
  {
    id: "CL-05",
    umrn: "UMRN-662309",
    patientId: "PT-3522",
    ageSex: "22y Male",
    statutoryStatus: "Form 1A MHA",
    statutoryTone: "danger",
    tier: "Tier 1 Crisis Monitoring",
    category: "high",
    keyClinician: "Dr K. Rao",
    lastContact: "17 Sep 4pm (Clinic)",
    nextReview: "Consultant Review 22 Sep",
  },
  {
    id: "CL-06",
    umrn: "UMRN-551980",
    patientId: "PT-3304",
    ageSex: "48y Male",
    statutoryStatus: "Voluntary",
    statutoryTone: "warn",
    tier: "Tier 3 Maintenance",
    category: "depot",
    keyClinician: "RN K. Vance",
    lastContact: "15 Sep 10am (Clinic)",
    nextReview: "Depot Injection 25 Sep",
  },
  {
    id: "CL-07",
    umrn: "UMRN-441290",
    patientId: "PT-3211",
    ageSex: "27y Female",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 1 Assertive Outreach",
    category: "cto",
    keyClinician: "Dr S. Chen",
    lastContact: "18 Sep 11am (Clinic)",
    nextReview: "CTO Review 15 Oct 2026",
  },
  {
    id: "CL-08",
    umrn: "UMRN-331089",
    patientId: "PT-3108",
    ageSex: "36y Male",
    statutoryStatus: "Voluntary",
    statutoryTone: "warn",
    tier: "Tier 2 Case Management",
    category: "depot",
    keyClinician: "SW M. Davies",
    lastContact: "14 Sep 2pm (Home)",
    nextReview: "Depot Clinic 28 Sep",
  },
  {
    id: "CL-09",
    umrn: "UMRN-221054",
    patientId: "PT-3055",
    ageSex: "54y Female",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 1 High Acuity",
    category: "high",
    keyClinician: "OT E. Wilson",
    lastContact: "19 Sep 10am (Clinic)",
    nextReview: "Tribunal Review 30 Sep",
  },
  {
    id: "CL-10",
    umrn: "UMRN-110982",
    patientId: "PT-2980",
    ageSex: "62y Male",
    statutoryStatus: "Voluntary",
    statutoryTone: "warn",
    tier: "Tier 3 Maintenance",
    category: "all",
    keyClinician: "RN C. Davis",
    lastContact: "12 Sep 3pm (Telehealth)",
    nextReview: "6-Month Review Nov 2026",
  },
  {
    id: "CL-11",
    umrn: "UMRN-902341",
    patientId: "PT-2845",
    ageSex: "40y Male",
    statutoryStatus: "Voluntary",
    statutoryTone: "warn",
    tier: "Tier 2 Case Management",
    category: "all",
    keyClinician: "RN K. Vance",
    lastContact: "16 Sep 9am (Clinic)",
    nextReview: "Next Appt 29 Sep",
  },
  {
    id: "CL-12",
    umrn: "UMRN-881230",
    patientId: "PT-2710",
    ageSex: "29y Female",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 1 High Acuity",
    category: "cto",
    keyClinician: "Dr K. Rao",
    lastContact: "Yesterday 4pm (Clinic)",
    nextReview: "Depot Clinic 24 Sep",
  },
  {
    id: "CL-13",
    umrn: "UMRN-773412",
    patientId: "PT-2601",
    ageSex: "51y Male",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 2 Case Management",
    category: "cto",
    keyClinician: "RN T. Bradley",
    lastContact: "17 Sep 11am (Home)",
    nextReview: "CTO Review 05 Nov 2026",
  },
  {
    id: "CL-14",
    umrn: "UMRN-664120",
    patientId: "PT-2509",
    ageSex: "38y Female",
    statutoryStatus: "Voluntary",
    statutoryTone: "warn",
    tier: "Tier 3 Maintenance",
    category: "depot",
    keyClinician: "RN C. Davis",
    lastContact: "11 Sep 10am (Clinic)",
    nextReview: "Depot Clinic 25 Sep",
  },
  {
    id: "CL-15",
    umrn: "UMRN-552319",
    patientId: "PT-2418",
    ageSex: "44y Male",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 1 Assertive Outreach",
    category: "high",
    keyClinician: "Dr S. Chen",
    lastContact: "19 Sep 2pm (Clinic)",
    nextReview: "MDT Review 26 Sep",
  },
  {
    id: "CL-16",
    umrn: "UMRN-441098",
    patientId: "PT-2315",
    ageSex: "30y Female",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 2 Case Management",
    category: "cto",
    keyClinician: "SW M. Davies",
    lastContact: "18 Sep 3pm (Home)",
    nextReview: "CTO Review 18 Nov 2026",
  },
  {
    id: "CL-17",
    umrn: "UMRN-330912",
    patientId: "PT-2210",
    ageSex: "67y Male",
    statutoryStatus: "Voluntary",
    statutoryTone: "warn",
    tier: "Tier 3 Maintenance",
    category: "all",
    keyClinician: "OT E. Wilson",
    lastContact: "10 Sep 11am (Telehealth)",
    nextReview: "Annual Review Dec 2026",
  },
  {
    id: "CL-18",
    umrn: "UMRN-220194",
    patientId: "PT-2104",
    ageSex: "25y Female",
    statutoryStatus: `Form 5A${formTitleForCode("5A") ? ` (${formTitleForCode("5A")})` : ""}`,
    statutoryTone: "danger",
    tier: "Tier 1 High Acuity",
    category: "cto",
    keyClinician: "RN T. Bradley",
    lastContact: "20 Sep 9am (Clinic)",
    nextReview: "Tribunal Review 02 Oct",
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
    assignment: "MDT Lead",
  },
  {
    name: "Dr K. Rao",
    role: "Consultant Psychiatrist",
    status: "Clinic Room 1",
    statusTone: "neutral",
    caseload: 34,
    ext: "4202",
    assignment: "Intake Clinic",
  },
  {
    name: "Dr J. Lim",
    role: "Senior Registrar",
    status: "Triage Duty",
    statusTone: "warn",
    caseload: 26,
    ext: "4205",
    assignment: "Crisis Desk",
  },
  {
    name: "K. Vance",
    role: "Nurse Unit Manager (NUM)",
    status: "Available",
    statusTone: "good",
    caseload: 12,
    ext: "4210",
    assignment: "Bed Coord",
  },
  {
    name: "T. Bradley",
    role: "Community Mental Health Nurse",
    status: "Response Car 1",
    statusTone: "warn",
    caseload: 22,
    ext: "4215",
    assignment: "Home Outreach",
  },
  {
    name: "C. Davis",
    role: "Community Mental Health Nurse",
    status: "Clinic Room 2",
    statusTone: "neutral",
    caseload: 24,
    ext: "4216",
    assignment: "Depot Clinic",
  },
  {
    name: "M. Davies",
    role: "Senior Social Worker",
    status: "Available",
    statusTone: "good",
    caseload: 18,
    ext: "4220",
    assignment: "Housing Liaison",
  },
  {
    name: "E. Wilson",
    role: "Senior Occupational Therapist",
    status: "Available",
    statusTone: "good",
    caseload: 16,
    ext: "4225",
    assignment: "Living Skills",
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

export const KNOWN_TEAM_CONFIGS: Record<string, CommunityTeamConfig> = {
  fremantle: {
    name: "Fremantle Adult CMHT (SMHS)",
    campus: "Fremantle Hospital · Alma Street",
    service: "South Metro (SMHS)",
    svcDot: "south",
    scope: "Alma St · 8 Suburbs",
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
    inpatientSites: "4 Hospital Sites",
    outreach: "Car 2 · Dr Nair & CNS Kowalski",
    fleet1: "Vehicle 1 (Fremantle Coastal Sector)",
    fleet2: "Vehicle 2 (Cockburn / Melville Sector)",
    sector: "Fremantle / South Metro Sector Catchment",
  },
  "alma-street-fremantle": {
    name: "Fremantle Adult CMHT (SMHS)",
    campus: "Fremantle Hospital · Alma Street",
    service: "South Metro (SMHS)",
    svcDot: "south",
    scope: "Alma St · 8 Suburbs",
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
    inpatientSites: "4 Hospital Sites",
    outreach: "Car 2 · Dr Nair & CNS Kowalski",
    fleet1: "Vehicle 1 (Fremantle Coastal Sector)",
    fleet2: "Vehicle 2 (Cockburn / Melville Sector)",
    sector: "Fremantle / South Metro Sector Catchment",
  },
  midland: {
    name: "Midland Adult CMHT (EMHS)",
    campus: "Swan Health Campus · Midland",
    service: "East Metro (EMHS)",
    svcDot: "east",
    scope: "Swan Valley · 12 Suburbs",
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
    fleet1: "Vehicle 1 (Swan North Sector)",
    fleet2: "Vehicle 2 (Swan Hills Sector)",
    sector: "Midland / East Metro Sector Catchment",
  },
  stirling: {
    name: "Stirling Adult CMHT (NMHS)",
    campus: "Mirrabooka Health Hub · Stirling",
    service: "North Metro (NMHS)",
    svcDot: "north",
    scope: "Stirling · 10 Suburbs",
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
    fleet1: "Vehicle 1 (Stirling Coastal Sector)",
    fleet2: "Vehicle 2 (Mirrabooka Inland Sector)",
    sector: "Stirling / North Metro Sector Catchment",
  },
  rockingham: {
    name: "Rockingham Adult CMHT (SMHS)",
    campus: "Rockingham General Hospital Campus",
    service: "South Metro (SMHS)",
    svcDot: "south",
    scope: "Kwinana / Rockingham · 9 Suburbs",
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
    fleet1: "Vehicle 1 (Rockingham Foreshore Sector)",
    fleet2: "Vehicle 2 (Kwinana Industrial Sector)",
    sector: "Rockingham / South Metro Sector Catchment",
  },
  armadale: {
    name: "Armadale Adult CMHT (EMHS)",
    campus: "Armadale Health Service Campus",
    service: "East Metro (EMHS)",
    svcDot: "east",
    scope: "Armadale / Serpentine · 14 Suburbs",
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
    inpatientSites: "Moodjar / Karalbrink Wards",
    outreach: "Car 5 · Dr Patel & RN Wilson",
    fleet1: "Vehicle 1 (Armadale Central Sector)",
    fleet2: "Vehicle 2 (Serpentine / Hills Sector)",
    sector: "Armadale / East Metro Sector Catchment",
  },
  joondalup: {
    name: "Joondalup Adult CMHT (NMHS)",
    campus: siteByCode("JHC")?.name ?? "Hospital not recorded",
    service: "North Metro (NMHS)",
    svcDot: "north",
    scope: "Joondalup / Wanneroo · 16 Suburbs",
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
    fleet1: "Vehicle 1 (Joondalup Coastal Sector)",
    fleet2: "Vehicle 2 (Wanneroo Outer Sector)",
    sector: "Joondalup / North Metro Sector Catchment",
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
    scope: `${prefix} · 8 Suburbs`,
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
    inpatientSites: `${prefix} Acute Unit & Satellite`,
    outreach: `Car 1 · ${prefix} Outreach Team`,
    fleet1: `Vehicle 1 (${prefix} North Sector)`,
    fleet2: `Vehicle 2 (${prefix} South Sector)`,
    sector: `${team.name} Catchment Sector`,
  };
}
