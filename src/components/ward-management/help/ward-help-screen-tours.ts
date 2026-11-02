/**
 * SHOW ME AROUND (Josh, 2 Nov 2026: "more interactive tutorials where things are highlighted").
 *
 * One short walk round each main screen, played by Show me (`ward-show-me.tsx`): it opens the
 * screen, then lights each part in turn with a line on what it shows. It presses nothing. They are
 * offered from Help only (the "On this screen" card and search), never as marks on the screens
 * themselves, which stay uncluttered.
 *
 * Steps name their controls by test id, as the how-tos do, and checked against the running app on
 * a desktop and a phone (synthetic data, 2 Nov 2026). A step marked for one device is skipped on the
 * other, so a phone is never walked to a part only a computer draws. Words describe what the screen
 * shows; nothing here ranks, suggests or places, or works out a legal time.
 */
import type { HowTo, ShowMeStep } from "./ward-help-howto";
import type { TourTarget } from "./ward-tour-steps";

const id = (testId: string): TourTarget => ({ sel: `[data-testid="${testId}"]` });
const starts = (testId: string): TourTarget => ({ sel: `[data-testid^="${testId}"]` });

/** The screen's hero card, as the desk tour finds it. */
const HERO: TourTarget = { sel: "#main-content section[aria-labelledby]" };
const PHONE_FIGURES = starts("wf-phone-hero-figure-");

type Around = {
  /** The rail entry id, which is also the screen's help id (`SCREEN_HELP`). */
  readonly screen: string;
  /** The screen's name as Help's "On this screen" card shows it. */
  readonly name: string;
  readonly keywords?: string;
  readonly steps: readonly ShowMeStep[];
};

const AROUND: readonly Around[] = [
  {
    screen: "capacity",
    name: "Capacity",
    keywords: "beds occupancy full ready mismatch",
    steps: [
      {
        target: [id("wf-occupancy-ring"), HERO],
        title: "How full the beds are",
        body: "The share of beds in use across what your desk can see, from each ward's last confirmed figures.",
      },
      {
        target: id("capacity-mismatch"),
        title: "Mismatch",
        body: "People waiting against beds that fit, for each kind of bed. Short means more people than beds.",
      },
      {
        device: "desk",
        target: id("ward-capacity-planned-admissions"),
        title: "Planned admissions",
        body: "Admissions booked ahead. Press Arrived when the person reaches the ward.",
      },
      {
        target: id("capacity-road-time"),
        title: "Nearest ready beds",
        body: "Ready beds by road distance from the place you choose. Distance only, not suitability.",
      },
      {
        device: "desk",
        target: starts("ward-diagram-unit-"),
        title: "Every ward",
        body: "Each ward's beds, ready and being made ready. Choose a ward to open its panel.",
      },
      {
        device: "desk",
        target: id("capacity-bed-meeting-tv"),
        title: "Bed meeting and TV",
        body: "Bed meeting opens the meeting view. Open on TV puts it on the meeting room screen, read only.",
      },
    ],
  },
  {
    screen: "movements",
    name: "Movements",
    keywords: "stages timeline moving",
    steps: [
      {
        target: id("movements-day-metric"),
        title: "Open movements",
        body: "Everyone moving to a bed now, from referral to arrival.",
      },
      {
        device: "desk",
        target: id("ward-movement-horizon"),
        title: "48 hour timeline",
        body: "The next two days for each receiving ward.",
      },
      {
        device: "phone",
        target: id("ward-movements-arrange-fold"),
        title: "Filter",
        body: "Narrow the list to the movements you are looking for.",
      },
      {
        target: [{ sel: '#main-content a[href^="/ward-flow/movements/"]' }, starts("movements-group-toggle-")],
        title: "Open a movement",
        body: "Movements are listed by stage. Open one to see its bed, transport and legal form in one place.",
      },
    ],
  },
  {
    screen: "referrals",
    name: "Referrals",
    keywords: "decide awaiting decision offered",
    steps: [
      {
        target: [id("ward-referral-kpis"), id("ward-referral-phone-hero")],
        title: "Referrals at a glance",
        body: "How many are awaiting a decision, the oldest wait, and any decision overdue.",
      },
      {
        target: [id("ward-referral-beds-ready"), id("ward-referral-phone-beds")],
        title: "Beds ready",
        body: "Beds ready now, by kind, so you can see what is free before asking a ward.",
      },
      {
        target: id("ward-referral-board-queued"),
        title: "Awaiting decision",
        body: "Longest wait first, never ranked by the app. Choose a name to open the referral.",
      },
      {
        target: id("ward-referral-board-ward-offers"),
        title: "Offered to wards",
        body: "Referrals waiting on a ward's answer, with who was asked.",
      },
      {
        device: "desk",
        target: id("ward-referral-meeting"),
        title: "Bed meeting list",
        body: "The referrals to talk through at the bed meeting.",
      },
    ],
  },
  {
    screen: "handover",
    name: "Handover",
    keywords: "shift sheet sign off print",
    steps: [
      {
        target: [id("ward-handover-kpi-strip"), id("wf-phone-hero-figure-act")],
        title: "What to hand over",
        body: "Act now, flagged urgent and due before the handover. Read Act now first.",
      },
      {
        target: id("ward-handover-open-promises"),
        title: "Ward promises to chase",
        body: "Times a ward said it would ring back. Chase the overdue ones first.",
      },
      {
        device: "desk",
        target: id("ward-handover-sheet"),
        title: "The handover sheet",
        body: "Filter the sheet to a service, then use Print handover for the paper copy.",
      },
      {
        target: [id("ward-handover-sign-bar"), id("ward-handover-phone-sign-off")],
        title: "Sign off",
        body: "Work through the Before you sign checks, then choose Sign off.",
      },
    ],
  },
  {
    screen: "delays",
    name: "Waiting",
    keywords: "delays blocker held up why waiting",
    steps: [
      {
        target: id("delays-hero"),
        title: "Who is waiting",
        body: "Everyone waiting in an ED or in transit, and the longest wait.",
      },
      {
        target: id("delays-owner-yours"),
        title: "Who the wait is on",
        body: "Split by who can move it on next: you, the wards, transport or someone else.",
      },
      {
        target: [id("delays-view-needs-me"), id("delays-filter-fold")],
        title: "Saved views",
        body: "Due soon or on you, Form due and For handover each narrow the list.",
      },
      {
        target: id("delays-waiting-list"),
        title: "The waiting list",
        body: "Longest wait first. Open a row to deal with what is holding it up.",
      },
    ],
  },
  {
    screen: "discharges",
    name: "Discharges",
    keywords: "bed release list",
    steps: [
      {
        target: id("ward-discharge-kpi-strip"),
        title: "Discharges today",
        body: "Held up, confirmed, expected, and discharged in the last day.",
      },
      {
        target: id("ward-discharge-group-blocked"),
        title: "Held up first",
        body: "Discharges with something in the way come first. Open one to see what is blocking it and the bed release.",
      },
      {
        device: "desk",
        target: id("ward-discharge-barrier-bars"),
        title: "Held up by barrier",
        body: "What is holding discharges up, counted by barrier.",
      },
      {
        device: "desk",
        target: id("ward-discharge-print"),
        title: "Print list",
        body: "A paper copy of the list for the ward or the bed meeting.",
      },
    ],
  },
  {
    screen: "legal-forms",
    name: "Legal forms",
    keywords: "mental health act form expiry typed",
    steps: [
      {
        target: id("ward-legal-hud-island"),
        title: "Legal forms",
        body: "Every open movement with a legal form, and the expiry time a person typed from that form.",
      },
      {
        target: id("legal-limits-not-checked"),
        title: "Times as typed",
        body: "Ward Flow does not work out legal periods. The times are copied from the paper form and are not legally checked.",
      },
      {
        target: id("ward-legal-forms-groups"),
        title: "Choose a patient",
        body: "Grouped by the typed expiry, earliest typed time first. Choose a patient to see their form.",
      },
    ],
  },
  {
    screen: "on-call",
    name: "On-call",
    keywords: "phone number roster who to call",
    steps: [
      {
        target: id("ward-on-call-hud-island"),
        title: "Who to call now",
        body: "The main state and service lines, with who answers each one now.",
      },
      {
        target: [id("ward-on-call-directory"), { sel: '#main-content [role="tablist"]' }],
        title: "The directory",
        body: "Hospitals, Teams, State and Mine. Search by role, place or number, and star a line to keep it under Mine.",
      },
      {
        device: "desk",
        target: id("ward-on-call-role-panel"),
        title: "The chosen line",
        body: "Who answers the line you chose, and until when.",
      },
      {
        device: "desk",
        target: id("ward-on-call-check-foot"),
        title: "When it was checked",
        body: "Each list says when someone last checked it. Mark checked now once you have confirmed it.",
      },
      {
        device: "phone",
        target: id("ward-on-call-phone-more"),
        title: "More tools",
        body: "Cover at, to see who answers at a later time, and the other on-call tools.",
      },
    ],
  },
  {
    screen: "out-of-area",
    name: "Out of area",
    keywords: "away from home repatriation return plan",
    steps: [
      {
        target: id("ward-out-of-area-count-people"),
        title: "Away from home",
        body: "People in a bed outside their home health service.",
      },
      {
        target: [starts("ward-out-of-area-highlight-"), PHONE_FIGURES],
        title: "Quick views",
        body: "Discharge date passed, no plan and the long trips home. Each narrows the list.",
      },
      {
        device: "desk",
        target: id("ward-out-of-area-table"),
        title: "The list",
        body: "Each person's home region, placement and discharge date.",
      },
      {
        device: "desk",
        target: id("ward-out-of-area-subject"),
        title: "Return plan",
        body: "Choose a person and their return plan opens here.",
      },
    ],
  },
  {
    screen: "seclusion",
    name: "Seclusion",
    keywords: "restraint restrictive practice incident room",
    steps: [
      {
        target: id("seclusion-scope-note"),
        title: "An operational view",
        body: "Times are as typed, and nothing works out a legal limit.",
      },
      {
        target: id("seclusion-ward-table"),
        title: "Ward by ward",
        body: "Each ward's seclusion room, what is in use now and its incidents. Choose a ward.",
      },
      {
        target: id("seclusion-room-available"),
        title: "The seclusion room",
        body: "Mark available or Mark out of service for the chosen ward's room.",
      },
      {
        target: id("seclusion-start-form"),
        title: "Record start and end",
        body: "Choose the patient and what is in use, type the time, then Record start. Record end when it finishes.",
      },
      {
        target: id("seclusion-incident-form"),
        title: "Record incident",
        body: "Choose the kind, type the time, then Record incident.",
      },
    ],
  },
  {
    screen: "governance",
    name: "Governance",
    keywords: "review audit override decisions",
    steps: [
      {
        target: [id("ward-governance-workbench"), PHONE_FIGURES],
        title: "What to review",
        body: "Recorded decisions waiting for review, such as overrides and refusals, for this session.",
      },
      {
        device: "phone",
        target: id("wf-group-head"),
        title: "Waiting for review",
        body: "Newest first. Choose an event, then Record review.",
      },
      {
        device: "desk",
        target: id("ward-governance-override-detail"),
        title: "Event detail",
        body: "Choose an event under Review and its detail shows here.",
      },
      {
        device: "desk",
        target: id("ward-governance-decision-record"),
        title: "Your review",
        body: "Record review once you have looked at it.",
      },
    ],
  },
  {
    screen: "statistics",
    name: "Statistics",
    keywords: "figures trends numbers",
    steps: [
      {
        target: id("ward-statistics-nav"),
        title: "Choose a view",
        body: "Network, Compare, Services, Wards, EDs, Teams and Weekly. Every figure is from synthetic records.",
      },
      {
        device: "desk",
        target: id("ward-statistics-network-cards"),
        title: "Occupancy by service",
        body: "Beds in use for each health service.",
      },
      {
        device: "desk",
        target: id("ward-statistics-fixed-questions"),
        title: "Ask a question",
        body: "Fixed questions answered from the records, such as which pulled beds are past their pull time limit.",
      },
      {
        device: "phone",
        target: id("ward-statistics-more-figures"),
        title: "More figures",
        body: "Discharges held up, declines by reason and the other figures.",
      },
      {
        device: "desk",
        target: id("ward-statistics-export"),
        title: "Export the figures",
        body: "Downloads the figures at the top of the page as a spreadsheet file.",
      },
    ],
  },
  {
    screen: "ed",
    name: "All EDs",
    keywords: "emergency department waiting",
    steps: [
      {
        target: [starts("ed-index-card-"), HERO],
        title: "Each ED",
        body: "Every emergency department, with the people there waiting for a mental health bed.",
      },
      {
        target: [id("ed-index-match-count"), id("ed-index-phone-filters")],
        title: "Filter and order",
        body: "Filter by health service or status, and choose the order.",
      },
      {
        device: "desk",
        target: starts("ed-index-link-"),
        title: "Enter an ED",
        body: "Enter opens that ED's board and each patient's next step.",
      },
    ],
  },
  {
    screen: "search",
    name: "Patients",
    keywords: "find person search",
    steps: [
      {
        target: id("ward-patient-typeahead-input"),
        title: "Find a person",
        body: "Search by name, record number or place.",
      },
      {
        target: id("ward-patient-search-results-console"),
        title: "Everyone now",
        body: "Open movements and stays. Open a row for the person's details.",
      },
      {
        target: id("ward-patient-search-add"),
        title: "Add patient",
        body: "Register a new synthetic person when they are not found.",
      },
    ],
  },
  {
    screen: "alerts",
    name: "Alerts",
    keywords: "notifications act now",
    steps: [
      {
        target: [id("ward-alerts-phone-hero"), HERO],
        title: "Addressed to your desk",
        body: "Alerts for this desk right now, act now first.",
      },
      {
        target: id("ward-alerts-open"),
        title: "Open an alert",
        body: "Each alert opens the record it is about.",
      },
      {
        target: id("ward-alerts-forecast"),
        title: "Forecast",
        body: "Kinds of bed likely to be short tomorrow, to help plan at the bed meeting.",
      },
    ],
  },
];

/** The id of the walk round `screen`, for the "On this screen" card. */
export function aroundId(screen: string): string {
  return `around-${screen}`;
}

/**
 * Each walk round as a how-to, so search, Show me and usage counts treat it as any other. They are
 * for every desk that opens the screen (`howToFor` checks the screen through `go`).
 */
export const SCREEN_TOURS: readonly HowTo[] = AROUND.map((each) => ({
  id: aroundId(each.screen),
  topic: "Finding your way",
  title: `Show me around ${each.name}`,
  keywords: `walkthrough explain screen page ${each.keywords ?? ""}`.trim(),
  answer: `A short walk round ${each.name}: Show me lights each part in turn and says what it shows. It never presses anything.`,
  desks: "all",
  go: each.screen,
  around: each.screen,
  showMe: each.steps,
}));
