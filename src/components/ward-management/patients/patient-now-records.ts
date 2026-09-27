/**
 * Patient Now Clinical Scenario Data and Derivations.
 *
 * Authored from docs/ward-flow/mockups/patient-now-original-third-edition.html.
 * Supplies rich clinical trajectories for demonstrated patients (WF-009 "Stuck" and WF-004 "Moving well"),
 * as well as dynamic fallback structures for any patient or movement in the system.
 */

import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { edById, unitById } from "@/components/ward-management/ward-sites";

/**
 * A fixture document's title, resolved from the Chief Psychiatrist register rather than
 * hand-written here. `legalFormName` only reads `form.code`, so a bare `{ code }` is a valid
 * `LegalForm` for this purpose. Before this change one of these fixture rows read "Form 3B,
 * inpatient treatment order" — the register titles 3B "Continuation of detention"; "Inpatient
 * treatment order" is Form 6A's title, the exact mislabel `ward-model.ts`'s own `LegalForm.kind`
 * doc comment records as the reason the model holds no stored form titles at all
 * (`legalFormName` in `ward-legal-forms.ts` resolves one from `code` at render time instead).
 * See `tests/ward-form-labels-from-register.test.ts`.
 */
function officialFormName(code: string): string {
  return legalFormName({ code });
}

/**
 * Ward, site and emergency-department names read from the one data layer (`ward-sites.ts`) that
 * owns them, rather than typed a second time here — `tests/ward-flow-data-boundary.test.ts` fails
 * closed on any file outside that layer stating one of these names as its own string literal. A
 * non-null assertion is safe: every id below is a fixture id declared in `ward-sites.ts` itself.
 */
const FSH_ADULT_SECURE = unitById("fsh-adult-secure")!.name;
const RGH_ADULT_SECURE = unitById("rgh-adult-secure")!.name;
const BTY_ADULT_SECURE = unitById("bty-adult-secure")!.name;
const FRE_ADULT_OPEN = unitById("fre-adult-open")!.name;
const SCGH_ADULT_OPEN = unitById("scgh-adult-open")!.name;

const PEEL_ED = edById("peel-ed")!.name;
const FSH_ED = edById("fsh-ed")!.name;
const JHC_ED = edById("jhc-ed")!.name;
const RGH_ED = edById("rgh-ed")!.name;
const SJGM_ED = edById("sjgm-ed")!.name;

export interface ClinicalGate {
  label: string;
  verdict: string;
  detail: string;
  passed?: boolean;
}

export interface ContactCard {
  who: string;
  role: string;
  note: string;
  tone: "warn" | "danger" | "good" | null;
}

export interface NextStepItem {
  w: string;
  d: string;
  tone: "warn" | "danger" | "good" | null;
  chase?: boolean;
}

export interface HistoricalPresentation {
  date: string;
  year: number;
  where: string;
  to: string;
  los: string;
  losFull: string;
  source: string;
  route: string;
  tier: number;
  legal: string;
  forms: DocumentRecord[];
  asked: Array<{ ward: string; outcome: string; why: string }>;
  outcome: string;
  team: string;
  story: string | null;
  current?: boolean;
}

export interface CommunityTeamRecord {
  name: string;
  state: string;
  note: string;
}

export interface DocumentRecord {
  code: string;
  name: string;
  from: string;
  by: string;
  when: string;
  status: string;
}

export interface PatientNowRecord {
  id: string;
  example: string;
  exampleNote: string;
  known: string;
  arrival: string;
  early: Array<{ off: number; what: string; tone?: string; st?: number }>;
  late: Array<{ off: number; what: string; tone?: string; st?: number; key?: string }>;
  blockerQuote: string | null;
  lastSeen: number | null;
  verdict: {
    tone: "danger" | "good" | "warn";
    short: string;
    title: string;
    gates: ClinicalGate[];
    none?: string;
  };
  reason: string;
  ring: ContactCard[];
  ladder: string;
  next: NextStepItem[];
  transport: Array<[string, string]>;
  transportNote: string;
  transportBooked?: boolean;
  cadNumber?: string;
  eta?: string;
  transportProvider?: string;
  transportLegalStatus?: string;
  escortRequired?: boolean;
  presentations: HistoricalPresentation[];
  presentationsAbsent?: string;
  community: {
    teams: CommunityTeamRecord[];
    absent?: string;
    followUp: string;
  };
  documents: DocumentRecord[];
  documentsAbsent: string;
}

export const LIVE_REASONS: Record<string, string> = {
  "No bed": "Re-check: After 14:00 shift handover.",
  "Sex mix": "Re-check: Suitable bay vacancy.",
  "Bed pulled for an earlier referral": "Re-check: Next bed release.",
  "No specialling available": "Re-check: Next shift staffing roster.",
};

export const SETTLED_REASONS: Record<string, string> = {
  "Acuity mix": "Ward acuity ceiling reached.",
  "Out of catchment": "Outside catchment boundary.",
};

export const STAGES = [
  { id: "placement_requested", label: "Placement requested" },
  { id: "destination_review", label: "Destination review" },
  { id: "accepted_awaiting_bed", label: "Accepted, awaiting bed" },
  { id: "pulled", label: "Bed pulled" },
  { id: "handover_ready", label: "Handover ready" },
  { id: "moving", label: "Moving" },
  { id: "arrived", label: "Arrived" },
] as const;

export const PATIENT_NOW_RECORDS: Record<string, PatientNowRecord> = {
  "WF-009": {
    id: "WF-009",
    example: "Stuck",
    exampleNote: "Every locked adult ward asked, every one declined, and fitness to travel never assessed.",
    known: "known as Toby",
    arrival: "brought in by police",
    early: [
      { off: 94, what: "Psychiatric examination recorded." },
      { off: 131, what: "Legal status changed to <b>involuntary inpatient</b>. Form 1A recorded." },
    ],
    late: [],
    blockerQuote: "No secure adult bed available across the network.",
    lastSeen: 580, // 09:40
    verdict: {
      tone: "danger",
      short: "Cannot be moved, 2 reasons",
      title: "Cannot be moved. Two things are missing.",
      gates: [
        {
          label: "A secure adult bed",
          verdict: "None found",
          detail: "5/5 adult locked wards declined. Escalated to State bed coordination desk (awaiting response).",
        },
        {
          label: "Fit to travel",
          verdict: "Not assessed",
          detail: "Medical clearance required from Peel Health Campus Emergency Department.",
        },
      ],
    },
    reason:
      "Brought in by police under a Form 1A after neighbours reported shouting in the street and an attempt to enter a property that was not theirs. Known to the Peel Community Mental Health Team. Prescribed medication not taken for about three weeks, per a family member. No injuries. Voluntary admission declined.",
    ring: [
      {
        who: "State bed coordination desk",
        role: "Escalated to at {{escalated}}",
        note: "No reply is recorded either way.",
        tone: null,
      },
      {
        who: PEEL_ED,
        role: "Where this person is now",
        note: "Fitness to travel has not been asked for.",
        tone: null,
      },
      {
        who: FSH_ADULT_SECURE,
        role: "Declined on beds at {{declined:fsh-adult-secure}}",
        note: "The softest of the five refusals. A bed, not a judgement.",
        tone: null,
      },
    ],
    ladder:
      "If the desk does not answer, the next rung is the <b>duty psychiatrist</b>, then the <b>on call service manager</b>.",
    next: [
      {
        w: "Ask the emergency department for a fitness to travel assessment",
        d: "Nobody has asked. Without it this person cannot travel even once a bed appears.",
        tone: "warn",
      },
      { w: "Chase the escalation", d: "", tone: "warn", chase: true },
      {
        w: "Re-ask the three wards whose reason can change",
        d: "A bed, a bay and a bed pulled for an earlier referral all change on their own. A cohort and a catchment do not.",
        tone: "warn",
      },
      {
        w: "Re-ask after the {{handover}} handover",
        d: "Three of the five wards answered before 08:00 and their beds turn over at handover.",
        tone: null,
      },
    ],
    transport: [
      ["Provider", "No transport job exists yet"],
      ["Escort required", "Not recorded. No job to record it against"],
      ["From", PEEL_ED],
      ["To", "No destination yet"],
    ],
    transportNote:
      "A past presentation carries no retained transport record. The transport job belongs to the movement, which closes on arrival, so each earlier episode carries its arrival route in History instead.",
    transportBooked: false,
    presentations: [
      {
        date: "14 Mar 2019",
        year: 2019.2,
        where: JHC_ED,
        to: SCGH_ADULT_OPEN,
        los: "8 days",
        losFull: "8 days, 14 to 22 Mar 2019",
        source: "Ambulance",
        route: "Ambulance",
        tier: 2,
        legal: "Voluntary throughout. No legal form filed.",
        forms: [],
        asked: [],
        outcome: `Admitted ${SCGH_ADULT_OPEN} 14 Mar 2019. Discharged 22 Mar 2019.`,
        team: "None allocated yet",
        story: null,
      },
      {
        date: "2 Jul 2021",
        year: 2021.5,
        where: FSH_ED,
        to: FRE_ADULT_OPEN,
        los: "16 days",
        losFull: "16 days, 3 to 19 Jul 2021",
        source: "Police, on a welfare concern",
        route: "Police vehicle",
        tier: 1,
        legal:
          "Detained awaiting examination on arrival, Form 1A recorded. Changed to Voluntary 5 Jul 2021, reason recorded by the treating team. No statutory deadline is recorded for a Form 1A in this model.",
        forms: [
          {
            code: "1A",
            name: officialFormName("1A"),
            from: "The 2 Jul 2021 presentation",
            by: "Examining medical practitioner",
            when: "2 Jul 2021",
            status: "Superseded",
          },
        ],
        asked: [
          { ward: FSH_ADULT_SECURE, outcome: "Declined", why: "no bed" },
          { ward: FRE_ADULT_OPEN, outcome: "Accepted", why: "" },
        ],
        outcome: `Admitted ${FRE_ADULT_OPEN} 3 Jul 2021. Discharged 19 Jul 2021 to community follow up.`,
        team: "Perth Metropolitan Community Mental Health Team",
        story:
          "Brought in by police on a welfare concern after family lost contact for four days. Discharged with an allocation to the Perth Metropolitan Community Mental Health Team.",
      },
      {
        date: "10 Jan 2023",
        year: 2023.03,
        where: RGH_ED,
        to: RGH_ADULT_SECURE,
        los: "21 days",
        losFull: "21 days, 11 Jan to 1 Feb 2023",
        source: "Community team referral",
        route: "Patient transport vehicle",
        tier: 1,
        legal: "Involuntary inpatient, Form 1A to Form 3B. Validated on admission.",
        forms: [
          {
            code: "1A",
            name: officialFormName("1A"),
            from: "The 10 Jan 2023 presentation",
            by: "Examining medical practitioner",
            when: "10 Jan 2023",
            status: "Superseded",
          },
        ],
        asked: [{ ward: RGH_ADULT_SECURE, outcome: "Accepted", why: "" }],
        outcome: `Admitted ${RGH_ADULT_SECURE} 11 Jan 2023. Discharged 1 Feb 2023.`,
        team: "Peel Community Mental Health Team",
        story: `Referred from the Peel Community Mental Health Team clinic following deterioration in the community. Accepted on first referral to ${RGH_ADULT_SECURE}.`,
      },
      {
        date: "8 Sep 2023",
        year: 2023.69,
        where: PEEL_ED,
        to: FSH_ADULT_SECURE,
        los: "14 days",
        losFull: "14 days, 9 to 23 Sep 2023",
        source: "Police, after an incident in the community",
        route: "Police vehicle",
        tier: 1,
        legal: "Involuntary inpatient, Form 3B. Treatment order confirmed by the Mental Health Tribunal.",
        forms: [
          {
            code: "3B",
            name: officialFormName("3B"),
            from: "The 8 Sep 2023 presentation",
            by: "Authorised psychiatrist",
            when: "9 Sep 2023",
            status: "Superseded",
          },
        ],
        asked: [
          { ward: RGH_ADULT_SECURE, outcome: "Declined", why: "acuity mix" },
          { ward: FSH_ADULT_SECURE, outcome: "Accepted", why: "" },
        ],
        outcome: `Admitted ${FSH_ADULT_SECURE} 9 Sep 2023. Discharged 23 Sep 2023 to Peel Community Team.`,
        team: "Peel Community Mental Health Team",
        story: `Brought in by police. Escalation required after RGH declined on acuity mix. Accepted by ${FSH_ADULT_SECURE} after telephone conference between duty psychiatrist and receiving consultant.`,
      },
      {
        date: "14 Jun 2024",
        year: 2024.45,
        where: PEEL_ED,
        to: "No bed found",
        los: "11 hours in ED",
        losFull: "11 hours, discharged from the emergency department",
        source: "Ambulance",
        route: "Ambulance",
        tier: 2,
        legal: "Voluntary throughout.",
        forms: [],
        asked: [
          { ward: RGH_ADULT_SECURE, outcome: "Declined", why: "no bed" },
          { ward: FSH_ADULT_SECURE, outcome: "Declined", why: "no bed" },
        ],
        outcome:
          "Discharged from the emergency department after 11 hours with crisis team follow up arranged for 09:00 next day. No bed found across South Metropolitan.",
        team: "Peel Community Mental Health Team",
        story:
          "Attended with acute distress and sleep disruption. Both South Metropolitan locked wards declined on beds. Assessed as safe to discharge with community crisis team follow up.",
      },
      {
        date: "18 Feb 2025",
        year: 2025.13,
        where: PEEL_ED,
        to: BTY_ADULT_SECURE,
        los: "7 days",
        losFull: "7 days, 18 to 25 Feb 2025",
        source: "Community team referral",
        route: "Patient transport vehicle",
        tier: 1,
        legal: "Involuntary inpatient, Form 1A. Form 3B made on ward on day 2.",
        forms: [
          {
            code: "REF",
            name: "Referral record, community to ward",
            from: "The 18 Feb 2025 presentation",
            by: "Community case coordinator",
            when: "18 Feb 2025",
            status: "Accepted",
          },
        ],
        asked: [
          { ward: RGH_ADULT_SECURE, outcome: "Declined", why: "acuity mix" },
          { ward: FSH_ADULT_SECURE, outcome: "Declined", why: "sex mix" },
          { ward: BTY_ADULT_SECURE, outcome: "Accepted", why: "" },
        ],
        outcome:
          "Out of catchment admission to Bentley Adult Secure, authorised by on call service manager. Discharged 25 Feb 2025 back to Peel Community Team.",
        team: "Peel Community Mental Health Team",
        story:
          "Referred by Peel Community Team. Both home-service secure wards declined. Accepted by Bentley Adult Secure as an out-of-catchment placement under service agreement.",
      },
    ],
    community: {
      teams: [
        {
          name: "Peel Community Mental Health Team",
          state: "Active",
          note: "Allocated 1 Dec 2021. Current case coordinator: Peel Community Mental Health Team.",
        },
        {
          name: "Perth Metropolitan Community Mental Health Team",
          state: "Closed 1 Dec 2021",
          note: "Previous team before move to Mandurah.",
        },
      ],
      followUp:
        "A follow up review was requested with the Peel Community Mental Health Team after the 25 Feb 2025 discharge. Ward Flow holds nothing further about what community contact happened between that discharge and the presentation open now. It is not a live feed of community team activity, only of the allocation and discharge events it has been told about.",
    },
    documents: [
      {
        code: "1A",
        name: officialFormName("1A"),
        from: "The presentation open now, Sat 15 Aug 2026",
        by: "Examining medical practitioner",
        when: "15 Aug 2026",
        status: "Filed",
      },
      {
        code: "3B",
        name: officialFormName("3B"),
        from: "The 8 Sep 2023 presentation",
        by: "Authorised psychiatrist",
        when: "9 Sep 2023",
        status: "Filed",
      },
      {
        code: "1A",
        name: officialFormName("1A"),
        from: "The 10 Jan 2023 presentation",
        by: "Examining medical practitioner",
        when: "10 Jan 2023",
        status: "Filed",
      },
      {
        code: "1A",
        name: officialFormName("1A"),
        from: "The 2 Jul 2021 presentation",
        by: "Examining medical practitioner",
        when: "2 Jul 2021",
        status: "Filed",
      },
      {
        code: "REF",
        name: "Referral record, community to ward",
        from: "The 18 Feb 2025 presentation",
        by: "Community case coordinator",
        when: "18 Feb 2025",
        status: "Accepted",
      },
      {
        code: "CM",
        name: "Community allocation record, Peel Community Mental Health Team",
        from: "Community intake",
        by: "Community intake",
        when: "1 Dec 2021",
        status: "Active",
      },
      {
        code: "CM",
        name: "Community allocation record, Perth Metropolitan Community Mental Health Team",
        from: "Community intake",
        by: "Community intake",
        when: "closed 1 Dec 2021",
        status: "Closed",
      },
    ],
    documentsAbsent:
      "No transport booking is on file. No transport job exists for this movement yet, so there is nothing to file. A booking appears here the moment one is raised.",
  },

  "WF-004": {
    // T7 (seed-link plan, 25 Sept 2026): WF-004 now names its patient (PT-046), so this story says
    // only what the movement records: involuntary, accepted by Bentley, bed pulled, and no transport
    // job yet (its blocker is the escort provider organising secure transport). The earlier story's
    // arrival, fitness to travel, room number, CAD number, ETA and ambulance booking were invented.
    id: "WF-004",
    example: "Waiting on transport",
    exampleNote: "Accepted and the bed is pulled. Transport is the one thing left to book.",
    known: "",
    arrival: "",
    early: [
      {
        off: 24,
        what: "Legal status <b>involuntary inpatient</b>.",
      },
    ],
    late: [
      { off: 38, what: "Referred to <b>{{dest}}</b>.", st: 1 },
      { off: 62, what: "<b>{{dest}} accepted.</b>", tone: "good", st: 2 },
      { off: 110, what: "Bed pulled at <b>{{dest}}</b>.", tone: "good", st: 3, key: "pulled" },
    ],
    blockerQuote: "Escort provider organising secure transport",
    lastSeen: null,
    verdict: {
      tone: "warn",
      short: "Waiting on transport",
      title: "One thing is holding this movement up.",
      gates: [
        {
          label: "Transport",
          verdict: "Not booked",
          detail: "The escort provider is organising secure transport. No job is recorded yet.",
        },
      ],
    },
    reason: "No presentation history is recorded for this movement.",
    ring: [
      {
        who: BTY_ADULT_SECURE,
        role: "Holding the bed, pulled at {{pulled}}",
        note: "Expecting this person.",
        tone: null,
      },
      {
        who: "Transport",
        role: "No job booked yet",
        note: "The escort provider is organising secure transport.",
        tone: "warn",
      },
    ],
    ladder: "No escalation ladder is needed while the bed is held and transport is being organised.",
    next: [
      {
        w: "Record the transport booking when the escort provider confirms it",
        d: "The bed is pulled, so the booking is the only thing left.",
        tone: "warn",
      },
      {
        w: "Nothing else outstanding",
        d: `${BTY_ADULT_SECURE} is holding the bed.`,
        tone: null,
      },
    ],
    transport: [
      ["Provider", "No transport job exists yet"],
      ["Escort required", "Not recorded. No job to record it against"],
      ["From", SJGM_ED],
      ["To", BTY_ADULT_SECURE],
    ],
    transportNote:
      "A past presentation carries no retained transport record. The transport job belongs to the movement, which closes on arrival, so each earlier episode carries its arrival route in History instead.",
    transportBooked: false,
    presentations: [],
    presentationsAbsent:
      "One presentation on file, the one open now. Nothing earlier was recorded for this person. Absence here means no earlier presentation reached a ward or an emergency department referral record, not that this record is incomplete. A frequency strip needs more than one mark to show anything, so none is drawn.",
    community: {
      teams: [],
      absent:
        "Not with a community team. Ward Flow holds no allocation record for this person, current or closed. Absence here means no team is allocated, not that the record is incomplete.",
      followUp:
        "No community follow up is held. Ward Flow records allocation and discharge events it has been told about, and it has been told about none for this person.",
    },
    documents: [
      {
        // Derived from the live movement's own form at render time (`{{formname}}`/`{{formcode}}`),
        // never a hand-set "4A" — this record's screen is also shown for whichever code the live
        // WF-004 movement actually carries, and a fixed code here contradicted it (P1-2).
        code: "{{formcode}}",
        name: "{{formname}}, transport authority",
        from: "The presentation open now, Sat 15 Aug 2026",
        by: "Bed coordinator",
        when: "15 Aug 2026",
        status: "Runs to {{due}}",
      },
    ],
    documentsAbsent:
      "No legal form from an earlier presentation is on file. This record holds one presentation and it is the one open now, so the register begins there.",
  },
};

export function dur(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function clock(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}`;
}

export function fillTemplate(
  text: string,
  context: {
    due?: number | null;
    escalated?: number | null;
    handover?: number;
    pulled?: number | null;
    transport?: number | null;
    fit?: number | null;
    dest?: string;
    formname?: string;
    formcode?: string;
    declined?: Record<string, number>;
  },
): string {
  if (!text) return text;
  return text.replace(/\{\{([a-z]+)(?::([a-z0-9-]+))?\}\}/g, (_, key, arg) => {
    let at: number | null | undefined = null;
    if (key === "due") at = context.due;
    else if (key === "escalated") at = context.escalated;
    else if (key === "handover") at = context.handover ?? 14 * 60;
    else if (key === "pulled") at = context.pulled;
    else if (key === "transport") at = context.transport;
    else if (key === "fit") at = context.fit;
    else if (key === "declined" && arg && context.declined) at = context.declined[arg];
    else if (key === "dest") return context.dest ?? "";
    else if (key === "formname") return context.formname ?? "No legal form recorded";
    else if (key === "formcode") return context.formcode ?? "—";

    return at === null || at === undefined ? "no time recorded" : clock(at);
  });
}
