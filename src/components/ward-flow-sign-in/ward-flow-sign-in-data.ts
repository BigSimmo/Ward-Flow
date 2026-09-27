// src/components/ward-flow-sign-in/ward-flow-sign-in-data.ts
/**
 * The role/action data this screen shows, ported verbatim (in content, not markup) from the
 * approved drawing (`docs/ward-flow/mockups/sign-in-third-edition.html`, lines 4757-4907) —
 * seven roles, thirteen actions, who the screens index names for each action, and the four
 * things refused to every role regardless of which is chosen.
 *
 * This module deliberately reads no live application state. Per contract
 * `docs/ward-flow/build-contracts-2026-09-12/contract-sign-in.md` §2, none of these seven role
 * ids match the app's real `WardFlowRole`/`WardChromeRole` types one-for-one, and the reach named
 * below is "read from the screens index of the Ward Flow design system, which is a drawing of a
 * tool" (the drawing's own §1 disclosure, reproduced in this screen's copy). Treating this table
 * as if it were a live permissions grant would misstate what the running application enforces —
 * see this screen's own top-level comment for the honesty boundary that follows from that.
 */

export type SignInRoleId = "bed" | "oncall" | "ed" | "duty" | "gov" | "lead" | "ward";

export interface SignInRole {
  id: SignInRoleId;
  name: string;
  /** "the bed coordinator" — used mid-sentence ("What the bed coordinator can do"). */
  the: string;
  /** "bed coordinator" — used after "Sign in as". */
  as: string;
  sub: string;
  /** The screen this role's "Sign in" would open, named in prose only — see the screen's own
   *  comment on why this control stays inert rather than becoming a real destination. */
  opens: string;
  scopeBadge: string;
  targetChip: string;
}

export const SIGN_IN_ROLES: readonly SignInRole[] = [
  {
    id: "bed",
    name: "Bed coordinator",
    the: "the bed coordinator",
    as: "bed coordinator",
    sub: "Runs the priority queue and places people across the network.",
    opens: "Command, the priority queue",
    scopeBadge: "Statewide Command",
    targetChip: "command-third-edition.html",
  },
  {
    id: "oncall",
    name: "Coordinator on call",
    the: "the coordinator on call",
    as: "coordinator on call",
    sub: "Holds the queue out of hours, and owns movements alongside the bed coordinator.",
    opens: "Command, the priority queue",
    scopeBadge: "Specialist On-Call",
    targetChip: "on-call-third-edition.html",
  },
  {
    id: "ed",
    name: "ED liaison",
    the: "the ED liaison",
    as: "ED liaison",
    sub: "Raises referrals from an emergency department and records what is decided on them.",
    opens: "Emergency departments",
    scopeBadge: "Emergency Liaison",
    targetChip: "patient-now-third-edition.html",
  },
  {
    id: "duty",
    name: "Duty consultant",
    the: "the duty consultant",
    as: "duty consultant",
    sub: "Triages the referrals waiting, oldest first.",
    opens: "Referrals",
    scopeBadge: "Specialist Triage",
    targetChip: "referrals-third-edition.html",
  },
  {
    id: "gov",
    name: "Governance lead",
    the: "the governance lead",
    as: "governance lead",
    sub: "Reviews every override recorded, and reads the period's figures.",
    opens: "Governance",
    scopeBadge: "Clinical Governance",
    targetChip: "governance-third-edition.html",
  },
  {
    id: "lead",
    name: "Service lead",
    the: "the service lead",
    as: "service lead",
    sub: "Reads the period's figures for the service, and reviews the overrides in it.",
    opens: "Statistics",
    scopeBadge: "Service Leadership",
    targetChip: "statistics-third-edition.html",
  },
  {
    id: "ward",
    name: "Ward",
    the: "the ward",
    as: "the ward",
    sub: "Answers what the ward can take, holds a bed on it, and records a decision on a move into it.",
    opens: "Wards",
    scopeBadge: "Inpatient Ward",
    targetChip: "ward-answer-third-edition.html",
  },
] as const;

export interface SignInAction {
  words: string;
  where: string;
  roles: readonly SignInRoleId[];
}

export const SIGN_IN_ACTIONS: readonly SignInAction[] = [
  {
    words: "Open the priority queue",
    where: "Command shows every open movement across the network, worst first, with what is wrong beside it.",
    roles: ["bed", "oncall"],
  },
  {
    words: "Raise a referral",
    where: "The New referral control sits on every screen, and the Raise a referral flow opens behind it.",
    roles: ["bed", "oncall", "ed"],
  },
  {
    words: "Record a decision on a movement",
    where: "The Movement screen carries every event, decline and decision on one person's move.",
    roles: ["bed", "ed", "ward"],
  },
  {
    words: "Hold a bed",
    where: "The Capacity screen shows beds by site and by ward, what is held, and where the pressure is.",
    roles: ["bed", "ward"],
  },
  {
    words: "Ask a ward",
    where: "The Wards screen shows every ward in the network, what it takes, and how it has answered.",
    roles: ["bed", "ward"],
  },
  {
    words: "Open an emergency department",
    where: "The Emergency departments screen shows each department's waiting, longest and breached.",
    roles: ["bed", "ed"],
  },
  {
    words: "Contact a community team",
    where: "The Community teams screen holds the teams by service, their catchments and what they send.",
    roles: ["bed"],
  },
  {
    words: "Find a person and open their movement",
    where: "Patient search is open to everyone signed in, and it states in words what it refuses to return.",
    roles: ["bed", "oncall", "ed", "duty", "gov", "lead", "ward"],
  },
  {
    words: "Triage a referral",
    where: "The Referrals screen holds every referral awaiting triage, oldest first, and the decision on each.",
    roles: ["duty"],
  },
  {
    words: "Sign off the handover",
    where: "The Handover screen is the record the incoming coordinator reads at the change of shift.",
    roles: ["bed"],
  },
  {
    words: "Export a period's figures",
    where: "The Statistics screen shows waits, breaches and flows over a period, with stated scales.",
    roles: ["lead", "gov"],
  },
  {
    words: "Record a review of an override",
    where: "The Governance screen holds every override recorded, oldest first, and the review of each.",
    roles: ["gov", "lead"],
  },
  {
    words: "Override a judgement about the patient, with a recorded reason",
    where: "A judgement about the patient is overridable by a named coordinator who records the reason.",
    roles: ["bed", "oncall"],
  },
] as const;

/**
 * Who the screens index names for each action. A row a role cannot reach says this, so the reader
 * is told who does hold it rather than only that they do not. Four of the names here are roles
 * this screen does not offer (triage, the incoming coordinator, and community team appear only in
 * prose), and they are kept rather than dropped, matching the drawing exactly.
 */
export const SIGN_IN_ACTION_NAMED: Readonly<Record<string, string>> = {
  "Open the priority queue": "the bed coordinator and the coordinator on call",
  "Raise a referral": "the bed coordinator, the coordinator on call, the ED liaison and a community team",
  "Record a decision on a movement": "the bed coordinator, the ED liaison and the ward",
  "Hold a bed": "the bed coordinator and the ward",
  "Ask a ward": "the bed coordinator and the ward",
  "Open an emergency department": "the bed coordinator and the ED liaison",
  "Contact a community team": "the bed coordinator and triage",
  "Find a person and open their movement": "everyone signed in",
  "Triage a referral": "the duty consultant and triage",
  "Sign off the handover": "the bed coordinator and the incoming coordinator",
  "Export a period's figures": "the service lead and governance",
  "Record a review of an override": "the governance lead and the service lead",
  "Override a judgement about the patient, with a recorded reason": "the bed coordinator and the coordinator on call",
};

export interface SignInRefused {
  words: string;
  where: string;
}

/**
 * Refused to every role, from the standard's rules about persons and about search. These are
 * properties of Ward Flow itself, so no choice of role changes any of them.
 */
export const SIGN_IN_REFUSED: readonly SignInRefused[] = [
  {
    words: "Overturn a fact about the world",
    where:
      "A fact about the world stands as it is recorded. A judgement about the patient is the one kind of check a coordinator can override, and only with a recorded reason.",
  },
  {
    words: "Override a check nobody has classified",
    where: "A check nobody has classified is out of reach of every role, a coordinator included.",
  },
  {
    words: "Read a risk score, an acuity score or a best match",
    where:
      "Search does not return a risk or acuity score or a best match. Search by name, identifier, department, ward or owner.",
  },
  {
    words: "Draw a verdict about a person",
    where: "Ward Flow draws verdicts about wards, beds, checks and movements, and never about a person.",
  },
] as const;

export function roleById(id: SignInRoleId): SignInRole {
  return SIGN_IN_ROLES.find((role) => role.id === id) ?? SIGN_IN_ROLES[0];
}

export function actionsForRole(id: SignInRoleId): SignInAction[] {
  return SIGN_IN_ACTIONS.filter((action) => action.roles.includes(id));
}

export function actionsNotForRole(id: SignInRoleId): SignInAction[] {
  return SIGN_IN_ACTIONS.filter((action) => !action.roles.includes(id));
}

export type ThirdEditionRoleId = "coordinator" | "ed" | "ward" | "community" | "consultant" | "governance";

export interface ThirdEditionRole {
  id: ThirdEditionRoleId;
  scopeBadge: string;
  title: string;
  desc: string;
  targetChip: string;
  can: readonly string[];
  cannot: readonly string[];
}

export const THIRD_EDITION_ROLES: readonly ThirdEditionRole[] = [
  {
    id: "coordinator",
    scopeBadge: "Statewide Command",
    title: "State Bed Flow Coordinator",
    desc: "Statewide demand and capacity oversight, allocation triage, and priority trajectory across all 23 acute units.",
    targetChip: "command-third-edition.html",
    can: [
      "Statewide visibility across all 23 adult, older adult, and forensic mental health units",
      "Allocate acute bed placements across metropolitan and country health service boundaries",
      "Declare network bed reservation holds and coordinate system capacity actions",
      "Direct clinical escalation bridge to Executive Director on Call",
    ],
    cannot: [
      "Direct clinical examination or discharge of individual ward inpatients",
      "Single-handed override of statutory Mental Health Act 2014 legal orders",
      "Direct modification of local ward nursing staffing rosters",
    ],
  },
  {
    id: "ed",
    scopeBadge: "Emergency Liaison",
    title: "ED Mental Health Liaison Nurse",
    desc: "Emergency department acute assessment, patient registration, Form 1A verification, and referral triage.",
    targetChip: "patient-now-third-edition.html",
    can: [
      "Intake registration of acute emergency department mental health presentations",
      "Statutory Form 1A verification and examination clock tracking",
      "Dispatch referral placement requests to up to 3 candidate catchment wards",
      "Record emergency department clinical updates and boarding delay reasons",
    ],
    cannot: [
      "Finalize admission bed allocations without receiving ward NUM acceptance",
      "Declare network-wide bed reservation holds outside emergency transit",
      "Authorize involuntary treatment orders under Mental Health Act 2014",
    ],
  },
  {
    id: "ward",
    scopeBadge: "Inpatient Ward",
    title: "Acute Inpatient NUM / Shift Lead",
    desc: "Unit bed availability, referral acceptance, bed reservation holds, census management, and departure planning.",
    targetChip: "ward-answer-third-edition.html",
    can: [
      "Record bed answers (Accept, Decline with clinical reason code, or Bed Hold)",
      "Manage ward census, expected departures, and staffing specialling ratios",
      "Log departure barriers and coordinate transport readiness",
      "Reserve designated beds for incoming accepted transfers",
    ],
    cannot: [
      "Force placement into another hospital or out-of-catchment facility",
      "Modify regional emergency department intake priorities",
      "Edit clinical governance audit logs or systemic review flags",
    ],
  },
  {
    id: "community",
    scopeBadge: "Ambulatory Team",
    title: "Community Mental Health Clinician",
    desc: "Urgent post-discharge follow-up, step-down coordination, crisis diversion, and community contact logs.",
    targetChip: "community-team-third-edition.html",
    /*
     * ⚠️ `targetRoute` IS DELIBERATELY NOT HERE, AND THE BRANCH THAT ADDED IT WAS NOT WRONG.
     * `claude/ward-outstanding-20260918` gave every role a target route and declared the field on
     * `ThirdEditionRole`. The merge on 2026-09-19 brought ONE of those seven lines through, because
     * only the community role's hunk conflicted while the other six auto-merged to this side —
     * which never had the field at all. A seventh of a feature compiles on nobody's terms.
     *
     * 🔴 Completing it from the branch was tried and made it worse (four more type errors):
     * this file has been restructured since the branch was cut, the field was removed from this
     * side deliberately, and nothing anywhere reads `targetRoute`. Grafting a stale feature into a
     * file somebody is mid-restructure on is the wrong move even when the feature was good.
     *
     * So the field is dropped and the loss is recorded rather than silent. The branch's own reason
     * for its community value is worth keeping whoever re-adds it: the community front door is the
     * team INDEX, never one hardcoded team, because a concrete instance href would contradict
     * `WARD_DYNAMIC_ROUTE_ORPHANS`'s "0 of 64 instances reachable without state" in
     * `tests/ward-nav.test.ts` — and that figure went 0 → 1 once before, from exactly this file.
     */
    can: [
      "Coordinate urgent post-discharge community follow-up and 7-day contact checks",
      "Review step-down placement referrals from acute inpatient units",
      "Flag community crisis team support to divert avoidable emergency presentations",
      "Record community clinical contact logs and shared management plans",
    ],
    cannot: [
      "Directly hold acute inpatient psychiatric beds without coordinator agreement",
      "Overrule emergency department involuntary detention orders",
      "Access statewide command transport dispatch controls",
    ],
  },
  {
    id: "consultant",
    scopeBadge: "Specialist On-Call",
    title: "On-Call Consultant Psychiatrist",
    desc: "Statutory Mental Health Act 2014 Form 3B orders, clinical exception reviews, HDU placements, and telehealth consults.",
    targetChip: "on-call-third-edition.html",
    can: [
      "Execute statutory Mental Health Act 2014 Form 3B involuntary inpatient treatment orders",
      "Review and endorse clinical exception placements for high-dependency units",
      "Conduct emergency telehealth consults for regional WACHS emergency departments",
      "Tier 2 clinical escalation and clinical safety risk determinations",
    ],
    cannot: [
      "Operational bed cleaning or physical ward bed occupancy assignments",
      "Authorize vehicle routing or fleet dispatch for transport services",
      "Directly edit nursing staffing rosters or shift allocations",
    ],
  },
  {
    id: "governance",
    scopeBadge: "Clinical Governance",
    title: "Clinical Governance & Review Officer",
    desc: "Audit trail inspection, catchment override reviews, clinical threshold breaches, and statutory compliance manifests.",
    targetChip: "governance-third-edition.html",
    can: [
      "Inspect complete immutable audit trail of all placements, declines, and overrides",
      "Audit clinical threshold breaches, long delays, and out-of-catchment justifications",
      "Review statutory compliance with Mental Health Act 2014 documentation",
      "Generate clinical governance safety reports and risk manifests",
    ],
    cannot: [
      "Modify active bed reservations or alter clinical queues",
      "Authorize patient movement or order patient transport vehicles",
      "Decline or cancel medical admissions or referrals",
    ],
  },
] as const;

export type CatchmentId = "NMHS" | "SMHS" | "EMHS" | "WACHS" | "Statewide";

export interface CatchmentOption {
  id: CatchmentId;
  label: string;
  name: string;
  svcClass?: string;
}

export const CATCHMENT_OPTIONS: readonly CatchmentOption[] = [
  {
    id: "NMHS",
    label: "North Metropolitan (NMHS)",
    name: "North Metropolitan Health Service (NMHS)",
    svcClass: "svcNorth",
  },
  {
    id: "SMHS",
    label: "South Metropolitan (SMHS)",
    name: "South Metropolitan Health Service (SMHS)",
    svcClass: "svcSouth",
  },
  { id: "EMHS", label: "East Metropolitan (EMHS)", name: "East Metropolitan Health Service (EMHS)" },
  { id: "WACHS", label: "Country Health (WACHS)", name: "WA Country Health Service (WACHS)", svcClass: "svcWachs" },
  { id: "Statewide", label: "Statewide Directorate", name: "Statewide Directorate" },
] as const;

export type ShiftRosterId = "Morning" | "Afternoon" | "Night";

export interface ShiftRosterOption {
  id: ShiftRosterId;
  label: string;
  name: string;
}

export const SHIFT_ROSTER_OPTIONS: readonly ShiftRosterOption[] = [
  { id: "Morning", label: "Morning Shift (07:00 - 15:30)", name: "Morning Shift (07:00 - 15:30)" },
  { id: "Afternoon", label: "Afternoon Shift (14:30 - 22:30)", name: "Afternoon Shift (14:30 - 22:30)" },
  { id: "Night", label: "Night Shift (22:00 - 07:30)", name: "Night Shift (22:00 - 07:30)" },
] as const;
