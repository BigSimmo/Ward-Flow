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
 * - Action Inbox Tasks (`buildActionInbox(movements.filter(isOpen), now ?? NOW_ANCHOR, units)`) - task summary, title, keyword "task"
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
  type InboxItem,
  type MovementSearchQuery,
} from "@/components/ward-management/ward-derivations";
import { SELECTABLE_LEGAL_FORMS, legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { EmergencyDepartment, LegalForm, Movement, Unit } from "@/components/ward-management/ward-model";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { findPatients, patientDisplayName, type Patient } from "@/components/ward-management/ward-patients";
import { allEmergencyDepartments, siteByCode, wardSites } from "@/components/ward-management/ward-sites";
import { COMMUNITY_TEAM_PAGES, type CommunityTeam } from "@/components/ward-management/community/community-derivations";
import { teamHref, unitHref } from "../shell/ward-facade";

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
    href: "/mockups/ward-flow/handover",
    keywords: ["handover", "shift", "shift handover", "nursing", "notes"],
    description: "Handover notes",
  },
  {
    key: "capacity",
    title: "Capacity",
    href: "/mockups/ward-flow/capacity",
    keywords: ["capacity", "bed map", "beds", "occupancy", "capacity bed map"],
    description: "Beds and occupancy",
  },
  {
    key: "delays",
    title: "Delays",
    href: "/mockups/ward-flow/delays",
    keywords: ["delays", "transfer delays", "past due", "wait"],
    description: "Transfer delays",
  },
  {
    key: "movements",
    title: "Movements",
    href: "/mockups/ward-flow/movements",
    keywords: ["movements", "horizon", "intake", "transfers"],
    description: "Open movements",
  },
  {
    key: "escalation",
    title: "Delays",
    href: "/mockups/ward-flow/escalation",
    keywords: ["escalation", "desk", "escalation desk", "priority", "alerts"],
    description: "Same as Delays",
  },
  {
    key: "statistics",
    title: "Statistics",
    href: "/mockups/ward-flow/statistics",
    keywords: ["statistics", "stats", "reports", "metrics", "system statistics"],
    description: "Figures for this demo",
  },
  {
    key: "on-call",
    title: "On-call",
    href: "/mockups/ward-flow/on-call",
    keywords: ["on-call", "roster", "specialist", "doctors"],
    description: "Contacts — no roster in this prototype",
  },
  {
    key: "hub",
    title: "Places",
    href: "/mockups/ward-flow/hub",
    keywords: ["hub", "facilities", "facilities hub", "site overview"],
    description: "Wards, ED and teams",
  },
  {
    key: "settings",
    title: "Settings",
    href: "/mockups/ward-flow/settings",
    keywords: ["settings", "configuration", "preferences", "system settings"],
    description: "This browser",
  },
  {
    key: "legal-forms",
    title: "Legal forms",
    href: "/mockups/ward-flow/legal-forms",
    keywords: ["legal-forms", "legal forms", "forms", "mha", "mental health act", "mental health act forms"],
    description: "Recorded forms (demo)",
  },
  {
    key: "referrals",
    title: "Referrals",
    href: "/mockups/ward-flow/referrals",
    keywords: ["referrals", "intake", "board", "queue"],
    description: "Waiting for a bed",
  },
  {
    key: "community",
    title: "Community",
    href: "/mockups/ward-flow/community",
    keywords: ["community", "teams", "directory", "clinics"],
    description: "Community teams",
  },
];

export type WardSearchResult = {
  unit: Unit;
  /** Null when the ward has not confirmed both its empty and allocatable figures. */
  readyBeds: number | null;
  siteName: string;
  href: string;
};

export type EdSearchResult = {
  ed: EmergencyDepartment;
  href: string;
};

export type CommunityTeamSearchResult = {
  team: CommunityTeam;
  href: string;
};

export type LegalFormSearchResult = {
  form: LegalForm;
  title: string;
  href: string;
};

export type ViewSearchResult = {
  view: CoreSearchView;
  href: string;
};

export type TaskSearchResult = {
  task: InboxItem;
  href: string;
};

/**
 * Calculates ready bed count for a unit per Standard §8.6.
 * Ready beds = min(allocatable, empty). With either figure missing the count is not recorded
 * (null): until 25 Sept 2026 it fell back to `unit.beds`, calling every bed on the ward ready.
 */
export function unitReadyBedCount(unit: Unit): number | null {
  if (unit.allocatable && unit.empty) {
    return Math.min(unit.allocatable.value, unit.empty.value);
  }
  return null;
}

/**
 * Matches wards by name, siteCode, unit id, or site name.
 */
export function searchWards(query: string, units?: Unit[]): WardSearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const candidateUnits = units ?? [];
  const isWardKeyword = needle === "ward" || needle === "wards";

  return candidateUnits
    .filter((unit) => {
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
export function searchEmergencyDepartments(query: string, eds?: EmergencyDepartment[]): EdSearchResult[] {
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
      href: `/mockups/ward-flow/ed/${ed.id}`,
    }));
}

/**
 * Matches community teams by name or slug id.
 */
export function searchCommunityTeams(
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
export function searchLegalForms(
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
      href: "/mockups/ward-flow/legal-forms",
    }));
}

/**
 * Matches core views and navigation pages by title, key, keywords, or description.
 */
export function searchCoreViews(
  query: string,
  views: readonly CoreSearchView[] = CORE_SEARCH_VIEWS,
): ViewSearchResult[] {
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
export function searchTasks(query: string, tasks: InboxItem[]): TaskSearchResult[] {
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
      href: task.href ?? `/mockups/ward-flow/movements/${task.movementId}`,
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

export const SEARCH_GROUP_ORDER = ["people", "movements", "wards", "eds", "teams", "forms", "views", "tasks"] as const;

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
  return wardSites.some((site) => {
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
      return ["people"];
    case "identifier":
      return /^\s*wf-/i.test(query) ? ["movements", "people"] : ["people", "movements"];
    case "place":
      return ["wards", "eds", "teams"];
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

function movementDisplayNames(movements: readonly Movement[], patients: readonly Patient[]): Record<string, string> {
  const resolve = createPatientResolver({ patients, movements });
  const names: Record<string, string> = {};
  for (const movement of movements) {
    const resolved = resolve(movement);
    if (!resolved.patient) continue;
    names[movement.id] = resolved.displayName;
  }
  return names;
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
  now?: number;
  limitPerGroup?: number;
  plannedAdmissions?: Parameters<typeof buildActionInbox>[3];
};

export type SmartSearchResults = {
  people: Patient[];
  movements: Movement[];
  wards: WardSearchResult[];
  emergencyDepartments: EdSearchResult[];
  communityTeams: CommunityTeamSearchResult[];
  legalForms: LegalFormSearchResult[];
  views: ViewSearchResult[];
  tasks: TaskSearchResult[];
  hasAny: boolean;
  totalCount: number;
  intent: SearchIntent;
};

/**
 * Unified multi-entity search runner.
 * Prefix and word-start matches lead each group. No score, no provider calls.
 */
export function searchWardFlow(input: SmartSearchInput): SmartSearchResults {
  const trimmed = input.query.trim();
  const intent = detectSearchIntent(trimmed);
  if (trimmed.length === 0) {
    return {
      people: [],
      movements: [],
      wards: [],
      emergencyDepartments: [],
      communityTeams: [],
      legalForms: [],
      views: [],
      tasks: [],
      hasAny: false,
      totalCount: 0,
      intent,
    };
  }

  const limit = input.limitPerGroup ?? 6;
  const names = movementDisplayNames(input.movements, input.patients);

  const people = rankAndLimit(
    findPatients(input.patients, trimmed),
    trimmed,
    (patient) => [patientDisplayName(patient), patient.givenName, patient.familyName, patient.umrn, patient.id],
    limit,
  );

  const movementQuery: MovementSearchQuery = { text: trimmed, patientDisplayNames: names };
  const movements = rankAndLimit(
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
    limit,
  );

  const wards = rankAndLimit(
    searchWards(trimmed, input.units),
    trimmed,
    (ward) => [ward.unit.name, ward.unit.siteCode, ward.unit.id, ward.siteName],
    limit,
  );
  const emergencyDepartments = rankAndLimit(
    searchEmergencyDepartments(trimmed),
    trimmed,
    (department) => [department.ed.name, department.ed.siteCode, department.ed.id],
    limit,
  );
  const communityTeams = rankAndLimit(
    searchCommunityTeams(trimmed),
    trimmed,
    (team) => [team.team.name, team.team.id],
    limit,
  );
  const legalForms = rankAndLimit(
    searchLegalForms(trimmed),
    trimmed,
    (form) => [form.form.code, form.title, `Form ${form.form.code}`],
    limit,
  );
  const views = rankAndLimit(
    searchCoreViews(trimmed),
    trimmed,
    (view) => [view.view.title, view.view.key, view.view.description, ...(view.view.keywords ?? [])],
    limit,
  );

  const tasksInbox = buildActionInbox(input.movements.filter(isOpen), input.now ?? 0, input.units, input.plannedAdmissions);
  const tasks = rankAndLimit(
    searchTasks(trimmed, tasksInbox),
    trimmed,
    (task) => [task.task.title, task.task.detail, task.task.movementId, task.task.owner],
    limit,
  );

  const totalCount =
    people.length +
    movements.length +
    wards.length +
    emergencyDepartments.length +
    communityTeams.length +
    legalForms.length +
    views.length +
    tasks.length;

  return {
    people,
    movements,
    wards,
    emergencyDepartments,
    communityTeams,
    legalForms,
    views,
    tasks,
    hasAny: totalCount > 0,
    totalCount,
    intent,
  };
}
