/**
 * ASK HELP: THE HOW-TO LIST (Josh, 26 Oct 2026: "write a question ... and show you easily").
 *
 * A fixed, reviewed list of the jobs staff ask about, each with a short answer in the screens' own
 * button names, the desks it is for, where it is done, and optional "Show me" steps that spotlight
 * the real controls on that screen. `askHelp` matches typed words against it with a fixed list of
 * word families, so "reserve a bed" finds "Pull a bed". No AI and no network: the same words always
 * give the same answers, and the typed question is never stored or sent.
 *
 * Nothing here ranks, scores or suggests a ward, places a patient, re-sorts a queue, works out
 * Mental Health Act times or releases a pulled bed. Show me only points at buttons a person presses.
 * A bed kept for an incoming patient is "pulled"; "held" is only a patient's own bed while they are
 * on leave or away (D-81). Show me targets use test ids, ids, `data-setting` and accessible text,
 * never class names; `tests/ward-help-howto.test.ts` fails when a test id leaves the source.
 */
import type { WardScreenId } from "@/components/ward-management/ward-role-access";

import { deskOpens, EVERY_LOGIN, howToFor, type WardEventType } from "./ward-help-access";
import type { WardTourRole } from "./ward-help-store";
import { HELP_SYNONYMS } from "./ward-help-synonyms";
import { nearestWord } from "./ward-help-typo";
import type { TourTarget } from "./ward-tour-steps";

/**
 * One spotlight in a Show me. Its targets are tried in order and the first on screen is lit, so a
 * step can name the desktop control and a phone stand-in. A step whose control is not on screen
 * shows its card with no spotlight.
 */
type ShowMeStep = {
  readonly target?: TourTarget | readonly TourTarget[];
  readonly title: string;
  readonly body: string;
};

/**
 * The groups Help's How do I… list shows a desk's tasks under (Josh, 30 Oct 2026), in this order.
 * Grouping only: it never orders the work itself.
 */
export const HOW_TO_TOPICS = [
  "Beds and referrals",
  "Transport",
  "Handover and reports",
  "Finding your way",
  "Settings and display",
] as const;
type HowToTopic = (typeof HOW_TO_TOPICS)[number];

export type HowTo = {
  readonly id: string;
  /** The group it is listed under in How do I…. */
  readonly topic: HowToTopic;
  /** The job as a person would ask it, shown as the answer's heading. */
  readonly title: string;
  /** Extra words people use for it, beyond those in the title and answer. */
  readonly keywords: string;
  /** Two or three sentences, naming the buttons as the screens show them. */
  readonly answer: string;
  /** The desks that do this job. Others still find it, under "Done by another desk". */
  readonly desks: readonly WardTourRole[] | "all";
  /** Where it is done: "home" (the desk's own home), a rail entry id, or "settings#<tab>"; several in order. */
  readonly go?: string | readonly string[];
  /**
   * The actions the task records (`EVENT_ROLE`). A login that may record none of them is not shown
   * the task as its own (audit finding 11, Josh 31 Oct 2026).
   */
  readonly acts?: readonly WardEventType[];
  /** A screen the task needs that `go` does not name, such as Alerts or Search. */
  readonly needs?: WardScreenId;
  readonly showMe?: readonly ShowMeStep[];
  /**
   * The controls are drawn on a computer only (the phone screen has no such button), so a phone is
   * told so instead of being offered a Show me that could light nothing.
   */
  readonly computerOnly?: true;
};

const EVERY_DESK = "all";
const CLINICAL_DESKS: readonly WardTourRole[] = ["coordinator", "ward", "ed", "community", "bed_manager", "officer"];

const PRIMARY_ACTION: TourTarget = {
  sel: '[data-testid="ward-bar-primary-action"], [data-testid="ward-phone-create"]',
};
const DESK_SWITCH: TourTarget = {
  sel: '[data-testid="ward-rail-persona-trigger"], [data-testid="ward-bar-phone-menu"]',
};
/** A Settings row; on a phone, whose rows sit in a sheet per tab, the tab's row in the list. */
const setting = (id: string, tab: string): TourTarget => ({
  sel: `[data-setting="${id}"], [data-testid="ward-settings-phone-area-${tab}"]`,
});

/** Whether Show me can walk this how-to on this device (`computerOnly` ones cannot on a phone). */
export function canShowMe(howTo: HowTo, phone: boolean): boolean {
  return Boolean(howTo.showMe?.length) && !(phone && howTo.computerOnly);
}

export const HOW_TOS: readonly HowTo[] = [
  {
    id: "pull-bed",
    topic: "Beds and referrals",
    title: "Pull the bed for a patient",
    keywords: "reserve keep book bed accepted placement",
    answer:
      "Once a ward accepts, open the movement and press Pull the bed. The bed is kept for the patient within the pull time limit. A person always chooses the bed; nothing is placed automatically.",
    desks: ["coordinator"],
    acts: ["PULL_PATIENT"],
    go: "movements",
    showMe: [
      {
        target: [
          { sel: '#main-content a[href^="/ward-flow/movements/"]', text: "Pull the bed" },
          // On a phone the list is grouped by stage, so the Accepted group stands in for the button.
          { sel: '[data-testid="movements-group-toggle-accepted_awaiting_bed"]' },
        ],
        title: "Find a movement ready for a pull",
        body: "Rows where a ward has accepted show Pull the bed. Open one to see the bed, transport and legal form together.",
      },
      {
        target: { sel: '[data-testid="ward-shortlist-hold-bed"]' },
        title: "Press Pull the bed",
        body: "On the movement, check the bed and press Pull the bed. It is kept within the pull time limit, which is set in Settings, Rules.",
      },
    ],
  },
  {
    id: "release-pulled-bed",
    topic: "Beds and referrals",
    title: "Release a pulled bed",
    keywords: "unpull give back free cancel pull expired",
    answer:
      "Open the movement and use Release the pulled bed. Cancel transport first if it is booked. A pulled bed is never released by itself: when the pull time limit passes it shows in Act now as Pull expired, bed still pulled.",
    desks: ["coordinator"],
    acts: ["RELEASE_PULL"],
    go: "home",
    showMe: [
      {
        target: [
          { sel: "#main-content button", text: "Release pulled bed" },
          // A phone's list opens each row in a sheet; the hero's Act now count stands in.
          { sel: "#main-content button", text: "Act now" },
        ],
        title: "Pulls past their limit are in Act now",
        body: "Release pulled bed opens the movement at the release step. You decide whether to release it or keep it.",
      },
      {
        target: [
          { sel: '[data-testid="ward-cancel-transport-toggle"]' },
          { sel: '[data-testid="ward-release-pull-toggle"]' },
        ],
        title: "Cancel transport first, then release",
        body: "If transport is booked, cancel it first so the officer is not sent. Then use Release the pulled bed.",
      },
    ],
  },
  {
    id: "decide-referral",
    topic: "Beds and referrals",
    title: "Accept or decline a referral",
    keywords: "decide answer approve reject refuse referral",
    answer:
      "Press Decide on the referral, read it, then Accept referral or Decline referral. A decline needs a reason. Only the ward or team it was sent to can answer for itself.",
    desks: ["coordinator", "ward", "community"],
    acts: ["ACCEPT_REFERRAL", "DECLINE_REFERRAL"],
    go: "home",
    showMe: [
      {
        // Decide is a link on the coordinator's list and a button elsewhere.
        target: [
          { sel: "#main-content a, #main-content button", text: "Decide" },
          // A phone's list opens each row in a sheet; the hero's To decide count stands in.
          { sel: "#main-content button", text: "To decide" },
          // A ward's phone keeps its referrals under the Decisions tab.
          { sel: "#main-content button", text: "Decisions" },
        ],
        title: "Referrals to decide",
        body: "They stay in wait order, oldest first. Press Decide to open one.",
      },
      {
        target: [{ sel: '[data-testid^="ward-accept-"]' }, { sel: "#main-content button", text: "Accept referral" }],
        title: "Accept or decline",
        body: "Read the referral, then Accept referral or Decline referral. A decline needs a reason from the list.",
      },
    ],
  },
  {
    id: "ask-more-wards",
    topic: "Beds and referrals",
    title: "Ask more wards",
    keywords: "send another ward more destinations parallel enquiry",
    answer:
      "Open the referral and choose Ask more wards, then tick the wards. They are listed A to Z and never ranked, and only a ward that fits can be ticked. The number asked at once is limited by Wards asked at once in Settings.",
    desks: ["coordinator"],
    acts: ["REFER_TO_UNITS"],
    go: "referrals",
    showMe: [
      {
        target: [
          { sel: '[data-testid^="ward-referral-board-select-"]' },
          { sel: '[data-testid^="ward-referral-board-card-select-"]' },
        ],
        title: "Open the referral",
        body: "Select the patient's referral. Its panel has Ask more wards.",
      },
      {
        target: { sel: '[data-testid="ward-referral-ask-open"]' },
        title: "Ask more wards",
        body: "Tick the wards to ask. They are listed A to Z, and only a ward that fits can be ticked.",
      },
    ],
  },
  {
    id: "book-transport",
    topic: "Transport",
    title: "Book transport",
    keywords: "ambulance car transfer move patient escort",
    answer:
      "On the movement, press Book transport, or record that none is needed. The app records the booking for the transport officer; it does not order the vehicle itself.",
    desks: ["coordinator"],
    acts: ["BOOK_TRANSPORT"],
    go: "movements",
    showMe: [
      {
        target: [
          { sel: '#main-content a[href^="/ward-flow/movements/"]', text: "Book transport" },
          // Movements whose bed is pulled are the ones waiting for transport.
          { sel: "#main-content button", text: "Pulled" },
        ],
        title: "Find a movement waiting for transport",
        body: "Once the bed is pulled, the movement needs transport. Open it from the Pulled stage.",
      },
      {
        target: { sel: '[data-testid="ward-shortlist-book-transport"]' },
        title: "Book transport",
        body: "Record the booking, or that none is needed. The officer sees it on their jobs list.",
      },
    ],
  },
  {
    id: "cancel-transport",
    topic: "Transport",
    title: "Cancel transport",
    keywords: "stop ambulance unbook transfer",
    answer:
      "Open the movement and cancel the booked transport there. Do this before you release a pulled bed, so the officer is not sent for a patient whose bed has gone.",
    desks: ["coordinator"],
    acts: ["CANCEL_TRANSPORT"],
    go: "movements",
    showMe: [
      {
        target: [
          { sel: '#main-content a[href^="/ward-flow/movements/"]' },
          // A phone groups the list by stage; open the stage, then the movement.
          { sel: '[data-testid^="movements-group-toggle-"]' },
        ],
        title: "Open the movement",
        body: "Open the patient's movement from the list.",
      },
      {
        target: { sel: '[data-testid="ward-cancel-transport-toggle"]' },
        title: "Cancel transport",
        body: "Choose a reason, then confirm. The officer's job is cancelled and says why.",
      },
    ],
  },
  {
    id: "log-call",
    topic: "Beds and referrals",
    title: "Log a call",
    keywords: "phone rang record contact follow up callback",
    answer:
      "Open the referral and use Log a call, choosing who was rung and the outcome from the list. The next person sees who was called and when.",
    desks: ["coordinator"],
    acts: ["LOG_REFERRAL_CONTACT"],
    go: "referrals",
    showMe: [
      {
        target: [
          { sel: '[data-testid^="ward-referral-board-select-"]' },
          { sel: '[data-testid^="ward-referral-board-card-select-"]' },
        ],
        title: "Open the referral",
        body: "Log a call is in the referral's panel, with the owner desk.",
      },
      {
        target: { sel: '[data-testid^="ward-referral-call-log-"]' },
        title: "Log a call",
        body: "Choose who was rung and the outcome from the lists, then Log a call. The next person sees it.",
      },
    ],
  },
  {
    id: "new-referral",
    topic: "Beds and referrals",
    title: "Raise a new referral",
    keywords: "refer send create start new referral",
    answer:
      "Press New referral, choose the destinations (several can go at once), record the legal status if known, then send. Each destination answers on its own.",
    desks: ["coordinator", "ed", "community", "ward"],
    acts: ["RAISE_REFERRAL"],
    showMe: [
      {
        target: PRIMARY_ACTION,
        title: "New referral",
        body: "Starts a referral from any screen. Shift+R does the same on a keyboard.",
      },
      {
        target: [
          { sel: '[data-testid="ward-referral-summary-rail"]' },
          { sel: '[data-testid="ward-referral-phone-continue"]' },
        ],
        title: "Destinations, then send",
        body: "Choose one or more destinations and the legal status if known. Send referral works once it reads Ready to send.",
      },
    ],
  },
  {
    id: "sign-off-handover",
    topic: "Handover and reports",
    title: "Hand over to the next shift",
    keywords: "handover handoff sign off shift change",
    answer:
      "Open Handover. Read Act now first, then what is due before the next handover. Work through Before you sign, then choose Sign off.",
    desks: ["coordinator", "ward"],
    acts: ["RECORD_HANDOVER_SIGN_OFF"],
    go: "handover",
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-handover-kpi-strip"]' },
          { sel: '[data-testid="ward-handover-phone-hero"]' },
        ],
        title: "Start with Act now",
        body: "These counts open the rows they describe, act now first.",
      },
      {
        target: [
          { sel: '[data-testid="ward-handover-sign-off-checks"]' },
          // On a phone the checks open from Sign off, so that button stands in.
          { sel: '[data-testid="ward-handover-phone-sign-off"]' },
        ],
        title: "Before you sign",
        body: "Each line in Before you sign should be checked before you sign. On a phone, Sign off opens them.",
      },
      {
        target: [
          { sel: '[data-testid="ward-handover-sign-off-button"]' },
          { sel: '[data-testid="ward-handover-phone-sign-off"]' },
        ],
        title: "Sign off",
        body: "Records that the handover was given, with the time.",
      },
    ],
  },
  {
    id: "print-handover",
    topic: "Handover and reports",
    title: "Print the handover sheet",
    keywords: "print paper copy present meeting",
    answer: "Open Handover and choose More, then Print handover. Present is there too, for the meeting screen.",
    desks: ["coordinator", "ward", "bed_manager"],
    go: "handover",
    computerOnly: true,
    showMe: [
      {
        target: { sel: '[data-testid="ward-handover-more"]' },
        title: "More",
        body: "Print handover and Present are in this menu.",
      },
    ],
  },
  {
    id: "confirm-numbers",
    topic: "Beds and referrals",
    title: "Confirm the ward's bed numbers",
    keywords: "morning count bed state update numbers census",
    answer:
      "On your ward's home, press Confirm numbers after checking ready, pulled, closed and occupied beds. The time you confirm shows on every screen, so others know how fresh the figure is.",
    desks: ["ward"],
    acts: ["CONFIRM_CAPACITY"],
    go: "home",
    showMe: [
      {
        target: { sel: '[data-testid^="ward-unit-card-"] button', text: "Confirm numbers" },
        title: "Confirm numbers",
        body: "Press this once the figures match the ward. The morning count is due by the time set in Settings.",
      },
    ],
  },
  {
    id: "answer-ward-referrals",
    topic: "Beds and referrals",
    title: "Answer the ward's referrals",
    keywords: "accept decline ward referral answer one by one",
    answer:
      "Open Referrals to answer, or Answer one by one on your ward's home, and accept or decline each. A decline needs a reason. A site bed manager can see them but cannot answer for the ward.",
    desks: ["ward"],
    acts: ["ACCEPT_REFERRAL", "DECLINE_REFERRAL"],
    go: "home",
    showMe: [
      {
        target: [
          { sel: '#main-content a[href$="/answer"]' },
          // On a phone the referrals to answer sit under the Decisions tab.
          { sel: "#main-content button", text: "Decisions" },
        ],
        title: "Answer one by one",
        body: "Steps through the ward's referrals in wait order.",
      },
    ],
  },
  {
    id: "bed-board",
    topic: "Beds and referrals",
    title: "See every bed on the ward",
    keywords: "bed board list beds occupied ready closed leave place move",
    answer:
      "Every bed on your ward's home shows who is in each bed or whether it is ready, pulled, closed or held for a patient on leave. Use Place or move to put someone waiting in a bed or move someone to another bed.",
    desks: ["ward"],
    go: "home",
    showMe: [
      {
        target: { sel: '[data-testid="ward-open-bed-board"]' },
        title: "Place or move",
        body: "Opens the bed board to place someone waiting or move someone between beds. Open a bed for the patient in it.",
      },
    ],
  },
  {
    id: "tv",
    topic: "Handover and reports",
    title: "Put the ward or bed meeting on a TV",
    keywords: "tv television screen display wall big screen meeting",
    answer:
      "Use On TV on a ward's home, or Open on TV on Capacity for the bed meeting. Open the link on the TV's browser; it is read only and shows names in full.",
    desks: ["coordinator", "ward", "bed_manager"],
    // Capacity's Open on TV for the desks that open Capacity; a ward's own page has its own.
    go: ["capacity", "home"],
    computerOnly: true,
    showMe: [
      {
        target: { sel: '[data-testid="capacity-bed-meeting-tv"], [data-testid="ward-open-tv"]' },
        title: "Open on TV",
        body: "Opens the large-type view to show on the meeting room or ward TV.",
      },
    ],
  },
  {
    id: "find-bed",
    topic: "Beds and referrals",
    title: "See which wards have a bed that fits",
    keywords: "find bed vacancy availability free beds",
    answer:
      "Use Find a bed in the side menu: choose the age group, bed type, sex and legal status, then read the wards that fit and their free beds. They are listed in a fixed order; the app never picks one.",
    desks: ["ed"],
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-rail-bed-finder"]' },
          { sel: '[data-testid="ward-phone-dock-bed-finder"]' },
        ],
        title: "Find a bed",
        body: "In the side menu, or the bar at the foot on a phone. Choose the patient's needs, then read the wards that fit.",
      },
    ],
  },
  {
    id: "ed-raise",
    topic: "Beds and referrals",
    title: "Refer a patient from the ED",
    keywords: "ed emergency raise referral board patient",
    answer:
      "On your ED board, open the patient and use Raise referral. The ED's waiting list stays in wait order; flags highlight a row but never move it.",
    desks: ["ed"],
    acts: ["RAISE_REFERRAL"],
    go: "home",
    showMe: [
      {
        target: { sel: '[data-testid="ward-ed-raise-referral-toggle"], [data-testid^="ward-ed-patient-"]' },
        title: "Raise a referral",
        body: "Start from the patient's row on the board.",
      },
    ],
  },
  {
    id: "transport-job",
    topic: "Transport",
    title: "Record a transport job",
    keywords: "officer job collected pickup arrived",
    answer:
      "Open the job on My jobs to see the pickup, the destination and the booking, then record when the patient is collected.",
    desks: ["officer"],
    acts: ["TRANSPORT_ACCEPTED", "PATIENT_COLLECTED"],
    go: "home",
    showMe: [
      {
        target: [{ sel: '[data-testid="ward-officer-joblist"]' }, { sel: '#main-content section[aria-label="Jobs"]' }],
        title: "My jobs",
        body: "Every job booked for you, with the pickup, destination and booking. Select one to see it in full.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-officer-next-"]' },
          { sel: '#main-content section[aria-label="Next action"]' },
        ],
        title: "Record the next step",
        body: "The job's next step is one press, such as collected or arrived. It is recorded with the time.",
      },
    ],
  },
  {
    id: "go-to-desk",
    topic: "Finding your way",
    title: "Go to another desk",
    keywords: "switch role desk change view ward ed workstation",
    answer:
      "Open the person menu at the foot of the side menu (the menu button on a phone) and choose Go to a desk. Each desk shows the screens its role uses.",
    desks: EVERY_DESK,
    showMe: [
      {
        target: DESK_SWITCH,
        title: "Go to a desk",
        body: "Opens the list of desks.",
      },
    ],
  },
  {
    id: "service-in-view",
    topic: "Finding your way",
    title: "Look at one health service",
    keywords: "service scope north south east metro wachs filter statewide",
    answer:
      "Use the service selector in the header to show one health service or the whole state. It changes what this screen shows, not anyone's access.",
    desks: ["coordinator", "bed_manager", "executive"],
    showMe: [
      {
        target: { sel: '[data-testid="ward-bar-service-trigger"]' },
        title: "Service in view",
        body: "Statewide, or one service.",
      },
    ],
  },
  {
    id: "alerts",
    topic: "Finding your way",
    title: "See alerts for my desk",
    keywords: "alerts tasks notifications bell to do",
    answer:
      "Press Alerts in the header (Tasks on some desks). Shift+T opens it on a keyboard. Each alert opens the record it is about.",
    desks: EVERY_DESK,
    needs: "alerts",
    showMe: [
      {
        target: { sel: '[data-testid="ward-bar-tasks-trigger"], [data-testid="ward-phone-dock"]' },
        title: "Alerts",
        body: "Everything addressed to this desk, newest first.",
      },
    ],
  },
  {
    id: "search-patient",
    topic: "Finding your way",
    title: "Find a patient",
    keywords: "search patient name umrn look up lookup",
    answer:
      "Type a name or UMRN in the header search. / or Ctrl+K jumps there on a keyboard. Questions such as no bed yet also work.",
    desks: CLINICAL_DESKS,
    needs: "search",
    showMe: [
      {
        target: { sel: '[data-testid="ward-global-search-input"]' },
        title: "Search",
        body: "Names, UMRNs, places and a few common questions.",
      },
    ],
  },
  {
    id: "pin-ward",
    topic: "Finding your way",
    title: "Pin a ward to my menu",
    keywords: "pin favourite my wards shortcut",
    answer: "Open the ward, then in the side menu choose Pin this ward. It stays under My wards on this device.",
    desks: ["coordinator", "bed_manager"],
    go: "wards",
    showMe: [
      {
        target: { sel: '#main-content a[href^="/ward-flow/ward/"]' },
        title: "Open the ward",
        body: "Open the ward you want from the list.",
      },
      {
        target: [{ sel: '[data-testid="ward-my-wards-pin"]' }, { sel: '[data-testid="ward-bar-phone-menu"]' }],
        title: "Pin this ward",
        body: "In the side menu, under My wards (in Menu on a phone). It stays pinned on this device.",
      },
    ],
  },
  {
    id: "theme",
    topic: "Settings and display",
    title: "Use dark mode or the bright light theme",
    keywords: "dark light night glare bright theme colour appearance",
    answer:
      "Settings, Display, Theme: Auto, Light, Dark or Bright light (for a bright room). It changes this device only.",
    desks: EVERY_DESK,
    go: "settings#display",
    showMe: [
      {
        target: setting("theme", "display"),
        title: "Theme",
        body: "In Settings, Display. It saves at once, on this device only.",
      },
    ],
  },
  {
    id: "density",
    topic: "Settings and display",
    title: "Fit more rows on screen",
    keywords: "compact density smaller rows more on screen",
    answer: "Settings, Display, Row density: Compact fits more rows on each screen.",
    desks: EVERY_DESK,
    go: "settings#display",
    showMe: [
      {
        target: setting("density", "display"),
        title: "Row density",
        body: "In Settings, Display: Comfortable or Compact.",
      },
    ],
  },
  {
    id: "notifications",
    topic: "Settings and display",
    title: "Get alerts when I am on another screen",
    keywords: "notifications browser phone push alert notify lock screen",
    answer:
      "Settings, Alerts: turn on Browser notifications for this computer, or Phone alerts for your phone. Both are for act-now and red alerts only.",
    desks: EVERY_DESK,
    needs: "alerts",
    go: "settings#alerts",
    showMe: [
      {
        target: setting("browser-notifications", "alerts"),
        title: "Browser notifications",
        body: "In Settings, Alerts. For this computer.",
      },
      {
        target: setting("phone-alerts", "alerts"),
        title: "Phone alerts",
        body: "In Settings, Alerts. For your phone, including the lock screen.",
      },
    ],
  },
  {
    id: "buzz",
    topic: "Settings and display",
    title: "Turn the buzz sound on or off",
    keywords: "sound chime audio noise mute buzz",
    answer: "Settings, Alerts, Buzz sound. Use its test to hear it.",
    desks: EVERY_DESK,
    needs: "alerts",
    go: "settings#alerts",
    showMe: [
      {
        target: setting("buzz", "alerts"),
        title: "Buzz sound",
        body: "In Settings, Alerts. A chime on an urgent buzz.",
      },
    ],
  },
  {
    id: "rules",
    topic: "Settings and display",
    title: "Change the pull time limit or ED target",
    keywords: "rules settings pull time limit ed target wards asked morning count warning surge",
    answer:
      "Settings, Rules. Change the value, then Save to apply. Each save is recorded in the audit and changes what every screen shows. Surge switches all timings to the busy-day set.",
    desks: ["coordinator"],
    acts: ["SET_CONFIGURATION"],
    go: "settings#rules",
    showMe: [
      {
        target: setting("pull-hold", "rules"),
        title: "Pull time limit",
        body: "In Settings, Rules. How long a pulled bed is kept for the patient.",
      },
      {
        target: setting("ed-target", "rules"),
        title: "ED wait target",
        body: "In Settings, Rules. An access measure only.",
      },
    ],
  },
  {
    id: "mha-times",
    topic: "Handover and reports",
    title: "Why the app does not work out Mental Health Act times",
    keywords: "mha legal form time expiry due calculate detention",
    answer:
      "Ward Flow never works out Mental Health Act times or expiry. It shows only times someone typed from the paper form, and warns before those typed times using the form warnings in Settings.",
    desks: EVERY_DESK,
  },
  {
    id: "undo",
    topic: "Finding your way",
    title: "Undo something I just did",
    keywords: "undo mistake wrong reverse back",
    answer:
      "Many saves show Undo in the message at the foot of the screen while it is showing. After that, change the record back yourself; the history keeps both steps.",
    desks: EVERY_DESK,
  },
  {
    id: "downtime",
    topic: "Handover and reports",
    title: "What to do if Ward Flow is down",
    keywords: "down offline outage paper downtime not working broken support help",
    answer:
      "Switch to the paper process. The downtime pack on Handover prints what you need. The app shows when it last saved, and says so when it is offline.",
    desks: EVERY_DESK,
    go: "handover",
    computerOnly: true,
    showMe: [
      {
        target: { sel: '#main-content a[href="/ward-flow/reports/downtime"]' },
        title: "Downtime pack",
        body: "Print it before you need it.",
      },
    ],
  },
  {
    // The same question for a login that cannot open Handover, so no answer sends it there.
    id: "downtime-paper",
    topic: "Handover and reports",
    title: "What to do if Ward Flow is down",
    keywords: "down offline outage paper downtime not working broken support help",
    answer:
      "Tell the bed coordinator on shift, who decides when everyone switches to paper and keeps the printed downtime pack. Work from paper until the coordinator says Ward Flow is back.",
    desks: EVERY_LOGIN.filter((role) => !deskOpens(role, "handover")),
  },
  {
    id: "tour",
    topic: "Finding your way",
    title: "Take the tour again",
    keywords: "tour tutorial guide walkthrough learn start",
    answer: "Open Help and press Take the tour, or use Replay the tour in Settings, Display.",
    desks: EVERY_DESK,
    showMe: [
      {
        target: [{ sel: '[data-testid="ward-rail-help"]' }, { sel: '[data-testid="ward-bar-phone-menu"]' }],
        title: "Help",
        body: "Help is in the side menu (in Menu on a phone). Take the tour is the first row of How do I….",
      },
    ],
  },
  {
    id: "statistics",
    topic: "Handover and reports",
    title: "See the statistics",
    keywords: "statistics stats trends reports figures numbers",
    answer: "Open Statistics for the network's trends. Every figure is from synthetic records.",
    desks: ["executive", "coordinator", "bed_manager"],
    go: "statistics",
    showMe: [
      {
        target: { sel: '[data-testid="ward-statistics-nav"]' },
        title: "Choose a view",
        body: "Network, Compare, Services, Wards, EDs, Teams and Weekly. Every figure is from synthetic records.",
      },
      {
        target: { sel: '[data-testid="ward-statistics-export"]' },
        title: "Export the figures",
        body: "Downloads the figures at the top of the page as a spreadsheet file, on a computer.",
      },
    ],
  },
  {
    id: "give-access",
    topic: "Settings and display",
    title: "Give or remove someone's access",
    keywords: "access account user role permission admin",
    answer: "Settings, Access: find the person, then give or remove a desk. Each change is recorded.",
    desks: ["admin"],
    go: "settings#access",
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-access-grant"]' },
          { sel: '[data-testid="ward-settings-phone-area-access"]' },
        ],
        title: "Give a desk",
        body: "Find the person, choose the desk, then confirm. Each change is recorded.",
      },
      {
        target: { sel: '[data-testid="ward-access-requests"]' },
        title: "Requests",
        body: "People who asked for access wait here until someone answers.",
      },
    ],
  },
];

/* Matching ----------------------------------------------------------------------------------- */

/** Words that carry no meaning in a question. */
const STOP = new Set(
  "a an and are can cant could do does for from get how i im in is it its me my of on or please should the this to use what when where which who why will with you your".split(
    " ",
  ),
);

/** Lower case with a few endings off, so "pulled", "pulls" and "pull", or "times" and "time", meet. */
function bareStem(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (w.length > 4 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 3 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 3 && /(ch|sh|x|ss)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

const STEM_FAMILY: ReadonlyMap<string, string> = new Map(
  HELP_SYNONYMS.map(([word, family]) => [bareStem(word), bareStem(family)]),
);

/** A word's stem, then its family. */
function stem(word: string): string {
  const bare = bareStem(word);
  return STEM_FAMILY.get(bare) ?? bare;
}

/** Every answer id, for checking a stored count against the answers that exist. */
export const HOW_TO_IDS: ReadonlySet<string> = new Set(HOW_TOS.map((howTo) => howTo.id));

/** The question's meaningful word stems, in order, without repeats. */
export function questionWords(query: string): readonly string[] {
  const words = query
    .split(/[\s,.?!/]+/)
    .filter((word) => word && !STOP.has(word.toLowerCase().replace(/'/g, "")))
    .map(stem)
    .filter((word) => word.length > 1);
  return [...new Set(words)];
}

const indexed = new WeakMap<HowTo, { strong: Set<string>; weak: Set<string> }>();
function wordsOf(howTo: HowTo) {
  let entry = indexed.get(howTo);
  if (!entry) {
    entry = {
      strong: new Set(questionWords(`${howTo.title} ${howTo.keywords}`)),
      weak: new Set(questionWords(howTo.answer)),
    };
    indexed.set(howTo, entry);
  }
  return entry;
}

let vocabulary: { list: readonly string[]; known: ReadonlySet<string> } | undefined;
/** Every word stem the how-tos hold, title and keyword words first, in list order. */
function howToVocabulary() {
  if (!vocabulary) {
    const strong = HOW_TOS.flatMap((howTo) => [...wordsOf(howTo).strong]);
    const weak = HOW_TOS.flatMap((howTo) => [...wordsOf(howTo).weak]);
    const list = [...new Set([...strong, ...weak])];
    vocabulary = { list, known: new Set(list) };
  }
  return vocabulary;
}

/**
 * Question words with small typos mended (P9): a word Help does not hold becomes the nearest word
 * it does, one slip away up to six letters and two beyond. Same words in, same words out.
 */
export function correctWords(words: readonly string[]): readonly string[] {
  const { list, known } = howToVocabulary();
  return [...new Set(words.map((word) => nearestWord(word, list, known)))];
}

/** A word as typed: lower case, letters and digits only, no endings taken off. */
function plainWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The words as written, endings still on, split the way a question is. */
function plainWords(text: string): string[] {
  return text
    .split(/[\s,.?!/]+/)
    .filter((word) => word && !STOP.has(word.toLowerCase().replace(/'/g, "")))
    .map(plainWord)
    .filter(Boolean);
}

let plainVocabulary: { list: readonly string[]; known: ReadonlySet<string> } | undefined;
/** Every word as written in the how-tos (title and keywords first) and the synonym list, endings on. */
function howToPlainVocabulary() {
  if (!plainVocabulary) {
    const strong = HOW_TOS.flatMap((howTo) => plainWords(`${howTo.title} ${howTo.keywords}`));
    const weak = HOW_TOS.flatMap((howTo) => plainWords(howTo.answer));
    const synonyms = HELP_SYNONYMS.map(([word]) => plainWord(word));
    const list = [...new Set([...strong, ...weak, ...synonyms])];
    plainVocabulary = { list, known: new Set(list) };
  }
  return plainVocabulary;
}

/**
 * The question's word stems with typos mended first (P9). A typed word is mended against the words
 * as written, then stemmed, because stemming first shortens the word and changes how many slips it
 * may hold ("thme" is one slip from "theme" but would be a three-letter stem). Same words in, same
 * words out.
 */
export function correctedQuestionWords(query: string): readonly string[] {
  const { list, known } = howToPlainVocabulary();
  const words = plainWords(query)
    .map((word) => stem(nearestWord(word, list, known)))
    .filter((word) => word.length > 1);
  return [...new Set(words)];
}

export type HowToMatch = { readonly howTo: HowTo; readonly forThisDesk: boolean };

/**
 * This login's own how-to with the same title as `howTo` (the downtime pair), else `howTo` itself.
 * A question that only matches the twin this login cannot follow still gets the answer it can.
 */
export function ownTwinOf(howTo: HowTo, role: WardTourRole): HowTo {
  if (howToFor(howTo, role)) return howTo;
  return HOW_TOS.find((other) => other.title === howTo.title && howToFor(other, role)) ?? howTo;
}

/** Each how-to once, keeping its first (best-ranked) place. */
function onceEach<T extends HowToMatch>(sorted: readonly T[]): T[] {
  const seen = new Set<string>();
  return sorted.filter(({ howTo }) => !seen.has(howTo.id) && Boolean(seen.add(howTo.id)));
}

/**
 * The how-tos that answer `query`. A how-to answers when at least half the question's words are
 * in it. Those holding more of the words come first, then this desk's own, then those whose title
 * or keywords hold the words (three times a word in the answer). Ties keep the list's own order,
 * so the same words always give the same answers. Answers scoring under half the best are dropped.
 */
export function askHelp(query: string, role: WardTourRole, limit = 6): readonly HowToMatch[] {
  const words = correctedQuestionWords(query);
  if (words.length === 0) return [];
  const needed = Math.max(1, Math.ceil(words.length / 2));
  const scored = HOW_TOS.flatMap((howTo, order) => {
    const { strong, weak } = wordsOf(howTo);
    let hits = 0;
    let score = 0;
    for (const word of words) {
      if (strong.has(word)) {
        hits += 1;
        score += 3;
      } else if (weak.has(word)) {
        hits += 1;
        score += 1;
      }
    }
    if (hits < needed) return [];
    const own = ownTwinOf(howTo, role);
    return [{ howTo: own, forThisDesk: howToFor(own, role), hits, score, order }];
  });
  // An answer far weaker than the best (one shared word such as "bed") is noise, not a lead.
  const best = Math.max(0, ...scored.map((entry) => entry.score));
  const ranked = scored
    .filter((entry) => entry.score * 2 >= best)
    .sort(
      (a, b) =>
        b.hits - a.hits || Number(b.forThisDesk) - Number(a.forThisDesk) || b.score - a.score || a.order - b.order,
    );
  return onceEach(ranked)
    .slice(0, limit)
    .map(({ howTo, forThisDesk }) => ({ howTo, forThisDesk }));
}

/**
 * When nothing answers (P9): up to `limit` how-tos sharing any one question word, most shared first,
 * this desk's own before others, then list order. Empty when no word is shared at all.
 */
export function closestHowTos(query: string, role: WardTourRole, limit = 3): readonly HowToMatch[] {
  const words = correctedQuestionWords(query);
  if (words.length === 0) return [];
  const scored = HOW_TOS.flatMap((howTo, order) => {
    const { strong, weak } = wordsOf(howTo);
    const score = words.reduce((sum, word) => sum + (strong.has(word) ? 3 : weak.has(word) ? 1 : 0), 0);
    const own = ownTwinOf(howTo, role);
    return score ? [{ howTo: own, forThisDesk: howToFor(own, role), score, order }] : [];
  });
  const ranked = scored.sort(
    (a, b) => b.score - a.score || Number(b.forThisDesk) - Number(a.forThisDesk) || a.order - b.order,
  );
  return onceEach(ranked)
    .slice(0, limit)
    .map(({ howTo, forThisDesk }) => ({ howTo, forThisDesk }));
}
