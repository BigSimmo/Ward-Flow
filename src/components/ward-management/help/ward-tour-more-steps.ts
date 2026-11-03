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
import {
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
  coordinator: ["Start of shift", "Handover", "Bed meeting", "If Ward Flow is down"],
  ward: ["Handover", "If Ward Flow is down"],
  ed: ["Handover", "If Ward Flow is down"],
  community: ["If Ward Flow is down"],
  officer: ["If Ward Flow is down"],
  bed_manager: ["Handover", "If Ward Flow is down"],
  executive: [],
  admin: [],
};

/** Desks with ward work of their own to practise: a bed request through to arrival. */
const PRACTISES: ReadonlySet<TourRole> = new Set(["coordinator", "ward", "ed", "community"]);

/** Desks that learn from checklists. The executive and the access admin record no shift work. */
const CHECKS: ReadonlySet<TourRole> = new Set(["coordinator", "ward", "ed", "community", "officer", "bed_manager"]);

function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/**
 * What Help holds for learning. `alone` is for a desk whose tour has no Help step of its own, so this
 * one introduces Help and says the tour can be replayed from it.
 */
function learnStep(role: TourRole, device: TourDevice, alone: boolean): MoreStep {
  const where = device === "phone" ? "Help, in the menu," : "Help";
  const checklists = CHECKS.has(role) ? TOUR_CHECKLISTS[role] : [];
  const body = [
    alone ? `${where} explains the screen you are on.` : "",
    `How to lists your jobs, many with a Show me, and Show me around this screen walks you round a screen that has one.`,
    checklists.length ? `Checklists has ${joinAnd(checklists)}.` : "",
    PRACTISES.has(role) ? "Practise a placement follows a bed request to arrival, on synthetic data." : "",
    alone ? "Replay this tour from Help or Settings." : "",
  ]
    .filter(Boolean)
    .join(" ");
  return more(
    "Finding your way",
    "learn",
    device === "phone" ? PHONE_MENU : RAIL_HELP,
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

function deskMore(role: TourRole): MoreStep[] {
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
        learnStep(role, "desk", false),
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
        learnStep(role, "desk", true),
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
        learnStep(role, "desk", true),
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
        learnStep(role, "desk", true),
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
        learnStep(role, "desk", true),
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
          "Discharges, under More, lists your site's planned discharges and departures, blocked releases first.",
        ),
        learnStep(role, "desk", false),
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
        learnStep(role, "desk", true),
      ];
    case "admin":
      return [
        more(
          "Your daily work",
          "settings",
          RAIL_SETTINGS,
          "Settings",
          "Your name at the foot of the menu opens Settings, which starts on Access. That is where you give, check and remove roles.",
          "review",
        ),
        BOARD_TIME_STEP,
        learnStep(role, "desk", true),
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
  return (device === "phone" ? phoneMore(role) : deskMore(role)).map((each) => each.step);
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
  for (const extra of device === "phone" ? phoneMore(role) : deskMore(role)) {
    if (steps.some((each) => each.id === extra.step.id)) continue;
    steps.splice(insertAt(steps, extra), 0, extra.step);
  }
  const [first, ...rest] = steps;
  const was = ` This takes ${tourMinutes(base.length, device)}.`;
  if (!first || first.id !== "welcome" || !first.body.endsWith(was)) return steps;
  const now = ` This takes ${tourMinutes(steps.length, device)}.`;
  return [{ ...first, body: `${first.body.slice(0, -was.length)}${now}` }, ...rest];
}
