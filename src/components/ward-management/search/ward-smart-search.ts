/**
 * WARD SMART SEARCH ENGINE
 *
 * Unified multi-entity search engine for Ward Flow.
 * Matches across:
 * - Patients (via `findPatients` from `ward-patients.ts`)
 * - Movements (via `searchMovements` from `ward-derivations.ts`, filtered by `isOpen`)
 * - Wards (`allUnits` from `ward-sites.ts`) - name, siteCode, site name, ready bed count
 * - Emergency Departments (`allEmergencyDepartments` from `ward-sites.ts`) - name, siteCode
 * - Community Teams (`COMMUNITY_TEAM_PAGES` from `community/community-derivations.ts`) - name
 * - Legal Forms (`SELECTABLE_LEGAL_FORMS` from `ward-legal-forms.ts`) - code, official title via `legalFormName`
 * - Core Views/Tools (`CORE_SEARCH_VIEWS`) - navigation routes and tool pages
 * - Action Inbox Tasks (`buildActionInbox(movements.filter(isOpen), now ?? 0, units)`) - task summary, title, keyword "task"
 * - Queued referrals still awaiting an answer - the patient's name and UMRN, referral id, origin and region
 * - Near spellings of a name that found nobody (`nearPatients`), each shown with UMRN and date of birth
 * - Beds ("Graylands bed 4") and wards with a ready bed ("free beds"), from `search-places.ts`
 *
 * STANDARD §8.6 ENFORCEMENT:
 * - Unranked candidate discipline: within a group, a prefix or word-start match is listed before a
 *   match buried mid-word. There is no numeric score, and nothing is labelled a best match.
 * - Truthfulness: only genuine matches are returned; empty state makes no claims about reality.
 * - Zero LLM or external provider calls: purely local, deterministic TypeScript matching.
 */

import {
  buildActionInbox,
  destinationUnit,
  isOpen,
  searchMovements,
  stageCopy,
  unitCapacity,
  type InboxItem,
  type MovementSearchQuery,
} from "@/components/ward-management/ward-derivations";
import { SELECTABLE_LEGAL_FORMS, legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { EmergencyDepartment, LegalForm, Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { createPatientResolver, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import {
  findPatients,
  foldPatientSearchText,
  nearPatients,
  patientDisplayName,
  type Patient,
} from "@/components/ward-management/ward-patients";
import { isAwaitingAnswer, referralState } from "@/components/ward-management/ward-referrals";
import { allEmergencyDepartments, siteByCode, siteDirectory } from "@/components/ward-management/ward-sites";
import { COMMUNITY_TEAM_PAGES, type CommunityTeam } from "@/components/ward-management/community/community-derivations";
import { movementHref, teamHref, unitHref } from "../shell/ward-facade";
import { isReadyBedQuery, searchBeds, type BedSearchResult } from "./search-places";

export type CoreSearchView = {
  key: string;
  title: string;
  href: string;
  keywords?: string[];
  description?: string;
};

export const CORE_SEARCH_VIEWS: readonly CoreSearchView[] = [
  {
    key: "handover",
    title: "Handover",
    href: "/ward-flow/handover",
    keywords: ["handover", "shift", "shift handover", "nursing", "notes"],
    description: "Handover notes",
  },
  {
    key: "capacity",
    title: "Capacity",
    href: "/ward-flow/capacity",
    keywords: ["capacity", "bed map", "beds", "occupancy", "capacity bed map"],
    description: "Beds and occupancy",
  },
  {
    key: "delays",
    title: "Delays",
    href: "/ward-flow/delays",
    keywords: ["delays", "transfer delays", "past due", "wait"],
    description: "Transfer delays",
  },
  {
    key: "movements",
    title: "Movements",
    href: "/ward-flow/movements",
    keywords: ["movements", "horizon", "intake", "transfers"],
    description: "Open movements",
  },
  {
    key: "escalation",
    title: "Delays",
    href: "/ward-flow/escalation",
    keywords: ["escalation", "desk", "escalation desk", "priority", "alerts"],
    description: "Same as Delays",
  },
  {
    key: "statistics",
    title: "Statistics",
    href: "/ward-flow/statistics",
    keywords: ["statistics", "stats", "reports", "metrics", "system statistics"],
    description: "Figures for this demo",
  },
  {
    key: "on-call",
    title: "On-call",
    href: "/ward-flow/on-call",
    keywords: ["on-call", "on call", "oncall", "roster", "specialist", "doctors", "registrar", "consultant"],
    description: "Contacts — no roster in this prototype",
  },
  {
    key: "hub",
    title: "Places",
    href: "/ward-flow/hub",
    keywords: ["hub", "facilities", "facilities hub", "site overview"],
    description: "Wards, ED and teams",
  },
  {
    key: "settings",
    title: "Settings",
    href: "/ward-flow/settings",
    keywords: ["settings", "configuration", "preferences", "system settings"],
    description: "This browser",
  },
  {
    key: "legal-forms",
    title: "Forms",
    href: "/ward-flow/legal-forms",
    keywords: ["legal-forms", "legal forms", "forms", "mha", "mental health act", "mental health act forms"],
    description: "Recorded forms (demo)",
  },
  {
    key: "referrals",
    title: "Referrals",
    href: "/ward-flow/referrals",
    keywords: ["referrals", "intake", "board", "queue"],
    description: "Waiting for a bed",
  },
  {
    key: "community",
    title: "Community",
    href: "/ward-flow/community",
    keywords: ["community", "teams", "directory", "clinics"],
    description: "Community teams",
  },
];

type WardSearchResult = {
  unit: Unit;
  /** Null when the ward has not confirmed both its empty and allocatable figures. */
  readyBeds: number | null;
  siteName: string;
  href: string;
};

type EdSearchResult = {
  ed: EmergencyDepartment;
  href: string;
};

type CommunityTeamSearchResult = {
  team: CommunityTeam;
  href: string;
};

type LegalFormSearchResult = {
  form: LegalForm;
  title: string;
  href: string;
};

type ViewSearchResult = {
  view: CoreSearchView;
  href: string;
};

type TaskSearchResult = {
  task: InboxItem;
  href: string;
};

/**
 * Calculates ready bed count for a unit per Standard §8.6.
 * Ready beds = min(allocatable, empty). With either figure missing the count is not recorded
 * (null): until 25 Sept 2026 it fell back to `unit.beds`, calling every bed on the ward ready.
 * Calls `unitCapacity` (ruling R-B-09) — never a fifth inline copy of the Ready expression.
 */
export function unitReadyBedCount(unit: Unit): number | null {
  if (unit.allocatable && unit.empty) {
    return unitCapacity(unit, []).available;
  }
  return null;
}

/**
 * Matches wards by name, siteCode, unit id, or site name.
 */
function searchWards(query: string, units?: Unit[]): WardSearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const candidateUnits = units ?? [];
  const isWardKeyword = needle === "ward" || needle === "wards";
  // "free beds": every ward with a recorded ready bed, in the network's own order (search-places.ts).
  const readyOnly = isReadyBedQuery(needle);

  return candidateUnits
    .filter((unit) => {
      if (readyOnly) return (unitReadyBedCount(unit) ?? 0) > 0;
      if (isWardKeyword) return true;
      const site = siteByCode(unit.siteCode);
      const siteName = site?.name ?? "";
      return (
        unit.name.toLowerCase().includes(needle) ||
        unit.siteCode.toLowerCase().includes(needle) ||
        unit.id.toLowerCase().includes(needle) ||
        siteName.toLowerCase().includes(needle)
      );
    })
    .map((unit) => {
      const site = siteByCode(unit.siteCode);
      const siteName = site?.name ?? unit.siteCode;
      const readyBeds = unitReadyBedCount(unit);
      return {
        unit,
        readyBeds,
        siteName,
        href: unitHref(unit.id),
      };
    });
}

/**
 * Matches emergency departments by name or siteCode.
 */
function searchEmergencyDepartments(query: string, eds?: EmergencyDepartment[]): EdSearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const candidateEds = eds ?? allEmergencyDepartments();
  const isEdKeyword = needle === "ed" || needle === "emergency";
  const tokens = needle.split(/\s+/).filter(Boolean);

  return candidateEds
    .filter((ed) => {
      if (isEdKeyword) return true;
      const site = siteByCode(ed.siteCode);
      const siteName = site?.name ?? "";
      const haystack = `${ed.name} ${ed.siteCode} ${ed.id} ${siteName}`.toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    })
    .map((ed) => ({
      ed,
      href: `/ward-flow/ed/${ed.id}`,
    }));
}

/**
 * Matches community teams by name or slug id.
 */
function searchCommunityTeams(
  query: string,
  teams: readonly CommunityTeam[] = COMMUNITY_TEAM_PAGES,
): CommunityTeamSearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const isCommunityKeyword = needle === "community" || needle === "team" || needle === "teams";

  return teams
    .filter((team) => {
      if (isCommunityKeyword) return true;
      return team.name.toLowerCase().includes(needle) || team.id.toLowerCase().includes(needle);
    })
    .map((team) => ({
      team,
      href: teamHref(team.id),
    }));
}

/**
 * Matches legal forms by code (e.g. "1A", "3A", "Form 1A") or official register title.
 */
function searchLegalForms(
  query: string,
  forms: readonly LegalForm[] = SELECTABLE_LEGAL_FORMS,
): LegalFormSearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const strippedCode = needle.replace(/^form\s*/i, "").trim();
  const isFormKeyword =
    needle === "form" ||
    needle === "forms" ||
    needle === "legal" ||
    needle === "legal form" ||
    needle === "legal forms";

  return forms
    .filter((form) => {
      if (isFormKeyword) return true;
      const code = form.code.toLowerCase();
      const formTitle = legalFormName(form).toLowerCase();
      const bareFormCode = `form ${code}`;
      const compactFormCode = `form${code}`;

      return (
        code === needle ||
        code === strippedCode ||
        code.includes(needle) ||
        bareFormCode.includes(needle) ||
        compactFormCode.includes(needle) ||
        formTitle.includes(needle)
      );
    })
    .map((form) => ({
      form,
      title: legalFormName(form),
      href: "/ward-flow/legal-forms",
    }));
}

/**
 * Matches core views and navigation pages by title, key, keywords, or description.
 */
function searchCoreViews(query: string, views: readonly CoreSearchView[] = CORE_SEARCH_VIEWS): ViewSearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const isViewKeyword = needle === "view" || needle === "views" || needle === "tool" || needle === "tools";

  return views
    .filter((view) => {
      if (isViewKeyword) return true;
      return (
        view.key.toLowerCase().includes(needle) ||
        view.title.toLowerCase().includes(needle) ||
        (view.description && view.description.toLowerCase().includes(needle)) ||
        (view.keywords && view.keywords.some((k) => k.toLowerCase().includes(needle)))
      );
    })
    .map((view) => ({
      view,
      href: view.href,
    }));
}

/**
 * Matches action inbox tasks by summary/detail, title, id, or keyword "task".
 */
function searchTasks(query: string, tasks: readonly InboxItem[]): TaskSearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const isTaskKeyword = needle === "task" || needle === "tasks";

  return tasks
    .filter((task) => {
      if (isTaskKeyword) return true;
      return (
        task.title.toLowerCase().includes(needle) ||
        task.detail.toLowerCase().includes(needle) ||
        task.movementId.toLowerCase().includes(needle) ||
        task.id.toLowerCase().includes(needle) ||
        task.owner.toLowerCase().includes(needle)
      );
    })
    .map((task) => ({
      task,
      href: task.href ?? movementHref(task.movementId),
    }));
}

/**
 * What the typed query is asking for. A label for the dropdown, not a rank and not a score.
 *
 * Checked in this order: PT-/WF- identifier, form word or form code, mostly-digits identifier,
 * place word or site token, view word, task word, a name (letters, spaces, apostrophe, hyphen),
 * then general. A query that hits more than one keyword keeps the earlier category.
 */
export type SearchIntent = "person" | "identifier" | "place" | "form" | "view" | "task" | "general";

export type SearchIntentLabel = "People" | "Movements" | "Places" | "Forms" | "Views" | "Tasks" | "All";

const SEARCH_GROUP_ORDER = [
  "people",
  "similar",
  "movements",
  "referrals",
  "beds",
  "wards",
  "eds",
  "teams",
  "forms",
  "views",
  "tasks",
] as const;

export type SearchGroupKey = (typeof SEARCH_GROUP_ORDER)[number];

const SITE_NAME_NOISE = new Set([
  "hospital",
  "health",
  "service",
  "campus",
  "public",
  "general",
  "emergency",
  "department",
  "memorial",
  "royal",
  "children",
  "childrens",
  "john",
  "king",
  "edward",
  "saint",
]);

function mentionsKnownSite(query: string): boolean {
  const needle = query.trim().toLowerCase();
  const tokens = needle.split(/[^a-z0-9]+/).filter((token) => token.length >= 3);
  return siteDirectory.some((site) => {
    const code = site.code.toLowerCase();
    const name = site.name.toLowerCase();
    if (needle.length >= 3 && (code === needle || name.includes(needle))) return true;
    if (tokens.includes(code)) return true;
    const distinctive = name.split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !SITE_NAME_NOISE.has(word));
    return tokens.some((token) => distinctive.includes(token));
  });
}

function hasPlaceSignal(query: string): boolean {
  return /\b(?:wards?|ed|emergency|community|teams?)\b/i.test(query) || mentionsKnownSite(query);
}

export function detectSearchIntent(query: string): SearchIntent {
  const trimmed = query.trim();
  if (trimmed.length === 0) return "general";
  if (/^(?:pt|wf)-/i.test(trimmed)) return "identifier";
  if (/\b(?:forms?|legal)\b/i.test(trimmed) || /^\d{1,2}[a-z]?$/i.test(trimmed)) return "form";
  const alnum = trimmed.replace(/[^0-9a-z]/gi, "");
  const digits = alnum.replace(/\D/g, "").length;
  const letters = alnum.replace(/[^a-z]/gi, "").length;
  if (digits >= 3 && digits > letters) return "identifier";
  if (hasPlaceSignal(trimmed)) return "place";
  if (/\b(?:delays?|movements?|capacity|command|network|transport|horizon|governance)\b/i.test(trimmed)) {
    return "view";
  }
  if (/\btasks?\b/i.test(trimmed)) return "task";
  if (/^[\p{L}][\p{L}\s'’-]*$/u.test(trimmed)) return "person";
  return "general";
}

/** Dropdown label for a detected intent. Identifier follows the id: WF- is Movements, otherwise People. */
export function searchIntentLabel(intent: SearchIntent, query = ""): SearchIntentLabel {
  switch (intent) {
    case "person":
      return "People";
    case "identifier":
      return /^\s*wf-/i.test(query) ? "Movements" : "People";
    case "place":
      return "Places";
    case "form":
      return "Forms";
    case "view":
      return "Views";
    case "task":
      return "Tasks";
    default:
      return "All";
  }
}

/** Header palette group order. The matching intent's groups lead; everything else keeps the fixed order. */
export function searchGroupOrder(intent: SearchIntent, query: string): readonly SearchGroupKey[] {
  const front = leadingGroups(intent, query);
  return [...front, ...SEARCH_GROUP_ORDER.filter((key) => !front.includes(key))];
}

function leadingGroups(intent: SearchIntent, query: string): readonly SearchGroupKey[] {
  switch (intent) {
    case "person":
      return ["people", "similar"];
    case "identifier":
      return /^\s*wf-/i.test(query) ? ["movements", "people"] : ["people", "movements"];
    case "place":
      return ["beds", "wards", "eds", "teams"];
    case "form":
      return ["forms"];
    case "view":
      return ["views"];
    case "task":
      return ["tasks"];
    default:
      return [];
  }
}

/**
 * The searchable person text for each movement: display name and UMRN. L5 (site review, 12 Oct
 * 2026): "Wren" or his UMRN found Tobias Wren but not his open movement, because a movement linked
 * through its referral resolved to nobody (the referrals were not passed) and the UMRN was never
 * indexed. Every open movement is now findable by its patient's name and UMRN.
 */
function movementDisplayNames(
  movements: readonly Movement[],
  patients: readonly Patient[],
  referrals: readonly Referral[] = [],
): Record<string, string> {
  const resolve = createPatientResolver({ patients, movements, referrals });
  const names: Record<string, string> = {};
  for (const movement of movements) {
    const resolved = resolve(movement);
    if (!resolved.patient) continue;
    names[movement.id] = `${resolved.displayName} ${resolved.umrn}`;
  }
  return names;
}

type ReferralSearchResult = {
  referral: Referral;
  /** "Family, Given" through the resolver, or its honest not-recorded wording. */
  formalName: string;
  umrn: string;
};

/**
 * Queued referrals still waiting on an answer, found by the patient's name or UMRN as well as the
 * referral's own id, origin and region. The same "queued and awaiting an answer" rule
 * `searchPatients` keeps, so a referral the referrer withdrew or a ward accepted is never offered:
 * an accepted one has a movement, and is found as that movement.
 *
 * Until 19 October 2026 the header search left referrals out because a referral had no page of its
 * own. `referralBoardHref` now opens one referral on the board, so each row has a real destination.
 */
function searchReferrals(
  query: string,
  referrals: readonly Referral[],
  lookup: { patients: readonly Patient[]; movements: readonly Movement[]; referrals: readonly Referral[] },
): ReferralSearchResult[] {
  const needle = foldPatientSearchText(query);
  if (needle.length < 2) return [];
  return referrals.flatMap((referral) => {
    if (referralState(referral) !== "queued" || !referral.destinations.some(isAwaitingAnswer)) return [];
    const info = resolveSubjectPatient(referral, lookup);
    const words = foldPatientSearchText(
      [info.displayName, info.formalName, info.umrn, referral.id, referral.originSiteCode, referral.homeRegion].join(
        " ",
      ),
    );
    return words.includes(needle) ? [{ referral, formalName: info.formalName, umrn: info.umrn }] : [];
  });
}

/**
 * "Did you mean…?" for a name that found nobody. Every word of the query must be a prefix of, or
 * one keystroke from, one of the person's names, so "Jon Smth" offers Jon Smith and not every Jon.
 * A near spelling is never chosen for anyone: the caller lists each with UMRN and date of birth so
 * the right person is confirmed by a human, because a near miss is the classic wrong-patient error.
 */
function similarPeople(patients: readonly Patient[], query: string): Patient[] {
  const words = query
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 2);
  if (words.length === 0) return [];
  let candidates: Set<Patient> | undefined;
  for (const word of words) {
    const matches = new Set<Patient>([...nearPatients(patients, [word]), ...findPatients(patients, word)]);
    candidates = candidates ? new Set([...candidates].filter((patient) => matches.has(patient))) : matches;
    if (candidates.size === 0) return [];
  }
  return [...(candidates ?? [])];
}

/** 0 = prefix or word-start, 1 = buried in a word, 2 = no text hit (kept in the original order). */
function matchTier(fields: readonly (string | undefined)[], needle: string): number {
  const q = needle.trim().toLowerCase();
  if (q.length === 0) return 0;
  let tier = 2;
  for (const field of fields) {
    if (!field) continue;
    const hay = field.toLowerCase();
    if (hay.startsWith(q) || hay.split(/[^a-z0-9]+/).some((word) => word.startsWith(q))) return 0;
    if (tier > 1 && hay.includes(q)) tier = 1;
  }
  return tier;
}

function rankAndLimit<T>(
  items: readonly T[],
  needle: string,
  fieldsOf: (item: T) => readonly (string | undefined)[],
  limit: number,
): T[] {
  return items
    .map((item, index) => ({ item, index, tier: matchTier(fieldsOf(item), needle) }))
    .sort((left, right) => left.tier - right.tier || left.index - right.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}

export type SmartSearchInput = {
  query: string;
  patients: readonly Patient[];
  movements: Movement[];
  units: Unit[];
  /** Referrals, so a movement linked to its patient through a referral is found by name and UMRN. */
  referrals?: readonly Referral[];
  now?: number;
  limitPerGroup?: number;
  plannedAdmissions?: readonly import("@/components/ward-management/ward-admissions").PlannedAdmission[];
  precomputedTasks?: readonly InboxItem[];
};

export type SmartSearchResults = {
  people: Patient[];
  /** Near spellings, only when the name found nobody. Never merged into `people`. */
  similarPeople: Patient[];
  movements: Movement[];
  referrals: ReferralSearchResult[];
  beds: BedSearchResult[];
  /** True when `wards` answers "free beds": only wards with a recorded ready bed. */
  readyBedsOnly: boolean;
  wards: WardSearchResult[];
  emergencyDepartments: EdSearchResult[];
  communityTeams: CommunityTeamSearchResult[];
  legalForms: LegalFormSearchResult[];
  views: ViewSearchResult[];
  tasks: TaskSearchResult[];
  hasAny: boolean;
  totalCount: number;
  /** Group keys whose matching records exceed the returned per-group limit. */
  truncatedGroups: string[];
  intent: SearchIntent;
};

/**
 * Audit round 2 (S-33): every list prints a person as "Surname, Given". A query typed that way
 * (or ending in a comma) reads as "Given Surname", which is how the name is matched. A query with a
 * digit in it (a UMRN, a date) is left alone.
 */
export function normaliseCommaNameQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed.includes(",") || /\d/.test(trimmed)) return trimmed;
  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
  return parts.join(" ");
}

/**
 * Words the inbox titles are written in ("Bed pull expired", "Transport awaiting departure", ...).
 * A query that is the start of one of them can match a task title, whatever intent it was given:
 * "bed" reads as a name and "transport" as a view, and deriving no tasks for either hid the real
 * action from every search surface (PR #285 review). Names are not caught by this: only a typed
 * prefix of one of these words, at least three letters long, opens the gate.
 */
const TASK_TITLE_WORDS = [
  "accepted",
  "arrival",
  "bed",
  "declined",
  "departure",
  "destination",
  "destinations",
  "expired",
  "legal",
  "planned",
  "pull",
  "transport",
] as const;

function queryStartsATaskTitleWord(typed: string): boolean {
  return typed
    .toLowerCase()
    .split(/[^a-z]+/)
    .some((token) => token.length >= 3 && TASK_TITLE_WORDS.some((word) => word.startsWith(token)));
}

/** Determines whether a query has potential task intent requiring inbox action derivation. */
export function shouldDeriveSearchTasks(query: string): boolean {
  const trimmed = normaliseCommaNameQuery(query);
  const typed = query.trim();
  if (typed.length === 0) return false;
  const intent = detectSearchIntent(trimmed);
  return (
    intent === "task" ||
    intent === "general" ||
    intent === "identifier" ||
    /\b(tasks?|actions?|inbox|pending|overdue)\b/i.test(typed) ||
    queryStartsATaskTitleWord(typed)
  );
}

/**
 * Unified multi-entity search runner.
 * Prefix and word-start matches lead each group. No score, no provider calls.
 */
export function searchWardFlow(input: SmartSearchInput): SmartSearchResults {
  // The "Surname, Given" rewrite is for matching people (and movements by their name) only; places,
  // forms, views and tasks keep the query as typed, so "Ward A, Bed" is not read as "Bed Ward A".
  const trimmed = normaliseCommaNameQuery(input.query);
  const typed = input.query.trim();
  const intent = detectSearchIntent(trimmed);
  if (trimmed.length === 0) {
    return {
      people: [],
      similarPeople: [],
      movements: [],
      referrals: [],
      beds: [],
      readyBedsOnly: false,
      wards: [],
      emergencyDepartments: [],
      communityTeams: [],
      legalForms: [],
      views: [],
      tasks: [],
      hasAny: false,
      totalCount: 0,
      truncatedGroups: [],
      intent,
    };
  }

  const limit = input.limitPerGroup ?? 6;
  const truncatedGroups: string[] = [];
  function rankGroup<T>(
    key: string,
    items: readonly T[],
    needle: string,
    fieldsOf: (item: T) => readonly (string | undefined)[],
  ): T[] {
    if (items.length > limit) truncatedGroups.push(key);
    return rankAndLimit(items, needle, fieldsOf, limit);
  }
  const names = movementDisplayNames(input.movements, input.patients, input.referrals);

  const people = rankGroup("people", findPatients(input.patients, trimmed), trimmed, (patient) => [
    patientDisplayName(patient),
    patient.givenName,
    patient.familyName,
    patient.umrn,
    patient.id,
  ]);

  const movementQuery: MovementSearchQuery = { text: trimmed, patientDisplayNames: names };
  const movements = rankGroup(
    "movements",
    searchMovements(input.movements, input.units, movementQuery),
    trimmed,
    (movement) => {
      const destination = destinationUnit(movement, input.units);
      return [
        names[movement.id],
        movement.id,
        movement.originEdId,
        destination?.id,
        destination?.name,
        stageCopy[movement.stage].label,
        movement.owner,
      ];
    },
  );

  const referrals = rankGroup(
    "referrals",
    searchReferrals(trimmed, input.referrals ?? [], {
      patients: input.patients,
      movements: input.movements,
      referrals: input.referrals ?? [],
    }),
    trimmed,
    (result) => [result.formalName, result.umrn, result.referral.id],
  );
  const readyBedsOnly = isReadyBedQuery(typed);
  const allBeds = searchBeds(typed, input.units);
  if (allBeds.length > limit) truncatedGroups.push("beds");
  const beds = allBeds.slice(0, limit);
  const wards = rankGroup("wards", searchWards(typed, input.units), typed, (ward) => [
    ward.unit.name,
    ward.unit.siteCode,
    ward.unit.id,
    ward.siteName,
  ]);
  const emergencyDepartments = rankGroup("eds", searchEmergencyDepartments(typed), typed, (department) => [
    department.ed.name,
    department.ed.siteCode,
    department.ed.id,
  ]);
  const communityTeams = rankGroup("teams", searchCommunityTeams(typed), typed, (team) => [
    team.team.name,
    team.team.id,
  ]);
  const legalForms = rankGroup("forms", searchLegalForms(typed), typed, (form) => [
    form.form.code,
    form.title,
    `Form ${form.form.code}`,
  ]);
  const views = rankGroup("views", searchCoreViews(typed), typed, (view) => [
    view.view.title,
    view.view.key,
    view.view.description,
    ...(view.view.keywords ?? []),
  ]);

  const shouldDeriveTasks = shouldDeriveSearchTasks(input.query);

  const tasksInbox = shouldDeriveTasks
    ? (input.precomputedTasks ??
      buildActionInbox(
        input.movements.filter(isOpen),
        input.now ?? 0,
        input.units,
        input.plannedAdmissions ? { plannedAdmissions: input.plannedAdmissions } : undefined,
      ))
    : [];
  const tasks = shouldDeriveTasks
    ? rankGroup("tasks", searchTasks(typed, tasksInbox), typed, (task) => [
        task.task.title,
        task.task.detail,
        task.task.movementId,
        task.task.owner,
      ])
    : [];

  // Near spellings only for a name-shaped query that found nobody and nothing else of the person's.
  const similar =
    intent === "person" &&
    !readyBedsOnly &&
    people.length === 0 &&
    movements.length === 0 &&
    referrals.length === 0 &&
    trimmed.length >= 3
      ? rankGroup("similar", similarPeople(input.patients, trimmed), trimmed, (patient) => [
          patient.familyName,
          patient.givenName,
        ])
      : [];
  const totalCount =
    people.length +
    similar.length +
    movements.length +
    referrals.length +
    beds.length +
    wards.length +
    emergencyDepartments.length +
    communityTeams.length +
    legalForms.length +
    views.length +
    tasks.length;

  return {
    people,
    similarPeople: similar,
    movements,
    referrals,
    beds,
    readyBedsOnly,
    wards,
    emergencyDepartments,
    communityTeams,
    legalForms,
    views,
    tasks,
    hasAny: totalCount > 0,
    totalCount,
    truncatedGroups,
    intent,
  };
}
