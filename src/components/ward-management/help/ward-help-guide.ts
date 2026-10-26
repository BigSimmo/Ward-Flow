/**
 * THE DESK GUIDE IN HELP (Josh, 24 Oct 2026): one page per desk that explains the core features in
 * plain words, so a clinician can learn the app without the tour and come back to it any time.
 *
 * The words follow the one-page desk guides in `docs/ward-flow/desk-guides/`, shortened for a side
 * sheet. Button names are written as the screens show them. A bed kept for an incoming patient is
 * "pulled" with a "pull time limit"; "held" is only a patient's own bed while they are on leave or
 * away (D-81). Nothing here is clinical advice, and nothing describes ranking, scoring or computed
 * Mental Health Act times, which Ward Flow never does.
 */
import type { WardTourRole } from "./ward-help-store";

type GuideJob = {
  /** The job in a few words, shown in bold. */
  readonly job: string;
  /** How to do it, naming the buttons the screen shows. */
  readonly how: string;
  /** Where it is done: the desk's home, or a rail entry id. Help links there when the desk can open it. */
  readonly go: string;
};

export type DeskGuide = {
  /** The desk's home screen, as its menu names it. */
  readonly homeName: string;
  /** One sentence: what this desk is for. */
  readonly summary: string;
  /** Where the desk starts and what its main menu holds. */
  readonly startsAt: string;
  /** The jobs the desk does most, in the order a shift meets them. */
  readonly jobs: readonly GuideJob[];
  /** What the desk cannot do, or what the app will never do for it. */
  readonly limits: readonly string[];
};

const NO_MHA_TIMES =
  "The app never works out Mental Health Act times. It shows only times someone typed from the paper form.";

export const DESK_GUIDES: Readonly<Record<WardTourRole, DeskGuide>> = {
  coordinator: {
    homeName: "My list",
    summary:
      "You see the whole network or your own health service, decide referrals and keep patients moving to a bed.",
    startsAt:
      "My list is your home: Act now, Since you last looked and Referrals to decide. Your menu holds Capacity, Movements, Referrals and Handover.",
    jobs: [
      {
        job: "Decide a referral",
        how: "Press Decide, read the referral, then Accept referral or Decline referral. A decline needs a reason.",
        go: "referrals",
      },
      {
        job: "Ask more wards",
        how: "Use Ask more wards and tick the wards. Wards stay in a fixed order; the app never ranks or suggests one.",
        go: "referrals",
      },
      {
        job: "Pull the bed",
        how: "Once a ward accepts, press Pull the bed. It is kept for the patient within the pull time limit.",
        go: "movements",
      },
      {
        job: "Book transport",
        how: "Press Book transport, or record that none is needed. Cancel transport before you release a pulled bed.",
        go: "movements",
      },
      {
        job: "Log a call",
        how: "On a referral, use Log a call so the next person sees who was rung.",
        go: "referrals",
      },
      { job: "Hand over", how: "Open Handover for what the next shift needs, then Sign off.", go: "handover" },
    ],
    limits: [
      "A person always chooses the bed. Nothing is placed automatically.",
      "Wait lists stay in wait order. Flags highlight a row but never move it.",
      NO_MHA_TIMES,
    ],
  },
  ward: {
    homeName: "My ward",
    summary: "You run your own ward's beds and answer the referrals sent to it.",
    startsAt:
      "My ward is your home: the bed board, this shift's jobs and Awaiting your answer. Your menu holds Coming and going, Referrals to answer and Handover.",
    jobs: [
      {
        job: "Confirm your beds",
        how: "Each morning fill in Confirm your beds and press Confirm by your service's roll-up time.",
        go: "home",
      },
      {
        job: "Read the referral",
        how: "Tap the patient's name or View referral. You see the whole referral before you answer.",
        go: "home",
      },
      {
        job: "Answer it",
        how: "Press Accept in principle and choose the pull time limit, or press Decline and pick a reason.",
        go: "home",
      },
      { job: "Arrivals", how: "When the patient reaches the ward, press Confirm arrival.", go: "movements" },
      {
        job: "Leave, away and discharge",
        how: "On a bed, Mark at an ED or Mark them back. Their bed is held while they are away. Record a discharge with They have left.",
        go: "home",
      },
      { job: "Hand over", how: "Open Handover, check the sheet, then Sign off.", go: "handover" },
    ],
    limits: [
      "You never see which other wards the patient was referred to.",
      "You cannot change another ward's beds or answers.",
      NO_MHA_TIMES,
    ],
  },
  ed: {
    homeName: "My ED board",
    summary: "You look after the mental health patients waiting in your own emergency department.",
    startsAt:
      "My ED board is your home: your patients, longest wait first, and where each referral stands. Your menu holds My referrals, New referral and Find a bed.",
    jobs: [
      {
        job: "Raise a referral",
        how: "Use New referral, or Raise referral on the board. Choose one or more destinations and send it.",
        go: "referral-intake",
      },
      {
        job: "Record ED steps",
        how: "On a patient, use Record examination, Record medically cleared and Mark handover ready.",
        go: "home",
      },
      {
        job: "Legal paperwork",
        how: "Use Change legal status and Mark Form 1A received. Type any expiry time from the paper form.",
        go: "home",
      },
      {
        job: "Transport",
        how: "Once a bed is pulled for your patient, press Transport booked or No transport needed.",
        go: "home",
      },
      {
        job: "Fix a mistake",
        how: "Use Withdraw referral, Record urgency change or Correct receipt.",
        go: "referrals",
      },
    ],
    limits: [
      "The board never re-sorts the queue. It stays longest wait first.",
      "You cannot accept for a ward or place a patient.",
      NO_MHA_TIMES,
    ],
  },
  officer: {
    homeName: "My jobs",
    summary: "You move patients between places for your own health service.",
    startsAt:
      "My jobs is your home: the open transport jobs, with the flags recorded on each referral. Alerts is your other screen.",
    jobs: [
      { job: "Open a job", how: "Choose a job to see the booking, the forms and the arrival plan.", go: "home" },
      {
        job: "Move it along",
        how: "Press Mark accepted, then Mark en route, Mark collected and Mark delivered as each step happens.",
        go: "home",
      },
      {
        job: "Undo a slip",
        how: "If you pressed the wrong step, press Undo on the message straight away.",
        go: "home",
      },
      { job: "Divert", how: "If the patient must go somewhere else, use Divert and record why.", go: "home" },
      { job: "Check the forms", how: "Use Inspect form before you leave.", go: "home" },
    ],
    limits: [
      "You see only your own service's jobs.",
      "You cannot accept a referral, pull a bed or change a ward's beds.",
      "A step can be refused, for example when a legal order changed. The message says why.",
    ],
  },
  community: {
    homeName: "My team",
    summary: "You work for one community mental health team. You send referrals and answer the ones sent to your team.",
    startsAt:
      "My team is your home: referrals waiting for your answer, people in a bed and your caseload. Your menu holds Referrals, New referral and Movements.",
    jobs: [
      {
        job: "Send a referral",
        how: "Use New referral. For another team, choose the purpose and first contact time, then Send referral.",
        go: "referral-intake",
      },
      { job: "Check what you sent", how: "The Sent tab shows your referrals and whether a ward accepted.", go: "home" },
      { job: "Answer a referral", how: "Open it, then Accept referral or Decline referral.", go: "referrals" },
      { job: "Record contact", how: "Use Record contact after you reach the person.", go: "home" },
      {
        job: "Follow a move",
        how: "An accepted referral is moved, transported and arrived. Follow it on Movements.",
        go: "movements",
      },
    ],
    limits: [
      "You cannot accept for a ward or place a patient.",
      "You cannot see other teams' referrals.",
      "Community journeys record your team name, never an address.",
    ],
  },
  bed_manager: {
    homeName: "Capacity",
    summary: "You look after bed flow for one hospital site: your site in detail, other sites as bed counts only.",
    startsAt: "Capacity is your home. Your menu holds Wards, Movements, Waiting and Handover.",
    jobs: [
      {
        job: "Check beds",
        how: "Check each ward's figures and who confirmed them. If one is old, ask the coordinator to request an update.",
        go: "home",
      },
      {
        job: "Bed releases",
        how: "Flag, confirm or block a bed that is due to come free, from the ward page.",
        go: "wards",
      },
      {
        job: "Discharge blockers",
        how: "Record or clear what is holding up a discharge, on Discharges.",
        go: "discharges",
      },
      {
        job: "Close or reopen a ward",
        how: "Choose a reason, then close the ward to admissions. Reopen it when it can take patients.",
        go: "wards",
      },
      {
        job: "Bed meeting",
        how: "Use Open on TV on Capacity to show your site's beds. The coordinator runs the meeting agenda.",
        go: "home",
      },
    ],
    limits: [
      "Accepting, placing and discharging stay with the ward and the coordinator.",
      "Referrals is read only for you.",
      "Other sites show as counts, with no patient names.",
    ],
  },
  executive: {
    homeName: "Statistics",
    summary: "You see how the network or your health service is going, as numbers. You do not see patients.",
    startsAt: "Statistics is your home and your only working screen, apart from Settings.",
    jobs: [
      { job: "See the network", how: "The Network page shows beds, occupancy and waits in one place.", go: "home" },
      { job: "Compare", how: "Set two wards or departments side by side.", go: "home" },
      { job: "Look for pressure", how: "Check ED waits, blocked discharges and expected discharges.", go: "home" },
      { job: "Export", how: "Use CSV to save a table of figures.", go: "home" },
    ],
    limits: [
      'Small counts of people read "fewer than 5", so no one can be picked out.',
      "A figure nobody recorded says Not recorded. The app does not guess.",
      "You cannot record, change or approve anything.",
    ],
  },
  admin: {
    homeName: "Settings",
    summary: "You give staff access to the right desk and place. You never see patients.",
    startsAt: "Settings is your home, where access is managed.",
    jobs: [
      { job: "Answer a request", how: "Press Give for 90 days or Decline.", go: "home" },
      {
        job: "Give a role",
        how: "Choose the person, one desk and one place, then Give role. Every grant has an end date.",
        go: "home",
      },
      {
        job: "Cover",
        how: "Use Give cover only for someone who already holds a ward or ED role, and End cover when done.",
        go: "home",
      },
      { job: "Remove access", how: "Press Remove when a person changes job or leaves.", go: "home" },
    ],
    limits: [
      "You cannot open patient records, referrals or bed boards.",
      "You cannot record any clinical or bed flow action.",
    ],
  },
};

/** How to tell an action was saved: the same on every desk. */
export const SAVED_OR_NOT: readonly string[] = [
  "After an action, a short message says it was recorded.",
  "A message saying an action was not recorded means nothing changed. Read the reason and try again.",
  "If the app says the connection is unavailable, stay on the page and press Retry. Do not reload.",
];
