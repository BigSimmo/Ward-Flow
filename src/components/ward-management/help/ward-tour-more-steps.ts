/**
 * MORE OF THE DESK IN THE OPENING TOUR (Josh, 2 Nov 2026: "extend the opening tour to other
 * components that are important for the role. Add a few more parts or steps to orient the person").
 *
 * `tourSteps` (`ward-tour-steps.ts`) walks each desk's home screen. These steps add the parts of the
 * desk that walk did not reach: the screens in the desk's own menu, the header's search, Alerts and
 * Activity, and what Help holds for learning. Each is joined into its own chapter, before the last
 * step (what the desk can do), and the welcome's length is worked out again for the longer tour.
 *
 * The tour stays on the desk's home screen. A step about another screen does not go there: it says
 * where that screen is and lights its entry in the rail's menu (desktop) or the tab bar or Menu
 * button (phone). Every target is a test id or an address the chrome already carries, never a class
 * name, and only names a screen the desk's access table (`ROLE_SCREENS`) lets it open.
 *
 * Saved progress keeps a step index and id per desk (`ward-help-store.ts`). Inserting steps moves
 * the index of the steps after them, which is acceptable: the player finds the saved step by its id
 * first and clamps a stale index to the tour's length (`ward-tour.tsx`). The new ids start "more-"
 * and must stay stable for the same reason.
 */
import { ROLE_SCREENS, type WardScreenId } from "@/components/ward-management/ward-role-access";

import {
  forTablet,
  tourMinutes,
  tourSteps,
  type TourDevice,
  type TourFacts,
  type TourRole,
  type TourStep,
  type TourTarget,
} from "./ward-tour-steps";

type Chapter = TourStep["chapter"];

/**
 * A step to join, and the step it follows or comes before when that is not simply the end of its
 * chapter. An anchor in another chapter, or missing from the tour, falls back to the chapter's end.
 */
type MoreStep = { readonly step: TourStep; readonly after?: string; readonly before?: string };

/** The first-run tour's chapters, in order. "Go further" is not one of them (`goFurtherSteps`). */
const CHAPTERS: readonly Chapter[] = ["Your desk", "Your daily work", "Finding your way", "What you can do"];

/** No desk's whole tour is longer than this, the opening step and the last one included. */
export const MAX_TOUR_STEPS = 16;

const id = (testId: string): TourTarget => ({ sel: `[data-testid="${testId}"]` });
/** A page in the desktop rail's own menu, by the end of its address. */
const railLink = (path: string): TourTarget => ({ sel: `[data-testid="ward-rail-role-menu"] a[href$="${path}"]` });
/** A page in the phone's tab bar, by the end of its address. */
const dockLink = (path: string): TourTarget => ({ sel: `[data-testid="ward-phone-dock"] a[href$="${path}"]` });

const SEARCH = id("ward-global-search");
const ALERTS = id("ward-bar-tasks-trigger");
const ACTIVITY = id("ward-bar-activity-trigger");
const PHONE_ACTIVITY = id("ward-phone-menu-activity");
/** Handover in the shift card at the top of the desktop menu, which counts down to the end of the shift. */
const RAIL_HANDOVER: TourTarget = { sel: '[data-testid="ward-rail"] a[aria-label^="Handover"]' };
const SERVICE = id("ward-bar-service-trigger");
const BOARD_TIME = id("ward-bar-demo-clock");
const RAIL_HELP = id("ward-rail-help");
const RAIL_MORE = id("ward-rail-more");
// DK1 (3 Nov 2026): Settings is in the account menu, which the person at the foot of the menu opens.
const RAIL_SETTINGS = id("ward-rail-persona-trigger");
const PHONE_MENU = id("ward-bar-phone-menu");

function more(
  chapter: Chapter,
  stepId: string,
  target: TourTarget | undefined,
  title: string,
  body: string,
  after?: string,
): MoreStep {
  return { step: { id: `more-${stepId}`, chapter, target, title, body }, after };
}

/**
 * The checklists Help lists for each desk (`checklistsForDesk` in `ward-help-checklists.ts`, which a
 * test keeps this in step with). Written out so the tour does not load the how-to list with it.
 */
export const TOUR_CHECKLISTS: Readonly<Record<TourRole, readonly string[]>> = {
  coordinator: ["Getting started", "Start of shift", "Handover", "Bed meeting", "If Ward Flow is down"],
  ward: ["Getting started", "Handover", "If Ward Flow is down"],
  ed: ["Getting started", "Handover", "If Ward Flow is down"],
  community: ["Getting started", "If Ward Flow is down"],
  officer: ["Getting started", "If Ward Flow is down"],
  bed_manager: ["Getting started", "Handover", "If Ward Flow is down"],
  // The executive and the access admin record no shift work, so they have no shift lists.
  executive: ["Getting started", "If Ward Flow is down"],
  admin: ["Getting started", "If Ward Flow is down"],
};

/** Desks with ward work of their own to practise: a bed request through to arrival. */
const PRACTISES: ReadonlySet<TourRole> = new Set(["coordinator", "ward", "ed", "community"]);

/** "Checklists has Getting started for your first week, then Handover and If Ward Flow is down." */
function checklistWords(role: TourRole): string {
  const [first, ...rest] = TOUR_CHECKLISTS[role];
  if (!first) return "";
  const lead = first === "Getting started" ? "Getting started for your first week" : first;
  return `Checklists has ${lead}${rest.length ? `, then ${joinAnd(rest)}` : ""}.`;
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/**
 * What Help holds for learning. `alone` is for a desk whose tour has no Help step of its own, so this
 * one introduces Help and says the tour can be replayed from it.
 */
function learnStep(role: TourRole, device: TourDevice, alone: boolean): MoreStep {
  const where = device === "desk" ? "Help" : "Help, in the menu,";
  const body = [
    alone ? `${where} explains the screen you are on.` : "",
    `How to lists your jobs, many with a Show me, and Show me around this screen walks you round a screen that has one.`,
    checklistWords(role),
    PRACTISES.has(role) ? "Practise a placement follows a bed request to arrival, on synthetic data." : "",
    alone ? "Replay this tour from Help or Settings." : "",
  ]
    .filter(Boolean)
    .join(" ");
  return more(
    "Finding your way",
    "learn",
    device === "desk" ? RAIL_HELP : PHONE_MENU,
    alone ? "Help is always here" : "Learn as you go",
    body,
  );
}

const DESK_SEARCH = more(
  "Finding your way",
  "search",
  SEARCH,
  "Find anyone or anything",
  "Press / from anywhere to find a patient by name or UMRN, or a ward, ED or page by name. Type a question and Help's answers show too.",
);

/** Before Help, so the two Help steps stay together. */
const PHONE_SEARCH: MoreStep = {
  ...more(
    "Finding your way",
    "search",
    SEARCH,
    "Find anyone or anything",
    "The magnifier finds a patient by name or UMRN, or a ward, ED or page by name. Type a question and Help's answers show too.",
  ),
  before: "help",
};

function alertsStep(place: string): MoreStep {
  return more(
    "Finding your way",
    "alerts",
    ALERTS,
    "Alerts",
    `The bell lists what is addressed to ${place} right now, across every movement and referral.`,
  );
}

const ACTIVITY_STEP = more(
  "Finding your way",
  "activity",
  ACTIVITY,
  "What has changed",
  "Activity lists the events recorded in this demo session, newest first, with any notices for your desk.",
);

const BOARD_TIME_STEP = more(
  "Finding your way",
  "board-time",
  BOARD_TIME,
  "Synthetic figures",
  "Every figure in Ward Flow is synthetic, from a demo. The clock in the header is the demo's own board time.",
);

/** The desktop's extra steps, or a tablet's, where the side menu is behind the bar's Menu button. */
function deskMore(role: TourRole, device: "desk" | "tablet"): MoreStep[] {
  const steps = deskMoreSteps(role, device);
  return device === "tablet" ? steps.map((each) => ({ ...each, step: forTablet(each.step) })) : steps;
}

function deskMoreSteps(role: TourRole, device: "desk" | "tablet"): MoreStep[] {
  switch (role) {
    case "coordinator":
      return [
        more(
          "Your daily work",
          "capacity",
          railLink("/capacity"),
          "Capacity and Mismatch",
          "Capacity, in your menu, shows each ward's confirmed beds and what is ready, pulled or closed. Its Mismatch card sets spare beds of each kind against the people waiting for one.",
        ),
        more(
          "Your daily work",
          "waiting",
          railLink("/waiting"),
          "Who is waiting and why",
          "Waiting, in your menu, groups everyone still waiting for a bed by the cause. All EDs, below it, lists each emergency department's waits.",
        ),
        { ...ACTIVITY_STEP, after: "tasks" },
        learnStep(role, device, false),
      ];
    case "ward":
      return [
        more(
          "Your daily work",
          "coming",
          railLink("/movements"),
          "Coming and going",
          "Coming and going, in your menu, lists every patient moving to or from your ward, by stage, from referral to arrival.",
        ),
        DESK_SEARCH,
        alertsStep("your ward"),
        learnStep(role, device, true),
      ];
    case "ed":
      return [
        more(
          "Your daily work",
          "referrals",
          railLink("/referrals"),
          "My referrals",
          "My referrals, in your menu, lists the referrals you sent that are waiting for an answer, and those decided recently.",
        ),
        DESK_SEARCH,
        alertsStep("your ED"),
        learnStep(role, device, true),
      ];
    case "community":
      return [
        more(
          "Your daily work",
          "referrals",
          railLink("/referrals"),
          "Referrals",
          "Referrals, in your menu, lists your team's referrals waiting for an answer, and those decided recently.",
        ),
        DESK_SEARCH,
        alertsStep("your team"),
        learnStep(role, device, true),
      ];
    case "officer":
      return [
        more(
          "Finding your way",
          "on-call",
          RAIL_MORE,
          "On-call",
          "On-call, under More, shows who answers each on-call line now, for hospitals, teams and state lines.",
        ),
        ACTIVITY_STEP,
        learnStep(role, device, true),
      ];
    case "bed_manager":
      return [
        more(
          "Your daily work",
          "movements",
          railLink("/movements"),
          "Movements",
          "Movements, in your menu, lists every patient moving to a bed at your site, by stage, from referral to arrival.",
        ),
        more(
          "Your daily work",
          "waiting",
          railLink("/waiting"),
          "Who is waiting and why",
          "Waiting, in your menu, groups the people still waiting for a bed by the cause.",
        ),
        more(
          "Your daily work",
          "discharges",
          RAIL_MORE,
          "Discharges",
          "Discharges, under More, lists your site's planned discharges, held-up discharges first.",
        ),
        learnStep(role, device, false),
      ];
    case "executive":
      return [
        more(
          "Your daily work",
          "capacity",
          railLink("/capacity"),
          "Capacity",
          "Capacity, in your menu, shows each ward's confirmed beds and what is ready, pulled or closed, as counts with no patient names.",
        ),
        BOARD_TIME_STEP,
        learnStep(role, device, true),
      ];
    case "admin":
      return [
        more(
          "Your daily work",
          "settings",
          RAIL_SETTINGS,
          "Settings",
          "Your name at the foot of the menu opens your account menu. Choose Settings there. It starts on Access, where you give, check and remove roles.",
          "record-review",
        ),
        BOARD_TIME_STEP,
        learnStep(role, device, true),
      ];
  }
}

function phoneMore(role: TourRole): MoreStep[] {
  const learn = learnStep(role, "phone", false);
  switch (role) {
    case "coordinator":
      return [
        more(
          "Your desk",
          "service",
          SERVICE,
          "Your health service",
          "The line under the title names the health service you are looking at. Tap it to choose another.",
        ),
        learn,
      ];
    case "ward":
      return [
        more(
          "Your daily work",
          "coming",
          dockLink("/movements"),
          "Coming and going",
          "Coming and going, in the tab bar, lists every patient moving to or from your ward, by stage.",
        ),
        PHONE_SEARCH,
        learn,
      ];
    case "ed":
    case "community":
      return [
        more(
          "Your daily work",
          "referrals",
          dockLink("/referrals"),
          "Referrals",
          role === "ed"
            ? "Referrals, in the tab bar, lists the referrals you sent that are waiting for an answer, and those decided recently."
            : "Referrals, in the tab bar, lists your team's referrals waiting for an answer, and those decided recently.",
        ),
        PHONE_SEARCH,
        learn,
      ];
    case "officer":
      return [
        {
          ...more(
            "Finding your way",
            "on-call",
            dockLink("/on-call"),
            "On-call",
            "On-call, in the tab bar, shows who answers each on-call line now.",
          ),
          before: "help",
        },
        learn,
      ];
    case "bed_manager":
      return [
        more(
          "Your daily work",
          "waiting",
          dockLink("/waiting"),
          "Who is waiting and why",
          "Waiting, in the tab bar, groups the people still waiting for a bed by the cause.",
        ),
        PHONE_SEARCH,
        learn,
      ];
    case "executive":
      return [
        more(
          "Your daily work",
          "capacity",
          dockLink("/capacity"),
          "Capacity",
          "Capacity, in the tab bar, shows each ward's confirmed beds, as counts with no patient names.",
        ),
        learn,
      ];
    case "admin":
      return [
        more(
          "Your daily work",
          "settings",
          PHONE_MENU,
          "Settings",
          "Settings, in the menu, opens on Access. That is where you give, check and remove roles.",
          "review",
        ),
        learn,
      ];
  }
}

/** The steps this file adds for one desk on one kind of screen, before they are joined. */
export function moreTourSteps(role: TourRole, device: TourDevice): readonly TourStep[] {
  return moreFor(role, device).map((each) => each.step);
}

function moreFor(role: TourRole, device: TourDevice): MoreStep[] {
  return device === "phone" ? phoneMore(role) : deskMore(role, device);
}

/** Where a step goes: after its `after` step, else at the end of its chapter. */
function insertAt(steps: readonly TourStep[], { step, after, before }: MoreStep): number {
  const anchor = steps.findIndex((each) => each.id === (after ?? before));
  if (anchor >= 0 && steps[anchor]?.chapter === step.chapter) return after === undefined ? anchor : anchor + 1;
  const rank = CHAPTERS.indexOf(step.chapter);
  const lastBefore = steps.findLastIndex((each) => CHAPTERS.indexOf(each.chapter) <= rank);
  return lastBefore + 1;
}

/**
 * One desk's whole tour: `tourSteps`, with this file's steps joined into their chapters before the
 * last step, and the welcome's "This takes about ..." worked out again for the new length.
 */
export function fullTourSteps(role: TourRole, device: TourDevice, facts: TourFacts): readonly TourStep[] {
  const base = tourSteps(role, device, facts);
  const steps = [...base];
  for (const extra of moreFor(role, device)) {
    if (steps.some((each) => each.id === extra.step.id)) continue;
    steps.splice(insertAt(steps, extra), 0, extra.step);
  }
  const [first, ...rest] = steps;
  const was = ` This takes ${tourMinutes(base.length, device)}.`;
  if (!first || first.id !== "welcome" || !first.body.endsWith(was)) return steps;
  const now = ` This takes ${tourMinutes(steps.length, device)}.`;
  return [{ ...first, body: `${first.body.slice(0, -was.length)}${now}` }, ...rest];
}

/* ── Go further ───────────────────────────────────────────────────────────────────────────── */

/**
 * GO FURTHER (Help and tour extension, 5 Nov 2026): up to `MAX_GO_FURTHER` optional steps the player
 * offers once the first-run tour ends. They visit the desk's other screens the first-run tour did not
 * reach, the same way: the tour stays on the home screen and lights where each screen is. A step whose
 * screen the desk's access table (`ROLE_SCREENS`) does not open is left out, so the tour never shows a
 * door the guard would shut. The first-run tour keeps its own cap (`MAX_TOUR_STEPS`).
 */
export const MAX_GO_FURTHER = 8;

/**
 * Where a screen sits on a desktop: in the desk's own menu (by the end of its address), under More,
 * in the account menu (the person at the foot of the menu), in the header, or as Handover in the shift
 * card at the top of the menu.
 */
type DeskPlace = { readonly menu: string } | "more" | "account" | "header" | "shift";

type Further = {
  readonly id: string;
  /** The screen the step is about. A step about the header itself names none. */
  readonly screen?: WardScreenId;
  readonly desk: DeskPlace;
  /** The end of its address in the phone's tab bar, when it is there. Otherwise it is in Menu. */
  readonly dock?: string;
  readonly title: string;
  /** The words, given where the screen is: "in your menu", "under More", "in the tab bar". */
  readonly body: (where: string) => string;
  readonly tryIt?: string;
};

// The landscape tablet (1001px to 1200px) draws the icon rail, whose More has its own test id.
const ANY_MORE: TourTarget = { sel: '[data-testid="ward-rail-more"], [data-testid="ward-rail-tablet-more"]' };

const movementsBody = (who: string) => (where: string) =>
  `Movements, ${where}, follows ${who} moving to a bed, by stage, from referral to arrival. Rows marked Act now are due now or overdue.`;

const WAITING: Further = {
  id: "waiting",
  screen: "delays",
  desk: "more",
  title: "Who is waiting and why",
  body: (where) => `Waiting, ${where}, groups the people still waiting for a bed by the cause.`,
};
const LEGAL_FORMS: Further = {
  id: "legal-forms",
  screen: "legal-forms",
  desk: "more",
  title: "Legal forms",
  body: (where) =>
    `Legal forms, ${where}, lists every open movement with a legal form. Times are as typed from the paper form, and Ward Flow does not work out legal periods.`,
};
const handover = (desk: DeskPlace): Further => ({
  id: "handover",
  screen: "handover",
  desk,
  title: "Handover",
  body: (where) =>
    `Handover, ${where}, is the sheet for the next shift. Read Act now first, check Before you sign, then choose Sign off.`,
});
const ownStatistics = (place: string): Further => ({
  id: "statistics",
  screen: "statistics",
  desk: "more",
  title: "Your figures",
  body: (where) => `Statistics, ${where}, shows ${place}'s own figures, as counts.`,
});
const ON_CALL: Further = {
  id: "on-call",
  screen: "on-call",
  desk: "more",
  title: "On-call",
  body: (where) => `On-call, ${where}, shows who answers each on-call line now, for hospitals, teams and state lines.`,
  tryIt: "Star a line to keep it under Mine, at the top of the page.",
};
const ACTIVITY_FURTHER: Further = {
  id: "activity",
  desk: "header",
  title: "What has changed",
  body: (where) => `Activity, ${where}, lists the events recorded in this demo session, newest first.`,
};
const SETTINGS: Further = {
  id: "settings",
  screen: "settings",
  desk: "account",
  title: "Make it yours",
  body: (where) =>
    `Settings, ${where}, has Display, for the theme, and Alerts, to turn on alerts on this device. Both change this device only.`,
};
const TRY_A_DESK: Further = {
  id: "other-desk",
  screen: "settings",
  desk: "account",
  title: "See another desk",
  body: (where) =>
    `In the demo, Try another desk (demo), ${where}, shows Ward Flow as another role sees it. Switch back the same way.`,
};

const FURTHER: Readonly<Record<TourRole, readonly Further[]>> = {
  coordinator: [
    {
      id: "movements",
      screen: "movements",
      desk: { menu: "/movements" },
      title: "Every move to a bed",
      body: movementsBody("every patient"),
      tryIt: "Open a movement to see its bed, transport and legal form in one place.",
    },
    {
      id: "referrals",
      screen: "referrals",
      desk: { menu: "/referrals" },
      dock: "/referrals",
      title: "Referrals",
      body: (where) =>
        `Referrals, ${where}, holds the referrals waiting for an answer and those decided recently. Open one to see each destination's answer.`,
    },
    {
      id: "eds",
      screen: "ed",
      desk: { menu: "/ed" },
      title: "All EDs",
      body: (where) =>
        `All EDs, ${where}, lists every emergency department with the people there waiting for a mental health bed. Past target finds EDs with someone past the access target.`,
    },
    {
      id: "discharges",
      screen: "discharges",
      desk: "more",
      title: "Discharges",
      body: (where) => `Discharges, ${where}, lists planned discharges, held-up discharges first.`,
    },
    LEGAL_FORMS,
    {
      id: "places",
      screen: "hub",
      desk: "more",
      title: "Places",
      body: (where) =>
        `Places, ${where}, lists every ward, ED and community team. Catchments, on its band, finds the team that covers a suburb.`,
    },
    SETTINGS,
    TRY_A_DESK,
  ],
  ward: [
    {
      id: "referrals",
      screen: "referrals",
      desk: { menu: "/referrals" },
      dock: "/referrals",
      title: "Referrals to answer",
      body: (where) =>
        `Referrals to answer, ${where}, lists the referrals sent to your ward. Accept, or decline with a reason.`,
    },
    handover("shift"),
    {
      id: "discharges",
      screen: "discharges",
      desk: "more",
      title: "Discharges",
      body: (where) => `Discharges, ${where}, lists your ward's planned discharges, held-up discharges first.`,
    },
    WAITING,
    LEGAL_FORMS,
    ownStatistics("your ward"),
    ON_CALL,
    SETTINGS,
  ],
  ed: [
    {
      id: "movements",
      screen: "movements",
      desk: "more",
      title: "Where your patients are",
      body: movementsBody("each person you referred"),
    },
    WAITING,
    LEGAL_FORMS,
    handover("more"),
    ownStatistics("your ED"),
    ON_CALL,
    SETTINGS,
    TRY_A_DESK,
  ],
  community: [
    {
      id: "movements",
      screen: "movements",
      desk: "more",
      dock: "/movements",
      title: "Where your people are",
      body: movementsBody("your team's people"),
    },
    WAITING,
    LEGAL_FORMS,
    ownStatistics("your team"),
    ON_CALL,
    SETTINGS,
    TRY_A_DESK,
  ],
  officer: [SETTINGS, TRY_A_DESK],
  bed_manager: [
    {
      id: "wards",
      screen: "wards",
      desk: { menu: "/wards" },
      dock: "/wards",
      title: "Your wards",
      body: (where) => `Wards, ${where}, lists your site's wards. Open one for its beds, arrivals and discharges.`,
      tryIt: "Open one of your wards, then come back.",
    },
    {
      id: "referrals",
      screen: "referrals",
      desk: { menu: "/referrals" },
      title: "Referrals to your site",
      body: (where) =>
        `Referrals, ${where}, shows the referrals coming to your site's wards. It is read only: each ward answers its own.`,
    },
    handover("shift"),
    {
      id: "patients",
      screen: "search",
      desk: "more",
      title: "Patients",
      body: (where) =>
        `Patients, ${where}, is the register of everyone at your site, found by record number, place, stage or owner.`,
    },
    {
      id: "statistics",
      screen: "statistics",
      desk: "more",
      title: "Statistics",
      body: (where) => `Statistics, ${where}, shows counts and waits, with no patient names.`,
    },
    ON_CALL,
    SETTINGS,
    TRY_A_DESK,
  ],
  executive: [ACTIVITY_FURTHER, SETTINGS, TRY_A_DESK],
  admin: [ACTIVITY_FURTHER, SETTINGS, TRY_A_DESK],
};

/** Where the step lights, and the words for where that is, on this kind of screen. */
function placeOf(each: Further, device: TourDevice): { target: TourTarget; where: string } {
  // A phone has no header Activity button: Activity is in its tab bar.
  if (each.desk === "header") {
    return device === "phone"
      ? { target: PHONE_ACTIVITY, where: "in the tab bar" }
      : { target: ACTIVITY, where: "in the header" };
  }
  if (device === "phone" && each.dock) return { target: dockLink(each.dock), where: "in the tab bar" };
  // The phone's Menu, and the tablet's, which opens the side menu and its More together.
  if (device !== "desk") {
    return { target: PHONE_MENU, where: each.desk === "account" ? "in the menu, under your name" : "in the menu" };
  }
  if (each.desk === "account") return { target: RAIL_SETTINGS, where: "in your account menu" };
  if (each.desk === "more") return { target: ANY_MORE, where: "under More" };
  if (each.desk === "shift") return { target: RAIL_HANDOVER, where: "at the top of your menu" };
  return { target: railLink(each.desk.menu), where: "in your menu" };
}

function furtherFor(role: TourRole): readonly Further[] {
  return FURTHER[role]
    .filter((each) => each.screen === undefined || ROLE_SCREENS[role][each.screen] !== undefined)
    .slice(0, MAX_GO_FURTHER);
}

/** The screens one desk's Go further steps are about, after the access check (for the tests). */
export function goFurtherScreens(role: TourRole): readonly WardScreenId[] {
  return furtherFor(role).flatMap((each) => (each.screen ? [each.screen] : []));
}

/**
 * The optional steps after one desk's first-run tour: its other screens, in the "Go further" chapter.
 * `facts` matches the other tour builders, so the player calls each the same way; no step needs a
 * figure yet.
 */
export function goFurtherSteps(role: TourRole, device: TourDevice, facts: TourFacts): readonly TourStep[] {
  void facts;
  return furtherFor(role).map((each) => {
    const { target, where } = placeOf(each, device);
    const step: TourStep = {
      id: `further-${each.id}`,
      chapter: "Go further",
      target,
      title: each.title,
      body: each.body(where),
    };
    return each.tryIt ? { ...step, tryIt: each.tryIt } : step;
  });
}
