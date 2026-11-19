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
import { type Around, HERO, id, MORE_PAGES, named, starts } from "./ward-help-screen-tours-pages";

const PHONE_FIGURES = starts("wf-phone-hero-figure-");

/**
 * One Show me step: the part to light (the first of its targets on screen), then what its card says
 * and any device or desk limit. Written this way so each step stays a few lines (15 Nov 2026).
 */
function step(target: ShowMeStep["target"], card: Omit<ShowMeStep, "target">): ShowMeStep {
  return { target, ...card };
}

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
      step([named("Figures", '[role="group"]'), HERO], {
        title: "Bed flow right now",
        body: "Open movements, Ready beds and the share in use across the network. Press Open movements or Ready for its breakdown.",
      }),
      step(id("ward-home-occupancy-link"), {
        title: "How full the network is",
        body: "The share of network beds in use, with At risk once it passes the line. Open it for Capacity.",
      }),
      step(
        { sel: "#main-content [data-wf-hero-next]" },
        {
          title: "What needs you",
          body: "How many need you now, split into act now and to decide. Show act now takes you to that list.",
        },
      ),
      step(id("home-next-checking"), {
        title: "Checking",
        body: "Bed counts gone stale, wards not reporting and outage packs never printed. Open a part to see which.",
      }),
      step(id("ward-quick-bar"), {
        title: "Quick controls",
        body: "The tools you use most, such as Ward updates and Find a bed. Each opens in the Tools panel on this page.",
      }),
      step(id("ward-home-ed-pressure"), {
        title: "Every ED at a glance",
        body: "One tile per emergency department, with how many are waiting and the longest wait. Choose a tile to narrow the list to that ED, and again to clear it.",
      }),
      step(
        { sel: '#main-content [role="radiogroup"][aria-label="Home list"]' },
        {
          title: "Needs you and Flow",
          body: "Needs you is what needs a person. Flow lists every open movement, and its tabs narrow it by stage. On a phone, Later today is the third list.",
        },
      ),
      step(id("ward-home-more"), { title: "More", body: "Today's review, Night view and Alerts history." }),
      step(id("home-since-banner"), {
        title: "Since the last shift",
        body: "What changed since the previous shift started. Review opens the changes to go through.",
      }),
      step(id("home-my-list"), {
        title: "Needs you",
        body: "Act now first, then referrals to decide and what you are waiting on others for. A row for someone waiting for a bed opens their placement checks; other rows open the record they are about. A person always chooses the bed.",
      }),
      step(id("home-call-sheet-open"), {
        title: "Ward calls",
        body: "The wards to ring about waiting referrals, in call order, to read or print.",
      }),
      step(id("home-beds-fit"), {
        device: "desk",
        title: "Beds that fit",
        body: "For each bed type, beds against the people waiting, now and tomorrow. Short means more people than beds. Counts only.",
      }),
      step(id("home-planned"), {
        device: "desk",
        title: "Later today",
        body: "Planned moves and expected times for the rest of your shift and after it, from times the records hold. Past planned time comes first.",
      }),
      step(id("home-tomorrow"), {
        device: "desk",
        title: "Tomorrow",
        body: "Expected and confirmed discharges and planned admissions for tomorrow.",
      }),
    ],
  },
  {
    screen: "wards",
    name: "All wards",
    keywords: "ward list every ward occupancy beds ready stale",
    steps: [
      step([named("Statewide counts", '[role="group"]'), id("wf-occupancy-ring"), HERO], {
        title: "Beds ready now",
        body: "Ready beds across the wards you can see, those expected to leave today, and how many are short or full.",
      }),
      step(id("ward-index-has-ready"), {
        device: "desk",
        title: "Has ready",
        body: "Highlights the wards with a bed ready. Press it again to show every ward the same.",
      }),
      step(id("ward-index-confirmed"), {
        title: "Counts confirmed",
        body: "How many wards confirmed their beds this shift, and the oldest count. Ask sends that ward a request to confirm.",
      }),
      step(id("ward-index-service-band"), {
        title: "In use by service",
        body: "The share in use and beds ready for each health service. Press a service to highlight its wards.",
      }),
      step(id("ward-index-tabs"), { title: "Services", body: "All, or one health service's wards." }),
      step(id("ward-index-filters-toggle"), {
        title: "Filters",
        body: "Search by ward, hospital or service, and choose status, cohort and order.",
      }),
      step(id("ward-index-view-toggle"), {
        device: "desk",
        title: "Table view",
        body: "Shows the wards as a table instead of cards. Card view switches back.",
      }),
      step(
        { sel: '#main-content [role="note"][aria-label="Reading a ward"]' },
        { device: "desk", title: "Reading a ward", body: "One square a bed. The key says what each colour means." },
      ),
      step([starts("ward-index-link-"), named("Wards", "section")], {
        title: "Open a ward",
        body: "Each ward with its beds. Open one for its beds, arrivals and discharges.",
      }),
      step(
        { sel: 'aside[aria-label="Statewide by service"]' },
        {
          device: "desk",
          title: "Counts to check",
          body: "The wards whose bed count is past its limit, so you know who to ask.",
        },
      ),
    ],
  },
  {
    screen: "hub",
    name: "Places",
    keywords: "places hub network wards eds teams pin catchments",
    steps: [
      step([id("hub-top"), HERO], {
        title: "What needs a check",
        body: "The band names the wards whose bed count is old, with the ward to ask first.",
      }),
      step(id("hub-ask-stale"), { title: "Ask the ward", body: "Sends that ward a request to confirm its beds." }),
      step(id("hub-glance-trigger"), {
        title: "At a glance",
        body: "Opens wards that need a bed check, wards by service, and the places you pinned or opened lately.",
      }),
      step(
        { sel: 'nav[aria-label="Places views"]' },
        {
          title: "Places and Catchments",
          body: "Places lists the network. Catchments finds which community team covers a suburb.",
        },
      ),
      step(named("Search wards, EDs and community teams", "input"), {
        title: "Search places",
        body: "Type a ward, hospital, ED, team or service.",
      }),
      // The phone has one button that switches between By service and A to Z.
      step([named("Order", '[role="radiogroup"]'), { sel: '[data-testid="hub-top"] button[aria-pressed]' }], {
        title: "Order",
        body: "Sets how the places are listed: by service or A to Z.",
      }),
      step(named("Show", '[role="radiogroup"]'), {
        title: "Show",
        body: "All, Wards, EDs or Teams, with how many of each.",
      }),
      step(
        { sel: "#hub-results" },
        {
          title: "The network",
          body: "Every place, grouped by service. Choose one to see who is heading or waiting there, then refer or open it.",
        },
      ),
      step(id("hub-teams-fold"), {
        title: "Community teams",
        body: "Teams are folded to keep the list short. Open the fold to list them.",
      }),
    ],
  },
  {
    screen: "referral-intake",
    name: "New referral",
    keywords: "new referral form send refer intake raise",
    steps: [
      step(starts("ward-referral-refer-to-"), {
        title: "Refer to",
        body: "A ward, a community team or an ED. The steps below change to suit.",
      }),
      step(
        { sel: '[role="group"][aria-label="Referral sections"]' },
        {
          title: "The steps",
          body: "Patient, Referral, then the checks and the places to ask. Each step says how many answers it still needs.",
        },
      ),
      step([id("ward-referral-new-patient-toggle"), id("ward-referral-no-patient")], {
        device: "desk",
        title: "The patient",
        body: "Find the patient, or choose Add patient for someone new. Not yet identified covers a person whose name is not known.",
      }),
      step(
        [id("ward-referral-use-catchment"), id("ward-referral-catchment-not-known"), id("ward-referral-suburb-note")],
        {
          device: "desk",
          title: "Catchment",
          body: "Worked out from the suburb on the record. Use this catchment to accept it, or choose another.",
        },
      ),
      step(id("ward-referral-summary-rail"), {
        device: "desk",
        title: "Before you send",
        body: "What is still needed, step by step. Choose a row to go to the step that answers it.",
      }),
      step([id("ward-referral-preview-letter"), id("ward-referral-phone-preview-letter")], {
        title: "Preview letter",
        body: "Shows the referral as the receiving place will read it. Back to edit returns to the form.",
      }),
      step(id("ward-referral-save-draft"), {
        device: "desk",
        title: "Save draft",
        body: "Keeps the referral in this tab until it reloads, so you can come back to it.",
      }),
      step([id("ward-referral-send-locked"), id("ward-referral-send-early")], {
        device: "desk",
        title: "Send",
        body: "Send stays locked until every step is answered, and says what it is waiting on.",
      }),
      step(id("ward-referral-phone-hero"), {
        device: "phone",
        title: "The referral so far",
        body: "Where the referral is going. It reads Fill in and send until it has gone.",
      }),
      step(id("ward-referral-phone-continue"), {
        device: "phone",
        title: "Continue",
        body: "Takes you to the next step still needed. It sends once every step is in.",
      }),
    ],
  },
  {
    screen: "officer",
    name: "Transport",
    keywords: "transport officer jobs run sheet collect arrive booking",
    steps: [
      step([id("ward-officer-top"), HERO], {
        title: "Jobs open",
        body: "Jobs that need transport, need forms or are past the ward's ETA. Each figure highlights those jobs.",
      }),
      // R-MOVE-2: the phone hero keeps only its figures, so a row's Log booking stands in there.
      // With no pulled bed waiting, the top's calm line stands in, so the step still lights.
      step([id("ward-officer-hero-log-booking"), starts("ward-officer-log-booking-"), id("ward-officer-act")], {
        acts: ["RECORD_TRANSPORT_CAD"],
        title: "Log booking",
        body: "Records a booking already made by phone, with the CAD number and quoted ETA. It shows when a pulled bed has none.",
      }),
      step(id("ward-officer-copy-handover"), {
        title: "Copy handover",
        body: "Copies every open job as text, with its route, ETA and forms, to paste into your handover.",
      }),
      step(id("ward-officer-stages"), {
        device: "desk",
        title: "Job stages",
        body: "How many jobs are at each stage, from To accept to Collected.",
      }),
      step(id("ward-officer-tabs"), {
        title: "Jobs and History",
        body: "Jobs lists the open ones. History holds jobs closed today, with refusals and cancellations.",
      }),
      step([id("ward-officer-need"), id("ward-officer-act"), id("ward-officer-top")], {
        title: "Needs transport",
        body: "Beds pulled with no transport logged yet, most urgent first. The list shows only while a pulled bed has none.",
      }),
      step(named("Find transport jobs", '[role="search"]'), {
        device: "desk",
        title: "Find and sort",
        body: "Type to highlight jobs by name or place, and choose how the list is sorted.",
      }),
      step([id("ward-officer-joblist"), named("Jobs", "section")], {
        title: "Jobs",
        body: "Late or delayed jobs first, then forms to upload, then furthest along.",
      }),
      step([starts("ward-officer-next-"), named("Next action", "section")], {
        title: "The next step",
        body: "Each job's button is its next stage, such as En route or Arrived at ward. It is recorded with the time.",
      }),
    ],
  },
];

const AROUND: readonly Around[] = [
  {
    screen: "capacity",
    name: "Capacity",
    keywords: "beds occupancy full ready mismatch",
    steps: [
      step([named("Network beds", '[role="group"]'), id("wf-occupancy-ring"), HERO], {
        title: "How full the beds are",
        body: "Ready beds, people who need a bed, how many short and the share in use, from each ward's last confirmed figures.",
      }),
      step(id("capacity-hero-confirmed"), {
        title: "Counts confirmed",
        body: "How many wards confirmed their beds this shift, and the oldest count. Ask sends that ward a request to confirm.",
      }),
      step(id("capacity-bed-meeting"), {
        device: "desk",
        title: "Bed meeting and TV",
        body: "Bed meeting sheet opens the sheet in one tap. The arrow beside it holds Open the meeting agenda, and Open on TV when a TV is available, which puts the meeting on the room screen, read only.",
      }),
      step(id("capacity-mismatch"), {
        title: "Mismatch",
        body: "People waiting against beds that fit, for each kind of bed. Short means more people than beds. Press a bed type to see who is waiting and where.",
      }),
      // Wave 4 (D-191): bookings sit on Capacity's Planned tab, so the step lights the tab chooser.
      step(id("capacity-tabs"), {
        title: "Overview and Wards",
        body: "Overview shows the figures and Wards each ward's beds.",
      }),
      step(id("capacity-tabs"), {
        device: "desk",
        acts: ["CONVERT_PLANNED_ADMISSION"],
        title: "Planned admissions",
        body: "Admissions booked ahead, on the Planned tab. Press Arrived when the person reaches the ward.",
      }),
      step(named("Highlight wards", '[role="group"]'), {
        device: "desk",
        title: "Highlight wards",
        body: "Any ready, Locked ready and the other choices highlight wards on the map. Every ward stays.",
      }),
      step(id("capacity-map-find-bed"), {
        device: "desk",
        title: "Find a bed",
        body: "Opens the bed finder to see which wards have a bed ready of the kind needed. A person always chooses.",
      }),
      step(starts("capacity-map-ward-"), {
        device: "desk",
        title: "Every ward",
        body: "Each ward's beds, ready and being made ready, one square a bed. Choose a ward to open its panel.",
      }),
      // Wave 4 (D-191): the phone's Overview shows Held up where Nearest ready beds was.
      step(id("capacity-held-up-card"), {
        title: "Held up",
        body: "Discharges due by tomorrow that are held up, with what is holding each one.",
      }),
      step([id("capacity-forecast-card"), id("capacity-phone-forecast")], {
        title: "Expected from recorded dates",
        body: "Tomorrow's spare and short beds by bed type, from the discharge dates wards recorded. Open shows the detail.",
      }),
    ],
  },
  {
    screen: "movements",
    name: "Movements",
    keywords: "stages timeline moving",
    steps: [
      step(id("movements-day-metric"), {
        title: "Open movements",
        body: "Everyone moving to a bed now, from referral to arrival.",
      }),
      step(named("Highlight movements", '[role="group"]'), {
        title: "Highlight movements",
        body: "Tier 1 and the other figures highlight those movements in the list below. Nothing is hidden.",
      }),
      step(id("movements-queue"), {
        title: "Your queue",
        body: "How many are waiting on you. Next in my queue opens the first one.",
      }),
      step(named("Movement tools", "ul"), {
        title: "Transport, Find a bed, Corridors",
        body: "Transport opens the transport jobs, Find a bed the bed finder, and Corridors the routes in use now.",
      }),
      // D-265: the hero's stage band shows on a phone; a tablet or laptop has the stage cards instead.
      step([id("movements-stage-band"), named("Stages", "nav")], {
        title: "Stages",
        body: "How many are at each stage, from Referred to on the way, with the longest wait in each.",
      }),
      step(id("movements-tabs"), {
        title: "All and Resolved today",
        body: "All shows the open movements and today's resolved ones. Resolved today shows only those closed since midnight.",
      }),
      // D-265: the timeline shows by default; light the Graph or Table bar when Table is chosen.
      step([id("ward-movement-horizon"), id("movements-timeline-switch")], {
        device: "desk",
        title: "The timeline",
        body: "What is coming up for each receiving ward. Graph or Table above it swaps it for the people list.",
      }),
      step(named("Transport right now", "section"), {
        device: "desk",
        title: "Transport right now",
        body: "Each transport leg on the go, grouped by stage, such as Collected and Accepted.",
      }),
      step(id("ward-movements-arrange-fold"), {
        device: "phone",
        title: "Filter",
        body: "Narrow the list to the movements you are looking for.",
      }),
      step(named("Find movements by name, UMRN or ED", "input"), {
        device: "desk",
        title: "Find a movement",
        body: "Type a name, UMRN or ED. Order beside it sets how the list is sorted.",
      }),
      // The row's own Review link, then its row, so the step never lights a row's Ask wards button.
      step(
        [
          { sel: '#main-content a[href^="/bedchart/movements/"]:not([href*="?"])', up: 1 },
          starts("movements-group-toggle-"),
        ],
        {
          title: "Open a movement",
          body: "Movements are listed by stage. Open one to see its bed, transport and legal form in one place.",
        },
      ),
      step(id("ward-movements-print"), {
        device: "desk",
        title: "Print and Export",
        body: "Print the list for a meeting, or Export it as a spreadsheet.",
      }),
    ],
  },
  {
    screen: "referrals",
    name: "Referrals",
    keywords: "decide awaiting decision offered",
    steps: [
      step([id("ward-referral-kpis"), id("ward-referral-phone-hero")], {
        title: "Referrals at a glance",
        body: "How many are awaiting a decision, the oldest wait, and any decision overdue.",
      }),
      step(id("ward-referral-next"), {
        title: "Next overdue",
        body: "The overdue referral that has waited longest. Next overdue opens it.",
      }),
      step(named("Referral highlights", "ul"), {
        title: "Highlight referrals",
        body: "Ward bed, ED, More than one and Refused once highlight those referrals in the queue.",
      }),
      step(id("ward-referral-meeting"), {
        title: "Bed meeting",
        body: "Opens the bed meeting agenda at its referrals, the ones to talk through at the meeting.",
      }),
      step([id("ward-referral-runway"), id("ward-referral-phone-axis")], {
        title: "Since referral",
        body: "Each referral's wait against its tier's decision window. Press a group to show those referrals.",
      }),
      step([id("ward-referral-beds-ready"), id("ward-referral-phone-beds")], {
        title: "Beds ready",
        body: "Beds ready now, by kind, so you can see what is free before asking a ward.",
      }),
      step(id("ward-referral-tabs"), {
        title: "Queue and History",
        body: "Queue holds the referrals still to decide, History the decided ones. Export saves the list as a spreadsheet.",
      }),
      step(id("ward-referral-board-queued"), {
        title: "Awaiting decision",
        body: "Longest wait first, never ranked by the app. Choose a name to open the referral.",
      }),
      step(id("ward-referral-board-ward-offers"), {
        title: "Offered to wards",
        body: "Referrals waiting on a ward's answer, with who was asked. Chase or Escalate a ward that is late to answer.",
      }),
    ],
  },
  {
    screen: "handover",
    name: "Handover",
    keywords: "shift sheet sign off print",
    steps: [
      step([id("ward-handover-shift"), id("ward-handover-phone-shift")], {
        title: "Which handover",
        body: "The handover time and shift this sheet is for. Choose it to switch to another handover.",
      }),
      step(id("ward-handover-kpi-strip"), {
        title: "What to hand over",
        body: "Act now, flagged urgent and due before the handover. Read Act now first. Each figure highlights its rows.",
      }),
      step([id("ward-handover-since-line"), id("ward-handover-phone-since")], {
        title: "Since the last handover",
        body: "What is new since the last handover, such as new referrals and moves.",
      }),
      step([id("ward-handover-open-promises"), id("ward-handover-promises-toggle")], {
        title: "Ward replies due",
        body: "Times a ward said it would ring back. Chase the overdue ones first.",
      }),
      step([id("ward-handover-meeting"), id("ward-handover-phone-meeting")], {
        title: "Start meeting",
        body: "Starts the meeting clock. Press it again to stop; History records how long the meeting took.",
      }),
      step([id("ward-handover-digest-open"), id("ward-handover-phone-digest")], {
        title: "Digest",
        body: "The shift digest: a short summary of this shift to read or copy.",
      }),
      step([id("ward-handover-hero-sign-off"), id("ward-handover-phone-sign-off")], {
        acts: ["RECORD_HANDOVER_SIGN_OFF", "RECORD_SITE_HANDOVER_SIGN_OFF"],
        title: "Sign off",
        body: "Sign off shows how many checks are clear. Open it, work through the Before you sign checks, then choose Sign off.",
      }),
      step([id("ward-handover-tabs"), id("ward-handover-phone-tabs")], {
        title: "Patients, Beds and History",
        body: "Patients is the handover sheet. Beds lists the beds ready, and History the handovers signed before.",
      }),
      step(id("ward-handover-prepare"), {
        device: "desk",
        title: "Set up the sheet",
        body: "Show filters the sheet to a ward or service. Detail sets the columns, and the other controls highlight or arrange rows.",
      }),
      step(id("ward-handover-sheet"), {
        device: "desk",
        title: "The handover sheet",
        body: "One row a patient, grouped as you chose. Act now and urgent rows stand out.",
      }),
      step(starts("ward-handover-phone-row"), {
        device: "phone",
        title: "Each patient",
        body: "Open a patient for their handover details.",
      }),
      step(id("ward-handover-print"), {
        device: "desk",
        title: "Print handover",
        body: "Opens the paper copy of the sheet to print.",
      }),
      step(named("More handover actions", "button"), {
        device: "desk",
        title: "More",
        body: "Present on a screen, Copy summary, the Downtime pack and Open in Waiting.",
      }),
    ],
  },
  {
    screen: "delays",
    name: "Waiting",
    keywords: "delays blocker held up why waiting",
    steps: [
      step([id("delays-top"), id("delays-hero")], {
        title: "Who is waiting",
        body: "Everyone waiting in an ED, those in transit, and the long waits. The long wait figures filter the list.",
      }),
      step(id("delays-next"), {
        title: "Your move",
        body: "How many are waiting on your move. Show these narrows the list to them, and Show everyone undoes it.",
      }),
      step(named("Waiting tools", "ul"), {
        title: "Waiting tools",
        body: "Find a bed opens the bed finder. The daily check and the next wait to cross its line show here when there are any.",
      }),
      step(id("delays-owner-yours"), {
        title: "Who the wait is on",
        body: "Split by who can move it on next: you, the ED, the wards, transport or someone else. Press one to show only theirs.",
      }),
      step(id("delays-tabs"), {
        title: "Longest wait or By hold-up",
        body: "Orders the list by the longest wait, or groups it by what is holding each person up.",
      }),
      step([id("delays-view-needs-me"), id("delays-filter-fold")], {
        title: "Saved views",
        body: "Due soon or on you, Form due and For handover each narrow the list.",
      }),
      step([id("delays-waiting-list"), id("delays-phone-cards")], {
        title: "The waiting list",
        body: "Longest wait first. Open a row to deal with what is holding it up.",
      }),
      step(id("delays-export"), { device: "desk", title: "Export", body: "Saves the list as a spreadsheet." }),
      step(named("Escalations and resolved", "section"), {
        device: "desk",
        title: "Today's follow-up",
        body: "Attention, Escalated and Done today. Open a person to act or to read the reply.",
      }),
      step(named("Delay graphs", "section"), {
        device: "desk",
        title: "Delay graphs",
        body: "The waits as graphs: the next hours, where and whose move, and the spread of waits.",
      }),
    ],
  },
  {
    screen: "discharges",
    name: "Discharges",
    keywords: "bed release list",
    steps: [
      step([named("Discharge figures", '[role="group"]'), HERO], {
        title: "Discharges today",
        body: "How many to work now out of all open, dates overdue, and bed days past the ward's date.",
      }),
      step(
        { sel: "#main-content [data-wf-hero-next]" },
        {
          title: "What to do next",
          body: "The next job, such as chasing held-up discharges. Show narrows the list to them.",
        },
      ),
      step(named("Discharge actions", "ul"), {
        title: "Discharge actions",
        body: "Ask wards about dates that have passed, Copy counts and Print list. On a phone, Per day and Filter sit here too.",
      }),
      step(id("ward-discharge-barrier-bars"), {
        device: "desk",
        title: "Held up by reason",
        body: "What is holding discharges up, counted by reason. Press a reason to highlight its discharges.",
      }),
      step(id("ward-discharge-tabs"), {
        title: "Now and History",
        body: "Now lists the discharges still open. History lists those already recorded.",
      }),
      step(id("ward-discharge-kpi-strip"), {
        device: "desk",
        title: "Highlight by stage",
        body: "Held up, confirmed and expected. Press one to highlight those rows; nobody is hidden.",
      }),
      step(id("ward-discharge-group-blocked"), {
        title: "Held up first",
        body: "Discharges with something in the way come first. Open one to see what is holding it up and which bed it frees.",
      }),
      step(id("ward-discharge-export"), { device: "desk", title: "Export", body: "Saves the list as a spreadsheet." }),
    ],
  },
  {
    screen: "legal-forms",
    name: "Legal forms",
    keywords: "mental health act form expiry typed",
    steps: [
      step(id("ward-legal-hud-island"), {
        title: "Legal forms",
        body: "Everyone on a form, how many are within your reminder window, and any with no time written. Times are as a person typed them.",
      }),
      step(id("ward-legal-act"), {
        title: "Act now",
        body: "Forms whose typed time has passed or is within your reminder window. Open goes to the first one.",
      }),
      step(id("ward-legal-record-chip"), {
        title: "Record a form",
        body: "Opens Record a form, to record the time written on a new paper form.",
      }),
      step(id("ward-legal-tasks-chip"), {
        title: "Record and tell",
        body: "Forms in force by type, what is still to record on each form, and who to tell about recent moves.",
      }),
      step(id("ward-legal-copy-chip"), {
        title: "Copy for handover",
        body: "Copies the form lines for your handover.",
      }),
      step(
        { sel: '#main-content [role="radiogroup"][aria-label="View"]' },
        {
          title: "On a form, Checklist and History",
          body: "On a form lists everyone with a form now. Checklist shows what each form still needs. History holds closed moves. Seclusion and restraint, for the desks that see it, shows the seclusion and restraint forms.",
        },
      ),
      step(id("ward-legal-print"), {
        device: "desk",
        title: "Print and Export",
        body: "Print the list, or Export it as a spreadsheet.",
      }),
      step(id("ward-legal-forms-groups"), {
        title: "Choose a patient",
        body: "Grouped by the typed expiry, earliest typed time first. Choose a patient to see their form.",
      }),
    ],
  },
  {
    screen: "on-call",
    name: "On-call",
    keywords: "phone number roster who to call",
    steps: [
      step(id("ward-on-call-top"), {
        title: "Who to call now",
        body: "How many lines are answering, closed or due a check, then the state bed desk's number. Copy number copies it.",
      }),
      step(id("ward-on-call-cover"), {
        title: "Cover at",
        body: "Shows who answers at a later time, such as 22:00 or 03:00. Choose Now to go back.",
      }),
      step(named("On-call actions", "ul"), {
        device: "desk",
        title: "Copy and Downtime card",
        body: "Copy who is on copies the lines answering now. Downtime card holds the key lines and My list, with their hours, to print.",
      }),
      step([id("ward-on-call-tabs"), { sel: '#main-content [role="tablist"]' }], {
        title: "Hospitals, Teams, State and Mine",
        body: "Each tab is one part of the directory. Mine holds the lines you starred.",
      }),
      step(
        { sel: '#main-content input[placeholder="Role, place or number"]' },
        { title: "Search", body: "Search by role, hospital, ward, team or number." },
      ),
      step([named("Show and group rows", '[role="group"]'), id("ward-on-call-filter-fold")], {
        title: "Show",
        body: "Highlights lines that are answering, ending soon, have email or are due a check. Nothing is hidden.",
      }),
      step(id("ward-on-call-phone-more"), {
        device: "phone",
        title: "More tools",
        body: "Mine, Copy who is on and the Downtime card.",
      }),
      step([starts("ward-on-call-row-"), id("ward-on-call-directory"), { sel: "#ward-reach-switchboard li button" }], {
        title: "The directory",
        body: "One line a role or place. Choose one to see who answers it, and star it to keep it under Mine.",
      }),
      step(id("ward-on-call-role-panel"), {
        device: "desk",
        title: "The chosen line",
        body: "Who answers the line you chose, and until when, with every number and If no answer for who to try next.",
      }),
      step(id("ward-on-call-check-foot"), {
        device: "desk",
        title: "When it was checked",
        body: "Each list says when someone last checked it. Mark checked now once you have confirmed it.",
      }),
    ],
  },
  {
    screen: "out-of-area",
    name: "Out of area",
    keywords: "away from home repatriation return plan",
    steps: [
      step(HERO, {
        title: "Away from home",
        body: "How many people are in a bed outside their home health service, split by days away. Checking counts discharge dates passed and missing return plans.",
      }),
      step([starts("ward-out-of-area-highlight-"), starts("ward-out-of-area-figure-")], {
        title: "Quick views",
        body: "Discharge date passed, no plan and the long trips home. Each narrows the list.",
      }),
      step([id("ward-out-of-area-tabs"), id("ward-out-of-area-phone-tabs")], {
        title: "Views",
        body: "Away now and History. On a phone: My list, Everyone and Beds.",
      }),
      step(
        { sel: "#ward-out-of-area-phone-panel-needs" },
        {
          device: "phone",
          title: "My list",
          body: "Leaving today, Ready to go home, then the people whose return date is in the next 2 days. Open a person for their return plan.",
        },
      ),
      // An empty list draws one line saying why in place of the table (D-193: only checked travel times show).
      step([id("ward-out-of-area-table"), id("ward-out-of-area-empty")], {
        device: "desk",
        title: "The list",
        body: "Each person's home region, placement and discharge date. When nobody is listed, one line says why.",
      }),
      step(id("ward-out-of-area-subject"), {
        device: "desk",
        title: "Return plan",
        body: "Choose a person and their return plan opens in a side panel: receiving bed, transport and dispatch.",
      }),
    ],
  },
  {
    screen: "seclusion",
    name: "Seclusion",
    keywords: "restraint restrictive practice incident room",
    steps: [
      step([id("seclusion-live"), id("seclusion-figure-live")], {
        title: "In use now",
        body: "Everyone in seclusion or restraint now, longest first. Ward staff record changes on their own ward.",
      }),
      step(id("seclusion-figure-rooms"), {
        title: "Rooms and incidents",
        body: "How many seclusion rooms are available, and the incidents recorded in the last day.",
      }),
      step(id("seclusion-start-open"), {
        acts: ["RECORD_RESTRICTIVE_PRACTICE_START"],
        title: "Start seclusion or restraint",
        body: "Find the patient, choose what is in use, type the time or press Now, then Record start.",
      }),
      step(id("seclusion-incident-open"), {
        acts: ["RECORD_WARD_INCIDENT"],
        title: "Record incident",
        body: "Choose the ward and the kind, type the time, then Record incident.",
      }),
      step(id("seclusion-room-open"), {
        acts: ["SET_SECLUSION_ROOM_STATUS"],
        title: "Change a room",
        body: "Marks a ward's seclusion room available or out of service, for everyone to see.",
      }),
      step(
        { sel: '#main-content [role="radiogroup"][aria-label="View"]' },
        {
          title: "Part of Legal forms",
          body: "Seclusion is one view of Legal forms. On a form goes back to the forms list.",
        },
      ),
      step(id("seclusion-rooms"), {
        title: "The seclusion rooms",
        body: "Each secure ward's room, who last marked it and when. Change marks it available or out of service.",
      }),
      step(id("seclusion-incidents-card"), {
        title: "Ward incidents",
        body: "Incidents recorded in the last day, by ward and kind. They name no patient.",
      }),
    ],
  },
  {
    screen: "governance",
    name: "Governance",
    keywords: "review audit override decisions",
    steps: [
      step([id("ward-governance-workbench"), PHONE_FIGURES], {
        title: "What to review",
        body: "Recorded decisions waiting for review, such as overrides and refusals, for this session.",
      }),
      step(id("ward-governance-act"), {
        title: "Newest to review",
        body: "The newest event waiting for review. Review next opens it.",
      }),
      step([id("ward-governance-record-review"), id("ward-governance-phone-record-review")], {
        acts: ["REVIEW_AUDIT_EVENT"],
        title: "Record review",
        body: "Opens Record a review: choose what is under review and the decision, then save it.",
      }),
      step(named("Governance actions", "ul"), {
        device: "desk",
        title: "Governance actions",
        body: "PIR chronology opens the patient chronology report. Repeat break glass highlights repeated openings when there are any.",
      }),
      step(id("ward-governance-tabs"), {
        title: "Views",
        body: "Review, Forms to chase, Audit trail, Registers and Reports.",
      }),
      step(named("Show in the review list", '[role="radiogroup"]'), {
        device: "desk",
        title: "Show",
        body: "All, Overrides, Steps not saved, or Record access.",
      }),
      step(id("wf-group-head"), {
        device: "phone",
        acts: ["REVIEW_AUDIT_EVENT"],
        title: "Waiting for review",
        body: "Newest first. Choose an event, then Record review.",
      }),
      // Drawer review (6 Nov 2026): the event's detail opens in a drawer only once someone chooses
      // it, so the walk lights the list rather than a detail pane that is no longer on the page.
      step(
        { sel: "[data-audit-row]" },
        {
          device: "desk",
          title: "Waiting for review",
          body: "Newest first. Choose an event and its detail opens beside the list.",
        },
      ),
    ],
  },
  {
    screen: "statistics",
    name: "Statistics",
    keywords: "figures trends numbers",
    steps: [
      step(
        { sel: '[data-testid="ward-statistics-nav"], [data-testid="ward-statistics-index"]' },
        {
          title: "Choose a view",
          body: "Network, Compare, Services, Wards, EDs, Teams and Weekly. Every figure is from synthetic records.",
        },
      ),
      step([named("Network at a glance", '[role="group"]'), PHONE_FIGURES, HERO], {
        title: "Network at a glance",
        body: "Beds in use, open ED movements, discharges today and those expected to leave today.",
      }),
      step(id("ward-statistics-pressure-act"), {
        title: "Wards at the line",
        body: "How many wards are at or over the bed alert line. Show wards takes you to them.",
      }),
      step(named("Statistics tools", "ul"), {
        device: "desk",
        title: "Open a unit",
        body: "Open a unit finds any ward, ED, service or team and opens its figures.",
      }),
      // D-265: on a phone Export sits in the Statistics tools menu ("…").
      step(
        { sel: '[data-testid="ward-statistics-export"], [data-testid="ward-statistics-tools-menu"]' },
        {
          title: "Export the figures",
          body: "Downloads the figures at the top of the page as a spreadsheet file. On a phone it is in the … menu.",
        },
      ),
      step(id("ward-statistics-view-bar"), {
        device: "desk",
        title: "Bed board, Movement or Map",
        body: "Shows the network as a bed board, as the movement of people, or on a map.",
      }),
      step(id("ward-statistics-network-cards"), {
        device: "desk",
        title: "Occupancy by service",
        body: "Beds in use for each health service.",
      }),
      step(id("ward-statistics-fixed-questions"), {
        device: "desk",
        title: "Ask a question",
        body: "Fixed questions answered from the records, such as which pulled beds are past their pull time limit.",
      }),
      step(id("ward-statistics-more-figures"), {
        device: "phone",
        title: "More figures",
        body: "Discharges held up, declines by reason and the other figures.",
      }),
    ],
  },
  {
    screen: "ed",
    name: "All EDs",
    keywords: "emergency department waiting",
    steps: [
      step([named("Highlight people waiting", '[role="group"]'), HERO], {
        title: "Waiting in EDs",
        body: "How many wait across the EDs, the long waits and those with no bed yet. Each figure highlights those people.",
      }),
      step(id("ed-index-act"), { title: "Longest wait", body: "The ED with the longest wait. Enter opens its board." }),
      step(named("Common jobs", "ul"), {
        title: "Common jobs",
        body: "Find a bed, Call and contacts, and Under a form or Accepted to highlight those people.",
      }),
      step(id("ed-index-tabs"), {
        title: "Views and services",
        body: "Cards, Table or Lanes, and one health service's EDs.",
      }),
      step([id("ed-index-match-count"), id("ed-index-phone-filters")], {
        title: "Filter and order",
        body: "Filter by status, and choose the order. The count says how many EDs show.",
      }),
      step([starts("ed-index-card-"), HERO], {
        title: "Each ED",
        body: "Every emergency department, with the people there waiting for a mental health bed.",
      }),
      step(starts("ed-index-preview-"), {
        device: "desk",
        title: "Preview who is waiting",
        body: "Choose an ED's card to preview who is waiting there without leaving the list.",
      }),
      step(starts("ed-index-link-"), {
        device: "desk",
        title: "Enter an ED",
        body: "Enter opens that ED's board and each patient's next step.",
      }),
      step(named("Departments with nobody waiting", '[role="group"]'), {
        device: "desk",
        title: "Nobody waiting",
        body: "The EDs with nobody waiting now. Enter still opens their boards.",
      }),
      step(starts("ed-index-phone-row-"), {
        device: "phone",
        title: "Open an ED",
        body: "Each row is one ED, with how many are waiting. Open it for that ED's board.",
      }),
    ],
  },
  {
    screen: "search",
    name: "Patients",
    keywords: "find person search",
    steps: [
      step(id("ward-patient-typeahead-input"), { title: "Find a person", body: "Search by name, UMRN or place." }),
      step(id("ward-patient-search-add"), {
        title: "Add patient",
        acts: ["ADD_PATIENT"],
        body: "Register a new synthetic person when they are not found.",
      }),
      step(id("ward-patient-search-today"), {
        title: "Today",
        body: "How many arrived, left or did not proceed today.",
      }),
      step(
        { sel: '[role="radiogroup"][aria-label="Where people are now"]' },
        {
          title: "Where people are now",
          body: "Everyone, In ED, In placement, Inpatient, Community or Not active, with how many in each.",
        },
      ),
      step(id("ward-patient-search-shift"), {
        device: "desk",
        title: "This shift",
        body: "What happened this shift, such as a pull that expired, with the time and the person.",
      }),
      step(id("ward-patient-search-results-console"), {
        title: "Everyone now",
        body: "Open movements and stays. Open a row for the person's details.",
      }),
      step(named("Sort patients", '[role="radiogroup"]'), {
        device: "desk",
        title: "Sort and highlight",
        body: "Sort by longest wait, tier or name. Highlight marks rows without hiding anyone.",
      }),
      step(named("Highlight", '[role="group"]'), {
        device: "phone",
        title: "Highlight",
        body: "Lights the people who match, such as Tier 1, without hiding anyone.",
      }),
      step(id("ward-census-export"), {
        device: "desk",
        title: "Copy list and Export",
        body: "Copy list copies the rows as text. Export saves them as a spreadsheet.",
      }),
    ],
  },
  {
    screen: "alerts",
    name: "Alerts",
    keywords: "notifications act now",
    steps: [
      step([id("ward-alerts-phone-hero"), id("ward-alerts-top"), HERO], {
        title: "Addressed to your desk",
        body: "Alerts for this desk right now: act now, waiting, and how old the oldest is.",
      }),
      step(id("ward-alerts-next"), { title: "Next alert", body: "The alert to deal with next. Next alert opens it." }),
      step(named("Alert actions", "ul"), {
        title: "Yours and Broadcast alert",
        body: "Yours highlights the alerts addressed to you. Broadcast alert sends one alert to several desks.",
      }),
      step(id("ward-alerts-today"), {
        title: "Today",
        body: "Alerts raised and acted on today, what is being checked, and any broadcasts.",
      }),
      step(id("ward-alerts-tabs"), {
        title: "Open, Cleared and Broadcasts",
        body: "Open alerts, the ones cleared, and the broadcasts sent.",
      }),
      step(id("ward-alerts-filters"), {
        title: "Show open alerts",
        body: "Act now, Waiting, Expected, Reminders, Notices, Snoozed or Yours. All shows every one again.",
      }),
      step(named("Arrange by", '[role="radiogroup"]'), {
        device: "desk",
        title: "Arrange by",
        body: "Urgency lists act now first. Lanes and Owner group the alerts in columns.",
      }),
      step(id("ward-alerts-open"), { title: "Open an alert", body: "Each alert opens the record it is about." }),
      // With no forecast line today the group is not drawn, so the Forecast filter stands in.
      step([id("ward-alerts-forecast"), { sel: '[data-testid="ward-alerts-filters"] button', text: "Expected" }], {
        title: "Expected from recorded dates",
        body: "Lines set in Settings: beds expected to be short tomorrow, the ED access target and expected beds that got worse. With none today, the Expected filter shows 0.",
      }),
      step(id("ward-alerts-notices"), {
        title: "Notices",
        body: "For information only, such as an arrival running late.",
      }),
      step(id("ward-alerts-order-note"), {
        device: "desk",
        title: "The order",
        body: "How the list is ordered: act now first, then waiting, oldest first in each.",
      }),
    ],
  },
  {
    screen: "ward",
    name: "this ward",
    keywords: "ward beds bed board my ward round",
    page: {
      purpose: "One ward's beds, who is coming and going, and the decisions due this shift.",
      path: /^\/bedchart\/ward\/[^/]+$/u,
      needs: "ward",
    },
    steps: [
      step(starts("ward-unit-card-"), {
        title: "This ward",
        body: "Beds ready now, the bed list, and what the page is still checking.",
      }),
      step([named("Ward capacity", '[role="group"]'), id("ward-hero")], {
        title: "Ready and arrivals",
        body: "Beds ready now and arrivals today. Open this shift goes to what needs doing.",
      }),
      step(id("ward-confirm-numbers"), {
        title: "Confirm numbers",
        body: "Confirm the ward's bed figures once you have checked them, so others can trust the count.",
      }),
      step(id("ward-updates"), { title: "Updates", body: "What changed on this ward since you last looked." }),
      step(id("ward-contact-open"), {
        title: "Contact and Staff needed",
        body: "Contact opens the ward's contact lines. Staff needed records a request for extra staff.",
      }),
      step(id("ward-hero-checking"), {
        title: "Checking",
        body: "When the capacity was last confirmed, and whether the outage pack has been printed.",
      }),
      step([id("ward-intake-window"), { sel: '[data-testid="ward-phone-figures"] > summary' }], {
        title: "Tonight's intake",
        body: "The hours this ward takes admissions tonight. Edit sets them. On a phone it is under Ward details and checks.",
      }),
      step(id("ward-tabs"), {
        title: "Ward tabs",
        body: "Ward home, Referrals for this ward to answer, and Decisions.",
      }),
      // The field, or on a phone the search button that opens it.
      step([id("ward-find-input"), id("ward-find-open")], {
        title: "Find on this ward",
        body: "Find a bed or a person on this ward.",
      }),
      step(id("ward-open-tv"), {
        device: "desk",
        title: "The toolbar",
        body: "On TV opens a read only screen for the ward's TV. More, beside it, holds Notices, Shift brief and Ward handover.",
      }),
      step(id("ward-open-bed-board"), {
        title: "Place or move",
        body: "Opens the bed board to place a patient in a bed or move one. The count says how many wait to be placed.",
      }),
      step(id("ward-unit-beds"), {
        device: "desk",
        title: "Bed figures",
        body: "Ready, pulled, closed and occupied beds, with when the ward last confirmed them.",
      }),
      step(id("ward-coming-and-going"), {
        title: "Coming and going",
        body: "Arrivals today and the patients due to leave, past their date first.",
      }),
      step(id("ward-walk-round"), {
        device: "phone",
        title: "The round",
        body: "Go through each patient in turn. The count shows how many are reviewed.",
      }),
    ],
  },
  {
    screen: "ed-board",
    name: "this ED board",
    keywords: "emergency department ed board waiting next step",
    page: {
      purpose: "One emergency department's mental health patients, each row with its next step.",
      path: /^\/bedchart\/ed\/[^/]+$/u,
      needs: "ed",
    },
    steps: [
      step(starts("ward-ed-card-"), { title: "This ED", body: "Who is waiting here and who is in transit." }),
      step(named("Highlight people on the board", '[role="group"]'), {
        title: "Highlight people",
        body: "On the board, the longest wait, no bed yet and under a form. Each figure highlights those rows.",
      }),
      step([named("Board jobs", "ul"), id("ward-phone-create")], {
        title: "Board jobs",
        body: "Updates since you last looked, Add patient and On TV. On a phone, Add patient is under the plus button.",
      }),
      step(id("ward-ed-switch"), {
        title: "Switch ED",
        body: "Every ED with how many wait and the longest wait. Choose one to open its board.",
      }),
      step(id("ward-ed-tabs"), {
        title: "Board and My list",
        body: "Board lists everyone here. My list holds the ones you are following.",
      }),
      step(id("forecast-ed-risk"), {
        title: "Long ED stays",
        body: "People whose ED stay is getting long, from recorded waits and releases. It is not a prediction.",
      }),
      step(named("Find a patient or UMRN", "input"), {
        device: "desk",
        title: "Find and sort",
        body: "Find a patient by name or UMRN. Sort and the filters beside it order and narrow the board.",
      }),
      step(starts("ward-ed-next-"), {
        device: "desk",
        title: "Each row's next step",
        body: "The button is the row's next step, such as Record exam or Log transport booking.",
      }),
      step([starts("ward-ed-form-pick-"), starts("ward-ed-form-expiry-")], {
        device: "desk",
        title: "Legal form",
        body: "The form on file. Type any expiry time from the paper form.",
      }),
      step(starts("ward-ed-unfold-"), {
        device: "desk",
        title: "Row actions",
        body: "Opens the row's other jobs, such as checks, transport and notes.",
      }),
      step(id("ward-ed-inbox-group"), {
        device: "desk",
        title: "New referrals",
        body: "Referrals waiting at this ED. Ask for a bed starts a bed request.",
      }),
      step(starts("ward-ed-review-ask-"), {
        device: "desk",
        title: "Awaiting psychiatric review",
        body: "Ask for review on a row asks for that patient's psychiatric review.",
      }),
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
      "Open Legal forms and choose the patient, then Record next form. Or use Record a form at the top. Choose the patient and form type, type the time on the form, then Save form. Only the written time is recorded; no expiry is calculated.",
    desks: ["ed", "coordinator", "ward"],
    acts: ["RECORD_LEGAL_FORM_WRITTEN"],
    go: "legal-forms",
    showMe: [
      step(
        { sel: '[data-testid="ward-legal-forms-groups"]' },
        {
          title: "Choose the patient",
          body: "Forms are grouped by the typed expiry, earliest typed time first. Choose the patient to open their form.",
        },
      ),
      step([id("ward-legal-form-sheet"), id("ward-legal-selected")], {
        title: "Their form",
        body: "What is on the form, the next step and its history. Check it is the right person first.",
      }),
      step(
        [
          { sel: '[role="dialog"] button', text: "Record next form" },
          { sel: "#main-content button", text: "Record next form" },
          id("ward-legal-record-chip"),
        ],
        {
          title: "Record next form",
          body: "Opens Record a form for this patient. Record a form at the top of the page opens it for anyone.",
        },
      ),
      step(
        { sel: '[data-testid="ward-legal-record"] div:has(> input[name="record-patient"])' },
        {
          title: "Patient",
          body: "Already filled in when you came from their form. Otherwise search by name or UMRN.",
        },
      ),
      step(
        { sel: '[data-testid="ward-legal-record"] div:has(> input[name="record-form-type"])' },
        {
          title: "Form type",
          body: "Choose the form type written on the paper. It is never filled in for you. Form 1A also asks for the region.",
        },
      ),
      step(
        { sel: '[data-testid="ward-legal-record"] input[placeholder="HH:MM"]' },
        {
          title: "Time on form",
          body: "Type the time written on the form, like 2:40 pm or 14:40. Leave Date on form blank when it was written today.",
        },
      ),
      step(
        [id("ward-legal-forms-register-confirm"), { sel: '[data-testid="ward-legal-record"] button', text: "Save" }],
        {
          title: "Save form",
          body: "Records the written time only. No expiry is calculated. If it is refused, the reason shows in the sheet.",
        },
      ),
      step(id("ward-legal-tasks-chip"), {
        title: "Record and tell",
        body: "Lists what is still to record on each form, and who to tell about recent moves.",
      }),
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
      step([{ sel: '[data-testid="ward-on-call-directory"]' }, { sel: '#main-content [role="tablist"]' }], {
        title: "Search the directory",
        body: "Hospitals, Teams, State and Mine. Search by role, place or number.",
      }),
      step(
        { sel: '#main-content input[placeholder="Role, place or number"]' },
        { title: "Search", body: "Type a role, hospital, ward, team or number. Matching lines show as you type." },
      ),
      step([named("Show and group rows", '[role="group"]'), id("ward-on-call-filter-fold")], {
        title: "Show",
        body: "Highlights lines that are answering now, ending soon, have email or are due a check.",
      }),
      step([starts("ward-on-call-row-"), { sel: "#ward-reach-switchboard li button" }], {
        title: "Choose a line",
        body: "Choose the role or place you need to reach.",
      }),
      step([id("ward-on-call-role-panel"), id("ward-on-call-sheet")], {
        title: "Who answers",
        body: "Who answers the line now and until when. Copy number copies it to dial.",
      }),
      step(
        [
          { sel: '[data-testid="ward-on-call-role-panel"] button', text: "If no answer" },
          { sel: '[data-testid="ward-on-call-sheet"] button', text: "If no answer" },
          // Not every line has a next contact; the chosen line stands in so the step still lights.
          id("ward-on-call-role-panel"),
          id("ward-on-call-sheet"),
        ],
        {
          title: "If no answer",
          body: "Where a line has one, If no answer names who to try next, as a preview order. Choose one to open their line.",
        },
      ),
      step(id("ward-on-call-cover"), {
        title: "Cover at",
        body: "Shows who answers at a later time, such as 22:00 or 03:00. Choose Now to go back.",
      }),
      step([starts("ward-on-call-row-"), id("ward-on-call-phone-more")], {
        title: "Keep it under Mine",
        body: "Star a line to keep it under Mine, the last tab. On a phone, Mine is also under More tools.",
      }),
    ],
  },
  {
    id: "plan-return-home",
    topic: "Beds and referrals",
    title: "Plan a patient's return home",
    keywords: "out area repatriation repat away home region transfer back",
    answer:
      "Open Out of area and choose the person. In the return plan, choose the receiving bed, then transport and legal status, then the CAD number and depart time. Record sent to ward once the ward is asked, and Record return once they are home.",
    desks: ["coordinator"],
    acts: ["RECORD_REPATRIATION"],
    go: "out-of-area",
    showMe: [
      step([{ sel: '[data-testid^="ward-out-of-area-row-"]' }, { sel: '[data-testid^="ward-out-of-area-figure-"]' }], {
        title: "Choose the person",
        body: "Everyone in a bed outside their home health service, with days away.",
      }),
      step(
        [{ sel: '[data-testid="ward-out-of-area-plan-sheet"]' }, { sel: '[data-testid="ward-out-of-area-subject"]' }],
        {
          title: "Their return plan",
          body: "Three steps: receiving bed, transport, dispatch. Each says how many answers it still needs.",
        },
      ),
      step(
        { sel: '[data-testid="ward-out-of-area-subject"] section[aria-label="Step 1, receiving bed"]' },
        {
          title: "Receiving bed",
          body: "Choose the receiving hospital, then whether its ward has agreed: Agreed or Not yet.",
        },
      ),
      step(
        { sel: '[data-testid="ward-out-of-area-subject"] section[aria-label="Step 2, transport"]' },
        {
          title: "Transport",
          body: "Travel by Road or Flight, the provider, and the legal status. Answer any form or escort question it then shows.",
        },
      ),
      step(
        { sel: '[data-testid="ward-out-of-area-subject"] section[aria-label="Step 3, dispatch"]' },
        {
          title: "Dispatch",
          body: "Type the CAD number, or leave it for later, and the depart time with Today or Tomorrow.",
        },
      ),
      step([id("ward-out-of-area-repat-next"), id("ward-out-of-area-repat-send")], {
        title: "Record sent to ward",
        body: "Go to takes you to the next answer still needed. Record sent to ward once the plan is with the ward.",
      }),
      step([id("ward-out-of-area-repat-submit"), id("ward-out-of-area-mark-ward-agreed")], {
        title: "Record return",
        body: "Once the ward has agreed, Record return records the move home. Mark ward agreed records the ward's yes.",
      }),
      step(id("ward-out-of-area-flag-early"), {
        title: "Flag early",
        body: "If they may be ready sooner than planned, Flag early tells the receiving ward, the home team and Transport.",
      }),
    ],
  },
  {
    id: "record-seclusion",
    topic: "Beds and referrals",
    title: "Record seclusion, restraint or an incident",
    keywords: "seclusion restraint restrictive practice incident room start end",
    answer:
      "Open Forms, then Seclusion and restraint. Start seclusion or restraint: find the patient, choose what is in use, type the time, then Record start. Record end on its row when it finishes. Record incident: choose the ward, the kind and the time.",
    desks: ["ward", "coordinator"],
    acts: ["RECORD_RESTRICTIVE_PRACTICE_START", "RECORD_WARD_INCIDENT"],
    go: "seclusion",
    showMe: [
      // With none in use, the page top's "in use now" figure says so (page tops, 9 Nov 2026).
      step([{ sel: '[data-testid="seclusion-live"]' }, { sel: '[data-testid="seclusion-figure-live"]' }], {
        title: "In use now",
        body: "Everyone in seclusion or restraint now, with Record end on each row.",
      }),
      step(
        { sel: '[data-testid="seclusion-start-open"]' },
        {
          title: "Start seclusion or restraint",
          body: "Opens the start form. Find the patient, choose what is in use, type the time, then Record start.",
        },
      ),
      step(
        [
          { sel: '[data-testid="seclusion-start-dialog"] input[placeholder="Surname or ward"]' },
          id("seclusion-start-chosen"),
        ],
        { title: "Find the patient", body: "Type a surname or ward, then choose the patient from the matches." },
      ),
      step(id("seclusion-start-practice"), {
        title: "What is in use",
        body: "Choose what is in use, such as seclusion or a kind of restraint.",
      }),
      step(id("seclusion-start-time"), {
        title: "Started at",
        body: "Type the time it started, like 2:40 pm or 14:40, or press Now beside it.",
      }),
      step(
        { sel: '[data-testid="seclusion-start-dialog"] button', text: "Record start" },
        { title: "Record start", body: "Saves the start. The person then shows under In use now." },
      ),
      step([id("seclusion-end-open"), id("seclusion-figure-live")], {
        title: "Record end",
        body: "When it finishes, press Record end on their row, type Ended at, then Save end time.",
      }),
      step(
        { sel: '[data-testid="seclusion-incident-open"]' },
        { title: "Record incident", body: "Opens Record a ward incident. It names no patient." },
      ),
      step([id("seclusion-incident-ward"), id("seclusion-incident-category")], {
        title: "Ward and kind",
        body: "Choose the ward, when there is more than one, and the kind of incident.",
      }),
      step(id("seclusion-incident-time"), {
        title: "Happened at",
        body: "Type the time, like 2:40 pm or 14:40, or press Now, then Record incident. It shows under Ward incidents.",
      }),
    ],
  },
  {
    id: "clear-held-up-discharge",
    topic: "Beds and referrals",
    title: "Clear a held-up discharge",
    keywords: "discharge held up blocked barrier blocker release delay",
    answer:
      "Open Discharges, where held-up discharges come first. Choose the person: Held up says what is in the way, and Message ward asks the ward about it. Add what is outstanding under Discharge arrangements. On a phone, Clear hold-up removes it once it is sorted.",
    desks: ["ward", "coordinator"],
    acts: ["CLEAR_STAY_DISCHARGE_BLOCKER", "SET_DISCHARGE_BARRIER"],
    go: "discharges",
    showMe: [
      // The phone fallback is the next step row only when it names held-up discharges.
      step(
        [
          { sel: '[data-testid="ward-discharge-kpi-blocked"]' },
          { sel: "#main-content [data-wf-hero-next]", text: "held up" },
        ],
        { title: "Held up", body: "How many discharges have something in the way." },
      ),
      step(
        { sel: '[data-testid="ward-discharge-group-blocked"]' },
        {
          title: "Open one",
          body: "Held up comes first. Open a discharge to see what is holding it up and which bed it frees.",
        },
      ),
      step(
        { sel: '[data-testid="ward-discharge-group-blocked"] button[aria-pressed]' },
        {
          title: "Choose the person",
          body: "Choose their name to open the discharge. Chase on a row takes you straight to the hold-up.",
        },
      ),
      step(
        { sel: '[data-testid="ward-discharge-detail"] button', text: "Held up" },
        {
          device: "desk",
          title: "Held up",
          body: "The Held up tab says what is holding the discharge up, as recorded.",
        },
      ),
      // Message ward is the coordinator's; a ward desk sees the hold-up itself there.
      step(
        [id("ward-discharge-message-ward"), { sel: '[data-testid="ward-discharge-detail"] [aria-label="Held up"]' }],
        {
          title: "Message ward",
          body: "On a coordinator desk, Message ward asks the ward about this hold-up, from beside the hold-up itself.",
        },
      ),
      step(id("ward-discharge-dependencies"), {
        title: "Discharge arrangements",
        body: "Choose what is outstanding and who owns it, then Add as outstanding. Practical arrangements only.",
      }),
      step(
        { sel: '[data-testid="ward-discharge-dependencies"] button', text: "Change expected out" },
        {
          title: "Change expected out",
          body: "If the date moves, choose the day, type the time, then Change expected out.",
        },
      ),
      step(id("ward-discharge-clear-blocker"), {
        device: "phone",
        title: "Clear hold-up",
        body: "Once it is sorted, Clear hold-up removes the hold-up from this discharge.",
      }),
      // On a computer the field is on the Milestones tab; the tab stands in while Held up is open.
      step(
        [
          id("ward-discharge-departure-destination"),
          { sel: '[data-testid="ward-discharge-detail"] [role="tab"]', text: "Milestones" },
        ],
        {
          title: "Record discharge",
          body: "When they leave, choose where they went under Milestones, then Record discharge. They then leave the Held up list.",
        },
      ),
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
  answer: `A walk round ${each.name}: Show me lights each part in turn and says what it shows. It never presses anything.`,
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
