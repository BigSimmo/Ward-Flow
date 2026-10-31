/**
 * THE ROLE-TAILORED TOUR (Josh approved the mock-up on 22 Oct 2026, desktop and phone).
 *
 * Each desk's steps point at a real control on its own home screen, and the words use the signed-in
 * person, their place and the figures the screen shows. Three chapters (your desk, your daily work,
 * finding your way), then a last step that lists what the desk can do and who to ask for the rest.
 *
 * Targets are CSS selectors over attributes the screens already carry (test ids, ids and accessible
 * names), never class names, which the production build renames. A target the screen does not show
 * (another page, a narrower scope, an empty list) is not an error: the player shows that step's card
 * in the middle of the screen with no spotlight. Every figure is optional for the same reason, and a
 * sentence whose figure is missing is written without it rather than with a guess.
 */
import { DESK_PERSONAS } from "@/components/ward-management/shell/ward-desk-personas";
import { deskActions, type DeskRole } from "@/components/ward-management/settings/workstation-desks";
import { CHROME_ROLE_LABELS, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { ROLE_SCREENS, type WardScreenId } from "@/components/ward-management/ward-role-access";

/** The tour's own idea of a desk: the chrome roles, plus the access admin, who has no clinical chrome. */
export type TourRole = WardChromeRole | "admin";
export type TourDevice = "desk" | "phone";
type TourChapter = "Your desk" | "Your daily work" | "Finding your way" | "What you can do";

/** The first element matching `sel` that is shown, holds `text` when given, then `up` parents up. */
export type TourTarget = { readonly sel: string; readonly text?: string; readonly up?: number };

export type TourStep = {
  readonly id: string;
  readonly chapter: TourChapter;
  readonly target?: TourTarget;
  readonly title: string;
  readonly body: string;
  readonly tryIt?: string;
  /** The last step, which lists what the desk can do. */
  readonly canDo?: true;
};

/** What the tour knows about the signed-in person and their screen. Every figure is optional. */
export type TourFacts = {
  /** Where the desk stands, as a phrase: "Dabakarn at Royal Perth Hospital", "the Midland team". */
  readonly place?: string;
  /** The ward, ED or team name on its own, for titles. */
  readonly placeName?: string;
  readonly readyBeds?: number;
  readonly openMovements?: number;
  readonly referralsWaiting?: number;
  readonly waitingInEd?: number;
  /** The ED with the longest wait, as the coordinator's ED tiles order them. */
  readonly topEd?: { readonly name: string; readonly waiting: number; readonly longest: string };
  readonly ward?: {
    readonly beds: number;
    readonly occupied: number;
    readonly ready: number;
    readonly confirmedAt?: string;
  };
  readonly ed?: { readonly waiting: number; readonly longest?: string; readonly targetHours: number };
  readonly activeJobs?: number;
};

export const TOUR_ROLE_LABELS: Record<TourRole, string> = { ...CHROME_ROLE_LABELS, admin: "Access admin" };

/** How the card greets them: the rail's person, or the role for a desk with no drawn person. */
export function tourGreeting(role: TourRole): string {
  return role === "admin" ? TOUR_ROLE_LABELS.admin : DESK_PERSONAS[role].greeting;
}

const PERSONA: TourTarget = { sel: '[data-testid="ward-rail-persona-trigger"]' };
const ROLE_MENU: TourTarget = { sel: '[data-testid="ward-rail-role-menu"]' };
const RAIL_HELP: TourTarget = { sel: '[data-testid="ward-rail-help"]' };
const PRIMARY: TourTarget = { sel: '[data-testid="ward-bar-primary-action"]' };
/** The screen's hero card, the first labelled section in the page's main region. */
const HERO_SEL = "#main-content section[aria-labelledby]";
const HERO: TourTarget = { sel: HERO_SEL };
const DOCK: TourTarget = { sel: '[data-testid="ward-phone-dock"]' };
const PLUS: TourTarget = { sel: '[data-testid="ward-phone-create"]' };
const PHONE_MENU: TourTarget = { sel: '[data-testid="ward-bar-phone-menu"]' };
const ED_PRESSURE: TourTarget = { sel: '[data-testid="ward-home-ed-pressure"]' };
/** Placement before anyone is chosen (the prompt card), or once someone is (the side panel). */
const PLACEMENT: TourTarget = { sel: '[data-testid="home-placement-prompt"], [data-testid="ward-home-placement"]' };
const MY_LIST: TourTarget = { sel: '[data-testid="home-my-list"]' };
const UNIT_CARD: TourTarget = { sel: '[data-testid^="ward-unit-card-"]' };
const CONFIRM: TourTarget = { sel: '[data-testid^="ward-unit-card-"] button', text: "Confirm numbers" };
const ED_CARD: TourTarget = { sel: '[data-testid^="ward-ed-card-"]' };
const ED_ROW: TourTarget = { sel: '[data-testid^="ward-ed-patient-"]' };
const STATS_NAV: TourTarget = { sel: '[data-testid="ward-statistics-nav"]' };
const TRENDS: TourTarget = { sel: '[data-testid="ward-statistics-session-trends"]' };
const MISMATCH: TourTarget = { sel: '[data-testid="capacity-mismatch"]' };

function count(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

/** "about 3 minutes", from the number of steps: about 15 seconds a step on a desktop, 12 on a phone. */
export function tourMinutes(steps: number, device: TourDevice): string {
  const minutes = Math.max(1, Math.round((steps * (device === "phone" ? 12 : 15)) / 60));
  return minutes === 1 ? "about a minute" : `about ${minutes} minutes`;
}

function signedInAs(role: TourRole, facts: TourFacts, scope: string): string {
  const label = role === "ed" ? "ED clinician" : TOUR_ROLE_LABELS[role];
  const join = role === "ed" ? "at" : role === "ward" ? "of" : "for";
  if (facts.place) return `You are signed in as ${label} ${join} ${facts.place}.`;
  return scope ? `You are signed in as ${label} ${scope}.` : `You are signed in as ${label}.`;
}

function step(
  chapter: TourChapter,
  id: string,
  target: TourTarget | undefined,
  title: string,
  body: string,
  tryIt?: string,
): TourStep {
  return tryIt ? { id, chapter, target, title, body, tryIt } : { id, chapter, target, title, body };
}

function canDoStep(role: TourRole): TourStep {
  const screensOnly = role === "bed_manager" || role === "executive" || role === "admin";
  return {
    id: "can-do",
    chapter: "What you can do",
    title: screensOnly ? "What your desk can open" : "What your desk can do",
    body:
      role === "coordinator"
        ? "The bed coordinator can take every action in Ward Flow. Other desks will ask you for the ones they cannot take."
        : screensOnly
          ? "Taken from the access table for your role."
          : "These come from the same rules the app checks when you act. For the rest, the list says who to ask.",
    canDo: true,
  };
}

/**
 * The access admin's own job, giving and removing roles, is on Settings, not the review screen the
 * tour walks through, so these steps show as cards in the middle of the screen (HF-05).
 */
const ACCESS_STEPS: readonly TourStep[] = [
  step(
    "Your daily work",
    "give-role",
    { sel: '[data-testid="ward-access-grant"]' },
    "Give a role",
    "In Settings, the Access tab has Give a role. Choose the person, the role, the place and how many days. Every role has an end date, and nobody gives themselves a role.",
    "Open Settings, then Access.",
  ),
  step(
    "Your daily work",
    "requests",
    { sel: '[data-testid="ward-access-requests"]' },
    "Requests and removing a role",
    "Requests for access lists people asking for a role. Give for 90 days or Decline answers each one. Everyone with a role lists who has one, and Remove ends it straight away.",
  ),
];

const HELP_BODY = "Help explains the screen you are on and has a glossary you can search.";

function deskSteps(role: TourRole, facts: TourFacts): TourStep[] {
  const f = facts;
  const place = f.placeName;
  switch (role) {
    case "coordinator": {
      const menuFigures = [
        f.readyBeds === undefined ? "" : `Capacity has ${count(f.readyBeds, "bed", "beds")} ready now`,
        f.openMovements === undefined ? "" : `Movements has ${f.openMovements} still open`,
        f.referralsWaiting === undefined
          ? ""
          : `${count(f.referralsWaiting, "referral is", "referrals are")} waiting for a decision`,
      ].filter(Boolean);
      return [
        step(
          "Your desk",
          "welcome",
          PERSONA,
          `Welcome, ${tourGreeting(role)}`,
          `${signedInAs(role, f, "for the whole network")} This tour shows where your work lives. You can leave at any step and pick it up again from Help.`,
        ),
        step(
          "Your desk",
          "shift",
          { sel: '[data-testid="ward-rail"] a[aria-label^="Handover"]', up: 1 },
          "Your shift",
          "Your shift and its hours show here. Handover counts down to the end of the shift and opens the sheet you pass on.",
          "Open Handover to see what goes to the next shift.",
        ),
        step(
          "Your desk",
          "menu",
          ROLE_MENU,
          "Your screens",
          `My list is where you start.${menuFigures.length ? ` ${joinAnd(menuFigures)}.` : ""} The numbers update as the network changes.`,
        ),
        step(
          "Your daily work",
          "pressure",
          { sel: '[data-testid="wf-occupancy-ring"]' },
          "How full the network is",
          "The ring shows how many beds are in use against the at-risk line. The chips beside it count Act now, Referrals to decide, Overdue waits and Tier 1 patients.",
        ),
        step(
          "Your daily work",
          "eds",
          ED_PRESSURE,
          "Every ED at a glance",
          `One tile per emergency department, with how many are waiting, the longest wait and whether a deadline is close.${
            f.topEd
              ? ` ${f.topEd.name} has ${f.topEd.waiting} waiting and the longest has been there ${f.topEd.longest}.`
              : ""
          }`,
        ),
        step(
          "Your daily work",
          "shortlist",
          PLACEMENT,
          "Placing a patient",
          "Choose a patient, alert or referral from My list and Placement opens for that person, with the checks for a bed. Nothing is chosen for you. Offer a bed once the checks you need are met.",
        ),
        step(
          "Your daily work",
          "new-referral",
          PRIMARY,
          "Start a referral",
          "New referral opens the referral form from any screen. The arrow beside it has the other things you can start.",
        ),
        step(
          "Finding your way",
          "search",
          { sel: '[data-testid="ward-global-search"]' },
          "Find anyone or anything",
          "Press / from anywhere to search patients by name or UMRN, and wards, EDs and pages by name.",
        ),
        step(
          "Finding your way",
          "tasks",
          { sel: '[data-testid="ward-bar-tasks-trigger"]' },
          "Alerts and tasks",
          "The bell holds the alerts and tasks addressed to your desk. Act-now items come first.",
        ),
        step(
          "Finding your way",
          "tools",
          { sel: '[data-testid="ward-bar-tools-trigger"]' },
          "Tools",
          "Find a bed, catchment lookup, on-call, form times and the bed summary for the executive on-call email.",
        ),
        step(
          "Finding your way",
          "help",
          RAIL_HELP,
          "Help is always here",
          `${HELP_BODY} Replay this tour from Help or Settings.`,
        ),
      ];
    }
    case "ward": {
      const ward = f.ward;
      return [
        step(
          "Your desk",
          "welcome",
          undefined,
          `Welcome, ${tourGreeting(role)}`,
          `${signedInAs(role, f, "")} You see your own ward's patients and the referrals sent to it.`,
        ),
        step(
          "Your desk",
          "you",
          PERSONA,
          "You and your shift",
          "Your name and role show here. Handover above counts down to the end of the shift.",
        ),
        step(
          "Your desk",
          "hero",
          UNIT_CARD,
          place ? `${place} right now` : "Your ward right now",
          ward
            ? `${count(ward.ready, "bed", "beds")} ready now and ${ward.occupied} of ${ward.beds} occupied. The card also shows what is due now and what will be ready later today.`
            : "Beds ready now, beds occupied, what is due now and what will be ready later today.",
        ),
        step(
          "Your desk",
          "checking",
          { sel: '[data-testid^="ward-unit-card-"] [data-testid="wf-checking-foot"]' },
          "What may be out of date",
          "Checking lists what the figures cannot vouch for, such as discharges held up, people past their expected date or a roster not recorded.",
        ),
        step(
          "Your daily work",
          "confirm",
          CONFIRM,
          "Confirm your numbers",
          `Confirm numbers tells the network your bed count is current.${
            ward?.confirmedAt ? ` It was last confirmed at ${ward.confirmedAt}.` : ""
          } Confirm again after any bed change so the coordinator is not working from an old figure.`,
        ),
        step(
          "Your daily work",
          "beds",
          { sel: "#bed-capacity" },
          "Every bed",
          "One tile per bed with who is in it, the length of stay and any flag. Filter to Needs a look, Due out or Ready.",
          "Select a bed to record a discharge, move the date or record a blocker.",
        ),
        step(
          "Your daily work",
          "answer",
          // Ward flow opens on its busiest list, so the referrals list may be the hidden pane; the
          // Referrals choice above it is always on screen (document order puts it first).
          { sel: '[aria-label="Ward flow list"] [role="radio"], #ward-awaiting-answer' },
          "Referrals to answer",
          `Referrals sent to ${place ?? "your ward"} wait here for your answer. Accept, or decline with a reason, and the sender sees your answer straight away.`,
        ),
        step(
          "Your daily work",
          "decisions",
          { sel: "#tabBtn-return" },
          "Decisions due",
          "Decisions gathers the ward's calls for today: who is ready to leave, leave requests and patients coming in.",
        ),
        step(
          "Your daily work",
          "raise",
          { sel: '[aria-label="Ward actions"] button', text: "Raise referral" },
          "Refer a patient on",
          `Raise referral sends a patient from ${place ?? "your ward"} to a medical ward or a community team.`,
        ),
        step(
          "Finding your way",
          "brief",
          { sel: '[aria-label="More ward actions"]' },
          "Shift brief",
          "Shift brief, under More, sums up the ward for the start of a shift. Handover beside More is the sheet you pass to the next nurse in charge.",
        ),
        step(
          "Finding your way",
          "pin",
          { sel: '[data-testid="ward-my-wards-pin"]' },
          "Keep your wards close",
          "Pin this ward to keep it under My wards. If you cover another ward, pin that one too.",
        ),
      ];
    }
    case "ed": {
      const ed = f.ed;
      return [
        step(
          "Your desk",
          "welcome",
          undefined,
          `Welcome, ${tourGreeting(role)}`,
          `${signedInAs(role, f, "")} You see the people on your board and the referrals you have sent.`,
        ),
        step(
          "Your desk",
          "you",
          PERSONA,
          "You and your shift",
          "Your name and role show here, with the shift and Handover above.",
        ),
        step(
          "Your desk",
          "card",
          ED_CARD,
          "Your board at a glance",
          ed
            ? `${count(ed.waiting, "person is", "people are")} on your board.${
                ed.longest ? ` The longest wait is ${ed.longest} against a ${ed.targetHours}h access target.` : ""
              } The card also counts who has no bed yet and who is under a form.`
            : "Who is waiting, who has no bed yet, who is under a form and the longest wait against the access target.",
        ),
        step(
          "Your daily work",
          "row",
          ED_ROW,
          "One row per person",
          "Tier, time in ED, bay, form, destination and the next step. T1 is most urgent. A red triangle marks a wait past its step target.",
        ),
        step(
          "Your daily work",
          "form",
          // The visible expiry chip: the screen-reader text's parent, beside the time drawn as typed.
          { sel: '[aria-hidden="true"] + [data-testid^="ward-ed-form-expiry-"]', up: 1 },
          "The legal form",
          "The Form column shows the form recorded for each person. In the row's menu, Mark Form 1A received and Record expiry from the form let the receiving ward and transport see it. The time is as typed from the paper form.",
        ),
        step(
          "Your daily work",
          "next",
          { sel: '[data-testid^="ward-ed-next-"]' },
          "The next step",
          "Next names the one thing to do now, such as Record exam. The menu beside it has everything else for this person.",
        ),
        step(
          "Your daily work",
          "raise",
          PRIMARY,
          "New referral",
          "New referral, at the top, starts a referral for someone on your board, to a ward or a community team.",
        ),
        step(
          "Finding your way",
          "find-bed",
          { sel: '[data-testid="ward-rail-bed-finder"]' },
          "Find a bed",
          "Lists the wards that meet the checks you choose, with their ready beds, A to Z by name. It is a quick filter, not a suggestion. The referral still checks every rule.",
        ),
      ];
    }
    case "community":
      return [
        step(
          "Your desk",
          "welcome",
          undefined,
          `Welcome, ${tourGreeting(role)}`,
          `${signedInAs(role, f, "")} You see the people referred to your team and the referrals you send.`,
        ),
        step(
          "Your desk",
          "you",
          PERSONA,
          "You and your shift",
          "Your name and role show here, with the shift and Handover above.",
        ),
        step(
          "Your desk",
          "hero",
          HERO,
          "Your caseload",
          "The people on your team's caseload. The tabs split them into Waiting answer, In a bed and Expected back. Checking lists what is not recorded yet.",
        ),
        step(
          "Your daily work",
          "actions",
          { sel: `${HERO_SEL} button`, text: "Record contact", up: 1 },
          "Team actions",
          "Record contact, the CTO register, the catchment MDT and Refer from team all sit in the header.",
        ),
        step(
          "Your daily work",
          "admitted",
          { sel: '[data-testid="ward-community-admitted"]' },
          "People in a bed",
          "Everyone your team referred who is in a bed or has one pulled, with the unit, legal status and days in.",
        ),
        step(
          "Your daily work",
          "transport",
          { sel: '[data-testid^="ward-community-open-dossier-"]' },
          "Open a person's record",
          "Select a person's row to open their record. When a move needs transport, Log transport booking appears beside it.",
        ),
        step(
          "Finding your way",
          "contact",
          { sel: '[data-testid="ward-community-contact"]' },
          "How other desks reach you",
          "Your team's phone, hours and address as other desks see them. These are invented for the demo.",
        ),
        step(
          "Finding your way",
          "raise",
          PRIMARY,
          "New referral",
          "Start a referral to a ward from anywhere in Ward Flow.",
        ),
        step(
          "Finding your way",
          "menu",
          ROLE_MENU,
          "Your menu",
          "My team, Referrals and New referral. More has the other screens your desk can open.",
        ),
      ];
    case "officer":
      return [
        step(
          "Your desk",
          "welcome",
          undefined,
          `Welcome, ${tourGreeting(role)}`,
          `${signedInAs(role, f, "")} You see the transport jobs assigned to you.`,
        ),
        step(
          "Your desk",
          "you",
          PERSONA,
          "You and your shift",
          "Your name and role show here, with the shift and Handover above.",
        ),
        step(
          "Your desk",
          "summary",
          HERO,
          "Your jobs at a glance",
          `${f.activeJobs === undefined ? "" : `${count(f.activeJobs, "job is", "jobs are")} still on the road. `}The chips count jobs to accept, crews to send, crews en route, jobs past the ward's ETA and jobs that still need forms.`,
        ),
        step(
          "Your daily work",
          "jobs",
          { sel: '[data-testid="ward-officer-joblist"]' },
          "Each job",
          "Patient, route from and to, stage and forms. Sort by next action or by longest wait, or search by name, UMRN, ED, ward or CAD number.",
        ),
        step(
          "Your daily work",
          "next",
          { sel: '[data-testid^="ward-officer-next-"]' },
          "Record the next step",
          "Next is the one step to record now, such as En route or Arrived at ward.",
        ),
        step(
          "Your daily work",
          "stepper",
          { sel: '[data-testid^="ward-officer-stepper-"]' },
          "How far the job has come",
          "The dots fill as the job moves from accepted to collected. The stage name sits beside them.",
        ),
        step(
          "Finding your way",
          "alerts",
          { sel: '[data-testid="ward-rail-role-menu"] a[href$="/alerts"]' },
          "Alerts",
          "Alerts that concern your jobs.",
        ),
      ];
    case "bed_manager":
      return [
        step(
          "Your desk",
          "welcome",
          undefined,
          `Welcome, ${tourGreeting(role)}`,
          `${signedInAs(role, f, "")} You see your site's wards, movements and waits.`,
        ),
        step(
          "Your desk",
          "menu",
          ROLE_MENU,
          "Your menu",
          `Capacity, Wards, Movements${f.openMovements === undefined ? "" : ` with ${f.openMovements} still open`} and Waiting${
            f.waitingInEd === undefined ? "" : ` with ${f.waitingInEd} waiting in ED`
          }.`,
        ),
        step(
          "Your daily work",
          "hero",
          HERO,
          "Beds ready",
          "How many beds are ready, with locked beds counted within the total. Beds pulled and beds due out today sit beside them.",
        ),
        step(
          "Your daily work",
          "mismatch",
          MISMATCH,
          "Mismatch",
          "For each kind of bed: how many are spare, how many people are waiting and how many beds fit them.",
        ),
        step(
          "Your daily work",
          "meeting",
          { sel: '[data-testid="capacity-bed-meeting"]' },
          "The bed meeting",
          "Bed meeting prints the meeting sheet and opens the agenda. Open on TV puts it on the meeting room screen.",
        ),
        step(
          "Finding your way",
          "map",
          { sel: "#capacity-bed-map" },
          "Bed map",
          "Every ward with ready, occupied and closed beds. Switch between Grid and Rows.",
        ),
        step(
          "Finding your way",
          "help",
          RAIL_HELP,
          "Help is always here",
          `${HELP_BODY} Replay this tour from Help or Settings.`,
        ),
      ];
    case "executive":
      return [
        step(
          "Your desk",
          "welcome",
          undefined,
          `Welcome, ${tourGreeting(role)}`,
          `${signedInAs(role, f, "for the whole state")} You see figures as counts, never patient names.`,
        ),
        step(
          "Your daily work",
          "hero",
          HERO,
          "The network today",
          `${networkToday(f)}The card also shows how full the network is and how many beds are being made ready.`,
        ),
        step(
          "Your daily work",
          "tabs",
          STATS_NAV,
          "Views",
          "Network, Compare, Services, Wards, EDs, Teams and Weekly each answer one question about the system.",
        ),
        step(
          "Finding your way",
          "export",
          { sel: '[data-testid="ward-statistics-export"]' },
          "Take the figures with you",
          "Export the figures is there when you need them for a report or briefing.",
        ),
        step(
          "Finding your way",
          "trends",
          TRENDS,
          "This session",
          "Hourly counts of referrals, decisions, arrivals and departures recorded since the demo started.",
        ),
      ];
    case "admin":
      return [
        step(
          "Your desk",
          "welcome",
          undefined,
          `Welcome, ${tourGreeting(role)}`,
          `${signedInAs(role, f, "for the whole state")} You give staff access to the right desk and place. Governance also shows overrides, refused actions and who opened which record.`,
        ),
        step(
          "Your daily work",
          "review",
          HERO,
          "What is waiting for review",
          "Overrides, refused or stale actions, record access and follow-ups. The tabs hold gaps by site, the audit trail, registers and reports.",
        ),
        ...ACCESS_STEPS,
      ];
  }
}

function networkToday(f: TourFacts): string {
  const parts = [
    f.readyBeds === undefined ? "" : `${count(f.readyBeds, "bed", "beds")} ready now`,
    f.waitingInEd === undefined ? "" : `${f.waitingInEd} waiting in ED`,
  ].filter(Boolean);
  return parts.length ? `${capitalise(joinAnd(parts))}. ` : "";
}

const PHONE_HELP = step(
  "Finding your way",
  "help",
  PHONE_MENU,
  "Help is in the menu",
  `${HELP_BODY} Replay this tour from there or from Settings.`,
);

function phoneCreate(things: string): TourStep {
  return step("Your daily work", "create", PLUS, "Start something new", `The plus button opens Create: ${things}.`);
}

function phoneDock(body: string): TourStep {
  return step("Finding your way", "dock", DOCK, "The tab bar", body);
}

function phoneSteps(role: TourRole, facts: TourFacts): TourStep[] {
  const f = facts;
  const place = f.placeName;
  const welcome = (extra: string, scope = "") =>
    step(
      "Your desk",
      "welcome",
      role === "coordinator" ? HERO : undefined,
      `Welcome, ${tourGreeting(role)}`,
      `${signedInAs(role, f, scope)} ${extra}`,
    );
  switch (role) {
    case "coordinator":
      return [
        welcome(
          "This short tour shows where things live on the phone. Skip at any step and pick it up again from Help.",
          "for the whole network",
        ),
        step(
          "Your desk",
          "chips",
          { sel: `${HERO_SEL} button`, up: 2 },
          "What needs you",
          "The chips beside it count Act now, To decide, Overdue waits and Tier 1 patients. The figures update as the network changes.",
        ),
        step(
          "Your daily work",
          "eds",
          ED_PRESSURE,
          "Every ED in one row",
          `One chip per emergency department with how many are waiting and the longest wait.${
            f.topEd ? ` ${f.topEd.name} has ${f.topEd.waiting} waiting, the longest for ${f.topEd.longest}.` : ""
          }`,
          "Swipe the row to see the other EDs.",
        ),
        step(
          "Your daily work",
          "queue",
          MY_LIST,
          "What needs you",
          `My list holds Act now, Referrals to decide and Waiting on others, oldest first.${
            f.referralsWaiting === undefined
              ? ""
              : ` ${count(f.referralsWaiting, "referral is", "referrals are")} waiting for a decision.`
          } Everyone waiting above it shows the whole queue, longest wait first.`,
        ),
        phoneCreate("New referral, Log a delay, Update a bed and Add patient"),
        phoneDock(
          `Home, Referrals${f.referralsWaiting === undefined ? "" : ` with ${f.referralsWaiting} awaiting a decision`}, Alerts and Activity.`,
        ),
        step(
          "Finding your way",
          "search",
          { sel: '[data-testid="ward-global-search"]' },
          "Find anyone or anything",
          "Search finds a patient by name or UMRN, or a ward, ED or page by name.",
        ),
        step(
          "Finding your way",
          "menu",
          PHONE_MENU,
          "The menu",
          "Every other screen for your desk: Capacity, Movements, Handover, Waiting, Places and the rest, with Go to a desk and Tools.",
        ),
        PHONE_HELP,
      ];
    case "ward": {
      const ward = f.ward;
      return [
        welcome("You see your own ward's patients and the referrals sent to it."),
        step(
          "Your desk",
          "hero",
          UNIT_CARD,
          place ? `${place} right now` : "Your ward right now",
          ward
            ? `${ward.beds} beds and ${ward.occupied} occupied. ${count(ward.ready, "bed is", "beds are")} ready now. The card also shows tasks due now and beds ready later today.`
            : "Beds ready now, beds occupied, tasks due now and beds ready later today.",
        ),
        step(
          "Your daily work",
          "confirm",
          CONFIRM,
          "Confirm your numbers",
          "Tells the network your bed count is current. Confirm again after any bed change so the coordinator is not working from an old figure.",
        ),
        step(
          "Your daily work",
          "tabs",
          { sel: "#mainTabList" },
          "Three views",
          "Ward home is today's summary. Decisions has the calls due today and Bed board shows every bed.",
        ),
        step(
          "Your daily work",
          "answer",
          { sel: '[data-testid="ward-phone-all-clear"], #ward-awaiting-answer' },
          "Referrals to answer",
          `Referrals sent to ${place ?? "your ward"} wait here for your answer.`,
        ),
        phoneCreate("New referral, Log a delay, Update a bed and Add patient"),
        phoneDock(
          "My ward, Referrals, Alerts and Handover. Handover is the sheet you pass to the next nurse in charge.",
        ),
        step(
          "Finding your way",
          "pin",
          PHONE_MENU,
          "Keep your wards close",
          `In the menu, Pin this ward keeps ${place ?? "your ward"} under My wards. Pin any other ward you cover too.`,
        ),
        PHONE_HELP,
      ];
    }
    case "ed": {
      const ed = f.ed;
      return [
        welcome("You see the people on your board and the referrals you sent."),
        step(
          "Your desk",
          "card",
          ED_CARD,
          "Your board at a glance",
          ed
            ? `${count(ed.waiting, "person is", "people are")} on the psychiatry board.${
                ed.longest ? ` The longest wait is ${ed.longest} against a ${ed.targetHours}h target.` : ""
              }`
            : "Who is waiting, who has no bed yet, who is under a form and the longest wait against the target.",
        ),
        step("Your daily work", "row", ED_ROW, "One row per person", "Tier, bay, time in ED and the next step."),
        phoneCreate("New referral, Log a delay and Add patient"),
        phoneDock("My ED, Referrals, Alerts and Find a bed."),
        step(
          "Finding your way",
          "find-bed",
          { sel: '[data-testid="ward-phone-dock-bed-finder"]' },
          "Find a bed",
          "Lists the wards that meet the checks you choose, with their ready beds, A to Z by name. It is a quick filter, not a suggestion. The referral still checks every rule.",
        ),
        PHONE_HELP,
      ];
    }
    case "community":
      return [
        welcome("You see the people referred to your team and the referrals you send."),
        step(
          "Your desk",
          "hero",
          { sel: '[data-testid="ward-community-phone-hero"]' },
          "Your caseload",
          "The people on your team's caseload and the suburbs it covers. It also shows what the team has not recorded yet.",
        ),
        step(
          "Your daily work",
          "chips",
          { sel: '[aria-label="Team tools"]' },
          "Team actions",
          "How to reach, On duty, Refer from team, Record contact, the CTO register, Catchment counts and more.",
          "Swipe the row to see the rest.",
        ),
        step(
          "Your daily work",
          "tabs",
          { sel: '[aria-label="Team lists"]' },
          "Who is where",
          "Waiting, In bed, Back and CTOs. Back counts the people expected back with the team.",
        ),
        step(
          "Your daily work",
          "row",
          { sel: '[data-testid^="ward-community-phone-in-bed-"]' },
          "One row per person",
          "The ward, legal status and days in the bed, with how long the person was with your team before.",
        ),
        phoneCreate("New referral, Log a delay and Add patient"),
        phoneDock("My team, Referrals, Alerts and Activity."),
        PHONE_HELP,
      ];
    case "officer":
      return [
        welcome("You see the transport jobs assigned to you."),
        step(
          "Your desk",
          "hero",
          HERO,
          "Your jobs at a glance",
          `${f.activeJobs === undefined ? "" : `${count(f.activeJobs, "job is", "jobs are")} still on the road. `}The chips count jobs to accept, late jobs and jobs that need forms. Copy handover copies the list for the next shift.`,
        ),
        step(
          "Your daily work",
          "next",
          { sel: 'section[aria-label="Next action"]' },
          "The next action",
          "The job to act on now, with its route and the forms still to upload. The big button records the next step.",
        ),
        step(
          "Your daily work",
          "jobs",
          { sel: 'section[aria-label="Jobs"]' },
          "Each job",
          "Patient, route and stage. The dots fill as the job moves from accepted to collected.",
        ),
        phoneDock("My jobs, Alerts, On-call and Activity."),
        PHONE_HELP,
      ];
    case "bed_manager":
      return [
        welcome("You see your site's wards, movements and waits."),
        step(
          "Your desk",
          "hero",
          HERO,
          "Beds ready",
          "How many beds are ready and how many people need one, with locked beds, pulled beds and beds in use beside them.",
        ),
        step(
          "Your daily work",
          "tabs",
          { sel: '[aria-label="Capacity view"]' },
          "Overview, Wards and Planned",
          "Overview is the summary. Wards lists every ward and Planned holds booked admissions.",
        ),
        step(
          "Your daily work",
          "mismatch",
          MISMATCH,
          "Mismatch",
          "For each kind of bed, how many people are waiting and how many beds fit them.",
        ),
        phoneDock(
          `Capacity${f.readyBeds === undefined ? "" : ` with ${f.readyBeds} ready`}, Wards, Alerts and Handover.`,
        ),
        PHONE_HELP,
      ];
    case "executive":
      return [
        welcome("You see figures as counts, never patient names.", "for the whole state"),
        step(
          "Your daily work",
          "hero",
          HERO,
          "The network now",
          `${networkToday(f)}The card also shows how full the network is and how many stays ended today.`,
        ),
        step(
          "Your daily work",
          "tabs",
          STATS_NAV,
          "Views",
          "Network, Compare, Services, Wards, EDs, Teams and Weekly each answer one question about the system.",
          "Swipe the row to see them all.",
        ),
        step(
          "Your daily work",
          "trends",
          TRENDS,
          "This session",
          "Hourly counts of referrals, decisions, arrivals and departures recorded since the demo started.",
        ),
        phoneDock("Statistics, Tasks and Activity."),
        PHONE_HELP,
      ];
    case "admin":
      return [
        welcome(
          "You give staff access to the right desk and place. Governance also shows overrides, refused actions and who opened which record.",
          "for the whole state",
        ),
        step(
          "Your daily work",
          "review",
          HERO,
          "What is waiting",
          "Overrides, refused actions and record access checks. Review next opens the next item when there is one.",
        ),
        ...ACCESS_STEPS,
        phoneDock("Tasks and Activity."),
        PHONE_HELP,
      ];
  }
}

/** One desk's tour on one kind of screen, ending with what the desk can do. */
export function tourSteps(role: TourRole, device: TourDevice, facts: TourFacts): readonly TourStep[] {
  const steps = [...(device === "phone" ? phoneSteps(role, facts) : deskSteps(role, facts)), canDoStep(role)];
  // The welcome says how long the tour takes, which depends on how many steps it has.
  const [first, ...rest] = steps;
  const length = ` This takes ${tourMinutes(steps.length, device)}.`;
  return first && first.id === "welcome" && device === "desk"
    ? [{ ...first, body: `${first.body}${length}` }, ...rest]
    : steps;
}

export type TourCanDo = {
  readonly canTitle: string;
  readonly can: readonly string[];
  readonly ask: readonly { readonly label: string; readonly by: string }[];
};

/** Screen groups for the desks the access table limits to screens rather than actions. */
const SCREEN_GROUPS: readonly {
  label: string;
  screens: readonly WardScreenId[];
  /** The name for a desk that opens only one of the group's screens, such as the executive's Capacity. */
  alone?: Partial<Record<WardScreenId, string>>;
}[] = [
  {
    label: "Capacity, Wards and ward boards",
    screens: ["capacity", "wards", "ward", "board"],
    alone: { capacity: "Capacity" },
  },
  { label: "Movements and Waiting", screens: ["movements", "delays"] },
  { label: "Discharges and the bed meeting", screens: ["discharges", "bed-meeting"] },
  { label: "Seclusion and restraint", screens: ["seclusion"] },
  { label: "Handover and Search", screens: ["handover", "search"] },
  { label: "Statistics", screens: ["statistics"] },
  { label: "Governance: overrides, refused actions and record access", screens: ["governance"] },
  { label: "Alerts", screens: ["alerts"] },
  { label: "On-call", screens: ["on-call"] },
  { label: "Settings for your own account", screens: ["settings"] },
];

const SCREEN_ASKS: Partial<Record<TourRole, TourCanDo["ask"]>> = {
  bed_manager: [
    { label: "Referral decisions", by: "Nurse in charge or Bed coordinator" },
    { label: "Anything at another site", by: "Bed coordinator" },
  ],
  executive: [
    { label: "Any patient record or action", by: "the desk that holds the patient" },
    { label: "Network decisions", by: "Bed coordinator" },
  ],
  admin: [{ label: "Any patient record or action", by: "the desk that holds the patient" }],
};

/**
 * What the desk can do, and who to ask for the rest. A desk that acts reads `deskActions`, the same
 * `EVENT_ROLE` table the reducer enforces. The bed manager, executive and access admin take no
 * actions there, so theirs lists the screens `ROLE_SCREENS` opens for them.
 */
export function tourCanDo(role: TourRole): TourCanDo {
  if (role === "bed_manager" || role === "executive" || role === "admin") {
    const table = ROLE_SCREENS[role];
    const can = SCREEN_GROUPS.flatMap(({ label: groupLabel, screens, alone }) => {
      const granted = screens.filter((screen) => table[screen] !== undefined);
      const grants = granted.map((screen) => table[screen]);
      if (grants.length === 0) return [];
      const label = (granted.length === 1 ? alone?.[granted[0]] : undefined) ?? groupLabel;
      if (grants.includes("counts")) return [`${label}, as counts with no patient names`];
      if (role === "bed_manager" && grants.every((grant) => grant === "own") && label !== SCREEN_GROUPS.at(-1)?.label) {
        return [`${label}, your site`];
      }
      if (grants.every((grant) => grant === "all") && role === "bed_manager") return [`${label}, all services`];
      return [label];
    });
    return { canTitle: "Screens you can open", can, ask: SCREEN_ASKS[role] ?? [] };
  }
  const actions = deskActions(role satisfies DeskRole);
  return { canTitle: "You can", can: actions.can, ask: actions.cannot };
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
