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
import type { WardAccess, WardScreenId } from "@/components/ward-management/ward-role-access";
import { ASK_WARDS_WINDOW_TEXT } from "@/components/ward-management/ward-operational-defaults";
import { deskMayAct, howToFor, type WardEventType } from "./ward-help-access";
import type { WardTourRole } from "./ward-help-store";
import { MORE_JOBS, SCREEN_TOURS } from "./ward-help-screen-tours";
import { DESK_JOBS, ED_ROW_ACTIONS, MOVEMENT_ROW } from "./ward-help-howto-desks";
import { CRAWL_JOBS } from "./ward-help-howto-more";
import { HELP_SYNONYMS } from "./ward-help-synonyms";
import { nearestWord } from "./ward-help-typo";
import type { TourDevice, TourTarget } from "./ward-tour-steps";
import {
  EVERY_DESK,
  PRIMARY_ACTION,
  DESK_SWITCH,
  tid,
  tidStart,
  opened,
  onPage,
  BOOKING_FORM,
  REFERRAL_FORM,
} from "./ward-help-howto-targets";
import { LATE_JOBS } from "./ward-help-howto-jobs-late";

/**
 * One spotlight in a Show me. Its targets are tried in order and the first on screen is lit, so a
 * step can name the desktop control and a phone stand-in. A step whose control is not on screen
 * shows its card with no spotlight. A step marked with a `device` is walked on that device only, so
 * a phone is never sent to a part only a computer draws.
 */
export type ShowMeStep = {
  readonly device?: TourDevice;
  /** Skip controls this desk cannot record. */
  readonly acts?: readonly WardEventType[];
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
  /** Global rules need the statewide coordinator; absent scope never grants the walkthrough. */
  readonly requiresWholeNetwork?: true;
  /** A screen the task needs that `go` does not name, such as Alerts or Search. */
  readonly needs?: WardScreenId;
  readonly showMe?: readonly ShowMeStep[];
  /**
   * The controls are drawn on a computer only (the phone screen has no such button), so a phone is
   * told so instead of being offered a Show me that could light nothing.
   */
  readonly computerOnly?: true;
  /**
   * A walk round this screen (its rail id), not a job (`ward-help-screen-tours.ts`). Offered from
   * Help's "On this screen" card and search, and left out of the desk's job list.
   */
  readonly around?: string;
};

/** The Show me steps walked on this device: those for every device and those marked for it. */
export function showMeSteps(howTo: HowTo | undefined, device: TourDevice, role?: WardTourRole): readonly ShowMeStep[] {
  return (howTo?.showMe ?? []).filter(
    (step) => (!step.device || step.device === device) && (!step.acts || !role || deskMayAct(role, step.acts)),
  );
}

/** Whether Show me can walk this how-to on this device (`computerOnly` ones cannot on a phone). */
export function canShowMe(howTo: HowTo, phone: boolean): boolean {
  return showMeSteps(howTo, phone ? "phone" : "desk").length > 0 && !(phone && howTo.computerOnly);
}

const JOBS: readonly HowTo[] = [
  {
    id: "pull-bed",
    topic: "Beds and referrals",
    title: "Pull the bed for a patient",
    keywords: "reserve keep book bed accepted placement",
    answer:
      "Once a ward accepts, open the movement and press Pull the bed on its Bed step. In Destination and placement, check the receiving ward, choose an observation level if asked, then press Pull the bed. The bed is kept within the pull time limit. A person always chooses the bed; nothing is placed automatically.",
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
        target: [
          { sel: '[data-testid="ward-patient-gate-bed"] button', text: "Pull the bed" },
          { sel: '[data-testid="ward-patient-phone-action-bar"] button', text: "Pull the bed" },
          tid("ward-shortlist-hold-bed"),
        ],
        title: "Press Pull the bed",
        body: "On the movement, the Bed step names the ward that accepted. Pull the bed opens Destination and placement.",
      },
      {
        target: opened("summary", "Receiving ward safety checks"),
        title: "Check the receiving ward",
        body: "Open Receiving ward safety checks to read each check for this ward before you pull.",
      },
      {
        target: tid("ward-transit-pull-level"),
        title: "Observation level, if asked",
        body: "Shown only when no level is recorded. Choose one before the pull; Intermittent also asks how often.",
      },
      {
        target: opened("[data-placement-action]", "Pull the bed"),
        title: "Pull the bed",
        body: "Press it to keep the bed for this patient. The message after it offers Undo.",
      },
      {
        target: [tid("ward-patient-transit-pull-timer"), tid("ward-patient-gate-bed")],
        title: "Time left on the pull",
        body: "The bed then reads Bed pulled with the time left. It stays pulled until someone releases it.",
      },
    ],
  },
  {
    id: "release-pulled-bed",
    topic: "Beds and referrals",
    title: "Release a pulled bed",
    keywords: "unpull give back free cancel pull expired",
    answer:
      "On Home, press Release pulled bed on the Act now row, choose a reason and press Release pulled bed for the patient. Or open the movement and use Release bed pull. Cancel transport first if it is booked. A pulled bed is never released by itself: past its limit it shows in Act now as Pull expired, bed still pulled.",
    desks: ["coordinator"],
    acts: ["RELEASE_PULL"],
    go: "home",
    showMe: [
      {
        target: [
          { sel: "#main-content button", text: "Release pulled bed" },
          // A phone's list opens each row in a sheet; the hero's Act now count stands in.
          { sel: "#main-content button", text: "Act now" },
          // A phone's hero folds its counts away and keeps the next step row (plan item 2i), used only
          // when that step is Act now; otherwise the tour says the target is not on screen.
          { sel: "#main-content [data-wf-hero-next]", text: "a person now" },
        ],
        title: "Pulls past their limit are in Act now",
        body: "Release pulled bed opens a sheet for that patient. You decide whether to release it or keep it.",
      },
      {
        target: { sel: '[data-testid="home-release-sheet"] select' },
        title: "Choose the reason",
        body: "The sheet names the patient and UMRN. Check them, then choose the reason for the release.",
      },
      {
        target: { sel: '[data-testid="home-release-sheet"] button', text: "Release pulled bed for" },
        title: "Release the bed",
        body: "Press Release pulled bed for the patient. The message after it offers Undo.",
      },
      {
        target: [
          tid("ward-cancel-transport-toggle"),
          tid("ward-patient-cancel-transport"),
          tid("ward-release-pull-toggle"),
        ],
        title: "Transport booked? Cancel it first",
        body: "A bed with booked transport cannot be released. Cancel the transport on the movement first, so the officer is not sent.",
      },
    ],
  },
  {
    id: "decide-referral",
    topic: "Beds and referrals",
    title: "Accept or decline a referral",
    keywords: "decide answer approve reject refuse referral",
    answer:
      "Press Decide on the referral and read it, with the destination's own checks. Then press Accept referral (Accept in principle on a ward) or choose a reason and Decline referral. A decline needs a reason. Only the ward or team it was sent to can answer for itself.",
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
          // A phone's hero folds its counts away and keeps the next step row (plan item 2i), used only
          // when that step is the referrals to decide.
          { sel: "#main-content [data-wf-hero-next]", text: " to decide" },
        ],
        title: "Referrals to decide",
        body: "They stay in wait order, oldest first. Press Decide to open one.",
      },
      {
        target: [tid("ward-referral-match-panel"), tidStart("ward-incoming-"), tid("ward-referral-match-summary")],
        title: "Read the referral",
        body: "Who the patient is, how long they have waited, and the destination's own checks for them.",
      },
      {
        target: [
          tidStart("ward-accept-"),
          tidStart("ward-referral-match-accept-"),
          tid("ward-referral-match-phone-accept"),
          { sel: "#main-content button", text: "Accept referral" },
        ],
        title: "Accept",
        body: "Accept referral, or Accept in principle on a ward. The bed coordinator then pulls the bed.",
      },
      {
        target: [
          tidStart("ward-referral-match-decline-reason-"),
          tid("ward-referral-match-decline-open"),
          tidStart("ward-decline-toggle-"),
        ],
        title: "Or decline, with a reason",
        body: "Choose the reason from the list. A decline cannot be sent without one.",
      },
      {
        target: [
          tid("ward-referral-match-decline"),
          tidStart("ward-referral-match-decline-"),
          tidStart("ward-decline-form-"),
        ],
        title: "Decline referral",
        body: "Sends the decline and its reason. The referrer sees it, and the other destinations still answer.",
      },
      {
        target: tid("ward-referral-match-not-your-decision"),
        title: "Not yours to answer",
        body: "Shown when the referral went to another ward or team. Only that place can answer for itself.",
      },
    ],
  },
  {
    id: "ask-more-wards",
    topic: "Beds and referrals",
    title: "Ask more wards",
    keywords: "send another ward more destinations parallel enquiry",
    answer:
      "Open the referral. Wards asked shows each ward and its answer. Press Ask more wards, search or tick the wards, then press Ask. Wards are listed A to Z and never ranked, and only a ward that fits can be ticked. How many may wait at once is set by Wards asked at once in Settings.",
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
        body: "Select the patient's referral. Its panel has Wards asked and Ask more wards.",
      },
      {
        target: tid("ward-referral-ask-more-wards"),
        title: "Wards asked",
        body: "Each ward asked, who asked it and its answer so far. The count shows how many are waiting of the most allowed.",
      },
      {
        target: tid("ward-referral-ask-open"),
        title: "Ask more wards",
        body: "Opens the list of wards. It is greyed when the most wards are already waiting.",
      },
      {
        target: [{ sel: '[data-testid="ward-referral-ask-list"] input' }, tid("ward-referral-ask-list")],
        title: "Search and tick the wards",
        body: "Type a ward or hospital, then tick each ward to ask. They are listed A to Z, and only a ward that fits can be ticked.",
      },
      {
        target: [tid("ward-referral-ask-submit"), tid("ward-referral-ask-cancel")],
        title: "Ask the wards",
        body: "The button reads Ask and the number ticked. Cancel closes the list without asking anyone.",
      },
    ],
  },
  {
    id: "chase-discharge-dates",
    topic: "Beds and referrals",
    title: "Chase overdue discharge dates",
    keywords: "discharge date passed overdue ask ward message ward confirm date edd chase",
    answer:
      "On Discharges, press Ask N wards in the top: it sends only the wards with a date that has passed one desk alert asking them to confirm or record a new date. It reads Asked once all have been asked. To ask about one person, open them and use Message ward, then choose what to ask.",
    desks: ["coordinator"],
    acts: ["DISPATCH_BROADCAST_ALERT"],
    go: "discharges",
    showMe: [
      {
        target: { sel: '[data-testid="ward-discharge-ask-overdue"]' },
        title: "Ask the wards",
        body: `Asks only the wards with a date that has passed. A ward asked in the last ${ASK_WARDS_WINDOW_TEXT} is not asked again.`,
      },
      {
        target: [tidStart("ward-discharge-cards-"), tidStart("ward-discharge-group-")],
        title: "Find the person",
        body: "Rows are grouped by status. Open a person whose date has passed to see the date and the hold-up.",
      },
      {
        target: tid("ward-discharge-message-ward"),
        title: "Message ward",
        body: "Choose Confirm the discharge date, Update the hold-up or Call the bed coordinator. The ward gets it as a desk alert.",
      },
    ],
  },
  {
    id: "book-transport",
    topic: "Transport",
    title: "Book transport",
    keywords: "ambulance car transfer move patient escort",
    answer:
      "Book by phone first. Then open a movement whose next step is Book transport, press Log booking on its Transport step and fill in the booking: who is collecting, the CAD number, the time, escort and legal status. Save transport booking. Ward Flow records it for the transport officer; it does not order the vehicle.",
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
        target: [
          { sel: '[data-testid="ward-patient-gate-transport"] button', text: "Log booking" },
          { sel: '[data-testid="ward-patient-phone-action-bar"] button', text: "Log booking" },
          tid("ward-shortlist-book-transport"),
        ],
        title: "Log booking",
        body: "On the movement's Transport step. Greyed until the movement is ready for transport, with the reason under it.",
      },
      {
        target: [tid("ward-patient-book-transport-btn"), tid("ward-patient-transport-form")],
        title: "Mark as Booked",
        body: "If the sheet shows Mark as Booked, press it to open the booking form.",
      },
      ...BOOKING_FORM,
      {
        target: [tid("ward-patient-transport-details"), tid("ward-patient-gate-transport")],
        title: "The booking on the movement",
        body: "The CAD number, time and provider then show here. The officer sees the job on their list.",
      },
    ],
  },
  {
    id: "book-transport-ed",
    topic: "Transport",
    title: "Book transport",
    keywords: "ambulance car transfer move patient escort",
    answer:
      "Book by phone first. On My ED board, open the patient's actions and choose Log transport booking. Fill in who is collecting, the CAD number, the time, escort and legal status, then Save transport booking. Ward Flow records it; it does not order a vehicle.",
    desks: ["ed"],
    acts: ["BOOK_TRANSPORT"],
    go: "home",
    showMe: [
      {
        target: ED_ROW_ACTIONS,
        title: "The patient's actions",
        body: "At the end of each board row. On a phone, tap the patient.",
      },
      {
        target: { sel: '[data-testid^="ward-ed-book-transport-toggle-"]' },
        title: "Log transport booking",
        body: "Shown once the bed is pulled. It opens the booking form for the call you made.",
      },
      ...BOOKING_FORM,
    ],
  },
  {
    id: "book-transport-community",
    topic: "Transport",
    title: "Book transport",
    keywords: "ambulance car transfer move patient escort",
    answer:
      "On My team, find the patient's row and choose Log transport booking (Log transport on a phone). Fill in who is collecting, the CAD number, the time, escort and legal status, then Save transport booking. Ward Flow records the booking made by phone; it does not order a vehicle.",
    desks: ["community"],
    acts: ["BOOK_TRANSPORT"],
    go: "home",
    showMe: [
      {
        target: [
          { sel: '[data-testid^="ward-community-book-transport-"]' },
          { sel: "#main-content button", text: "Log transport" },
        ],
        title: "Log transport booking",
        body: "On the patient's row, once a bed is pulled. Record the booking made by phone.",
      },
      ...BOOKING_FORM,
      {
        target: [tidStart("ward-community-transport-eta-"), tidStart("ward-community-transport-cell-")],
        title: "The booking on the row",
        body: "The row then shows the estimated time, and Cancel this team's booking until collection.",
      },
    ],
  },
  {
    id: "book-transport-ward",
    topic: "Transport",
    title: "Book transport",
    keywords: "ambulance car transfer move patient escort",
    answer:
      "Open the patient from Coming and going, press the Destination row, then Record transport booking. Fill in the booking made by phone and press Save transport booking. You may record a booking for a journey your ward sent. Ward Flow records the booking; it does not order a vehicle.",
    desks: ["ward"],
    acts: ["BOOK_TRANSPORT"],
    go: "movements",
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Open the patient's journey from Coming and going." },
      {
        target: tid("ward-patient-destination-row"),
        title: "Destination",
        body: "Opens Destination and placement, where your ward records its booking.",
      },
      {
        target: [opened("button", "Record transport booking"), onPage("button", "Record transport booking")],
        title: "Record transport booking",
        body: "Shows once the bed is pulled and no booking is recorded yet, for a journey your ward sent.",
      },
      ...BOOKING_FORM,
    ],
  },
  {
    id: "cancel-transport-ed",
    topic: "Transport",
    title: "Cancel transport",
    keywords: "stop ambulance unbook transfer orphaned no bed pulled",
    answer:
      "On Movements, open a referral your ED sent. Under Transport booked with no bed pulled, choose a reason, then press Cancel the transport job. This control handles orphaned jobs only; ask the coordinator about ordinary bookings. No cancellation is possible after collection.",
    desks: ["ed"],
    acts: ["CANCEL_TRANSPORT"],
    go: "movements",
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Open the referral your ED sent." },
      {
        target: [tid("ward-patient-orphaned-transport"), tid("ward-console-cancel-transport")],
        title: "Transport booked with no bed pulled",
        body: "Shown only when a job is still booked but the bed has gone. It says who may cancel it.",
      },
      {
        target: tid("ward-console-cancel-transport-reason"),
        title: "Why is the job being cancelled?",
        body: "Choose the reason from the list. It goes to the officer with the cancellation.",
      },
      {
        target: tid("ward-console-cancel-transport"),
        title: "Cancel the transport job",
        body: "Press it once the reason is chosen. Ring the provider as well; Ward Flow does not tell them.",
      },
    ],
  },
  {
    id: "cancel-transport-ward",
    topic: "Transport",
    title: "Cancel transport",
    keywords: "stop ambulance unbook transfer orphaned no bed pulled sending ward booker",
    answer:
      "On Coming and going, open the movement. Under Transport booked with no bed pulled, choose a reason, then Cancel the transport job. Only the sending ward recorded as booker may cancel; receiving the patient is not enough. Ask the coordinator about ordinary bookings. No cancellation is possible after collection.",
    desks: ["ward"],
    acts: ["CANCEL_TRANSPORT"],
    go: "movements",
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Open the journey your ward sent." },
      {
        target: [tid("ward-patient-orphaned-transport"), tid("ward-console-cancel-transport")],
        title: "Transport booked with no bed pulled",
        body: "Shown only when a job is still booked but the bed has gone. It names the ward that booked it.",
      },
      {
        target: tid("ward-console-cancel-transport-reason"),
        title: "Why is the job being cancelled?",
        body: "Choose the reason from the list.",
      },
      {
        target: [tid("ward-console-cancel-transport-not-yours"), tid("ward-console-cancel-transport")],
        title: "Cancel the transport job",
        body: "Works only for the sending ward recorded as booker. Otherwise the screen says so; ask the coordinator.",
      },
    ],
  },
  {
    id: "cancel-transport-community",
    topic: "Transport",
    title: "Cancel transport",
    keywords: "stop ambulance unbook transfer",
    answer:
      "On My team, press Cancel this team's booking on the patient's row, choose the reason, then Confirm cancel. Ring the provider too. You cannot cancel another team's booking or a job after collection; ask the bed coordinator then.",
    desks: ["community"],
    acts: ["CANCEL_TRANSPORT"],
    go: "home",
    showMe: [
      {
        target: { sel: '[data-testid^="ward-community-cancel-transport-"]' },
        title: "Cancel this team's booking",
        body: "On your own team's active booking, before collection.",
      },
      {
        target: [tidStart("ward-community-cancel-transport-reason-"), opened("select", "Choose a reason")],
        title: "Why is the job being cancelled?",
        body: "The dialog names the patient and the job. Choose the reason from the list.",
      },
      {
        target: [tidStart("ward-community-cancel-transport-confirm-"), opened("button", "Confirm cancel")],
        title: "Confirm cancel",
        body: "Records the cancellation for the officer and the receiving ward. Keep as is closes without cancelling.",
      },
    ],
  },
  {
    id: "cancel-transport",
    topic: "Transport",
    title: "Cancel transport",
    keywords: "stop ambulance unbook transfer",
    answer:
      "Open the movement and press its Destination row. Under Review & corrections, open Cancel transport, choose the reason and press Cancel transport. The bed stays pulled. Do this before you release a pulled bed, so the officer is not sent for a patient whose bed has gone.",
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
        target: tid("ward-patient-destination-row"),
        title: "Destination",
        body: "Opens Destination and placement, where booked transport is cancelled.",
      },
      {
        target: [tid("ward-patient-cancel-transport"), tid("ward-cancel-transport-toggle")],
        title: "Cancel transport",
        body: "Under Review & corrections. Open it to see the reasons.",
      },
      {
        target: [
          { sel: '[data-testid="ward-patient-cancel-transport"] [role="group"]' },
          { sel: '[data-testid="ward-cancel-transport"] select' },
        ],
        title: "Choose the reason",
        body: "Choose one reason. The line under it names the patient and says the bed stays pulled.",
      },
      {
        target: [
          { sel: '[data-testid="ward-patient-cancel-transport"] button', text: "Cancel transport" },
          { sel: '[data-testid="ward-cancel-transport"] button', text: "Cancel transport" },
        ],
        title: "Cancel transport",
        body: "The officer's job is cancelled and says why. The message after it offers Undo.",
      },
    ],
  },
  {
    id: "log-call",
    topic: "Beds and referrals",
    title: "Log a call",
    keywords: "phone rang contact follow up callback",
    answer:
      "Open the referral. Under Log a call, choose Who was rung and What they said, then press Log a call. The next person sees who was called and when. A call does not answer the referral; the decision time keeps running.",
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
        body: "Log a call is in the referral's panel, with the desk that owns it.",
      },
      {
        target: tidStart("ward-referral-assign-"),
        title: "The owner desk",
        body: "Assign gives the referral to a desk, so everyone knows who is chasing it.",
      },
      {
        target: tidStart("ward-referral-call-who-"),
        title: "Who was rung",
        body: "The referrer, a ward or a community team.",
      },
      {
        target: tidStart("ward-referral-call-outcome-"),
        title: "What they said",
        body: "Choose the outcome from the list.",
      },
      {
        target: tidStart("ward-referral-call-log-"),
        title: "Log a call",
        body: "Records the call with the time. It does not answer the referral; the decision time keeps running.",
      },
      {
        target: [tidStart("ward-referral-calls-"), tidStart("ward-referral-call-log-")],
        title: "Calls logged",
        body: "Newest first, with who logged each and when.",
      },
    ],
  },
  {
    id: "new-referral",
    topic: "Beds and referrals",
    title: "Raise a new referral",
    keywords: "refer send create start new referral",
    answer:
      "Press New referral. Choose Refer to, find or add the patient, check the catchment, then work down the steps; Before you send lists what is still needed. Several destinations can go at once and each answers on its own. Send referral, then Confirm and send. Save draft keeps it in this tab.",
    desks: ["coordinator", "ed", "community", "ward"],
    acts: ["RAISE_REFERRAL"],
    showMe: [
      {
        target: PRIMARY_ACTION,
        title: "New referral",
        body: "Starts a referral from any screen. Shift+R does the same on a keyboard.",
      },
      ...REFERRAL_FORM,
    ],
  },
  {
    id: "sign-off-handover",
    topic: "Handover and reports",
    title: "Hand over to the next shift",
    keywords: "handover handoff sign off shift change",
    answer:
      "Open Handover. Read Act now first, then what is due before the next handover. Work through Before you sign: each line has its own button where something needs doing. Then press Sign off. Undo sign-off takes it back if it was a mistake.",
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
        body: "These counts open the rows they describe, act now first. Read each row's detail before you hand it on.",
      },
      {
        device: "desk",
        target: { sel: '[data-testid="ward-handover-sign-off-checks"]' },
        title: "Before you sign",
        body: "Check each line before you sign. A line with a button opens what it needs.",
      },
      {
        device: "phone",
        target: [tid("ward-handover-phone-row"), tid("ward-handover-sheet")],
        title: "The patients to hand over",
        body: "Grouped as the counts are. Open a row to read its detail before you hand it on.",
      },
      {
        device: "desk",
        target: [tid("ward-handover-sign-off-button"), tid("ward-handover-sign-off-visible-status")],
        title: "Sign off",
        body: "The button carries the time and records the handover by your desk. The time then shows here and in History; Undo sign-off takes it back.",
      },
      {
        device: "phone",
        target: tid("ward-handover-phone-sign-off"),
        title: "Before you sign, then Sign off",
        body: "Sign off opens the Before you sign checks. Work through them, then sign. Undo sign-off takes it back.",
      },
    ],
  },
  {
    id: "print-handover",
    topic: "Handover and reports",
    title: "Print the handover sheet",
    keywords: "print paper copy present meeting",
    answer:
      "Open Handover and choose Print handover. Choose what to include, the paper (A4 landscape or portrait) and any highlight, review the pages, then press Print or save PDF. Back to handover returns without printing.",
    desks: ["coordinator", "ward", "bed_manager"],
    go: "handover",
    computerOnly: true,
    showMe: [
      {
        target: { sel: '[data-testid="ward-handover-print"]' },
        title: "Print handover",
        body: "Opens the print sheet, a live preview of the pages.",
      },
      {
        target: { sel: '[data-testid="ward-handover-print-sheet"] section', text: "Include" },
        title: "Include",
        body: "Switch each part of the sheet on or off.",
      },
      {
        target: { sel: '[data-testid="ward-handover-print-sheet"] section', text: "Paper" },
        title: "Paper",
        body: "A4 landscape or A4 portrait. The page count updates as you choose.",
      },
      {
        target: { sel: '[data-testid="ward-handover-print-sheet"] section', text: "Highlight" },
        title: "Highlight",
        body: "Marks rows on the printed copy without leaving any out.",
      },
      {
        target: { sel: '[data-testid="ward-handover-print-sheet"] button', text: "Print or save PDF" },
        title: "Print or save PDF",
        body: "Review the pages first. The sheet then says when the last copy was prepared.",
      },
    ],
  },
  {
    id: "confirm-numbers",
    topic: "Beds and referrals",
    title: "Confirm the ward's bed numbers",
    keywords: "morning count bed state update numbers census",
    answer:
      "On your ward's home, press Confirm numbers. Check the staffed, in use, ready and closed figures, set Beds free to offer, then press Confirm beds (with the morning numbers while they are due). The time you confirm shows on every screen, so others know how fresh the figure is.",
    desks: ["ward"],
    acts: ["CONFIRM_CAPACITY"],
    go: "home",
    showMe: [
      {
        target: { sel: '[data-testid^="ward-unit-card-"] button', text: "Confirm numbers" },
        title: "Confirm numbers",
        body: "Press this once the figures match the ward. The morning count is due by the time set in Settings.",
      },
      {
        target: { sel: '[data-testid="ward-capacity-form"] section[aria-label="Bed roster and census"]' },
        title: "Check the figures",
        body: "Staffed beds, in use, ready and closed, with pulled beds not yet arrived under them.",
      },
      {
        target: tid("ward-capacity-input"),
        title: "Beds free to offer",
        body: "Type the number, or use One bed fewer and One bed more. The line under it says when it was last confirmed.",
      },
      {
        target: tid("ward-capacity-review-discharges-btn"),
        title: "Expected discharges today",
        body: "Opens the ward board to check today's discharges before you confirm.",
      },
      {
        target: opened("button", "Confirm beds"),
        title: "Confirm beds",
        body: "Confirms the figure for this ward only. While the morning numbers are due, the button sends them too.",
      },
    ],
  },
  {
    id: "answer-ward-referrals",
    topic: "Beds and referrals",
    title: "Answer the ward's referrals",
    keywords: "accept decline ward referral answer one by one",
    answer:
      "Open Answer one by one on your ward's home. Read each referral and the ward's own checks, then press Accept in principle (choosing the pull time limit) or Decline with a reason. A site bed manager can see them but cannot answer for the ward.",
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
      {
        target: [
          { sel: '#main-content [aria-label="Awaiting your answer"]' },
          { sel: '#main-content [aria-label="Bed request position"]' },
        ],
        title: "Referrals waiting",
        body: "Each referral waiting for this ward, oldest first. Move between them here.",
      },
      {
        target: [tidStart("ward-incoming-"), tid("ward-answer-selection-left")],
        title: "Read the referral",
        body: "The patient's current facts and this ward's own checks, side by side.",
      },
      {
        device: "desk",
        target: { sel: '#main-content select[id^="ward-accept-hold-"]' },
        title: "Pull time limit",
        body: "Choose the time limit before you accept. Accept stays locked until one is chosen.",
      },
      {
        target: tidStart("ward-accept-"),
        title: "Accept in principle",
        body: "Accepts for this ward. The coordinator then pulls the bed.",
      },
      {
        target: [tidStart("ward-decline-form-"), tidStart("ward-decline-toggle-")],
        title: "Decline with a reason",
        body: "Decline opens the reasons. Choose one, then press Decline for the patient.",
      },
      {
        target: tid("ward-answer-history"),
        title: "Recent answers",
        body: "Each answer this ward gave, with the time.",
      },
    ],
  },
  {
    id: "bed-board",
    topic: "Beds and referrals",
    title: "See every bed on the ward",
    keywords: "bed board list beds occupied ready closed leave place move",
    answer:
      "Every bed on your ward's home shows who is in each bed or whether it is ready, pulled, closed or held for a patient on leave. Place or move opens the bed board: choose who needs a bed, then a lit bed, then confirm. Every bed list shows the beds as a list.",
    desks: ["ward"],
    go: "home",
    showMe: [
      {
        target: { sel: '[data-testid="ward-open-bed-board"]' },
        title: "Place or move",
        body: "Opens the bed board to place someone waiting or move someone between beds. Open a bed for the patient in it.",
      },
      {
        target: tid("ward-board-waitlist"),
        title: "Who needs a bed",
        body: "The people waiting for this ward. Choose one to light the beds that fit.",
      },
      {
        target: tid("ward-bed-board-plan"),
        title: "Choose a lit bed",
        body: "Lit beds fit the person chosen. On a computer you can also drag the person onto a bed.",
      },
      {
        target: [tid("ward-board-confirm"), tid("ward-board-say")],
        title: "Confirm the bed",
        body: "The board asks you to confirm. Choose another bed if it is wrong. A person always chooses the bed.",
      },
      {
        target: onPage("button", "Every bed list"),
        title: "Every bed list",
        body: "The same beds as a list, with who is in each.",
      },
    ],
  },
  {
    id: "tv",
    topic: "Handover and reports",
    title: "Put the ward or bed meeting on a TV",
    keywords: "tv television screen display wall big screen meeting",
    answer:
      "For the bed meeting, open Capacity and choose Open on TV under the arrow beside Bed meeting sheet. For one ward, use On TV on the ward's home. Open the same link on the TV's browser. The TV view is read only and shows names in full, so check who can see the screen.",
    desks: ["coordinator", "ward", "bed_manager"],
    // Capacity's Bed meeting menu (it holds Open on TV) for the desks that open Capacity; a ward's own page has its own.
    go: ["capacity", "home"],
    computerOnly: true,
    showMe: [
      {
        target: { sel: '[data-testid="capacity-bed-meeting"], [data-testid="ward-open-tv"]' },
        title: "Bed meeting sheet",
        body: "On Capacity, the Bed meeting sheet opens the printable sheet. On a ward's home, On TV opens the ward's own TV view.",
      },
      {
        target: [tid("capacity-bed-meeting-more"), tid("ward-open-tv")],
        title: "More bed meeting views",
        body: "The arrow beside Bed meeting sheet holds Open on TV and, for some desks, the meeting agenda.",
      },
      {
        target: [{ sel: '[role="menu"] [role="menuitem"]', text: "Open on TV" }, tid("ward-open-tv")],
        title: "Open on TV",
        body: "Opens the large-type view. Open the same link on the TV's browser; it is read only and shows names in full.",
      },
    ],
  },
  {
    id: "find-bed",
    topic: "Beds and referrals",
    title: "See which wards have a bed that fits",
    keywords: "find bed vacancy availability free beds",
    answer:
      "Use Find a bed in the side menu (the bar at the foot on a phone). Choose the Age group, Bed, Ward for and Legal status, then read the ready beds by ward. They are listed in a fixed order; the app never picks one. A referral still asks the ward.",
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
      {
        target: [
          { sel: '[data-testid="ward-tools-bed-finder"] button', text: "Change" },
          tid("ward-bed-finder-summary"),
        ],
        title: "The needs chosen",
        body: "The line names the needs used last time on this device. Change opens them; Done closes them.",
      },
      {
        target: { sel: '[data-testid="ward-tools-bed-finder"] [role="radiogroup"][aria-label="Age group"]' },
        title: "Age group",
        body: "The patient's age group. Only wards for that group are counted.",
      },
      {
        target: { sel: '[data-testid="ward-tools-bed-finder"] [role="radiogroup"][aria-label="Bed"]' },
        title: "Bed",
        body: "The kind of bed needed, or Any bed.",
      },
      {
        target: { sel: '[data-testid="ward-tools-bed-finder"] [role="group"][aria-label="Ward for"]' },
        title: "Ward for",
        body: "Who the ward takes. Choose the one that fits the patient.",
      },
      {
        target: { sel: '[data-testid="ward-tools-bed-finder"] [role="radiogroup"][aria-label="Legal status"]' },
        title: "Legal status",
        body: "Required. The wards are listed once a legal status is chosen.",
      },
      {
        target: [
          { sel: '[data-testid="ward-tools-bed-finder"] [aria-label="Ready beds by ward"]' },
          tid("ward-bed-finder-summary"),
        ],
        title: "Ready beds by ward",
        body: "In a fixed order, never ranked. To ask a ward, send a New referral; the ward answers.",
      },
    ],
  },
  {
    id: "ed-raise",
    topic: "Beds and referrals",
    title: "Refer a patient from the ED",
    keywords: "ed emergency raise referral board patient",
    answer:
      "On your ED board, open the patient and use New referral. Choose Refer to and the destinations, then work through the steps until Send referral; press Confirm and send. The ED's waiting list stays in wait order; flags highlight a row but never move it.",
    desks: ["ed"],
    acts: ["RAISE_REFERRAL"],
    go: "home",
    showMe: [
      {
        target: { sel: '[data-testid="ward-ed-raise-referral-toggle"], [data-testid^="ward-ed-patient-"]' },
        title: "New referral",
        body: "Start from the patient's row on the board.",
      },
      ...REFERRAL_FORM,
    ],
  },
  {
    id: "transport-job",
    topic: "Transport",
    title: "Record a transport job",
    keywords: "officer job collected pickup arrived",
    answer:
      "Open the job on My jobs to see the pickup, the destination and the booking. Check the person's identity and the forms to carry, then press the job's next step, such as collected or arrived. Each step is recorded with the time.",
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
        target: [tidStart("ward-officer-select-"), tidStart("ward-officer-job-")],
        title: "Select a job",
        body: "Opens the job beside the list, or full screen on a phone.",
      },
      {
        target: [tidStart("ward-officer-route-"), tid("ward-officer-nextcard-facts")],
        title: "Pickup and destination",
        body: "Where to collect the patient, where they are going, and the booked time.",
      },
      {
        target: [tidStart("ward-officer-identity-check-"), tid("ward-officer-next-identity")],
        title: "Check who you collect",
        body: "Check the name and UMRN against the person before you leave.",
      },
      {
        target: [tidStart("ward-officer-legal-"), tidStart("ward-officer-forms-pack-")],
        title: "Legal status and forms",
        body: "The legal status recorded for the journey and the forms that travel with the patient.",
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
      "Open your account menu. It is your name at the foot of the side menu, or the menu button on a phone. Choose Switch desk if your account has more than one desk. In the demo, choose Try another desk (demo). Each desk shows the screens its role uses.",
    desks: EVERY_DESK,
    showMe: [
      {
        target: DESK_SWITCH,
        title: "Your account menu",
        body: "Switch desk is here when your account has more than one desk. In the demo, it is Try another desk (demo).",
      },
      {
        target: [
          opened("button", "Switch desk"),
          opened("button", "Try another desk"),
          opened("a", "Try another desk"),
        ],
        title: "Switch desk",
        body: "Choose the desk to work as. The menu and home change to suit it.",
      },
    ],
  },
  {
    id: "service-in-view",
    topic: "Finding your way",
    title: "Look at one health service",
    keywords: "service scope north south east metro wachs filter statewide",
    answer:
      "Use the service selector in the header to show one health service or the whole state. Each choice shows how many are waiting there. It changes what this screen shows, not anyone's access.",
    desks: ["coordinator", "bed_manager", "executive"],
    showMe: [
      {
        target: { sel: '[data-testid="ward-bar-service-trigger"]' },
        title: "Service in view",
        body: "Statewide, or one service.",
      },
      {
        target: tid("ward-bar-service-panel"),
        title: "Choose a health service",
        body: "Statewide, or one service, each with the number waiting. The header then names the service shown.",
      },
    ],
  },
  {
    id: "alerts",
    topic: "Finding your way",
    title: "See alerts for my desk",
    keywords: "alerts tasks notifications bell to do",
    answer:
      "Press Alerts in the header. Shift+T opens it on a keyboard. Each alert opens the record it is about. Open alerts at the foot of the panel goes to the full Alerts page.",
    desks: EVERY_DESK,
    needs: "alerts",
    showMe: [
      {
        target: { sel: '[data-testid="ward-bar-tasks-trigger"], [data-testid="ward-phone-dock"]' },
        title: "Alerts",
        body: "Everything addressed to this desk, newest first.",
      },
      {
        target: [tid("ward-tasks-drawer-count"), tid("ward-bar-tasks-sheet")],
        title: "Your alerts",
        body: "The count of open alerts. Press an alert to open the record it is about.",
      },
      {
        target: tid("ward-tasks-sort"),
        title: "Order",
        body: "Change how the alerts are ordered.",
      },
      {
        target: tid("ward-tasks-open-alerts"),
        title: "Open alerts",
        body: "The full Alerts page, with what was cleared and the broadcasts.",
      },
    ],
  },
  ...LATE_JOBS,
];

/** The desks' jobs, the jobs added with the walk-rounds, the desk jobs added later, then the walks round each screen. */
export const HOW_TOS: readonly HowTo[] = [...JOBS, ...MORE_JOBS, ...DESK_JOBS, ...CRAWL_JOBS, ...SCREEN_TOURS];

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
export function ownTwinOf(howTo: HowTo, role: WardTourRole, access?: WardAccess): HowTo {
  if (howToFor(howTo, role, access)) return howTo;
  return HOW_TOS.find((other) => other.title === howTo.title && howToFor(other, role, access)) ?? howTo;
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
export function askHelp(query: string, role: WardTourRole, limit = 6, access?: WardAccess): readonly HowToMatch[] {
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
    const own = ownTwinOf(howTo, role, access);
    return [{ howTo: own, forThisDesk: howToFor(own, role, access), hits, score, order }];
  });
  // An answer far weaker than the best (one shared word such as "bed") is noise, not a lead.
  const best = Math.max(0, ...scored.map((entry) => entry.score));
  const ranked = scored
    .filter((entry) => entry.score * 2 >= best)
    .sort(
      (a, b) =>
        b.hits - a.hits ||
        // A job comes before a walk round that shares its words; "show me around" asks for one.
        Number(Boolean(a.howTo.around)) - Number(Boolean(b.howTo.around)) ||
        Number(b.forThisDesk) - Number(a.forThisDesk) ||
        b.score - a.score ||
        a.order - b.order,
    );
  return onceEach(ranked)
    .slice(0, limit)
    .map(({ howTo, forThisDesk }) => ({ howTo, forThisDesk }));
}

/**
 * When nothing answers (P9): up to `limit` how-tos sharing any one question word, most shared first,
 * this desk's own before others, then list order. Empty when no word is shared at all.
 */
export function closestHowTos(
  query: string,
  role: WardTourRole,
  limit = 3,
  access?: WardAccess,
): readonly HowToMatch[] {
  const words = correctedQuestionWords(query);
  if (words.length === 0) return [];
  const scored = HOW_TOS.flatMap((howTo, order) => {
    // A walk round a screen answers only when asked for; it is never a "closest" job.
    if (howTo.around) return [];
    const { strong, weak } = wordsOf(howTo);
    const score = words.reduce((sum, word) => sum + (strong.has(word) ? 3 : weak.has(word) ? 1 : 0), 0);
    const own = ownTwinOf(howTo, role, access);
    return score ? [{ howTo: own, forThisDesk: howToFor(own, role, access), score, order }] : [];
  });
  const ranked = scored.sort(
    (a, b) => b.score - a.score || Number(b.forThisDesk) - Number(a.forThisDesk) || a.order - b.order,
  );
  return onceEach(ranked)
    .slice(0, limit)
    .map(({ howTo, forThisDesk }) => ({ howTo, forThisDesk }));
}
