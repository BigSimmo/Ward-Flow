/**
 * IN-APP HELP CONTENT (fix plan item 12, 21 Oct 2026): what each screen is for and its main
 * actions, a glossary of the words and codes the screens use, and the keyboard shortcuts the app
 * registers. Each desk's tour has its own steps (`ward-tour-steps.ts`). A screen's "How do I" and
 * "Why can't I" answers sit with that screen's help, so they show where the task is done.
 *
 * Rail screens are keyed by rail entry id (`ward-rail-entries.ts`) and match their own address only,
 * so Home never stands in for a page without help. Detail and stand-alone pages match by their whole
 * address (`PAGE_HELP`). A screen with neither shows the sheet's "no help page yet" line.
 *
 * The words describe the current screens. Nothing here is clinical or legal advice: every screen is
 * a synthetic prototype, and the help says so once, at the top of the sheet.
 */
import { formTitleForCode } from "@/lib/form-register";
import { BED_FINDER_MENU_ID, ROLE_MENUS } from "@/components/ward-management/shell/ward-rail-entries";
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import { ROLE_SCREENS } from "@/components/ward-management/ward-role-access";
import { CONTINUATION_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import { CLINICAL_VALUES, formatClinicalFigure } from "@/components/ward-management/ward-clinical-values";
import { WARD_COMMAND_HREF } from "@/components/ward-management/ward-nav";
import { siteDirectory } from "@/components/ward-management/ward-sites";
import { UNDO_WINDOW_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import type { SiteIdentity } from "@/components/ward-management/ward-sites";

import type { WardTourRole } from "./ward-help-store";
import { MORE_PAGE_HELP } from "./ward-help-pages-more";

/** The Give button's own words, from the value it grants (D-122: help never types a threshold). */
const GIVE_FOR = `Give for ${formatClinicalFigure(CLINICAL_VALUES.accessGrantDefault.value, CLINICAL_VALUES.accessGrantDefault.unit)}`;

export type ScreenHelp = {
  /** The screen's name as the rail or the page heading shows it. */
  title: string;
  /** One sentence: what the screen is for. */
  purpose: string;
  /** Its main actions, at most three, each a short sentence. */
  actions: readonly string[];
  /** The same actions on a phone, where a keyboard line would mean nothing (HF-14). */
  phoneActions?: readonly string[];
  /** Questions people ask on this screen, each answered in a sentence or two. */
  questions?: readonly HelpQuestion[];
};

type HelpQuestion = { question: string; answer: string };

const WHY_NO_ANSWER: HelpQuestion = {
  question: "Why can't I answer this referral?",
  answer:
    "Only the ward itself accepts or declines its referrals. A site bed manager sees them but cannot answer, so ask the ward to answer from its own desk.",
};

/**
 * The meeting room TV hides the header, so Help cannot open there. Its help sits on the screens
 * that open it: Capacity, a ward and an ED (HF-10). Full names on every TV view (D-83, WT-20).
 */
const TV_QUESTION: HelpQuestion = {
  question: "How do I put this on the meeting room TV?",
  answer:
    "On a desktop, choose Open on TV on Capacity, or On TV on a ward or an ED. The TV is read only, shows full names as the desks do and updates on its own. Use Screen to pick another meeting, ward or ED and View to switch that screen's board, Full screen for the wall screen and Leave TV view to come back. On a TV that stays on the wall, Lock as TV keeps that browser on TV views, even after a reload, until someone presses Unlock.",
};

/** PL1 (3 Nov 2026): the suburb lookup moved from Community to the Catchments tab of Places. */
const CATCHMENT_QUESTION: HelpQuestion = {
  question: "How do I find which community team covers a suburb?",
  answer:
    "Open Places and choose Catchments on the band. Type the suburb or postcode in the lookup. It names the team that covers it.",
};

/** Statistics' small-count rule, said wherever figures about people show. */
const FEWER_THAN_FIVE: HelpQuestion = {
  question: 'Why does a figure say "fewer than 5"?',
  answer: 'Small counts of people read "fewer than 5", so no one can be picked out.',
};

/** Where every statistics figure comes from. */
const FIGURES_FROM: HelpQuestion = {
  question: "Where do these figures come from?",
  answer:
    "They are worked out from the synthetic records in this demo. A figure nobody recorded says Not recorded, and each figure's note says what it counts and what it leaves out.",
};

export const SCREEN_HELP: Readonly<Record<string, ScreenHelp>> = {
  command: {
    title: "Home",
    purpose: "What needs the coordinator now, across every ward, ED and movement.",
    actions: [
      "Work down Needs you first: act now, then referrals to decide. Each row opens the record it is about.",
      "Switch to Flow for every open movement. Its tabs narrow it to Needs a bed, Bed agreed, Ready to move or Moving.",
      "Open Alerts in the header for everything addressed to this desk.",
    ],
    phoneActions: [
      "Work down Needs you first: act now, then referrals to decide. Tap a row to open the record it is about.",
      "Switch to Flow for every open movement, or Later today for the rest of the shift.",
      "Alerts sits in the dock at the foot of the screen.",
    ],
    questions: [
      {
        question: "How do I place a patient from Home?",
        answer:
          "Choose the patient, alert or referral in the list and Placement opens with the checks for a bed. Nothing is chosen for you. Offer a bed once the checks you need are met.",
      },
      {
        question: "How do I see one ED's patients?",
        answer:
          "Choose that ED's tile under ED pressure. The list narrows to that ED. Choose the tile again to see every ED.",
      },
      {
        // Explain this number (Help overhaul, 9 Nov 2026): the three figures at the top of Home, in the
        // glossary's own words, with the bed alert line from its one source (clinical-values.md).
        question: "What do the figures at the top of Home mean?",
        answer: `Open movements counts movements that started at an ED and have not closed, including people in transit. It is not how many people are in an ED right now. Ready counts beds the wards have confirmed as Ready, across the whole network. The last figure, In use, is the share of beds in use statewide: it carries an amber dot at ${CLINICAL_VALUES.bedAlertLine.value}% or more (the bed alert line).`,
      },
      {
        question: "What is Later today?",
        answer:
          "The rest of the shift, from times the records already hold, against your default targets, such as people who reach the ED access target by tomorrow unless placed.",
      },
    ],
  },
  capacity: {
    title: "Capacity",
    purpose: "Each ward's confirmed beds, what is ready, pulled or closed, and when it was last confirmed.",
    actions: [
      "Ask for an update when a ward's figure is old.",
      "Open a ward to see its beds and who is coming in.",
      "Use the service selector in the header to look at one health service.",
    ],
    questions: [
      TV_QUESTION,
      {
        question: "What does Short mean on Mismatch?",
        answer:
          "More people waiting than beds that fit, for that kind of bed. Spare means more beds than people, and Enough means they match.",
      },
      {
        question: "Do drive times choose a ward for me?",
        answer:
          "No. The Mismatch drawer, and Nearest ready beds on a phone, show road distance from the emergency department you choose. Distance only, not suitability, and a person always chooses the bed.",
      },
      {
        question: "How do I reopen a closed ward?",
        answer:
          "Open the ward, press Closures, then Reopen to admissions and confirm. It is offered again straight away, and anything still pointed at it is listed to mark dealt with.",
      },
      {
        question: "How do I change or cancel a planned admission?",
        answer:
          "Open Planned moves and choose the booking. Change booking edits it; Cancel booking needs a reason and offers Undo.",
      },
    ],
  },
  movements: {
    title: "Movements",
    purpose: "Every patient moving to a bed, by stage, from referral to arrival.",
    actions: [
      "Open a movement to see its bed, transport and legal form in one place.",
      "Move it on a stage once that step is done, such as pulling a bed or booking transport.",
      "Rows marked Act now are due now or overdue.",
    ],
    questions: [
      {
        question: "Where is the timeline?",
        answer:
          "On a computer, the timeline shows above the list. It shows what is coming up for each receiving ward. Turn off Show timeline to hide it; this device remembers that.",
      },
      {
        question: "How do I pull a bed?",
        answer:
          "Once a ward accepts, the Bed box shows Pull the bed. Choose it and pick the bed. The bed is kept for the patient until the pull time limit.",
      },
      {
        question: "What does the urgent flag do?",
        answer:
          "A flagged patient leads the queue ahead of every tier until the flag is removed. It needs a reason, and only the coordinator and the ED can set it.",
      },
      {
        question: "How do I record what is holding a movement up?",
        answer:
          "On the movement's page, type it under What is holding this up and press Record it. Name wards, roles and jobs only, never patient details.",
      },
      {
        question: "I recorded the wrong stage. How do I fix it?",
        answer:
          "The coordinator opens Correct the recorded stage on the movement's page and chooses the earlier stage and a reason. The history shows both.",
      },
    ],
  },
  referrals: {
    title: "Referrals",
    purpose: "Referrals waiting for an answer, and those decided recently.",
    actions: [
      "Open a referral to see where it was sent and each destination's answer.",
      "Accept or decline it for your own ward or team, with a reason when declining.",
      "On a keyboard, J and K step through referrals. Press ? for the rest.",
    ],
    phoneActions: [
      "Open a referral to see where it was sent and each destination's answer.",
      "Accept or decline it for your own ward or team, with a reason when declining.",
      "Tap a referral to open it, and the back arrow to return to the list.",
    ],
    questions: [
      {
        question: "How do I ask more wards?",
        answer:
          "Open the referral and choose Ask more wards, then tick the wards. They are listed A to Z and never ranked, and only a ward that fits can be ticked. The card shows how many are waiting out of the network's limit, and a ward that declines frees its place.",
      },
      {
        question: "How do I chase a ward that has not answered?",
        answer:
          "Under Offered to wards, each referral waiting on a ward has Chase. It shows who was asked and how long they have had it.",
      },
      {
        question: "Why is a referral marked overdue?",
        answer:
          "It has waited past its decision target. The targets are operational defaults set in Settings, not legal limits.",
      },
    ],
  },
  "referral-intake": {
    title: "New referral",
    purpose: "Send a new referral to one or more wards, an ED or a community team.",
    actions: [
      "Choose the destinations. Several can be sent in one go.",
      "Record the legal status and the tentative diagnosis block, if known.",
      "Send it. Each destination answers on its own.",
    ],
    questions: [
      {
        question: "How do I use the suggested catchment?",
        answer:
          "Choose Use this catchment to accept the team, region and service area from the suburb, or Change to pick another.",
      },
      {
        question: "How do I keep or discard a referral I have not sent?",
        answer: "Close it and choose Keep draft and close or Discard. A kept draft reopens in this tab.",
      },
      {
        question: "How do I add a new patient while making a referral?",
        answer:
          "In the Patient step choose Add patient, fill in the four starred fields, then Add and use for this referral.",
      },
    ],
  },
  handover: {
    title: "Handover",
    purpose: "A point-in-time handover sheet for the next shift, ready to print.",
    actions: [
      "Read Act now first, then anything due before the next handover.",
      "Check the Before you sign list, then choose Sign off.",
      "Print handover and Present are under More.",
    ],
    questions: [
      {
        question: "How do I hand over to the next shift?",
        answer:
          "Read Act now first, then what is due before the next handover. Work through Before you sign, then choose Sign off. Use More to print the sheet or present it at the meeting.",
      },
      {
        question: "What are ward promises?",
        answer: "Times a ward said it would ring back. Chase the overdue ones first, and hand over any still open.",
      },
    ],
  },
  wards: {
    title: "All wards",
    purpose: "Every ward, grouped by health service, each opening its own ward screen.",
    actions: [
      "Open your ward to see its beds, arrivals and discharges.",
      "Search by ward, hospital or service. Filters holds status, age group and order.",
      "While a ward is open, Pin this ward in the menu keeps it under My wards.",
    ],
    questions: [
      {
        question: "What does Stale counts mean?",
        answer:
          "Wards whose bed figures have not been confirmed lately. Choose Stale counts to highlight them, then ask the ward to confirm.",
      },
      {
        question: "How do I read a ward's bed strip?",
        answer: "One cell a bed. On a computer, the key above the list says what each cell shows.",
      },
    ],
  },
  ed: {
    title: "All EDs",
    purpose: "Every emergency department, with the people there waiting for a mental health bed.",
    actions: [
      "Filter by health service or status, and choose the order.",
      "Use Past target to find EDs with someone past the access target.",
      "Open an ED to see its board and each patient's next step.",
    ],
    questions: [
      {
        question: "Is Past target a legal deadline?",
        answer:
          "No. The access target is an ED performance target set in Settings, counted from when the patient's wait began.",
      },
      {
        question: "How do I see who is waiting without leaving the list?",
        answer: "On a computer, choose an ED's card to preview who is waiting there. Enter opens its full board.",
      },
    ],
  },
  [BED_FINDER_MENU_ID]: {
    title: "Find a bed",
    purpose: "Lists which wards meet the checks you choose, A to Z by name, before you send a new referral.",
    actions: [
      "Choose the age group, bed type, sex and legal status, then read the wards that meet those checks and their ready beds. Wards are never ranked.",
    ],
    questions: [
      {
        question: "Does Find a bed choose the ward?",
        answer:
          "No. It lists the wards that meet the checks you chose, A to Z by name. A person always chooses where to refer.",
      },
    ],
  },
  officer: {
    title: "Transport",
    purpose: "The transport officer's jobs: who is moving, where and when.",
    actions: [
      "Open a job to see the pickup, the destination and the booking.",
      "Each job's button is its next stage, such as En route, Collected or Arrived at ward.",
      "Log booking records a booking already made by phone, with its CAD number.",
    ],
    phoneActions: [
      "Next action at the top is the job to do now. Tap a job for the pickup, destination and booking.",
      "Each job's button is its next stage, such as En route, Collected or Arrived at ward.",
      "Log booking records a booking already made by phone, with its CAD number.",
    ],
    questions: [
      {
        question: "What order are the jobs in?",
        answer: "Late or delayed jobs first, then forms to upload, then furthest along.",
      },
      {
        question: "Why can't I book transport?",
        answer:
          "Log booking stays greyed until a ward has accepted the patient, and the reason shows beside it. Book by phone first: logging it needs the CAD number from the call, the quoted ETA, the provider, the legal status and whether an escort is needed.",
      },
    ],
  },
  alerts: {
    title: "Alerts",
    purpose: "What is addressed to this desk right now, across every movement and referral.",
    actions: [
      "Act on the top alert first.",
      "Each alert opens the record it is about.",
      "Use the chips to show one kind, such as Act now, Forecast or Yours.",
    ],
    questions: [
      {
        question: "What order are alerts in?",
        answer: "Act now first, then waiting. Oldest first in each.",
      },
      {
        question: "Where do forecast alerts come from?",
        answer:
          "From the forecast lines set in Settings: beds likely to be short tomorrow, the ED access target and a forecast that got worse.",
      },
      {
        question: "Can I put an alert off until later?",
        answer:
          "Yes. Open it, then More actions and Snooze. Choose how long and why. It comes back on its own, or press Return now. Act now alerts can only be snoozed briefly.",
      },
      {
        question: "How do I extend or stand down a broadcast?",
        answer:
          "Coordinators and site bed managers use Extend 30m or Stand down on the banner, or under Broadcasts here. Add desks asks more desks.",
      },
    ],
  },
  community: {
    title: "Community",
    purpose: "Every community team now sits in Places, on its Catchments tab. Each team still has its own page.",
    actions: [
      "Open Places, then choose Catchments on the band to find a team.",
      "Open your team to see referrals waiting for an answer.",
      "Start a New referral from the team page.",
    ],
    questions: [CATCHMENT_QUESTION],
  },
  delays: {
    title: "Waiting",
    purpose: "Why each waiting patient is still waiting, grouped by cause.",
    actions: [
      "Use the saved views: Due soon or on you, Form due and For handover.",
      "Open a row to deal with what is holding it up.",
    ],
    questions: [
      {
        question: "Who is the wait on?",
        answer:
          "Each wait is split by who can move it on next: you, the ED, the wards, transport or someone else. Choose one to narrow the list.",
      },
      {
        question: "Does the order mean one patient matters more?",
        answer: "No. The list is longest wait first. Flags highlight a row but never move it.",
      },
    ],
  },
  statistics: {
    title: "Statistics",
    purpose: "Counts and waits for the network, a service or a ward, worked out from the records.",
    actions: [
      "Read each figure's note for what it counts and what it leaves out.",
      "Choose a view on the band: Network, Compare, Services, Wards, EDs, Teams or Weekly.",
      "On a computer, Export downloads the figures at the top of the page as a spreadsheet file.",
    ],
    phoneActions: [
      "Read each figure's note for what it counts and what it leaves out.",
      "Choose a view on the band: Network, Compare, Services, Wards, EDs, Teams or Weekly.",
      "More figures holds discharges held up, declines by reason and the rest.",
    ],
    questions: [FIGURES_FROM, FEWER_THAN_FIVE],
  },
  discharges: {
    title: "Discharges",
    purpose: "Planned discharges, held-up discharges first.",
    actions: [
      "Work through what is blocking each discharge.",
      "Open one to see where the patient is going and the bed release.",
      "On a computer, Print list makes a paper copy for the ward or the bed meeting.",
    ],
    questions: [
      {
        question: "What is the difference between confirmed and expected?",
        answer:
          "A confirmed discharge is one the ward has confirmed. An expected discharge has a date but is not confirmed yet.",
      },
      {
        question: "How do I clear a hold-up?",
        answer:
          "Open the discharge to see what is holding it up and the bed, then update the hold-up once it is sorted. The ward and the coordinator can record it.",
      },
      {
        question: "How do I track what a discharge still needs?",
        answer:
          "Open it and use Discharge arrangements: add each arrangement with who owns it, then mark it done or not needed. These never free the bed by themselves.",
      },
      {
        question: "How do I record that the patient has left?",
        answer: "Press Record discharge on the discharge. Undo shows straight after if it was a mistake.",
      },
    ],
  },
  search: {
    title: "Patients",
    purpose: "The register of everyone, found by record number, place, stage or owner.",
    actions: [
      "Use the switch on the band: Everyone, In ED, In placement, Inpatient, Community or Not active.",
      "Search by record number, place, stage or owner.",
      "To see who closed today, choose Today on the band. On a phone, use Closed today at the foot of the list.",
    ],
    questions: [
      {
        question: "Why can't I find a patient?",
        answer:
          "Each desk sees only the patients its role covers. Check the switch is on Everyone, then try the record number. If they are new, use Add patient.",
      },
      {
        question: "Is what I type kept?",
        answer: "No. The words you search are never stored, put in an address or logged.",
      },
    ],
  },
  hub: {
    title: "Places",
    purpose:
      "Every ward, ED and community team in the network. The band names the wards whose bed count needs a check.",
    actions: [
      "Use the search box above the list, or narrow the list to wards, EDs or teams.",
      "Choose a place to see who is heading or waiting there, then refer or open it. Pin the places you use most.",
      "Choose Catchments on the band to find which community team covers a suburb.",
    ],
    questions: [
      CATCHMENT_QUESTION,
      {
        question: "Why does a ward need a bed check?",
        answer:
          "Its bed count has not been confirmed lately, so the figure may be out of date. Ask the ward to confirm its numbers.",
      },
    ],
  },
  "legal-forms": {
    title: "Legal forms",
    purpose: "Every open movement with a legal form, and the expiry time a person typed from that form.",
    actions: [
      "Times are as typed from the paper form. Ward Flow does not work out legal periods, and the times are not legally checked.",
      "Switch between On a form, Checklist and History. Each row names its next step. Choose a patient to see their form.",
      "Use Record next form when a new form is written. Record and tell lists who to let know.",
    ],
    questions: [
      {
        question: "Does Ward Flow work out when a form expires?",
        answer:
          "No. A person types the time from the paper form, and Ward Flow keeps it as typed. It is never legally checked.",
      },
      {
        question: "How do I record a new form?",
        answer:
          "Choose the patient, then Record next form. Type the time from the paper form and record it. Record and tell lists who to let know.",
      },
      {
        question: "How do I mark a form received?",
        answer:
          "Choose the patient and press Mark Form received. Undo shows straight after. A receipt recorded wrongly is corrected from the ED board with a reason.",
      },
      {
        question: "Where do I record that the carer, PSP or MHAS were told?",
        answer: "In the Carer, PSP and MHAS panel. Record who was told and when. It is a reminder, not a legal check.",
      },
    ],
  },
  governance: {
    title: "Governance",
    purpose: "Recorded decisions to review, gaps by site and the audit trail for this session.",
    actions: [
      "Choose an event under Review, then Record review.",
      "Gaps by site lists missing requirements for each site.",
      "Audit trail lists what this session captured. Registers and Reports hold previews.",
    ],
    questions: [
      {
        question: "Why can't I record a review?",
        answer: "Only the bed coordinator records a review. Other desks that open Governance can read the events.",
      },
      {
        question: "What goes to review?",
        answer:
          "Recorded decisions such as overrides and refusals. Each one waits under Review until someone records a review.",
      },
    ],
  },
  seclusion: {
    title: "Seclusion",
    purpose: "An operational view of seclusion rooms, seclusion and restraint in use, and incidents, ward by ward.",
    actions: [
      "Choose the ward, then Mark available or Mark out of service for its seclusion room.",
      "Record start when one begins and Record end when it finishes. Times are as typed, and nothing works out a legal limit.",
      "Use Record incident for an incident on the ward.",
    ],
    questions: [
      {
        question: "Does Ward Flow tell me when seclusion must end?",
        answer: "No. Times are as typed, and nothing works out a legal limit.",
      },
      {
        question: "Where do finished episodes go?",
        answer: "Once Record end is pressed, the episode leaves In use now. Finished episodes are kept in Governance.",
      },
    ],
  },
  "out-of-area": {
    title: "Out of area",
    purpose: "Patients in a bed outside their home health service, with days away and any return plan.",
    actions: [
      "Choose a patient to open their return plan.",
      "Fill in the plan, then Record sent to ward or Record return.",
      "Copy the bed meeting summary or export the list from the header.",
    ],
    questions: [
      {
        question: "What counts as out of area?",
        answer: "A patient in a bed outside their home health service.",
      },
      {
        question: "Who records a return plan?",
        answer: "The bed coordinator. Other desks can read the plan and the days away.",
      },
    ],
  },
  "on-call": {
    title: "On-call",
    purpose: "Who answers each on-call line now, for hospitals, teams and state lines.",
    actions: [
      "Search by role, hospital, ward, team or number.",
      "Pick a service in the header, or use Show, to narrow the list.",
      "Star a line to keep it under Mine and at the top of the page.",
    ],
    questions: [
      {
        question: "Who do I call if no one answers?",
        answer: "Open the line. Its If no answer list names who to try next.",
      },
      {
        question: "How do I see who is on call later?",
        answer: "Use Cover at and choose the time. The lines show who answers then.",
      },
      {
        question: "Are these numbers real?",
        answer:
          "No. Every number is synthetic. Each list says when someone last checked it, and Mark checked now records a fresh check.",
      },
    ],
  },
};
/** One page the rail does not list, matched by its whole address. */
type PageHelp = ScreenHelp & {
  id: string;
  path: RegExp;
  /** The rail id whose role-menu name this page takes (a ward desk's My ward opens its ward). */
  menuId?: string;
};

/** Detail and stand-alone pages. Listed most specific first; the first match wins. */
const PAGE_HELP: readonly PageHelp[] = [
  ...MORE_PAGE_HELP,
  {
    id: "ward-answer",
    path: /^\/ward-flow\/ward\/[^/]+\/answer$/u,
    title: "Ward answer",
    purpose: "One bed request at a time, for this ward to accept or decline.",
    actions: [
      "Read the request and check each gate: Pass or Does not pass.",
      "Choose Accept in principle, or Decline with a reason.",
      "Use Previous and Next when more than one request is waiting.",
    ],
    questions: [
      WHY_NO_ANSWER,
      {
        question: "Do the gates decide for me?",
        answer:
          "No. Each gate reads Pass or Does not pass to inform your answer. The ward decides, and a decline needs a reason.",
      },
      {
        question: "Can a ward see where else a patient was referred?",
        answer: "You never see which other wards the patient was referred to.",
      },
    ],
  },
  {
    id: "ward",
    path: /^\/ward-flow\/ward\/[^/]+$/u,
    menuId: "wards",
    title: "Ward",
    purpose: "One ward's beds, who is coming and going, and the decisions due this shift.",
    actions: [
      "Ward home lists what needs you, with referrals awaiting your answer.",
      "Bed board places patients in beds. Decisions holds what is due this shift.",
      "Confirm numbers when the bed figures change. Notices, Shift brief and Handover are in the toolbar.",
    ],
    questions: [
      WHY_NO_ANSWER,
      TV_QUESTION,
      {
        question: "How often should I confirm numbers?",
        answer:
          "After any bed change, and by the morning bed numbers time set in Settings. Confirm numbers tells the network your count is current.",
      },
      {
        question: "How do I record leave or a trip to an ED?",
        answer:
          "Open the patient and use Record a change: Start leave or Gone to ED. The bed stays with them. Record return when they are back.",
      },
      {
        question: "How do I ask the referrer for more information?",
        answer: "On Referrals, tick what you need under Need before we can decide and press Ask the referrer.",
      },
    ],
  },
  {
    id: "board",
    path: /^\/ward-flow\/board\/[^/]+$/u,
    title: "Bed board",
    purpose: "Every bed on one ward, who is in it, who is coming in and who is going out today and tomorrow.",
    actions: [
      "Choose a bed to see its patient. Move the date, Record hold-up or Record that they have left.",
      "Before handover lists what needs you before the next handover, such as a discharge still here.",
      "Show shift brief opens the ward's sheet for the shift.",
    ],
    questions: [
      {
        question: "How do I record that a patient has left?",
        answer:
          "Choose their bed, choose where they are going, then Record that they have left. A trip to an ED is Gone to an ED instead, which keeps the bed.",
      },
      {
        question: "What does Past date mean on a bed?",
        answer: "The patient is still on the ward after their expected discharge date.",
      },
    ],
  },
  {
    id: "add-patient",
    path: /^\/ward-flow\/people\/new$/u,
    title: "Add patient",
    purpose: "Adds a new invented patient record. Only the core details are needed.",
    actions: [
      "Fill in family name, given name, date of birth and UMRN. Everything else is optional.",
      "Read the Duplicate check first, so one person does not get two records.",
      "Choose Add patient to open the new record, or Add and start referral to go straight to a referral.",
    ],
    questions: [
      {
        question: "Why is Add patient greyed out?",
        answer: "It waits on the four core details: family name, given name, date of birth and UMRN.",
      },
      {
        question: "What does the duplicate check look at?",
        answer:
          "Every patient record, as you type a UMRN or a name of four letters or more. Open the existing record instead if it is the same person.",
      },
    ],
  },
  {
    id: "patient",
    path: /^\/ward-flow\/(?:people|movements)\/[^/]+$/u,
    title: "Patient",
    purpose: "One patient's record: where they are now, their movement and the next step.",
    actions: [
      "Now shows the status card: the bed, fit to travel and transport, each with its next step.",
      "Open Destination to ask wards, pull the bed or make a correction.",
      "History, Community, Details and Documents hold the rest of the record.",
    ],
    questions: [
      {
        question: "How do I ask more wards?",
        answer:
          "In the Bed box choose Ask wards, or Ask more wards once some have been asked, then choose the wards. Wards are never ranked, and a ward that declines frees its place.",
      },
      {
        question: "How do I pull a bed?",
        answer:
          "Once a ward accepts, the Bed box shows Pull the bed. Choose it and pick the bed. The bed is kept for the patient until the pull time limit.",
      },
      {
        question: "How do I change a destination?",
        answer:
          "Open Destination on Now to ask other wards or move a pulled bed. If the plan has changed completely, Withdraw referral closes the movement and frees any pulled bed.",
      },
      {
        question: "Why can't I book transport?",
        answer:
          "Log booking stays greyed until a ward has accepted the patient, and the reason shows beside it. Book by phone first: logging it needs the CAD number from the call, the quoted ETA, the provider, the legal status and whether an escort is needed.",
      },
    ],
  },
  {
    id: "ed-board",
    path: /^\/ward-flow\/ed\/[^/]+$/u,
    menuId: "ed",
    title: "ED board",
    purpose: "One emergency department's mental health patients, each row with its next step.",
    actions: [
      "Work down My list first. Act-now items carry the Act now mark.",
      "Each row's button is its next step, such as Record exam, Refer to a ward or Handover ready. A referral waiting in the inbox has Ask for a bed.",
      "New referral starts a new one. Tap a figure in the header to highlight those patients.",
    ],
    questions: [
      TV_QUESTION,
      {
        question: "Does Ward Flow work out when a form expires?",
        answer:
          "No. A person types the time from the paper form, and Ward Flow keeps it as typed. It is never legally checked.",
      },
      {
        question: "What if a cleared patient becomes medically unwell?",
        answer:
          "Open the person and press Record medical deterioration, then confirm. It releases the bed, cancels transport not yet collected and pauses placement.",
      },
      {
        question: "How do I record that no transport is needed?",
        answer: "Open the row's actions and press Record no transport needed.",
      },
    ],
  },
  {
    id: "catchments",
    path: /^\/ward-flow\/hub\/catchments$/u,
    title: "Catchments",
    purpose: "Which community team covers a suburb, every community team from A to Z, and team names that read alike.",
    actions: [
      "Type a suburb or postcode in the lookup to find the team that covers it.",
      "Use the A to Z to open a team's own page with its referrals.",
      "Read alike sets team names that look similar side by side. Choose Places on the band to go back.",
    ],
    questions: [
      CATCHMENT_QUESTION,
      {
        question: "Why do some teams read alike?",
        answer:
          "Some team names are written more than one way. Read alike sets them side by side so you open the right one.",
      },
    ],
  },
  {
    id: "community-team",
    path: /^\/ward-flow\/community\/[^/]+$/u,
    menuId: "community",
    title: "Community team",
    purpose: "One community team's referrals and patients, from a referral sent to their return to the team.",
    actions: [
      "Sent and Waiting answer show this team's referrals and where each one is up to.",
      "In a bed, Expected back and Caseload and CTOs follow the team's patients.",
      "New referral in the header starts a referral. How to reach this team stays beside every list.",
    ],
    questions: [
      {
        question: "How do I open another team?",
        answer: "Choose Switch team at the top of the page, or find the team on Places, Catchments.",
      },
      {
        question: "Are the team's phone and address real?",
        answer: "No. They are invented for the demo, as is every patient on the page.",
      },
    ],
  },
  {
    id: "settings",
    path: /^\/ward-flow\/settings$/u,
    title: "Settings",
    purpose: "The network's rules and this device's own choices, in tabs.",
    actions: [
      "Change a rule under Rules, then Save. Rule changes wait for Save.",
      "Display holds the theme, row density and Single-key shortcuts. They save at once on this device.",
      "Press / to find a setting.",
    ],
    phoneActions: [
      "Change a rule under Rules, then Save. Rule changes wait for Save.",
      "On this phone holds the theme and row density. They save at once.",
      "Use Find a setting at the top, or open an area under All settings.",
    ],
    questions: [
      {
        question: "Why can't I change the rules?",
        answer: "Only the bed coordinator for the whole network changes the rules, and every save is recorded.",
      },
      {
        question: "Where is the tour?",
        answer: "Help holds the tour, the keyboard shortcuts and Show me. Open Help to replay the tour.",
      },
    ],
  },
  {
    id: "night",
    path: /^\/ward-flow\/night$/u,
    title: "Night view",
    purpose:
      "The coordinator's overnight page: beds ready, ED waits by Step, who is on the way, intake windows and on-call lines.",
    actions: [
      "Read the figures across the top. They are the same as Home, Waiting and Movements.",
      "Open a ward, a patient or a line from its card. Each card links to its full page.",
      "Open Help and choose Show me around for a short first-night walk round.",
    ],
    questions: [
      {
        question: "Why are the wards in this order?",
        answer: "Wards are listed by health service, then by name. They are never ranked by beds ready.",
      },
      {
        question: "Why do the intake windows say Not recorded?",
        answer: "Wards do not record overnight intake windows in Ward Flow yet, so no time is shown.",
      },
    ],
  },
  {
    id: "downtime",
    path: /^\/ward-flow\/reports\/downtime$/u,
    title: "Downtime pack",
    purpose:
      "A printable copy of the last snapshot, for when the system is down: beds by ward, the ED queue, pending moves and legal forms.",
    actions: [
      "The coordinator takes a New snapshot. The pack does not update by itself.",
      "Print or save PDF to keep a paper copy.",
    ],
    questions: [
      {
        question: "Why can't I take a new snapshot?",
        answer: "Only the bed coordinator takes a new snapshot. Every desk sees when the last one was taken.",
      },
      {
        question: "What if Ward Flow is down?",
        answer:
          "Tell the bed coordinator on shift. They decide when everyone switches to paper and pass the problem to the Ward Flow team.",
      },
    ],
  },
  {
    id: "bed-meeting-agenda",
    path: /^\/ward-flow\/bed-meeting\/agenda$/u,
    title: "Bed meeting agenda",
    purpose: "The bed meeting's agenda, built from fixed rules, and the actions agreed at earlier meetings.",
    actions: [
      "Work through each section: longest ED waits, pulled beds, stranded stays and out of area.",
      "Use Action against a person, with an owner and a due time, then Record action.",
      "Use Mark done on an earlier action once it is.",
    ],
    questions: [
      {
        question: "Who decides what is on the agenda?",
        answer:
          "Fixed rules build it from the records, such as the longest ED waits and pulled beds with least time left. Nobody is ranked.",
      },
      {
        question: "Why can't I add an action?",
        answer: "Only the bed coordinator, who chairs the meeting, records an action. Other desks read the agenda.",
      },
    ],
  },
  {
    id: "chronology",
    path: /^\/ward-flow\/reports\/chronology$/u,
    title: "Patient chronology",
    purpose: "One patient's events in time order, for a post-incident review, ready to print or download.",
    actions: [
      "Find a patient by name or UMRN, or choose one from Patients on the board.",
      "Narrow the events by source: Records, Audit or Session.",
      "Print, or Download CSV for a spreadsheet copy.",
    ],
    phoneActions: [
      "Find a patient by name or UMRN, or choose one from Patients on the board.",
      "Tap an event for its detail. Filters narrows the events by source.",
      "Print sits under Filters on a phone.",
    ],
    questions: [
      {
        question: "What does a chronology hold?",
        answer:
          "Referrals, movements and admissions as saved, the coordinator's audit trail where your desk may see it, and this browser session's log. Times are as recorded or typed. Nothing is calculated.",
      },
      {
        question: "Is this a clinical record?",
        answer: "No. It is built from synthetic demo data, for practising a post-incident review.",
      },
    ],
  },
  {
    id: "statistics-compare",
    path: /^\/ward-flow\/statistics\/compare$/u,
    title: "Compare",
    purpose: "Every ward and every ED side by side, as a chart or a table, with up to three wards pinned.",
    actions: [
      "Choose what to compare, such as Occupancy or Stay, and switch between Chart and Data.",
      "CSV downloads the figures you are looking at.",
      "Pin up to three wards to set them beside the network.",
    ],
    questions: [FIGURES_FROM, FEWER_THAN_FIVE],
  },
  {
    id: "statistics-services",
    path: /^\/ward-flow\/statistics\/services$/u,
    title: "Health services",
    purpose: "Each health service's beds, where referrals were accepted and its open ED movements.",
    actions: [
      "Open a service for its own figures.",
      "Compare opens the ward and ED comparisons.",
      "Read each figure's note for what it counts and what it leaves out.",
    ],
    questions: [FIGURES_FROM, FEWER_THAN_FIVE],
  },
  {
    id: "statistics-wards",
    path: /^\/ward-flow\/statistics\/wards$/u,
    title: "All wards",
    purpose: "Every ward's beds in use, stay so far and discharges held up.",
    actions: [
      "Group the table by service, or show one list.",
      "Open a ward for its own figures, or Compare wards to set them side by side.",
      "Read each figure's note for what it counts and what it leaves out.",
    ],
    questions: [
      FIGURES_FROM,
      {
        question: "What does in use mean?",
        answer: "Beds occupied or pulled, as a share of the ward's beds.",
      },
    ],
  },
  {
    id: "statistics-eds",
    path: /^\/ward-flow\/statistics\/eds$/u,
    title: "All emergency departments",
    purpose: "Every emergency department's open movements and how long each has been open.",
    actions: [
      "Read the chart: one dot per open movement, by hours since it opened.",
      "Sort the table by any column, or open an ED for its own figures.",
      "Compare EDs sets them side by side.",
    ],
    questions: [
      FIGURES_FROM,
      {
        question: "Does an open movement mean the patient is still in the ED?",
        answer: "Not always. Open ED movements include people in transit, and the note under the chart says how many.",
      },
    ],
  },
  {
    id: "statistics-teams",
    path: /^\/ward-flow\/statistics\/teams$/u,
    title: "Community teams",
    purpose: "Each community team's patients in a bed, and those with a discharge date.",
    actions: [
      "Read Teams by service for each service's team patients in a bed.",
      "The table lists only teams with someone in a bed. Show all lists every team.",
      "Open a team for its own figures.",
    ],
    questions: [FIGURES_FROM, FEWER_THAN_FIVE],
  },
  {
    id: "statistics-weekly",
    path: /^\/ward-flow\/statistics\/weekly$/u,
    title: "Weekly operations",
    purpose: "One week's operations: the pilot measures, where the time goes and the pressure that week.",
    actions: [
      "Choose the week: this week so far, the last full week or one of the seven before it.",
      "Read the pilot measures first, then where the time goes.",
      "Print makes a paper copy of the week.",
    ],
    questions: [
      FIGURES_FROM,
      {
        question: "Why does a measure show a dash?",
        answer: "Nothing finished that week to measure, so there is no typical time to show.",
      },
    ],
  },
  {
    id: "statistics-place",
    path: /^\/ward-flow\/statistics\/(?:service|ward|ed|community)\/[^/]+$/u,
    title: "Statistics",
    purpose: "The figures for one health service, ward, ED or community team, worked out from the records.",
    actions: [
      "Read each figure's note for what it counts and what it leaves out.",
      "A ward, ED or team desk sees its own figures only, as counts.",
    ],
    questions: [FIGURES_FROM, FEWER_THAN_FIVE],
  },
];

/**
 * Settings as the access admin sees it: it opens on Access, the desk's only job (HF-02). The other
 * desks read the Settings help above.
 */
export const ADMIN_SETTINGS_HELP: ScreenHelp & { id: string } = {
  id: "settings",
  title: "Settings",
  purpose: "Where you give, check and remove roles. It opens on Access. You see no patients from this desk.",
  actions: [
    `Answer Requests for access with ${GIVE_FOR} or Decline.`,
    "Use Give a role for a new role: the person, one desk, one place and an end date.",
    "Check Everyone with a role, and Remove a role when someone changes job or leaves.",
  ],
};

/** Rail screens whose own pages sit under their address, so they share its help. */
const OWNS_SUB_PAGES: ReadonlySet<string> = new Set(["statistics"]);

/** Desk menu entries that open the desk's own place, not the list page that shares their id. */
const OWN_PLACE_MENUS: ReadonlySet<string> = new Set(["wards", "ed", "community"]);

type ShownHelp = ScreenHelp & { id: string };

/**
 * The help for the screen at `pathname`. A page pattern wins; then the rail entry at that exact
 * address (Home also at its `/command` alias). When the desk's own menu renames the page, the title
 * is that menu's name, so Help and the menu agree.
 */
export function screenHelpFor(
  pathname: string,
  entries: readonly { id: string; href: string }[],
  role?: WardChromeRole,
): ShownHelp | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/u, "") : pathname;
  let help: ShownHelp | undefined;
  let menuId: string | undefined;
  const page = PAGE_HELP.find((candidate) => candidate.path.test(path));
  if (page) {
    help = {
      id: page.id,
      title: page.title,
      purpose: page.purpose,
      actions: page.actions,
      phoneActions: page.phoneActions,
      questions: page.questions,
    };
    menuId = page.menuId;
  } else {
    const entry = entries.find(
      (candidate) =>
        candidate.id in SCREEN_HELP &&
        (path === candidate.href ||
          (candidate.id === "command" && path === WARD_COMMAND_HREF) ||
          (OWNS_SUB_PAGES.has(candidate.id) && path.startsWith(`${candidate.href}/`))),
    );
    if (!entry) return undefined;
    help = { id: entry.id, ...SCREEN_HELP[entry.id] };
    menuId = OWN_PLACE_MENUS.has(entry.id) ? undefined : entry.id;
  }
  const renamed = role ? ROLE_MENUS[role].find(([id]) => id === menuId)?.[1] : undefined;
  return renamed ? { ...help, title: renamed } : help;
}

export type GlossaryTerm = { term: string; meaning: string };

/** Ward Flow's own words. Codes for sites and services are added below from their one source. */
const WARD_FLOW_TERMS: readonly GlossaryTerm[] = [
  { term: "Act now", meaning: "Something due now or overdue. Lists that have it keep it in its own Act now group." },
  { term: "Movement", meaning: "One patient's move to a bed, from the request to arrival." },
  { term: "Referred", meaning: "A destination has been asked for, and nothing has answered yet." },
  { term: "Review", meaning: "At least one unit is weighing up whether it can take the patient." },
  { term: "Accepted", meaning: "A unit has agreed in principle, but no bed has been pulled yet." },
  {
    term: "Pulled",
    meaning: "A bed kept for a named patient who has not arrived yet. The pull has a time limit.",
  },
  { term: "Pull expired", meaning: "The time limit on a pulled bed has passed. Move or release the bed." },
  { term: "Handover ready", meaning: "The bed and paperwork are ready. Only the physical move is left." },
  { term: "Moving", meaning: "The patient has been collected and the move is under way." },
  { term: "Arrived", meaning: "The patient has arrived, and this leg of the movement is complete." },
  { term: "Held bed", meaning: "A bed kept for a patient on leave or away from the ward, ready for their return." },
  {
    term: "Pull time limit",
    meaning:
      "How long a pulled bed is kept for the patient. When it passes, the bed shows Pull expired and a person moves or releases it.",
  },
  {
    term: "Being made ready",
    meaning:
      "A released bed still being prepared. It is not counted as Ready, but a patient can still be pulled into it.",
  },
  { term: "Ready", meaning: "A bed the ward has confirmed is clean and staffed for an admission." },
  { term: "Held up", meaning: "A discharge or move that is delayed. It is not a bed state." },
  {
    term: "Short",
    meaning:
      "More people waiting than beds that fit, for one kind of bed. Spare means more beds than people, and Enough means they match.",
  },
  { term: "Confirmed beds", meaning: "The bed figures a ward last confirmed, with the time it did so." },

  { term: "Past date", meaning: "The patient is still on the ward after their expected discharge date." },
  {
    term: "Confirmed out",
    meaning: "A discharge the ward has confirmed. An expected discharge is not confirmed yet.",
  },
  {
    term: "CLD",
    meaning:
      "Criteria led discharge. The ward records the criteria the treating psychiatrist set and ticks each one met.",
  },
  {
    term: "CLD ready",
    meaning: "Every criterion for criteria led discharge is met. CLD review means the criteria have lapsed.",
  },
  {
    term: "Tier",
    meaning:
      "The urgency recorded on the referral, from T1 (most urgent) to T3. Lists stay in wait order; the tier only marks a row.",
  },
  { term: "T1", meaning: "Urgency tier 1, most urgent. The tier is recorded on the referral." },
  { term: "T2", meaning: "Urgency tier 2, urgent." },
  { term: "T3", meaning: "Urgency tier 3, least urgent." },
  { term: "Overdue waits", meaning: "Patients who have waited longer than the target for their urgency tier." },
  {
    term: "Access target",
    meaning:
      "An ED performance target set in Settings, counted from when the patient's wait began. It is not a legal deadline.",
  },
  { term: "Fit to travel", meaning: "The ED doctor's recorded medical clearance. It is needed before transport." },
  {
    // The full road-distance caveat (ward-reference-distances.ts). The shortlist shows a short line
    // and links here (Josh, 3 Nov 2026). A test keeps the two in step.
    term: "Road distance",
    meaning:
      "Indicative road distance measured on public map data. Not live traffic, and not a clinical travel time. Ward lists are never sorted by it.",
  },

  {
    term: "Catchment",
    meaning: "The area a community mental health team covers. Ward Flow finds it from the patient's suburb.",
  },
  {
    term: "Cohort",
    meaning:
      "The age group a bed is for: Adult, Older adult or Youth. Capacity splits adult beds into locked and open.",
  },
  {
    term: "Locked bed",
    meaning:
      "A bed the ward designates locked. Each ward splits its beds into locked and open. This describes the bed, not the patient's legal status.",
  },

  {
    term: "Board time",
    meaning:
      "The demo's own clock, which every screen works from. It starts at the sample day's time and runs on from there, so it is not the real time. It opens the demo controls.",
  },
  {
    term: "Constant observation",
    meaning: "An observation level that keeps staff with the patient, shown as 1:1 or 2:1. A person records it.",
  },
  {
    term: "Shift brief",
    meaning: "The ward's sheet for the shift: who came in, who is going, who is stuck and who is overdue.",
  },
  {
    term: "Notices",
    meaning: "A ward's own messages: buzzes from the coordinator, urgent tasks and notices, under the bell.",
  },
  { term: "Activity", meaning: "The header drawer of recent changes and notices. Shift+A opens it." },
  { term: "Synthetic", meaning: "Invented. Every patient, bed figure and record in Ward Flow is made up." },
  { term: "Demo", meaning: "The Demo panel: scenario, clock and reset for the invented data. Board time opens it." },
  {
    term: "Tentative diagnosis",
    meaning: "A broad ICD-10-AM Chapter V block chosen from a fixed list. It is never a confirmed diagnosis.",
  },
  { term: "Legal form", meaning: "The legal form a person recorded for a movement, with its due time as recorded." },

  { term: "Out of area", meaning: "A patient in a bed outside their home health service." },
  { term: "AWOL", meaning: "Absent without leave: a patient who has left the ward without approved leave." },
  {
    term: "CTO",
    meaning: "Community treatment order. The community team's CTO register lists the people on one.",
  },
  { term: "ETA", meaning: "Estimated time of arrival, as quoted by the transport provider or the ward." },
  { term: "MDT", meaning: "Multidisciplinary team, such as the catchment MDT a community team holds." },
  { term: "MHA", meaning: "The Mental Health Act, the WA law the legal forms are named from." },
  { term: "ATS", meaning: "Australasian Triage Scale category, as recorded at ED triage." },
  { term: "RAMP", meaning: "Risk Assessment and Management Plan, the WA mental health form." },
  { term: "PSP", meaning: "Personal support person: a carer, close family member, nominated person or guardian." },
  { term: "MHAS", meaning: "Mental Health Advocacy Service." },
  { term: "GP", meaning: "General practitioner." },
  { term: "BPSD", meaning: "Behavioural and psychological symptoms of dementia." },
  { term: "ED", meaning: "Emergency department." },
  { term: "EDD", meaning: "Expected date of discharge." },
  { term: "UMRN", meaning: "Unit medical record number. Ward Flow uses invented ones only." },
  { term: "CAD number", meaning: "The St John WA booking number for an ambulance transfer." },
  { term: "ECT", meaning: "Electroconvulsive therapy." },
  { term: "NIC", meaning: "Nurse in charge." },
  { term: "NUM", meaning: "Nurse unit manager." },
  { term: "CAHS", meaning: "Child and Adolescent Health Service." },
  { term: "EMHS", meaning: "East Metropolitan Health Service." },
  { term: "NMHS", meaning: "North Metropolitan Health Service." },
  { term: "SMHS", meaning: "South Metropolitan Health Service." },
  { term: "WACHS", meaning: "WA Country Health Service." },
  {
    term: "AWST",
    meaning:
      "Australian Western Standard Time, Perth time. Signed-in times are AWST; the demo's board clock says demo time.",
  },
  { term: "CAMHS", meaning: "Child and Adolescent Mental Health Service." },
  { term: "HDU", meaning: "High dependency unit: a ward area for patients who need closer care." },
  { term: "KPI", meaning: "Key performance indicator, such as the national seven-day follow-up measure." },
  { term: "MHERL", meaning: "Mental Health Emergency Response Line, the WA crisis phone line." },
  { term: "PIR", meaning: "Post-incident review. The PIR chronology lists one patient's events in time order." },
  {
    term: "QR code",
    meaning: "A square barcode a phone camera can read to open a link, such as a desk's Ward Flow link.",
  },

  // Chronology (5 Nov 2026): the words on the patient chronology and its sources.
  {
    term: "Chronology",
    meaning: "One patient's events in time order, built from the records for a post-incident review.",
  },
  {
    term: "Audit trail",
    meaning: "Coordinator changes and overrides, with their reasons. Only some desks see it.",
  },
  { term: "Session log", meaning: "What this browser session recorded, for this session only." },
  { term: "CSV", meaning: "A plain spreadsheet file. Download CSV saves the figures or events you are looking at." },

  // Statistics (5 Nov 2026): the words the figures and their notes use.
  { term: "In use", meaning: "Beds occupied or pulled, as a share of a ward's beds." },
  {
    term: "Occupancy",
    meaning: "The share of beds in use. At risk shows once it passes the line set for the screen.",
  },
  {
    term: "Typical",
    meaning: "The middle value, the median: half took less time and half took more.",
  },
  {
    term: "Slowest 1 in 10",
    meaning: "The time the slowest tenth took longer than. It shows how long the long waits run.",
  },
  {
    term: "Stay so far",
    meaning: "How long people in a bed now have been there. It is not a finished length of stay.",
  },
  {
    term: "Open ED movement",
    meaning: "A movement that started at an ED and has not closed. It includes people in transit.",
  },
  {
    term: "Fewer than 5",
    meaning: "Shown in place of a small count of people, so no one can be picked out.",
  },
  { term: "Not recorded", meaning: "Nobody recorded this figure. Ward Flow does not guess it." },
  {
    term: "Pilot measures",
    meaning: "The weekly report's own measures, such as referral to arrival and bed figures on time.",
  },

  // Other screens (5 Nov 2026).
  {
    term: "Stranded",
    meaning:
      "A prompt, not a judgement: someone in a bed a long time with no expected discharge date, or waiting on something outside the ward.",
  },
  {
    term: "Step-down",
    meaning: "A patient the ward has marked as a candidate for subacute care. A person marks it.",
  },
  {
    term: "Stale count",
    meaning: "A ward's bed figures not confirmed lately, so they may be out of date. Ask the ward to confirm.",
  },
  {
    term: "Mismatch",
    meaning: "People waiting against beds that fit, for each kind of bed, on Capacity.",
  },
  {
    term: "Downtime pack",
    meaning: "A printable copy of the last snapshot, for when the system is down. It does not update by itself.",
  },
  {
    term: "Snapshot",
    meaning: "A copy of the figures at one time. Only the bed coordinator takes a new one.",
  },
  {
    term: "Read alike",
    meaning: "Community team names that look similar, set side by side so you open the right one.",
  },
  {
    term: "Caseload",
    meaning: "The people a community team is looking after.",
  },
  {
    term: "Ward promise",
    meaning: "A time a ward said it would ring back. Handover lists the ones to chase.",
  },
  {
    term: "Accept in principle",
    meaning: "A ward agrees it can take the patient. A bed is pulled as a separate step.",
  },
  {
    term: "Gate",
    meaning: "One of a ward's own checks for a patient, marked Pass or Does not pass. It informs the answer.",
  },
  {
    term: "Bed meeting",
    meaning: "The regular meeting on beds. Its agenda is built from fixed rules and its actions have an owner.",
  },
  { term: "Surge", meaning: "A Settings choice that tightens some rules at once for a busy period." },
  // F-96 (pack F3, D-176 item 6): two software limits the app runs on, as `clinical-values.md` lists them.
  {
    term: "Undo window",
    meaning: `How long a recorded decision or bed move can still be undone: ${UNDO_WINDOW_MINUTES} minutes. A software limit, not a clinical one.`,
  },
  {
    term: "Wards asked at once",
    meaning: "A coordinator normally asks up to three wards at once. A fourth needs a recorded reason.",
  },
  {
    term: "Cover",
    meaning: "One ward or one ED handed to another desk for a time. It lasts for a set time and ends by itself.",
  },

  // Abbreviations the screens show that had no entry (audit M102, Josh, 10 Nov 2026).
  { term: "ATSI", meaning: "Aboriginal and Torres Strait Islander." },
  { term: "CMHT", meaning: "Community mental health team." },
  { term: "CNS", meaning: "Clinical nurse specialist." },
  { term: "DOB", meaning: "Date of birth." },
  { term: "ECG", meaning: "Electrocardiogram, a recording of the heart's rhythm." },
  { term: "EMR", meaning: "Electronic medical record." },
  { term: "FDV", meaning: "Family and domestic violence. The FDV951 is WA Health's screening form." },
  { term: "HMDC", meaning: "Hospital Morbidity Data Collection, WA Health's record of hospital stays." },
  {
    term: "ISBAR",
    meaning: "Identify, Situation, Background, Assessment, Recommendation: the order a clinical handover follows.",
  },
  { term: "MBBS", meaning: "Bachelor of Medicine, Bachelor of Surgery, a medical degree." },
  { term: "MHN", meaning: "Mental health nurse." },
  {
    term: "NICE",
    meaning: "National Institute for Health and Care Excellence, the UK body that writes clinical guidelines.",
  },
  { term: "PAS", meaning: "Patient administration system, the hospital's admissions and bed record." },
  { term: "PSOLIS", meaning: "Psychiatric Services Online Information System, WA's mental health record." },
  { term: "RN", meaning: "Registered nurse." },
  // D1 (Josh, 13 Nov 2026): the prefix only; the letters are not expanded.
  { term: "SMHMR", meaning: "The form-number prefix for WA's statewide standardised mental health documents." },
  // E1 (Josh, 13 Nov 2026): the Act is always named in full, never as an abbreviation.
  {
    term: "Criminal Law (Mental Impairment) Act 2023",
    meaning: "A WA Act, in operation from 1 September 2024. Always written in full.",
  },
  { term: "SW", meaning: "Social worker." },
  // F-91 (K24, Josh 13 Nov 2026): short forms the screens show in sample text, spelled out.
  { term: "AHD", meaning: "Advance health directive." },
  { term: "BD", meaning: "Twice a day, on a medicine line." },
  { term: "CK", meaning: "Creatine kinase, a blood test." },
  { term: "CR", meaning: "Controlled release, on a medicine line." },
  { term: "IM", meaning: "Intramuscular, given as an injection into a muscle." },
  { term: "MRO", meaning: "Multi-resistant organism." },
  { term: "MSE", meaning: "Mental state examination." },
  { term: "OT", meaning: "Occupational therapist." },
  { term: "RACF", meaning: "Residential aged care facility." },
  { term: "RAT", meaning: "Rapid antigen test." },
  { term: "SAT", meaning: "State Administrative Tribunal, WA's tribunal for guardianship and administration." },
];

/**
 * The legal forms people can record, named from the Chief Psychiatrist's register, so the glossary
 * cannot drift from the titles the screens show (HF-08).
 */
const FORM_TERMS: readonly GlossaryTerm[] = CONTINUATION_LEGAL_FORMS.flatMap(({ code }) => {
  const title = formTitleForCode(code);
  return title === null
    ? []
    : [{ term: `Form ${code}`, meaning: `${title}. Any time shown is as typed from the paper form.` }];
});

/** Initial glossary retained for existing imports. The help sheet reads the active directory below. */
export const GLOSSARY: readonly GlossaryTerm[] = [
  ...WARD_FLOW_TERMS,
  ...FORM_TERMS,
  ...siteDirectory.map((site) => ({ term: site.code, meaning: site.name })),
].toSorted((left, right) => left.term.localeCompare(right.term, "en-AU"));

const glossaries = new WeakMap<readonly SiteIdentity[], readonly GlossaryTerm[]>([[siteDirectory, GLOSSARY]]);

/** Stable terms for one scenario's identity directory; pass sites explicitly in React consumers. */
export function glossaryForSites(sites: readonly SiteIdentity[]): readonly GlossaryTerm[] {
  const existing = glossaries.get(sites);
  if (existing) return existing;
  const terms = [
    ...WARD_FLOW_TERMS,
    ...FORM_TERMS,
    ...sites.map((site) => ({ term: site.code, meaning: site.name })),
  ].toSorted((left, right) => left.term.localeCompare(right.term, "en-AU"));
  glossaries.set(sites, terms);
  return terms;
}

/** Terms whose word or meaning contains `query`, ignoring case. An empty query matches all. */
export function filterGlossary(
  query: string,
  terms: readonly GlossaryTerm[] = glossaryForSites(siteDirectory),
): readonly GlossaryTerm[] {
  const needle = query.trim().toLocaleLowerCase("en-AU");
  if (!needle) return terms;
  return terms.filter(
    (entry) =>
      entry.term.toLocaleLowerCase("en-AU").includes(needle) ||
      entry.meaning.toLocaleLowerCase("en-AU").includes(needle),
  );
}

/**
 * The shortcuts the shell registers on a keyboard (`search-shortcut.ts`, `ward-rail-preferences.ts`,
 * `ward-rail.tsx`, and `wf/toast-keyboard.ts` for notices), with the names the screens use. Every one
 * but Ctrl+K, Alt+N and Esc is a single-key shortcut, which Settings can turn off. `short` and `group`
 * are the shortcuts sheet's few words and heading, where a row has them.
 */
/** The columns the shortcuts sheet sorts the keys into (redesign, #1118). */
export const SHORTCUT_GROUPS = ["Find", "Open", "Move around"] as const;

export const KEYBOARD_SHORTCUTS: readonly {
  keys: string;
  action: string;
  /** The few words the shortcuts sheet shows (round 2, #1118); `action` stays the spoken sentence. */
  short: string;
  group: (typeof SHORTCUT_GROUPS)[number];
}[] = [
  {
    keys: "/",
    action: "Search, from the box in the header. On Settings it finds a setting.",
    short: "Search",
    group: "Find",
  },
  {
    keys: "Ctrl+K",
    action: "Search, even with single-key shortcuts off. Cmd+K on a Mac.",
    short: "Search, even with shortcuts off (⌘K on a Mac)",
    group: "Find",
  },
  { keys: "Shift+T", action: "Open Alerts.", short: "Open Alerts", group: "Open" },
  { keys: "Shift+A", action: "Open Activity.", short: "Open Activity", group: "Open" },
  { keys: "Shift+R", action: "Start a new referral.", short: "New referral", group: "Open" },
  {
    keys: "[",
    action: "Fold the side menu to icons, or open it again.",
    short: "Fold or open the side menu",
    group: "Move around",
  },
  {
    keys: "Alt+N",
    action: "Jump to the newest notice's button, and back. Option+N on a Mac.",
    short: "Jump to the newest notice, and back",
    group: "Move around",
  },
  {
    keys: "G",
    action:
      "Go to a page: press G, then H Home, E ED, W Waiting, B Wards, D Discharges, R Referrals, C Capacity, S Statistics. Pages your desk cannot open are skipped.",
    // The short line names no page: type-ahead must not offer it for a page this desk cannot open.
    short: "Go to a main page: G, then that page's letter",
    group: "Move around",
  },
  { keys: "Esc", action: "Close what is open, or step back.", short: "Close, or step back", group: "Move around" },
  {
    keys: "?",
    action: "Show these shortcuts. On Handover and Referrals, list that page's own keys.",
    short: "Show shortcuts",
    group: "Open",
  },
];

/**
 * The keys this login can use (audit finding 11, Josh 31 Oct 2026). Shift+T and Shift+A open Alerts
 * and Activity, which only the desks with an Alerts screen have: the executive's and access admin's
 * header says both are unavailable. Shift+R starts a referral, which only a desk that may raise one
 * can send (`EVENT_ROLE`). Every other key works on every desk.
 */
export function shortcutsForDesk(role: WardTourRole): typeof KEYBOARD_SHORTCUTS {
  const alerts = ROLE_SCREENS[role].alerts !== undefined;
  const refers = (EVENT_ROLE.RAISE_REFERRAL as readonly string[]).includes(role);
  return KEYBOARD_SHORTCUTS.filter((item) =>
    item.keys === "Shift+R" ? refers : item.keys === "Shift+T" || item.keys === "Shift+A" ? alerts : true,
  );
}
