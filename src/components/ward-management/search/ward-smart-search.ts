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
 * - Unranked candidate discipline: results are presented in deterministic structural order,
 *   never ordered by an opaque "relevance score", "risk score" or "acuity score".
 * - Truthfulness: only genuine matches are returned; empty state makes no claims about reality.
 * - Zero LLM or external provider calls: purely local, deterministic TypeScript matching.
 */

import {
  buildActionInbox,
  isOpen,
  searchMovements,
  type InboxItem,
  type MovementSearchQuery,
} from "@/components/ward-management/ward-derivations";
import { SELECTABLE_LEGAL_FORMS, legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { EmergencyDepartment, LegalForm, Movement, Unit } from "@/components/ward-management/ward-model";
import { findPatients, type Patient } from "@/components/ward-management/ward-patients";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
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
      href: `/mockups/ward-flow/movements/${task.movementId}`,
    }));
}

export type SmartSearchInput = {
  query: string;
  patients: readonly Patient[];
  movements: Movement[];
  units: Unit[];
  now?: number;
  limitPerGroup?: number;
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
};

/**
 * Unified multi-entity search runner.
 * Enforces unranked candidate discipline and zero provider calls.
 */
export function searchWardFlow(input: SmartSearchInput): SmartSearchResults {
  const trimmed = input.query.trim();
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
    };
  }

  const limit = input.limitPerGroup ?? 6;

  const people = findPatients(input.patients, trimmed).slice(0, limit);

  const movementQuery: MovementSearchQuery = { text: trimmed };
  const movements = searchMovements(input.movements, input.units, movementQuery).slice(0, limit);

  const wards = searchWards(trimmed, input.units).slice(0, limit);
  const emergencyDepartments = searchEmergencyDepartments(trimmed).slice(0, limit);
  const communityTeams = searchCommunityTeams(trimmed).slice(0, limit);
  const legalForms = searchLegalForms(trimmed).slice(0, limit);
  const views = searchCoreViews(trimmed).slice(0, limit);

  const tasksInbox = buildActionInbox(input.movements.filter(isOpen), input.now ?? 0, input.units);
  const tasks = searchTasks(trimmed, tasksInbox).slice(0, limit);

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
  };
}
