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
import type { HowTo } from "./ward-help-howto";
import { type Around, HERO, id, MORE_PAGES, named, starts } from "./ward-help-screen-tours-pages";

const PHONE_FIGURES = starts("wf-phone-hero-figure-");

/**
 * Walk-rounds for the rail screens that had none (5 Nov 2026): Home, All wards, Places, New
 * referral and Transport. Each step names a part the screen draws before anyone chooses a record.
 */
const MORE_SCREENS: readonly Around[] = [
  {
    screen: "command",
    name: "Home",
    keywords: "home my list coordinator start queue",
    steps: [
      {
        target: id("ward-home-occupancy-link"),
        title: "How full the network is",
        body: "The share of network beds in use, with At risk once it passes the line. Open it for Capacity.",
      },
      {
        target: id("ward-home-ed-pressure"),
        title: "Every ED at a glance",
        body: "One tile per emergency department, with how many are waiting and the longest wait. Choose a tile to narrow the list to that ED, and again to clear it.",
      },
      {
        target: { sel: '#main-content [role="radiogroup"][aria-label="Home list"]' },
        title: "Needs you and Flow",
        body: "Needs you is what needs a person. Flow lists every open movement, and its tabs narrow it by stage.",
      },
      {
        target: id("home-my-list"),
        title: "Needs you",
        body: "Act now first, then referrals to decide and what you are waiting on others for. Each row opens the record it is about.",
      },
      {
        device: "desk",
        target: id("home-beds-fit"),
        title: "Beds that fit",
        body: "For each bed type, beds against the people waiting, now and tomorrow. Short means more people than beds. Counts only.",
      },
      {
        device: "desk",
        target: id("home-placement-prompt"),
        title: "Placement",
        body: "Choose someone from the list and their placement checks open here. A person always chooses the bed.",
      },
    ],
  },
  {
    screen: "wards",
    name: "All wards",
    keywords: "ward list every ward occupancy beds ready stale",
    steps: [
      {
        target: [id("wf-occupancy-ring"), HERO],
        title: "Beds ready now",
        body: "Ready beds across the wards you can see, and the share in use. The counts beside it narrow the list, such as Stale counts.",
      },
      {
        target: named("Ward filters", "section"),
        title: "Find a ward",
        body: "Search by ward, hospital or service. Filters holds status, age group and order.",
      },
      {
        target: [starts("ward-index-link-"), named("Wards", "section")],
        title: "Open a ward",
        body: "Each ward with its beds. Open one for its beds, arrivals and discharges.",
      },
      {
        device: "desk",
        target: { sel: 'aside[aria-label="Statewide by service"]' },
        title: "By service",
        body: "Occupancy for each health service, and the wards whose bed count needs a check.",
      },
    ],
  },
  {
    screen: "hub",
    name: "Places",
    keywords: "places hub network wards eds teams pin catchments",
    steps: [
      {
        target: HERO,
        title: "What needs a check",
        body: "The band names the wards whose bed count is old, with the ward to ask first.",
      },
      {
        target: { sel: 'nav[aria-label="Places views"]' },
        title: "Places and Catchments",
        body: "Catchments finds which community team covers a suburb.",
      },
      {
        target: named("Search wards, EDs and community teams", "input"),
        title: "Search places",
        body: "Type a ward, hospital, ED, team or service. Show narrows the list to wards, EDs or teams.",
      },
      {
        target: { sel: "#hub-results" },
        title: "The network",
        body: "Every place, grouped by service. Choose one to see who is heading or waiting there, then refer or open it.",
      },
      {
        device: "desk",
        target: { sel: '[data-testid="hub-glance-trigger"]' },
        title: "At a glance",
        body: "Opens wards that need a bed check, wards by service, and the places you pinned or opened lately.",
      },
    ],
  },
  {
    screen: "referral-intake",
    name: "New referral",
    keywords: "new referral form send refer intake raise",
    steps: [
      {
        target: starts("ward-referral-refer-to-"),
        title: "Refer to",
        body: "A ward, a community team or an ED. The steps below change to suit.",
      },
      {
        device: "desk",
        target: [id("ward-referral-new-patient-toggle"), id("ward-referral-no-patient")],
        title: "The patient",
        body: "Find the patient, or choose Add patient for someone new. Not yet identified covers a person whose name is not known.",
      },
      {
        device: "desk",
        target: [
          id("ward-referral-use-catchment"),
          id("ward-referral-catchment-not-known"),
          id("ward-referral-suburb-note"),
        ],
        title: "Catchment",
        body: "Worked out from the suburb on the record. Use this catchment to accept it, or choose another.",
      },
      {
        device: "desk",
        target: id("ward-referral-summary-rail"),
        title: "Before you send",
        body: "What is still needed, step by step. Send stays locked until it is all in.",
      },
      {
        device: "desk",
        target: id("ward-referral-save-draft"),
        title: "Save draft",
        body: "Keeps the referral in this tab until it reloads, so you can come back to it.",
      },
      {
        device: "phone",
        target: id("ward-referral-phone-hero"),
        title: "The referral so far",
        body: "Where the referral is going. It reads Fill in and send until it has gone.",
      },
      {
        device: "phone",
        target: id("ward-referral-phone-continue"),
        title: "Continue",
        body: "Takes you to the next step still needed. It sends once every step is in.",
      },
    ],
  },
  {
    screen: "officer",
    name: "Transport",
    keywords: "transport officer jobs run sheet collect arrive booking",
    steps: [
      {
        target: HERO,
        title: "Jobs open",
        body: "How many transport jobs are open. The figures highlight jobs, such as those that need transport.",
      },
      {
        acts: ["RECORD_TRANSPORT_CAD"],
        target: id("ward-officer-hero-log-booking"),
        title: "Log booking",
        body: "Records a booking already made by phone, with the CAD number and the quoted ETA.",
      },
      {
        target: id("ward-officer-need"),
        title: "Needs transport",
        body: "Beds pulled with no transport logged yet. Log booking on a row once it is booked.",
      },
      {
        target: [id("ward-officer-joblist"), named("Jobs", "section")],
        title: "Jobs",
        body: "Late jobs first, then forms to upload, then furthest along. History holds the jobs closed today.",
      },
      {
        target: [starts("ward-officer-next-"), named("Next action", "section")],
        title: "The next step",
        body: "Each job's button is its next stage, such as En route or Arrived at ward. It is recorded with the time.",
      },
    ],
  },
];

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
        acts: ["CONVERT_PLANNED_ADMISSION"],
        target: id("ward-capacity-planned-admissions"),
        title: "Planned admissions",
        body: "Admissions booked ahead. Press Arrived when the person reaches the ward.",
      },
      {
        // Josh's fifth notes (8 Nov 2026): desktop shows drive times in the Mismatch drawer instead.
        device: "phone",
        target: id("capacity-road-time"),
        title: "Nearest ready beds",
        body: "Ready beds by road distance from the place you choose. Distance only, not suitability.",
      },
      {
        device: "desk",
        target: starts("capacity-map-ward-"),
        title: "Every ward",
        body: "Each ward's beds, ready and being made ready. Choose a ward to open its panel.",
      },
      {
        device: "desk",
        target: id("capacity-bed-meeting"),
        title: "Bed meeting and TV",
        body: "Bed meeting opens a menu: Print the meeting sheet and Open the meeting agenda. Open on TV shows only when a TV is available, and puts the meeting on the room screen, read only.",
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
        // M3: the timeline sits behind its switch, shown by default (Note 7); light the switch when it is hidden.
        target: [id("ward-movement-horizon"), id("movements-timeline-switch")],
        title: "The timeline",
        body: "What is coming up for each receiving ward.",
      },
      {
        device: "phone",
        target: id("ward-movements-arrange-fold"),
        title: "Filter",
        body: "Narrow the list to the movements you are looking for.",
      },
      {
        // The row's own Review link, then its row, so the step never lights a row's Ask wards button.
        target: [
          { sel: '#main-content a[href^="/ward-flow/movements/"]:not([href*="?"])', up: 1 },
          starts("movements-group-toggle-"),
        ],
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
        title: "Bed meeting",
        body: "The ... menu opens the bed meeting agenda at its referrals, the ones to talk through at the meeting.",
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
        body: "Use Show to filter the sheet to a service, then use Print handover for the paper copy.",
      },
      {
        acts: ["RECORD_HANDOVER_SIGN_OFF", "RECORD_SITE_HANDOVER_SIGN_OFF"],
        target: [id("ward-handover-hero-sign-off"), id("ward-handover-phone-sign-off")],
        title: "Sign off",
        body: "Sign off shows how many checks are clear. Open it, work through the Before you sign checks, then choose Sign off.",
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
        body: "Split by who can move it on next: you, the ED, the wards, transport or someone else.",
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
        device: "desk",
        target: id("ward-discharge-kpi-strip"),
        title: "Discharges today",
        body: "Held up, confirmed, expected, and discharged in the last day.",
      },
      {
        // A phone's hero folds the four counts away, so its overview points at the headline counts.
        device: "phone",
        target: id("ward-discharge-bed-days-past"),
        title: "Discharges today",
        body: "How many to work now, how many are open, and bed days past the ward's date.",
      },
      {
        target: id("ward-discharge-group-blocked"),
        title: "Held up first",
        body: "Discharges with something in the way come first. Open one to see what is holding it up and which bed it frees.",
      },
      {
        device: "desk",
        target: id("ward-discharge-barrier-bars"),
        title: "Held up by reason",
        body: "What is holding discharges up, counted by reason.",
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
        target: { sel: '#main-content [role="radiogroup"][aria-label="View"]' },
        title: "On a form, Checklist and History",
        body: "On a form lists everyone with a form now. Checklist shows what each form still needs. History holds closed moves. Seclusion and restraint, for the desks that see it, shows the seclusion and restraint forms.",
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
        body: "The state lines, then bed flow for each service, then your starred lines. Copy a number straight from its card.",
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
        target: HERO,
        title: "Away from home",
        body: "How many people are in a bed outside their home health service, split by days away. Checking counts discharge dates passed and missing return plans.",
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
        body: "Choose a person and their return plan opens in a side panel.",
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
        target: id("seclusion-live"),
        title: "In use now",
        body: "Everyone in seclusion or restraint now, longest first. Ward staff record changes on their own ward.",
      },
      {
        acts: ["RECORD_RESTRICTIVE_PRACTICE_START"],
        target: id("seclusion-start-open"),
        title: "Start seclusion or restraint",
        body: "Find the patient, choose what is in use, type the time or press Now, then Record start.",
      },
      {
        acts: ["SET_SECLUSION_ROOM_STATUS"],
        target: id("seclusion-rooms"),
        title: "The seclusion rooms",
        body: "Each secure ward's room. Change marks it available or out of service.",
      },
      {
        acts: ["RECORD_WARD_INCIDENT"],
        target: id("seclusion-incident-open"),
        title: "Record incident",
        body: "Choose the ward and the kind, type the time, then Record incident.",
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
        acts: ["REVIEW_AUDIT_EVENT"],
        target: id("wf-group-head"),
        title: "Waiting for review",
        body: "Newest first. Choose an event, then Record review.",
      },
      {
        // Drawer review (6 Nov 2026): the event's detail opens in a drawer only once someone chooses
        // it, so the walk lights the list rather than a detail pane that is no longer on the page.
        device: "desk",
        target: { sel: "[data-audit-row]" },
        title: "Waiting for review",
        body: "Newest first. Choose an event and its detail opens beside the list.",
      },
      {
        device: "desk",
        acts: ["REVIEW_AUDIT_EVENT"],
        target: id("ward-governance-record-review"),
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
        target: starts("ed-index-preview-"),
        title: "Preview who is waiting",
        body: "Choose an ED's card to preview who is waiting there without leaving the list.",
      },
      {
        device: "desk",
        target: starts("ed-index-link-"),
        title: "Enter an ED",
        body: "Enter opens that ED's board and each patient's next step.",
      },
      {
        device: "phone",
        target: starts("ed-index-phone-row-"),
        title: "Open an ED",
        body: "Each row is one ED, with how many are waiting. Open it for that ED's board.",
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
        target: { sel: '[role="radiogroup"][aria-label="Where people are now"]' },
        title: "Where people are now",
        body: "Everyone, In ED, In placement, Inpatient, Community or Not active.",
      },
      {
        target: id("ward-patient-search-results-console"),
        title: "Everyone now",
        body: "Open movements and stays. Open a row for the person's details.",
      },
      {
        target: id("ward-patient-search-add"),
        title: "Add patient",
        acts: ["ADD_PATIENT"],
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
        target: id("ward-alerts-filters"),
        title: "Show open alerts",
        body: "Act now, Waiting, Forecast, Reminders, Notices, Snoozed or Yours. All shows every one again.",
      },
      {
        target: id("ward-alerts-open"),
        title: "Open an alert",
        body: "Each alert opens the record it is about.",
      },
      {
        device: "desk",
        target: id("ward-alerts-order-note"),
        title: "The order",
        body: "How the list is ordered: act now first, then waiting, oldest first in each.",
      },
      {
        target: id("ward-alerts-forecast"),
        title: "Forecast",
        body: "Forecast lines set in Settings: beds likely to be short tomorrow, the ED access target and a worse forecast.",
      },
    ],
  },
  {
    screen: "ward",
    name: "this ward",
    keywords: "ward beds bed board my ward round",
    page: {
      purpose: "One ward's beds, who is coming and going, and the decisions due this shift.",
      path: /^\/ward-flow\/ward\/[^/]+$/u,
      needs: "ward",
    },
    steps: [
      {
        target: starts("ward-unit-card-"),
        title: "This ward",
        body: "Beds ready now, the bed list, and what the page is still checking.",
      },
      {
        target: id("ward-open-bed-board"),
        title: "Place or move",
        body: "Opens the bed board to place a patient in a bed or move one.",
      },
      {
        // The field, or on a phone the search button that opens it.
        target: [id("ward-find-input"), id("ward-find-open")],
        title: "Find on this ward",
        body: "Find a bed or a person on this ward.",
      },
      {
        device: "desk",
        target: id("ward-open-tv"),
        title: "The toolbar",
        body: "On TV opens a read only screen for the ward's TV. More, beside it, holds Notices, Shift brief and Ward handover.",
      },
      {
        device: "desk",
        target: id("ward-unit-beds"),
        title: "Bed figures",
        body: "Ready, pulled, closed and occupied beds, with when the ward last confirmed them.",
      },
      {
        device: "phone",
        target: id("ward-walk-round"),
        title: "The round",
        body: "Go through each patient in turn. The count shows how many are reviewed.",
      },
    ],
  },
  {
    screen: "ed-board",
    name: "this ED board",
    keywords: "emergency department ed board waiting next step",
    page: {
      purpose: "One emergency department's mental health patients, each row with its next step.",
      path: /^\/ward-flow\/ed\/[^/]+$/u,
      needs: "ed",
    },
    steps: [
      {
        target: starts("ward-ed-card-"),
        title: "This ED",
        body: "Who is waiting here and who is in transit.",
      },
      {
        device: "desk",
        target: starts("ward-ed-next-"),
        title: "Each row's next step",
        body: "The button is the row's next step, such as Record exam or Log transport booking.",
      },
      {
        device: "desk",
        target: starts("ward-ed-form-pick-"),
        title: "Legal form",
        body: "The form on file. Type any expiry time from the paper form; nothing works it out.",
      },
      {
        device: "desk",
        target: id("ward-ed-inbox-group"),
        title: "New referrals",
        body: "Referrals waiting at this ED. Ask for a bed starts a bed request.",
      },
      {
        target: [id("ward-ed-add-patient"), id("ward-phone-create")],
        title: "Add patient",
        body: "Add patient registers a new synthetic person. On a phone it is under the plus button.",
      },
    ],
  },
  ...MORE_SCREENS,
  ...MORE_PAGES,
];

/**
 * Highlighted jobs for screens that had none (2 Nov 2026). Kept here, beside the walk-rounds, and
 * joined to the how-to list there (`HOW_TOS`).
 */
export const MORE_JOBS: readonly HowTo[] = [
  {
    id: "record-legal-form",
    topic: "Handover and reports",
    title: "Record a new legal form",
    keywords: "mha form written renew continuation paper legal",
    answer:
      "Open Legal forms and choose the patient. Use Record next form when a new form is written, typing the time from the paper form. Ward Flow never works out the expiry: it keeps the time as typed.",
    desks: ["ed", "coordinator", "ward"],
    acts: ["RECORD_LEGAL_FORM_WRITTEN"],
    go: "legal-forms",
    showMe: [
      {
        target: { sel: '[data-testid="ward-legal-forms-groups"]' },
        title: "Choose the patient",
        body: "Forms are grouped by the typed expiry, earliest typed time first. Choose the patient to open their form.",
      },
      {
        target: { sel: '[data-testid="ward-legal-forms-record-region"]' },
        title: "Record next form",
        body: "Type the time from the paper form, then record it. Record and tell lists who to let know.",
      },
    ],
  },
  {
    id: "find-on-call",
    topic: "Finding your way",
    title: "Find who is on call",
    keywords: "oncall phone number call roster consultant registrar switchboard",
    answer:
      "Open On-call and search by role, hospital, ward, team or number. A line opens on who answers now, with Copy number, and If no answer names who to try next. Use Cover at for a later time, and star a line to keep it under Mine.",
    desks: "all",
    go: "on-call",
    showMe: [
      {
        target: [{ sel: '[data-testid="ward-on-call-directory"]' }, { sel: '#main-content [role="tablist"]' }],
        title: "Search the directory",
        body: "Hospitals, Teams, State and Mine. Search by role, place or number.",
      },
      {
        device: "desk",
        target: { sel: '[data-testid="ward-on-call-role-panel"]' },
        title: "Who answers",
        body: "Choose a line to see who answers it now and until when.",
      },
      {
        device: "phone",
        target: { sel: '[data-testid="ward-on-call-phone-more"]' },
        title: "Cover at",
        body: "Under more tools, Cover at shows who answers at a later time.",
      },
    ],
  },
  {
    id: "plan-return-home",
    topic: "Beds and referrals",
    title: "Plan a patient's return home",
    keywords: "out area repatriation repat away home region transfer back",
    answer:
      "Open Out of area and choose the person. Fill in their return plan, then Record sent to ward or Record return.",
    desks: ["coordinator"],
    acts: ["RECORD_REPATRIATION"],
    go: "out-of-area",
    showMe: [
      {
        target: [{ sel: '[data-testid^="ward-out-of-area-row-"]' }, { sel: '[data-testid^="wf-phone-hero-figure-"]' }],
        title: "Choose the person",
        body: "Everyone in a bed outside their home health service, with days away.",
      },
      {
        target: [
          { sel: '[data-testid="ward-out-of-area-plan-sheet"]' },
          { sel: '[data-testid="ward-out-of-area-subject"]' },
        ],
        title: "Fill in the return plan",
        body: "Then Record sent to ward, or Record return once they are home.",
      },
    ],
  },
  {
    id: "record-seclusion",
    topic: "Beds and referrals",
    title: "Record seclusion, restraint or an incident",
    keywords: "seclusion restraint restrictive practice incident room start end",
    answer:
      "Open Forms, then Seclusion and restraint. Start seclusion or restraint when it begins and Record end when it finishes, or Record incident for an incident. Times are as typed, and nothing works out a legal limit.",
    desks: ["ward", "coordinator"],
    acts: ["RECORD_RESTRICTIVE_PRACTICE_START", "RECORD_WARD_INCIDENT"],
    go: "seclusion",
    showMe: [
      {
        target: { sel: '[data-testid="seclusion-live"]' },
        title: "In use now",
        body: "Everyone in seclusion or restraint now, with Record end on each row.",
      },
      {
        target: { sel: '[data-testid="seclusion-start-open"]' },
        title: "Start seclusion or restraint",
        body: "Find the patient, choose what is in use, type the time, then Record start.",
      },
      {
        target: { sel: '[data-testid="seclusion-incident-open"]' },
        title: "Record incident",
        body: "Choose the ward and the kind, type the time, then Record incident.",
      },
    ],
  },
  {
    id: "clear-held-up-discharge",
    topic: "Beds and referrals",
    title: "Clear a held-up discharge",
    keywords: "discharge held up blocked barrier blocker release delay",
    answer:
      "Open Discharges, where held-up discharges come first. Open one to see what is holding it up and which bed it frees, and update the hold-up once it is sorted.",
    desks: ["ward", "coordinator"],
    acts: ["CLEAR_STAY_DISCHARGE_BLOCKER", "SET_DISCHARGE_BARRIER"],
    go: "discharges",
    showMe: [
      {
        // The phone fallback is the next step row only when it names held-up discharges.
        target: [
          { sel: '[data-testid="ward-discharge-kpi-blocked"]' },
          { sel: "#main-content [data-wf-hero-next]", text: "held-up" },
        ],
        title: "Held up",
        body: "How many discharges have something in the way.",
      },
      {
        target: { sel: '[data-testid="ward-discharge-group-blocked"]' },
        title: "Open one",
        body: "Held up comes first. Open a discharge to see what is holding it up and which bed it frees.",
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
  go: each.page ? undefined : each.screen,
  needs: each.page?.needs,
  around: each.screen,
  showMe: each.steps,
}));

/** What a walked page is for, for its printed guide (rail screens take theirs from `SCREEN_HELP`). */
export function aroundPagePurpose(screen: string): string | undefined {
  return AROUND.find((each) => each.screen === screen)?.page?.purpose;
}

/**
 * Whether `howTo` can play at `pathname`: always, except a page walk round (one ward, one ED board),
 * which plays only on its own page, where its parts are drawn (review, 2 Nov 2026).
 */
export function walkPlaysHere(howTo: HowTo, pathname: string): boolean {
  const page = howTo.around ? AROUND.find((each) => each.screen === howTo.around)?.page : undefined;
  return !page || page.path.test(pathname.replace(/\/+$/u, ""));
}
