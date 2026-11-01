/**
 * MOCK-UP ONLY (1 Nov 2026, patient screen round 2). Invented record extras for the seven sample
 * patients so the History, Community, Details and Documents redesigns can show what a fuller record
 * would hold. None of these fields exist in the store yet: each is a proposal for Josh. Every name,
 * date and number here is invented. Nothing here is a clinical record.
 *
 * Dates are display strings, as typed. Nothing is computed into a countdown.
 */

import { siteByCode } from "../ward-sites";

/** Site names come from the data layer, never typed a second time here. */
const GRAYLANDS = siteByCode("GRY")?.name ?? "Graylands";

export type EpisodeKind = "admission" | "ed" | "community";

/** One earlier episode of care, newest first in each list. */
export interface PastEpisode {
  id: string;
  kind: EpisodeKind;
  /** "12 Mar 2026" */
  start: string;
  end?: string;
  year: number;
  /** Where the person was cared for: a ward, an ED or a community team. */
  where: string;
  /** Where they came from: an ED, a team, police, GP. */
  from?: string;
  /** "18 days" */
  stay?: string;
  bedDays?: number;
  /** Legal forms in this episode, as form codes in order: ["1A", "3A", "6A"]. */
  legal: string[];
  /** Highest legal status in the episode, in words. */
  legalSummary: string;
  outcome: string;
  /** Recorded events in the episode. Counts only; no typed text. */
  events?: { seclusion?: number; restraint?: number; awol?: number; leave?: number; transfers?: number };
  /** Readmitted within 28 days of the previous discharge. */
  readmit28?: boolean;
}

interface CareContact {
  name: string;
  role: string;
  phone?: string;
}

/** Engagement with a community mental health team (beyond a catchment match). */
export interface CommunityEngagement {
  status: "active" | "ended";
  team: string;
  /** "Case management", "Assertive outreach", "Clozapine clinic" */
  program: string;
  since: string;
  ended?: string;
  caseManager: CareContact;
  psychiatrist?: CareContact;
  lastContact?: string;
  nextContact?: string;
  /** Ids of documents in `documents` that belong to the community record. */
  documentIds: string[];
}

export type DocumentCategory = "Legal" | "Referral" | "Clinical" | "Community" | "Discharge" | "Transport";

export interface RecordDocument {
  id: string;
  /** Form code from the MHA 2014 (WA) register when it is a statutory form, e.g. "6A". */
  code?: string;
  title: string;
  category: DocumentCategory;
  /** Episode id from `episodes`, or "current" for this presentation. */
  episode: string;
  date: string;
  year: number;
  /** Role or team that recorded it. */
  by: string;
  source: string;
  status: "In force" | "Ended" | "Current" | "Filed" | "Superseded";
  /** "PDF · 2 pages". Metadata only; no file is held. */
  meta?: string;
}

interface SupportPerson {
  name: string;
  /** MHA 2014 (WA) roles: carer, close family member, nominated person; or next of kin. */
  role: string;
  relationship?: string;
  phone?: string;
  /** Must be told of admission, transfer and discharge under the Act. */
  notify?: boolean;
}

export interface RecordExtras {
  episodes: PastEpisode[];
  community?: CommunityEngagement[];
  documents: RecordDocument[];
  supports: SupportPerson[];
  /** Physical health and safety alerts that matter for a bed or a transfer. */
  alerts: string[];
  phone?: string;
  /** Medicare-style identifiers are left out on purpose: not needed for bed flow. */
}

const PEEL_ED = "Peel Health Campus ED";

const PATIENT_RECORD_EXTRAS: Record<string, RecordExtras> = {
  // Finding a bed, Cannot move. No community engagement: Community tab hidden.
  "PT-023": {
    phone: "0491 570 006",
    alerts: [],
    supports: [
      { name: "Wren, Ada", role: "Close family member", relationship: "Mother", phone: "0491 570 156", notify: true },
    ],
    episodes: [
      {
        id: "E-023-1",
        kind: "ed",
        start: "14 Jun 2026",
        end: "14 Jun 2026",
        year: 2026,
        where: PEEL_ED,
        from: "Police",
        stay: "9h",
        legal: ["1A", "3E"],
        legalSummary: "Referred, then released",
        outcome: "Discharged home from ED; GP follow-up",
      },
    ],
    documents: [
      {
        id: "D-023-1",
        title: "Referral letter",
        category: "Referral",
        episode: "current",
        date: "1 Nov 2026",
        year: 2026,
        by: "ED doctor",
        source: "Attached to the referral",
        status: "Current",
        meta: "PDF · 2 pages",
      },
      {
        id: "D-023-2",
        title: "ED discharge summary",
        category: "Discharge",
        episode: "E-023-1",
        date: "14 Jun 2026",
        year: 2026,
        by: "ED doctor",
        source: PEEL_ED,
        status: "Filed",
        meta: "PDF · 1 page",
      },
      {
        id: "D-023-3",
        code: "1A",
        title: "Referral for examination by a psychiatrist",
        category: "Legal",
        episode: "E-023-1",
        date: "14 Jun 2026",
        year: 2026,
        by: "ED doctor",
        source: PEEL_ED,
        status: "Ended",
      },
      {
        id: "D-023-4",
        code: "3E",
        title: "Order that person cannot continue to be detained",
        category: "Legal",
        episode: "E-023-1",
        date: "14 Jun 2026",
        year: 2026,
        by: "Psychiatrist",
        source: PEEL_ED,
        status: "Ended",
      },
    ],
  },

  // Bed accepted. No community engagement.
  "PT-001": {
    phone: "0491 570 157",
    alerts: ["Penicillin allergy"],
    supports: [
      { name: "Halloway, Ben", role: "Nominated person", relationship: "Partner", phone: "0491 570 158", notify: true },
    ],
    episodes: [],
    documents: [
      {
        id: "D-001-1",
        title: "Referral letter",
        category: "Referral",
        episode: "current",
        date: "1 Nov 2026",
        year: 2026,
        by: "ED doctor",
        source: "Attached to the referral",
        status: "Current",
        meta: "PDF · 2 pages",
      },
      {
        id: "D-001-2",
        title: "Medication chart",
        category: "Clinical",
        episode: "current",
        date: "1 Nov 2026",
        year: 2026,
        by: "ED nurse",
        source: "Attached to the referral",
        status: "Current",
        meta: "PDF · 1 page",
      },
    ],
  },

  // Moving, Form 4A. Interpreter required. No community engagement.
  "PT-013": {
    phone: "0491 570 159",
    alerts: ["Type 2 diabetes, insulin", "Falls risk"],
    supports: [
      {
        name: "Marrowvale, Paolo",
        role: "Carer",
        relationship: "Husband",
        phone: "0491 570 110",
        notify: true,
      },
    ],
    episodes: [
      {
        id: "E-013-1",
        kind: "admission",
        start: "2 Feb 2025",
        end: "21 Feb 2025",
        year: 2025,
        where: "Swan Hospital, Ward 3",
        from: "Midland Hospital ED",
        stay: "19 days",
        bedDays: 19,
        legal: ["1A", "3A", "6A"],
        legalSummary: "Involuntary",
        outcome: "Discharged home; GP follow-up",
        events: { leave: 2 },
      },
    ],
    documents: [
      {
        id: "D-013-1",
        title: "Discharge summary",
        category: "Discharge",
        episode: "E-013-1",
        date: "21 Feb 2025",
        year: 2025,
        by: "Ward doctor",
        source: "Swan Hospital, Ward 3",
        status: "Filed",
        meta: "PDF · 3 pages",
      },
      {
        id: "D-013-2",
        code: "6A",
        title: "Inpatient treatment order in authorised hospital",
        category: "Legal",
        episode: "E-013-1",
        date: "4 Feb 2025",
        year: 2025,
        by: "Psychiatrist",
        source: "Swan Hospital, Ward 3",
        status: "Ended",
      },
    ],
  },

  // On a ward. Past community engagement (ended).
  "PT-003": {
    phone: "0491 570 313",
    alerts: [],
    supports: [
      { name: "Marrowby, Rosa", role: "Next of kin", relationship: "Sister", phone: "0491 570 737", notify: false },
    ],
    episodes: [
      {
        id: "E-003-2",
        kind: "admission",
        start: "3 Aug 2026",
        end: "17 Aug 2026",
        year: 2026,
        where: "Bentley Hospital, Ward 5A",
        from: "Royal Perth Hospital ED",
        stay: "14 days",
        bedDays: 14,
        legal: [],
        legalSummary: "Voluntary",
        outcome: "Discharged home; GP follow-up",
        events: { leave: 1 },
      },
      {
        id: "E-003-1",
        kind: "community",
        start: "Mar 2025",
        end: "Jan 2026",
        year: 2025,
        where: "Bentley Community Team",
        from: "GP",
        legal: [],
        legalSummary: "Voluntary",
        outcome: "Discharged to GP care",
      },
    ],
    community: [
      {
        status: "ended",
        team: "Bentley Community Team",
        program: "Case management",
        since: "Mar 2025",
        ended: "Jan 2026",
        caseManager: { name: "Okafor, Grace", role: "Clinical nurse, case manager", phone: "08 0000 4410" },
        psychiatrist: { name: "Dr L. Huang", role: "Consultant psychiatrist" },
        lastContact: "14 Jan 2026, clinic",
        documentIds: ["D-003-3", "D-003-4"],
      },
    ],
    documents: [
      {
        id: "D-003-1",
        title: "Admission care plan",
        category: "Clinical",
        episode: "current",
        date: "26 Oct 2026",
        year: 2026,
        by: "Ward nurse",
        source: "Ward",
        status: "Current",
        meta: "PDF · 2 pages",
      },
      {
        id: "D-003-2",
        title: "Discharge summary",
        category: "Discharge",
        episode: "E-003-2",
        date: "17 Aug 2026",
        year: 2026,
        by: "Ward doctor",
        source: "Bentley Hospital, Ward 5A",
        status: "Filed",
        meta: "PDF · 3 pages",
      },
      {
        id: "D-003-3",
        title: "Community care plan",
        category: "Community",
        episode: "E-003-1",
        date: "20 Mar 2025",
        year: 2025,
        by: "Case manager",
        source: "Bentley Community Team",
        status: "Superseded",
        meta: "PDF · 4 pages",
      },
      {
        id: "D-003-4",
        title: "Community discharge letter",
        category: "Community",
        episode: "E-003-1",
        date: "14 Jan 2026",
        year: 2026,
        by: "Case manager",
        source: "Bentley Community Team",
        status: "Filed",
        meta: "PDF · 1 page",
      },
    ],
  },

  // On leave. Active community engagement.
  "PT-036": {
    phone: "0491 571 266",
    alerts: [],
    supports: [
      {
        name: "Daviecroft, June",
        role: "Carer",
        relationship: "Mother",
        phone: "0491 571 491",
        notify: true,
      },
    ],
    episodes: [
      {
        id: "E-036-2",
        kind: "admission",
        start: "11 Sep 2026",
        end: "2 Oct 2026",
        year: 2026,
        where: "Swan Hospital, Ward 3",
        from: "Midland Hospital ED",
        stay: "21 days",
        bedDays: 21,
        legal: ["1A", "3A", "6A", "6C"],
        legalSummary: "Involuntary",
        outcome: "Discharged to Midland Community Team",
        events: { seclusion: 1, leave: 3 },
      },
      {
        id: "E-036-1",
        kind: "ed",
        start: "30 Aug 2026",
        end: "30 Aug 2026",
        year: 2026,
        where: "Midland Hospital ED",
        from: "Self",
        stay: "6h",
        legal: [],
        legalSummary: "Voluntary",
        outcome: "Discharged home; community team told",
      },
    ],
    community: [
      {
        status: "active",
        team: "Midland Community Team",
        program: "Case management",
        since: "Apr 2024",
        caseManager: { name: "Pereira, Dan", role: "Social worker, case manager", phone: "08 0000 3120" },
        psychiatrist: { name: "Dr A. Nair", role: "Consultant psychiatrist" },
        lastContact: "28 Oct 2026, home visit",
        nextContact: "4 Nov 2026, clinic",
        documentIds: ["D-036-3", "D-036-4"],
      },
    ],
    documents: [
      {
        id: "D-036-1",
        title: "Leave plan",
        category: "Clinical",
        episode: "current",
        date: "31 Oct 2026",
        year: 2026,
        by: "Ward doctor",
        source: "Ward",
        status: "Current",
        meta: "PDF · 1 page",
      },
      {
        id: "D-036-2",
        title: "Discharge summary",
        category: "Discharge",
        episode: "E-036-2",
        date: "2 Oct 2026",
        year: 2026,
        by: "Ward doctor",
        source: "Swan Hospital, Ward 3",
        status: "Filed",
        meta: "PDF · 3 pages",
      },
      {
        id: "D-036-3",
        title: "Community care plan",
        category: "Community",
        episode: "community",
        date: "6 Oct 2026",
        year: 2026,
        by: "Case manager",
        source: "Midland Community Team",
        status: "Current",
        meta: "PDF · 4 pages",
      },
      {
        id: "D-036-4",
        title: "Relapse prevention plan",
        category: "Community",
        episode: "community",
        date: "6 Oct 2026",
        year: 2026,
        by: "Case manager",
        source: "Midland Community Team",
        status: "Current",
        meta: "PDF · 2 pages",
      },
      {
        id: "D-036-5",
        code: "6A",
        title: "Inpatient treatment order in authorised hospital",
        category: "Legal",
        episode: "E-036-2",
        date: "13 Sep 2026",
        year: 2026,
        by: "Psychiatrist",
        source: "Swan Hospital, Ward 3",
        status: "Ended",
      },
    ],
  },

  // At ED with a bed kept. No community engagement.
  "PT-029": {
    phone: "0491 571 804",
    alerts: ["Chronic obstructive pulmonary disease, home oxygen"],
    supports: [],
    episodes: [
      {
        id: "E-029-1",
        kind: "admission",
        start: "9 May 2026",
        end: "30 May 2026",
        year: 2026,
        where: "Kalgoorlie Hospital, Mental Health Unit",
        from: "Kalgoorlie Hospital ED",
        stay: "21 days",
        bedDays: 21,
        legal: ["1A", "3A", "6B"],
        legalSummary: "Involuntary",
        outcome: "Discharged home; GP follow-up",
        events: { transfers: 1 },
      },
    ],
    documents: [
      {
        id: "D-029-1",
        title: "Discharge summary",
        category: "Discharge",
        episode: "E-029-1",
        date: "30 May 2026",
        year: 2026,
        by: "Ward doctor",
        source: "Kalgoorlie Hospital",
        status: "Filed",
        meta: "PDF · 2 pages",
      },
    ],
  },

  // Not currently active. Active community engagement; an earlier CTO has ended.
  "PT-002": {
    phone: "0491 572 549",
    alerts: ["Type 2 diabetes", "Hypertension"],
    supports: [
      {
        name: "Nguyen, Lan",
        role: "Nominated person",
        relationship: "Daughter",
        phone: "0491 572 665",
        notify: true,
      },
      { name: "Hallowin, Thi", role: "Carer", relationship: "Wife", phone: "0491 572 983", notify: true },
    ],
    episodes: [
      {
        id: "E-002-4",
        kind: "admission",
        start: "2 Jul 2026",
        end: "6 Aug 2026",
        year: 2026,
        where: "Swan Hospital, Ward 3",
        from: "Midland Hospital ED",
        stay: "35 days",
        bedDays: 35,
        legal: ["1A", "3A", "6A", "6C"],
        legalSummary: "Involuntary",
        outcome: "Discharged to Midland Community Team",
        events: { restraint: 1, leave: 4 },
        readmit28: true,
      },
      {
        id: "E-002-3",
        kind: "admission",
        start: "8 Jun 2026",
        end: "19 Jun 2026",
        year: 2026,
        where: "Swan Hospital, Ward 3",
        from: "Midland Hospital ED",
        stay: "11 days",
        bedDays: 11,
        legal: ["1A", "3A", "6A"],
        legalSummary: "Involuntary",
        outcome: "Discharged on a CTO (Form 5A)",
        events: { awol: 1 },
      },
      {
        id: "E-002-2",
        kind: "ed",
        start: "21 Jan 2026",
        end: "22 Jan 2026",
        year: 2026,
        where: "Midland Hospital ED",
        from: "Ambulance",
        stay: "14h",
        legal: ["1A"],
        legalSummary: "Referred, then voluntary",
        outcome: "Discharged home; community team told",
      },
      {
        id: "E-002-1",
        kind: "admission",
        start: "4 Oct 2024",
        end: "1 Nov 2024",
        year: 2024,
        where: GRAYLANDS,
        from: "Royal Perth Hospital ED",
        stay: "28 days",
        bedDays: 28,
        legal: ["1A", "3A", "6A"],
        legalSummary: "Involuntary",
        outcome: "Discharged to Midland Community Team",
        events: { seclusion: 2 },
      },
    ],
    community: [
      {
        status: "active",
        team: "Midland Community Team",
        program: "Case management",
        since: "Nov 2024",
        caseManager: { name: "Tran, Minh", role: "Clinical nurse, case manager", phone: "08 0000 3114" },
        psychiatrist: { name: "Dr A. Nair", role: "Consultant psychiatrist" },
        lastContact: "27 Oct 2026, home visit",
        nextContact: "10 Nov 2026, depot clinic",
        documentIds: ["D-002-1", "D-002-2", "D-002-5"],
      },
    ],
    documents: [
      {
        id: "D-002-1",
        title: "Community care plan",
        category: "Community",
        episode: "community",
        date: "12 Aug 2026",
        year: 2026,
        by: "Case manager",
        source: "Midland Community Team",
        status: "Current",
        meta: "PDF · 4 pages",
      },
      {
        id: "D-002-2",
        title: "Relapse prevention plan",
        category: "Community",
        episode: "community",
        date: "12 Aug 2026",
        year: 2026,
        by: "Case manager",
        source: "Midland Community Team",
        status: "Current",
        meta: "PDF · 2 pages",
      },
      {
        id: "D-002-3",
        title: "Discharge summary",
        category: "Discharge",
        episode: "E-002-4",
        date: "6 Aug 2026",
        year: 2026,
        by: "Ward doctor",
        source: "Swan Hospital, Ward 3",
        status: "Filed",
        meta: "PDF · 3 pages",
      },
      {
        id: "D-002-4",
        code: "6C",
        title: "Continuation of inpatient treatment order",
        category: "Legal",
        episode: "E-002-4",
        date: "23 Jul 2026",
        year: 2026,
        by: "Psychiatrist",
        source: "Swan Hospital, Ward 3",
        status: "Ended",
      },
      {
        id: "D-002-5",
        code: "5A",
        title: "Community treatment order",
        category: "Legal",
        episode: "E-002-3",
        date: "19 Jun 2026",
        year: 2026,
        by: "Psychiatrist",
        source: "Swan Hospital, Ward 3",
        status: "Ended",
      },
      {
        id: "D-002-6",
        title: "Discharge summary",
        category: "Discharge",
        episode: "E-002-3",
        date: "19 Jun 2026",
        year: 2026,
        by: "Ward doctor",
        source: "Swan Hospital, Ward 3",
        status: "Filed",
        meta: "PDF · 2 pages",
      },
      {
        id: "D-002-7",
        title: "Discharge summary",
        category: "Discharge",
        episode: "E-002-1",
        date: "1 Nov 2024",
        year: 2024,
        by: "Ward doctor",
        source: GRAYLANDS,
        status: "Filed",
        meta: "PDF · 4 pages",
      },
    ],
  },
};

export function recordExtrasFor(patientId: string | undefined): RecordExtras | undefined {
  return patientId ? PATIENT_RECORD_EXTRAS[patientId] : undefined;
}

/**
 * Community tab rule (Josh, 1 Nov 2026): show the tab only when community engagement is noted —
 * a community team episode (active or ended) or a CTO, current or earlier. A catchment match alone
 * is not engagement; it stays in Details.
 */
export function hasCommunityEngagement(
  patientId: string | undefined,
  communityTreatmentOrder: { earlier?: unknown[] } | undefined,
): boolean {
  if (communityTreatmentOrder) return true;
  return (recordExtrasFor(patientId)?.community?.length ?? 0) > 0;
}
