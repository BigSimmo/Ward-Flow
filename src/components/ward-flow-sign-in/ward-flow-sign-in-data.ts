// src/components/ward-flow-sign-in/ward-flow-sign-in-data.ts
/**
 * The role/action data this screen shows, ported verbatim (in content, not markup) from the
 * approved drawing (`design/third-edition-mockups/sign-in-third-edition.html`, lines 4757-4907) —
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
  /** One line for the v6 role list (7 Oct 2026); `sub` stays the full sentence. */
  brief: string;
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
    brief: "Runs the queue and places people",
    opens: "Command, the priority queue",
    scopeBadge: "Statewide",
    targetChip: "command-third-edition.html",
  },
  {
    id: "oncall",
    name: "Coordinator on call",
    the: "the coordinator on call",
    as: "coordinator on call",
    sub: "Holds the queue out of hours, and owns movements alongside the bed coordinator.",
    brief: "Holds the queue out of hours",
    opens: "Command, the priority queue",
    scopeBadge: "On call",
    targetChip: "on-call-third-edition.html",
  },
  {
    id: "ed",
    name: "ED liaison",
    the: "the ED liaison",
    as: "ED liaison",
    sub: "Raises referrals from an emergency department and records what is decided on them.",
    brief: "Raises referrals from an ED",
    opens: "Emergency departments",
    scopeBadge: "ED",
    targetChip: "patient-now-third-edition.html",
  },
  {
    id: "duty",
    name: "Duty consultant",
    the: "the duty consultant",
    as: "duty consultant",
    sub: "Triages the referrals waiting, oldest first.",
    brief: "Triages referrals, oldest first",
    opens: "Referrals",
    scopeBadge: "Triage",
    targetChip: "referrals-third-edition.html",
  },
  {
    id: "gov",
    name: "Governance lead",
    the: "the governance lead",
    as: "governance lead",
    sub: "Reviews every override recorded, and reads the period's figures.",
    brief: "Reviews every recorded override",
    opens: "Governance",
    scopeBadge: "Governance",
    targetChip: "governance-third-edition.html",
  },
  {
    id: "lead",
    name: "Service lead",
    the: "the service lead",
    as: "service lead",
    sub: "Reads the period's figures for the service, and reviews the overrides in it.",
    brief: "Reads the period figures",
    opens: "Statistics",
    scopeBadge: "Service",
    targetChip: "statistics-third-edition.html",
  },
  {
    id: "ward",
    name: "Ward",
    the: "the ward",
    as: "the ward",
    sub: "Answers what the ward can take, holds a bed on it, and records a decision on a move into it.",
    brief: "Answers asks and holds beds",
    opens: "Wards",
    scopeBadge: "Ward",
    targetChip: "ward-answer-third-edition.html",
  },
] as const;

export interface SignInAction {
  words: string;
  where: string;
  /** The screen the action sits on, named short for the v6 action list. */
  place: string;
  /** Shorter words for the one-line v6 list, when `words` would not fit; `words` stays the title. */
  short?: string;
  roles: readonly SignInRoleId[];
}

export const SIGN_IN_ACTIONS: readonly SignInAction[] = [
  {
    words: "Open the priority queue",
    where: "Command shows every open movement across the network, worst first, with what is wrong beside it.",
    place: "Command",
    roles: ["bed", "oncall"],
  },
  {
    words: "New referral",
    where: "The New referral control sits on every screen, and the New referral flow opens behind it.",
    place: "Every screen",
    roles: ["bed", "oncall", "ed"],
  },
  {
    words: "Record a decision on a movement",
    where: "The Movement screen carries every event, decline and decision on one person's move.",
    place: "Movement",
    roles: ["bed", "ed", "ward"],
  },
  {
    words: "Hold a bed",
    where: "The Capacity screen shows beds by site and by ward, what is held, and where the pressure is.",
    place: "Capacity",
    roles: ["bed", "ward"],
  },
  {
    words: "Ask a ward",
    where: "The Wards screen shows every ward in the network, what it takes, and how it has answered.",
    place: "Wards",
    roles: ["bed", "ward"],
  },
  {
    words: "Open an emergency department",
    where: "The Emergency departments screen shows each department's waiting, longest and breached.",
    place: "Emergency",
    roles: ["bed", "ed"],
  },
  {
    words: "Contact a community team",
    where: "The Community teams screen holds the teams by service, their catchments and what they send.",
    place: "Community",
    roles: ["bed"],
  },
  {
    words: "Find a person and open their movement",
    where: "Patient search is open to everyone signed in, and it states in words what it refuses to return.",
    place: "Search",
    roles: ["bed", "oncall", "ed", "duty", "gov", "lead", "ward"],
  },
  {
    words: "Triage a referral",
    where: "The Referrals screen holds every referral awaiting triage, oldest first, and the decision on each.",
    place: "Referrals",
    roles: ["duty"],
  },
  {
    words: "Sign off the handover",
    where: "The Handover screen is the record the incoming coordinator reads at the change of shift.",
    place: "Handover",
    roles: ["bed"],
  },
  {
    words: "Export a period's figures",
    where: "The Statistics screen shows waits, breaches and flows over a period, with stated scales.",
    place: "Statistics",
    roles: ["lead", "gov"],
  },
  {
    words: "Record a review of an override",
    where: "The Governance screen holds every override recorded, oldest first, and the review of each.",
    place: "Governance",
    roles: ["gov", "lead"],
  },
  {
    words: "Override a judgement about the patient, with a recorded reason",
    short: "Override a judgement, with a recorded reason",
    where: "A judgement about the patient is overridable by a named coordinator who records the reason.",
    place: "Movement",
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
  "New referral": "the bed coordinator, the coordinator on call, the ED liaison and a community team",
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

/**
 * The same names, short enough for one line beside the action in the v6 list ("Named for …"). The
 * full sentence above stays as the row's title and its screen-reader text.
 */
export const SIGN_IN_ACTION_NAMED_SHORT: Readonly<Record<string, string>> = {
  "Open the priority queue": "the bed coordinator and on call",
  "New referral": "coordinators, ED liaison, community",
  "Record a decision on a movement": "the bed coordinator, ED liaison, ward",
  "Hold a bed": "the bed coordinator and the ward",
  "Ask a ward": "the bed coordinator and the ward",
  "Open an emergency department": "the bed coordinator and ED liaison",
  "Contact a community team": "the bed coordinator and triage",
  "Find a person and open their movement": "everyone signed in",
  "Triage a referral": "the duty consultant and triage",
  "Sign off the handover": "the bed coordinator and incoming",
  "Export a period's figures": "the service lead and governance",
  "Record a review of an override": "the governance and service leads",
  "Override a judgement about the patient, with a recorded reason": "the bed coordinator and on call",
};

export interface SignInRefused {
  words: string;
  where: string;
  /** The short reason beside it in the v6 limits list. */
  brief: string;
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
    brief: "Facts stand as recorded",
  },
  {
    words: "Override a check nobody has classified",
    where: "A check nobody has classified is out of reach of every role, a coordinator included.",
    brief: "Out of reach of every role",
  },
  {
    words: "Read a risk score, an acuity score or a best match",
    where:
      "Search does not return a risk or acuity score or a best match. Search by name, identifier, department, ward or owner.",
    brief: "Search never returns one",
  },
  {
    words: "Draw a verdict about a person",
    where: "Ward Flow draws verdicts about wards, beds, checks and movements, and never about a person.",
    brief: "Verdicts are about beds and wards",
  },
] as const;

/**
 * What a reader must know before going in, one line each for the v6 limits list. The full
 * disclosure stays word for word in the screen's Details panel; these lines restate it, never
 * soften it.
 */
export const SIGN_IN_READ_FIRST: readonly SignInRefused[] = [
  { words: "Prototype, not for clinical use", where: "Not clinical decision support.", brief: "Not decision support" },
  {
    words: "Every figure here is invented",
    where: "The hospital sites and health services are real WA names.",
    brief: "WA sites are real names",
  },
  { words: "Ward Flow places nobody", where: "A coordinator decides every placement.", brief: "A coordinator decides" },
  {
    words: "Confirm against the ward record",
    where: "Check every figure against the ward's own record before anyone acts.",
    brief: "Before anyone acts",
  },
  {
    words: "No password field, by design",
    where: "Who you are is settled by the hospital's own sign on, outside Ward Flow.",
    brief: "Hospital sign on sits outside",
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
  /** Rostered hours as words, for the v6 shift row. */
  hours: string;
}

export const SHIFT_ROSTER_OPTIONS: readonly ShiftRosterOption[] = [
  {
    id: "Morning",
    label: "Morning Shift (07:00 - 15:30)",
    name: "Morning Shift (07:00 - 15:30)",
    hours: "07:00 to 15:30",
  },
  {
    id: "Afternoon",
    label: "Afternoon Shift (14:30 - 22:30)",
    name: "Afternoon Shift (14:30 - 22:30)",
    hours: "14:30 to 22:30",
  },
  { id: "Night", label: "Night Shift (22:00 - 07:30)", name: "Night Shift (22:00 - 07:30)", hours: "22:00 to 07:30" },
] as const;
