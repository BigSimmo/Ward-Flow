/**
 * HELP HOW-TOS FROM THE FEATURE CRAWL (Josh, 8 Nov 2026: "deeply understand and crawl the site ...
 * create further guides and add further questions to the Help"). Each job here is one a desk can
 * record on a screen that Help did not yet explain: broadcast alerts, the coordinator's alert queue,
 * notices, bed meeting actions, bookings, closures, discharge readiness, and the patient, referral
 * and movement tools. Listed in `HOW_TOS` after the older jobs, so a question that matches an older
 * job equally well still finds that one first.
 *
 * Each answer is written from the screen's own source, in the button names the screen draws. Show me
 * targets use test ids, ids and accessible text, never class names (`tests/ward-help-howto.test.ts`
 * fails when a test id leaves the source). Nothing here ranks, places, suggests a ward or works out a
 * legal time; a person presses every button.
 */
import type { HowTo } from "./ward-help-howto";
import type { TourTarget } from "./ward-tour-steps";

const CLINICAL_DESKS = ["coordinator", "ward", "ed", "community", "bed_manager", "officer"] as const;

const button = (text: string): TourTarget => ({ sel: "button", text });
const ALERTS_DRAWER: TourTarget = { sel: '[data-testid="ward-bar-tasks-trigger"]' };
const CAPACITY_WARD: TourTarget = { sel: '[data-testid^="capacity-map-ward-"]' };
const MOVEMENT_ROW: TourTarget[] = [
  { sel: '#main-content a[href^="/ward-flow/movements/"]' },
  { sel: '[data-testid^="movements-group-toggle-"]' },
];
const WORKFLOW_CONTROLS: TourTarget = { sel: "summary, button", text: "Additional workflow controls" };

export const CRAWL_JOBS: readonly HowTo[] = [
  /* Broadcast alerts */
  {
    id: "broadcast-acknowledge",
    topic: "Finding your way",
    title: "Acknowledge a broadcast alert",
    keywords: "broadcast banner directive acknowledge seen read top of screen alert message",
    answer:
      "A live broadcast shows as a banner at the top of every screen. For a directive, press Acknowledge and it reads Acknowledged for your desk. A bed call is answered instead, with your desk's answer on the call.",
    desks: [...CLINICAL_DESKS],
    acts: ["ACKNOWLEDGE_BROADCAST_ALERT"],
    showMe: [
      {
        target: { sel: '[data-testid="ward-broadcast-banner"]' },
        title: "The banner",
        body: "Shows while a broadcast is live. It stays on every screen until it ends or is stood down.",
      },
      {
        target: button("Acknowledge"),
        title: "Acknowledge",
        body: "Records that your desk has seen the directive.",
      },
    ],
  },
  {
    id: "broadcast-extend-stand-down",
    topic: "Finding your way",
    title: "Extend or stand down a broadcast alert",
    keywords: "broadcast extend longer stand down end stop cancel alert bed call 30 minutes",
    answer:
      "On the banner, or Alerts then Broadcasts, press Extend 30m for half an hour more. Press Stand down to end it; it asks you to confirm first.",
    desks: ["coordinator", "bed_manager"],
    acts: ["EXTEND_BROADCAST_ALERT", "STAND_DOWN_BROADCAST_ALERT"],
    go: "alerts",
    showMe: [
      {
        target: { sel: '[data-testid="ward-broadcast-extend"]' },
        title: "Extend 30m",
        body: "Keeps the alert live for 30 more minutes.",
      },
      {
        target: { sel: '[data-testid="ward-broadcast-stand-down"]' },
        title: "Stand down",
        body: "Ends the alert for everyone it went to, after you confirm.",
      },
    ],
  },
  {
    id: "broadcast-add-desks",
    topic: "Finding your way",
    title: "Add desks to a broadcast alert",
    keywords: "broadcast add desks more wards widen ask more units bed call",
    answer:
      "Open Alerts, choose Broadcasts, then press Add desks on the live alert. Tick the desks to add and press Add. The button is greyed when every desk is already asked.",
    desks: ["coordinator", "bed_manager"],
    acts: ["ADD_BROADCAST_ALERT_UNITS"],
    go: "alerts",
    showMe: [
      {
        target: { sel: "button, a, [role='tab']", text: "Broadcasts" },
        title: "Broadcasts",
        body: "The live broadcasts, with who has answered.",
      },
      {
        target: button("Add desks"),
        title: "Add desks",
        body: "Tick the desks to ask as well. Those already asked are not listed again.",
      },
    ],
  },

  /* The coordinator's alert queue */
  {
    id: "alert-take-hand-back",
    topic: "Finding your way",
    title: "Take an alert as mine, or hand it back",
    keywords: "own alert take mine claim assign hand back release queue someone else",
    answer:
      "Open the alert from Alerts, or the Alerts bell at the top, and press Take; it then reads Yours. To give it back, press Hand back and confirm. The alert returns to the queue and Undo shows for a short while.",
    desks: ["coordinator"],
    acts: ["TAKE_INBOX_ITEM_OWNERSHIP", "RELEASE_INBOX_ITEM_OWNERSHIP"],
    go: "alerts",
    showMe: [
      {
        target: ALERTS_DRAWER,
        title: "The Alerts bell",
        body: "Opens your alerts in a drawer without leaving the page.",
      },
      { target: button("Take"), title: "Take", body: "Marks the alert as yours, so others know it is being handled." },
      {
        target: button("Hand back"),
        title: "Hand back",
        body: "Shows on an alert you own. Asks before it returns it.",
      },
    ],
  },
  {
    id: "alert-snooze",
    topic: "Finding your way",
    title: "Snooze or acknowledge an alert",
    keywords: "snooze later remind defer acknowledge seen watch return now waiting callback",
    answer:
      "Open the alert, then More actions. Snooze asks how long and why. Acknowledge marks it Seen and leaves it on watch. Return now brings a snoozed alert back. Act now alerts can only be snoozed for a short time.",
    desks: ["coordinator"],
    acts: ["SNOOZE_INBOX_ITEM", "UNSNOOZE_INBOX_ITEM", "ACKNOWLEDGE_INBOX_ITEM"],
    go: "alerts",
    showMe: [
      {
        target: { sel: '[data-testid="alerts-more-actions"]' },
        title: "More actions",
        body: "Snooze, Acknowledge and Return now sit here on an open alert.",
      },
      {
        target: button("Snooze"),
        title: "Snooze",
        body: "Choose a time, then a reason. The alert comes back on its own.",
      },
    ],
  },
  {
    id: "alert-mark-done",
    topic: "Finding your way",
    title: "Mark an alert done, or reopen it",
    keywords: "alert done complete finished tick close reopen undone",
    answer:
      "Open the Alerts bell at the top and press Mark done on the alert's row. The row then says who did it. Press Reopen on a done row to put it back on the queue.",
    desks: ["coordinator"],
    acts: ["COMPLETE_INBOX_ITEM", "REOPEN_INBOX_ITEM"],
    showMe: [
      { target: ALERTS_DRAWER, title: "The Alerts bell", body: "Your alerts, in a drawer over the page you are on." },
      {
        target: { sel: '[data-testid^="ward-task-complete-"]' },
        title: "Mark done",
        body: "Closes the alert and records who did it.",
      },
      { target: { sel: '[data-testid^="ward-task-reopen-"]' }, title: "Reopen", body: "Shows on a done row." },
    ],
  },
  {
    id: "notice-read",
    topic: "Finding your way",
    title: "Mark a notice as read",
    keywords: "notice activity read unread message update news bell",
    answer:
      "Press Activity at the top of the screen and open the notice. Press Mark as read; it then reads Read. Opening the drawer alone marks nothing.",
    desks: [...CLINICAL_DESKS],
    acts: ["MARK_NOTICE_READ"],
    showMe: [
      {
        target: { sel: '[data-testid="ward-bar-activity-trigger"]' },
        title: "Activity",
        body: "Notices and recent activity for your desk.",
      },
      { target: button("Mark as read"), title: "Mark as read", body: "The only way a notice is marked read." },
    ],
  },
  {
    id: "on-call-checked",
    topic: "Finding your way",
    title: "Record that an on-call number was checked",
    keywords: "on call directory checked verified number phone correct stale date",
    answer:
      "Open On-call and choose the entry. Once you have checked the number is right, press Mark checked now. The entry then shows when it was last checked, so others know how fresh it is.",
    desks: [...CLINICAL_DESKS],
    acts: ["RECORD_DIRECTORY_CHECK"],
    go: "on-call",
    showMe: [
      {
        target: { sel: '[data-testid="ward-on-call-mark-checked"]' },
        title: "Mark checked now",
        body: "Records the check with today's time.",
      },
    ],
  },

  /* Bed meeting and handover */
  {
    id: "meeting-action-done",
    topic: "Handover and reports",
    title: "Mark a bed meeting action done",
    keywords: "bed meeting action agreed task done complete follow up agenda",
    answer:
      "Open the patient. The Agreed at the bed meeting card lists each action: press Mark done. The coordinator can also press Done on the Actions card of the Meeting agenda. Undo shows in the message straight after.",
    desks: ["coordinator", "ward", "ed", "community"],
    acts: ["COMPLETE_BED_MEETING_ACTION", "UNDO_BED_MEETING_ACTION"],
    showMe: [
      {
        target: [
          { sel: '[data-testid="meeting-action-mark-done"]' },
          { sel: '[data-testid="bed-meeting-action-done"]' },
        ],
        title: "Mark done",
        body: "Records the action as done, with your desk and the time.",
      },
    ],
  },
  {
    id: "handover-ready",
    topic: "Transport",
    title: "Mark a patient's handover ready",
    keywords: "handover ready transport officer accept job sending team ready to go",
    answer:
      "On the ED board, press Handover ready as the row's next step, or Mark handover ready in its menu. A sending community team uses Mark handover ready on the patient's transit panel. The transport officer can then accept the job.",
    desks: ["ed", "community", "coordinator"],
    acts: ["HANDOVER_READY"],
    go: ["ed", "home"],
    showMe: [
      {
        target: [{ sel: '[data-testid^="ward-ed-handover-"]' }, button("Handover ready")],
        title: "Handover ready",
        body: "Tells the transport officer the patient is ready to be handed over.",
      },
    ],
  },
  {
    id: "undo-handover-sign-off",
    topic: "Handover and reports",
    title: "Undo a handover sign-off",
    keywords: "undo sign off handover take back mistake signed wrong",
    answer:
      "On Handover, open the sign-off panel and press Undo sign-off. A site bed manager presses Undo sign-off on the Site handover card. A coordinator who signed as cover cannot undo a site sign-off.",
    desks: ["coordinator", "ward", "bed_manager"],
    acts: ["UNDO_HANDOVER_SIGN_OFF", "UNDO_SITE_HANDOVER_SIGN_OFF"],
    go: "handover",
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-handover-sign-off-undo"]' },
          { sel: '[data-testid="ward-handover-site-undo"]' },
        ],
        title: "Undo sign-off",
        body: "Takes the sign-off back. Sign again when ready.",
      },
    ],
  },

  /* Ward, capacity and bookings */
  {
    id: "morning-numbers",
    topic: "Beds and referrals",
    title: "Confirm the morning bed numbers",
    keywords: "morning numbers rollup daily figures due time overdue confirm beds discharges planned",
    answer:
      "On the ward's home, press Confirm bed numbers when the banner says they are due, or Confirm on the Home card. It records the morning figures and how many discharges are planned today. The due time is set in Settings.",
    desks: ["ward", "bed_manager", "coordinator"],
    acts: ["CONFIRM_MORNING_ROLLUP"],
    go: ["wards", "home"],
    showMe: [
      {
        target: { sel: '[data-testid="ward-confirm-morning-rollup-btn"]' },
        title: "Confirm bed numbers",
        body: "Shows when the morning figures are due or overdue.",
      },
    ],
  },
  {
    id: "change-planned-admission",
    topic: "Beds and referrals",
    title: "Change or cancel a planned admission",
    keywords: "planned admission booking change date move cancel elective booked",
    answer:
      "On Capacity, open Planned moves and choose the booking. Press Change booking, edit it and Save. Or press Cancel booking, choose a reason and confirm; Undo shows straight after. A ward does the same from its own bookings.",
    desks: ["coordinator", "bed_manager", "ward"],
    acts: ["CHANGE_PLANNED_ADMISSION", "CANCEL_PLANNED_ADMISSION"],
    go: ["capacity", "home"],
    showMe: [
      {
        target: { sel: '[data-testid^="ward-planned-"]' },
        title: "The booking",
        body: "Opens its details in a drawer.",
      },
      { target: button("Change booking"), title: "Change booking", body: "Edit the date, ward or details, then Save." },
      {
        target: button("Cancel booking"),
        title: "Cancel booking",
        body: "Needs a reason. Keep as is leaves it booked.",
      },
    ],
  },
  {
    id: "reopen-ward",
    topic: "Beds and referrals",
    title: "Reopen a closed ward to admissions",
    keywords: "reopen ward closed admissions open again closure lifted",
    answer:
      "On Capacity, open the ward and press Closures. Press Reopen to admissions and confirm. The ward is offered for new patients again straight away. Anything still pointed at it is listed so you can mark each one dealt with.",
    desks: ["coordinator", "bed_manager", "ward"],
    acts: ["REOPEN_WARD_TO_ADMISSIONS", "MARK_CLOSURE_TRANSITION_ITEM"],
    go: "capacity",
    showMe: [
      { target: CAPACITY_WARD, title: "Open the ward", body: "Its panel opens beside the map." },
      { target: button("Closures"), title: "Closures", body: "The last button at the foot of the panel." },
      {
        target: { sel: '[data-testid="ward-closure-reopen"]' },
        title: "Reopen",
        body: "Asks first. Keep as is leaves the ward closed.",
      },
      {
        target: { sel: '[data-testid="ward-closure-transition"]' },
        title: "Still pointed at this ward",
        body: "Referrals, bookings or moves to reassign or cancel on their own record, then Mark dealt with.",
      },
    ],
  },
  {
    id: "ask-ward-confirm-beds",
    topic: "Beds and referrals",
    title: "Ask a ward to confirm its bed numbers",
    keywords: "ask ward confirm beds stale old figures refresh update numbers chase",
    answer:
      "On Capacity, open the ward and press Ask the ward. On Places, press Ask to confirm. The ward is asked to confirm its beds, and the status reads Asked with the time.",
    desks: ["coordinator"],
    acts: ["REQUEST_CAPACITY_REFRESH"],
    go: "capacity",
    showMe: [
      { target: CAPACITY_WARD, title: "Open the ward", body: "Its panel shows when the numbers were last confirmed." },
      {
        target: [button("Ask the ward"), button("Ask to confirm")],
        title: "Ask the ward",
        body: "Sends the ward a request.",
      },
    ],
  },

  /* Discharges */
  {
    id: "confirm-discharge-ready",
    topic: "Beds and referrals",
    title: "Confirm a discharge is ready and send support notices",
    keywords: "discharge ready confirm today release bed support notice services send",
    answer:
      "On the ward's discharges list, press Confirm ready on the expected discharge. A Discharge support notices card then opens: press Send notice for each service that needs to know.",
    desks: ["ward", "bed_manager", "coordinator"],
    acts: ["CONFIRM_BED_RELEASE", "SEND_RELEASE_SUPPORT_NOTICE"],
    go: ["wards", "home"],
    showMe: [
      {
        target: { sel: '[data-testid^="ward-today-release-confirm-"]' },
        title: "Confirm ready",
        body: "Confirms the discharge for today.",
      },
      {
        target: { sel: '[data-testid="ward-discharge-notices"]' },
        title: "Discharge support notices",
        body: "Send notice for each service. Each then reads Notice sent.",
      },
    ],
  },
  {
    id: "record-hold-up",
    topic: "Beds and referrals",
    title: "Record what is holding up a discharge",
    keywords: "hold-up held-up blocker delay discharge waiting barrier reason",
    answer:
      "Open the bed on the ward and press Record hold-up. Choose what it is held up by and press Save hold-up. On the bed board the same question opens as a dialog. Press Clear hold-up once it is sorted; the stage does not change.",
    desks: ["ward", "bed_manager", "coordinator"],
    acts: ["BLOCK_BED_RELEASE", "CLEAR_BED_RELEASE_BLOCK"],
    go: ["wards", "home"],
    showMe: [
      { target: button("Record hold-up"), title: "Record hold-up", body: "Opens the list of reasons." },
      {
        target: [{ sel: '[data-testid="ward-blocker-save"]' }, { sel: '[data-testid="ward-board-blocker-dialog"]' }],
        title: "Save hold-up",
        body: "The hold-up shows on Discharges and in handover until cleared.",
      },
    ],
  },
  {
    id: "bed-ready",
    topic: "Beds and referrals",
    title: "Mark a cleaned bed ready",
    keywords: "bed ready cleaned prepared turnaround available again offer",
    answer:
      "Open the bed on the ward. While it is being prepared, press Ready once it can take a patient. It is offered again straight away.",
    desks: ["ward", "bed_manager", "coordinator"],
    acts: ["SET_BED_PREPARATION"],
    go: ["wards", "home"],
    showMe: [
      {
        target: { sel: "[role='dialog'] button", text: "Ready" },
        title: "Ready",
        body: "Shows on a bed being prepared.",
      },
    ],
  },

  /* Movements and the bed search */
  {
    id: "pull-now",
    topic: "Beds and referrals",
    title: "Ask a ward to pull a patient now",
    keywords: "pull now urgent ask ward pull answer by chase",
    answer:
      "Open the movement and press Pull now. The ward is asked to pull the patient, and the button then shows the time it should answer by. The ward still decides.",
    desks: ["coordinator"],
    acts: ["RAISE_PULL_NOW"],
    go: "movements",
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Its panel opens beside the list." },
      { target: button("Pull now"), title: "Pull now", body: "Sends the ward the request." },
    ],
  },
  {
    id: "ward-capacity-review",
    topic: "Beds and referrals",
    title: "Ask a ward to review its bed numbers from a movement",
    keywords: "buzz ward review check beds numbers nudge",
    answer:
      "Open the movement, then Additional workflow controls. Press Request ward capacity review. The ward is asked to review and confirm its capacity.",
    desks: ["coordinator", "bed_manager"],
    acts: ["SEND_WARD_BUZZ"],
    go: "movements",
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "The movement's page has its tools." },
      { target: WORKFLOW_CONTROLS, title: "Additional workflow controls", body: "Opens the less used tools." },
      { target: button("Request ward capacity review"), title: "Request review", body: "Sends the ward the request." },
    ],
  },
  {
    id: "expectation-flag",
    topic: "Beds and referrals",
    title: "Raise or clear an expectation review flag",
    keywords: "expectation review flag voluntary involuntary raise clear",
    answer:
      "Open the movement, then Additional workflow controls. Press Raise expectation review flag to mark the movement for an expectation review; the review period depends on legal status. The same button clears it.",
    desks: ["coordinator", "ward", "ed", "community"],
    acts: ["RAISE_EXPECT_FLAG", "CLEAR_EXPECT_FLAG"],
    go: ["movements", "home"],
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Choose it in the list. Its page holds these tools." },
      { target: WORKFLOW_CONTROLS, title: "Additional workflow controls", body: "On the movement's page." },
      {
        target: [button("Raise expectation review flag"), button("Clear expectation review flag")],
        title: "The flag",
        body: "One button raises the flag or clears it.",
      },
    ],
  },
  {
    id: "record-escalation",
    topic: "Beds and referrals",
    title: "Record an escalation when no bed is found",
    keywords: "escalate escalation no bed found exhausted search contact next manager",
    answer:
      "In the placement panel from Home, press Record escalation. Name the role or service being contacted next and press Record escalation. Escalate also shows on an exhausted bed search alert.",
    desks: ["coordinator"],
    acts: ["RECORD_ESCALATION"],
    go: "home",
    showMe: [
      {
        target: { sel: '[data-testid="ward-shortlist-escalation-toggle"]' },
        title: "Record escalation",
        body: "Opens a short form. Update escalation records a further escalation; earlier ones stay in the history.",
      },
      {
        target: { sel: '[data-testid="ward-shortlist-escalation-submit"]' },
        title: "Save it",
        body: "The escalation shows on the movement and in handover.",
      },
    ],
  },
  {
    id: "withdraw-ward-request",
    topic: "Beds and referrals",
    title: "Withdraw a request to one ward",
    keywords: "withdraw request one ward take back cancel ask others stay",
    answer:
      "In the placement panel, press Withdraw on that ward's request, choose a reason and confirm. Only that request ends; the movement and the other wards' requests stay. Undo shows straight after.",
    desks: ["coordinator"],
    acts: ["WITHDRAW_WARD_REQUEST"],
    go: "home",
    showMe: [
      {
        target: { sel: '[data-testid^="ward-shortlist-withdraw-toggle-"]' },
        title: "Withdraw",
        body: "On each ward's request.",
      },
      {
        target: { sel: '[data-testid^="ward-shortlist-withdraw-submit-"]' },
        title: "Confirm",
        body: "Needs a reason first.",
      },
    ],
  },
  {
    id: "archive-patient",
    topic: "Finding your way",
    title: "Remove a patient record added in error",
    keywords: "archive delete remove wrong patient duplicate added in error mistake",
    answer:
      "Open the patient and find the Record added in error card. Choose a reason, press Archive this record and confirm. The record leaves every list and only the audit trail shows it. Undo shows straight after.",
    desks: ["coordinator"],
    acts: ["ARCHIVE_PATIENT"],
    showMe: [
      {
        target: { sel: '[data-testid="ward-patient-archive-start"]' },
        title: "Archive this record",
        body: "For a record added in error only. It asks before it archives.",
      },
    ],
  },

  /* Referrals: conditions, information and corrections */
  {
    id: "acceptance-conditions",
    topic: "Beds and referrals",
    title: "Record a condition on a ward's acceptance",
    keywords: "acceptance condition accepted with conditions bed offered from agreed with mark met",
    answer:
      "Open the movement. Under the acceptance, press Add a condition, choose when the bed is offered from and who agreed it, then Record condition. Press Mark met once it is done; the row then shows when and by which desk.",
    desks: ["coordinator", "ward"],
    acts: ["RECORD_ACCEPTANCE_CONDITION", "MARK_ACCEPTANCE_CONDITION_MET"],
    go: ["movements", "home"],
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Choose it in the list. Its page holds these tools." },
      {
        target: { sel: '[data-testid="acceptance-condition-add"]' },
        title: "Add a condition",
        body: "For a condition the ward attached when it accepted.",
      },
      {
        target: { sel: '[data-testid^="acceptance-condition-met-"]' },
        title: "Mark met",
        body: "Ticks the condition off with the time and desk.",
      },
    ],
  },
  {
    id: "ask-referrer-information",
    topic: "Beds and referrals",
    title: "Ask the referrer for more information",
    keywords: "need more information before decide ask referrer missing details request info",
    answer:
      "On the ward's Referrals, tick what you need under Need before we can decide, then press Ask the referrer. The sending desk sees the list and presses Provided against each item as it comes in.",
    desks: ["ward", "coordinator"],
    acts: ["REQUEST_REFERRAL_INFORMATION"],
    go: ["wards", "home"],
    showMe: [
      {
        target: { sel: '[data-testid^="ward-referral-needs-ask-"]' },
        title: "Ask the referrer",
        body: "Sends the ticked items to the desk that referred.",
      },
    ],
  },
  {
    id: "provide-referral-information",
    topic: "Beds and referrals",
    title: "Answer a ward's request for more information",
    keywords: "ward needs information requested provided supply missing details referral",
    answer:
      "Open your referral. Information requested lists what the ward still needs. Once you have sent each item, press Provided beside it. Only the desk that sent the referral can do this.",
    desks: ["ed", "community", "ward", "coordinator"],
    acts: ["MARK_REFERRAL_INFORMATION_MET"],
    go: ["referrals", "ed", "community", "home"],
    showMe: [
      {
        target: { sel: '[data-testid="ward-referral-needs-panel"]' },
        title: "Information requested",
        body: "What the ward asked for before it can decide.",
      },
      { target: button("Provided"), title: "Provided", body: "Marks one item as sent." },
    ],
  },
  {
    id: "referral-correction",
    topic: "Beds and referrals",
    title: "Correct or add to a referral already sent",
    keywords: "correct referral mistake wrong update addendum amend edit sent history note",
    answer:
      "Open the referral and go to Written history. Type the correction and press Add a correction. Notes are added, never edited or removed, so the history shows both. Only the sending desk can add one.",
    desks: ["community", "ed", "ward", "coordinator"],
    acts: ["ADD_REFERRAL_CORRECTION"],
    go: ["referrals", "ed", "community", "home"],
    showMe: [
      {
        target: { sel: '[data-testid="ward-referral-add-correction"]' },
        title: "Add a correction",
        body: "Adds a dated note to the referral's history.",
      },
    ],
  },
  {
    id: "referrer-withdrawal",
    topic: "Beds and referrals",
    title: "Record that the referrer cancelled a referral",
    keywords: "referrer cancelled withdraw referral no longer needed cancel",
    answer:
      "On Referrals, open the referral and choose Record referrer cancellation, then Withdraw referral and Confirm withdrawal. Every destination still waiting is marked withdrawn; answers already given stand.",
    desks: ["coordinator", "community", "ward"],
    acts: ["RECORD_REFERRER_WITHDRAWAL"],
    go: ["referrals", "community", "home"],
    showMe: [
      {
        target: { sel: '[data-testid="ward-referral-match-withdraw"]' },
        title: "Withdraw referral",
        body: "Asks you to confirm before it withdraws.",
      },
    ],
  },
  {
    id: "change-urgency-legal-status",
    topic: "Beds and referrals",
    title: "Change a patient's urgency or legal status",
    keywords: "urgency tier change legal status voluntary involuntary update reason retier",
    answer:
      "Press Change urgency or Change legal status: in the placement panel, an ED row's actions, a ward bed or a community team's Sent tab. Choose the new tier or status, give a reason and record it. The history shows the old and new.",
    desks: ["coordinator", "ed", "ward", "community"],
    acts: ["CHANGE_URGENCY", "CHANGE_LEGAL_STATUS"],
    go: ["home", "ed"],
    showMe: [
      {
        target: [
          { sel: '[data-testid^="ward-change-urgency-toggle"]' },
          { sel: '[data-testid="sent-journey-urgency-toggle"]' },
        ],
        title: "Change urgency",
        body: "Choose the tier and a reason.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-change-legal-status-toggle"]' },
          { sel: '[data-testid="sent-journey-legal-status-toggle"]' },
        ],
        title: "Change legal status",
        body: "Record what the paperwork says. The app works out no legal time.",
      },
    ],
  },

  /* The movement's tools */
  {
    id: "urgent-flag",
    topic: "Beds and referrals",
    title: "Flag a patient as urgent, or remove the flag",
    keywords: "urgent flag ahead of tier 1 lead the queue priority remove flag",
    answer:
      "Open the movement, choose a reason and press Flag this patient as urgent. It then leads the queue ahead of every tier. Remove the urgent flag puts it back in order by tier, then wait.",
    desks: ["coordinator", "ed"],
    acts: ["FLAG_MOVEMENT_URGENT", "CLEAR_MOVEMENT_URGENT_FLAG"],
    go: "movements",
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "The flag is in its drawer and on its page." },
      {
        target: [
          { sel: '[data-testid="ward-movement-drawer-urgent-toggle"]' },
          { sel: '[data-testid="ward-console-urgent-flag-toggle"]' },
        ],
        title: "Urgent flag",
        body: "Needs a reason. The same control removes it.",
      },
    ],
  },
  {
    id: "movement-hold-up",
    topic: "Beds and referrals",
    title: "Record what is holding up a movement",
    keywords: "movement held up delay blocker waiting clean room record it clear",
    answer:
      "On the movement's page, type what is holding it up under What is holding this up and press Record it. Name wards, roles and jobs only, never patient details. Press Clear when nothing is holding it up.",
    desks: ["ed", "community", "ward", "coordinator", "officer"],
    acts: ["RECORD_MOVEMENT_BLOCKER", "CLEAR_MOVEMENT_BLOCKER"],
    go: ["movements", "home"],
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Choose it in the list. Its page holds these tools." },
      {
        target: { sel: '[data-testid="ward-console-blocker-input"]' },
        title: "What is holding this up",
        body: "A short note, such as Awaiting single-room clean.",
      },
      {
        target: { sel: '[data-testid="ward-console-blocker-clear"]' },
        title: "Clear",
        body: "Records that the delay is over.",
      },
    ],
  },
  {
    id: "withdraw-acceptance",
    topic: "Beds and referrals",
    title: "Withdraw a ward's acceptance",
    keywords: "withdraw acceptance no longer stands back to destination review undo accept",
    answer:
      "On the movement's page, open Withdraw the ward's acceptance, choose a reason and press Withdraw acceptance. The ward is told it no longer stands, a pulled bed is released and the movement goes back to Destination review.",
    desks: ["coordinator"],
    acts: ["WITHDRAW_ACCEPTANCE"],
    go: "movements",
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "The page holds the less common steps." },
      {
        target: { sel: '[data-testid="ward-console-withdraw-acceptance"]' },
        title: "Withdraw acceptance",
        body: "Needs a reason. Cancel transport first if it is booked.",
      },
    ],
  },
  {
    id: "step-back-stage",
    topic: "Beds and referrals",
    title: "Correct a stage recorded by mistake",
    keywords: "wrong stage step back correct record mistake earlier stage",
    answer:
      "On the movement's page, open Correct the recorded stage. Choose the stage to go back to and a reason, then press Correct the record. It corrects the record only; nobody moves.",
    desks: ["coordinator"],
    acts: ["STEP_BACK_STAGE"],
    go: "movements",
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Choose it in the list. Its page holds these tools." },
      {
        target: { sel: '[data-testid="ward-console-step-back-stage"]' },
        title: "Correct the recorded stage",
        body: "The history keeps both the mistake and the correction.",
      },
    ],
  },
  {
    id: "stop-transport",
    topic: "Transport",
    title: "Stop transport after the patient is collected",
    keywords: "stop transport collected turn back divert abandon where are they now",
    answer:
      "On the movement's page, press Stop transport. Give a reason and choose where the patient is now. The officer is told; the bed stays pulled until someone releases it.",
    desks: ["coordinator", "ed"],
    acts: ["STOP_TRANSPORT"],
    go: ["movements", "ed"],
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Choose it in the list. Its page holds these tools." },
      {
        target: { sel: '[data-testid="ward-console-stop-transport"]' },
        title: "Stop transport",
        body: "Only once the patient is collected. Before that, cancel transport instead.",
      },
    ],
  },
  {
    id: "support-notifications",
    topic: "Handover and reports",
    title: "Record that the carer, PSP or MHAS were told",
    keywords: "carer personal support person psp mhas advocacy notification told informed",
    answer:
      "Open the Carer, PSP and MHAS panel on the movement, a discharge or Legal forms. Press Record, choose the outcome, who was told and when, then Save. The panel counts how many of the three are done. It is a reminder, not a legal check.",
    desks: ["ward", "coordinator"],
    acts: ["RECORD_SUPPORT_NOTIFICATION"],
    go: ["movements", "legal-forms", "home"],
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Choose it in the list. Its page holds these tools." },
      {
        target: { sel: '[data-testid="ward-support-notifications"]' },
        title: "Carer, PSP and MHAS",
        body: "One row each. Record or Change opens the short form.",
      },
    ],
  },

  /* Legal forms */
  {
    id: "legal-form-received",
    topic: "Handover and reports",
    title: "Mark a legal form received, or correct it",
    keywords: "form received paperwork arrived 1A mark received correct receipt wrong",
    answer:
      "On Legal forms, choose the form and press Mark Form received. The ED board has the same in a row's actions. To fix a receipt, press Correct receipt on the ED row, choose a reason and Save correction. Undo shows straight after marking.",
    desks: ["ed", "ward", "community", "coordinator"],
    acts: ["RECORD_LEGAL_FORM_RECEIVED", "CORRECT_LEGAL_FORM_RECEIPT"],
    go: ["legal-forms", "ed"],
    showMe: [
      {
        target: [
          { sel: '[data-testid^="ward-legal-forms-mark-received-"]' },
          { sel: '[data-testid^="ed-mark-form-received-"]' },
        ],
        title: "Mark received",
        body: "Records that the form is in hand, with the time.",
      },
    ],
  },
  {
    id: "legal-form-expiry",
    topic: "Handover and reports",
    title: "Record a legal form's expiry or extension",
    keywords: "form expiry expires end time extension extend renew legal form",
    answer:
      "On Legal forms, press Extend recorded form and confirm. On the ED board, use Record expiry from the form or Record an extension, then Save. Type the time exactly as the form states it. The app never works it out.",
    desks: ["ed", "coordinator", "ward"],
    acts: ["RECORD_LEGAL_FORM_EXPIRY"],
    go: ["legal-forms", "ed"],
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-legal-forms-renew-confirm"]' },
          { sel: '[data-testid^="ward-ed-legal-form-expiry-save-"]' },
        ],
        title: "Save the time",
        body: "The time as typed from the form.",
      },
    ],
  },
  {
    id: "legal-mismatch",
    topic: "Handover and reports",
    title: "Flag that the legal form does not match the ward",
    keywords: "legal mismatch wrong ward form placement does not match authorised flag",
    answer:
      "On the movement's page, open Additional workflow controls and press Flag current legal placement mismatch. It flags the movement for review; it does not judge the paperwork.",
    desks: ["ward", "coordinator"],
    acts: ["FLAG_LEGAL_MISMATCH"],
    go: ["movements", "home"],
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Choose it in the list. Its page holds these tools." },
      { target: WORKFLOW_CONTROLS, title: "Additional workflow controls", body: "The less used tools." },
      {
        target: button("Flag current legal placement mismatch"),
        title: "Flag mismatch",
        body: "Raises it for review.",
      },
    ],
  },

  /* A patient on the ward */
  {
    id: "patient-leave",
    topic: "Beds and referrals",
    title: "Record leave, a return or absence without leave",
    keywords: "leave start leave due back return record return absent without leave awol missing",
    answer:
      "Open the patient. On Record a change, press Start leave, choose when they are expected back and Record leave; the bed is kept. Press Record return when they are back. If they do not come back, press Mark absent. Undo shows straight after.",
    desks: ["ward", "coordinator"],
    acts: ["RECORD_LEAVE_BED", "END_LEAVE_BED", "RECORD_ABSENT_WITHOUT_LEAVE"],
    go: ["wards", "home"],
    showMe: [
      {
        target: { sel: '[data-testid="ward-patient-change-card"]' },
        title: "Record a change",
        body: "Leave, Gone to ED and the discharge date sit here.",
      },
      {
        target: [button("Start leave"), button("Record return")],
        title: "Start or end leave",
        body: "The bed is held while they are away.",
      },
    ],
  },
  {
    id: "patient-gone-to-ed",
    topic: "Beds and referrals",
    title: "Record that a patient went to an ED and came back",
    keywords: "gone to ed emergency department medical transfer away back returned",
    answer:
      "Open the patient and press Gone to ED, then confirm. The bed stays theirs while they are away. When they are back, press Record return.",
    desks: ["ward", "coordinator"],
    acts: ["RECORD_AWAY_AT_EMERGENCY_DEPARTMENT", "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT"],
    go: ["wards", "home"],
    showMe: [
      {
        target: [{ sel: '[data-testid="ward-board-record-away-submit"]' }, button("Gone to ED")],
        title: "Gone to ED",
        body: "Keeps the bed while they are away.",
      },
      {
        target: [{ sel: '[data-testid="ward-board-record-returned-submit"]' }, button("Record return")],
        title: "Back on the ward",
        body: "Records the return.",
      },
    ],
  },
  {
    id: "move-patient-bed",
    topic: "Beds and referrals",
    title: "Move a patient to another bed on the ward",
    keywords: "move swap change room transfer within ward",
    answer:
      "Open the patient's bed and press Move to another bed. Tap the new bed and press Move to bed. Undo puts the bed and the person back where they were.",
    desks: ["ward", "coordinator"],
    acts: ["PLACE_IN_BED"],
    go: ["wards", "home"],
    showMe: [
      {
        target: button("Move to another bed"),
        title: "Move to another bed",
        body: "Picks the patient up on the bed board.",
      },
      {
        target: { sel: '[data-testid="ward-board-confirm-send"]' },
        title: "Move to bed",
        body: "Confirms the new bed.",
      },
    ],
  },
  {
    id: "observation-level",
    topic: "Beds and referrals",
    title: "Record a change in observation level",
    keywords: "observation level obs check every review change frequency",
    answer:
      "Open the bed on the ward, or the person on the ED board, and press Change observation level. Choose the level, how often checks are due and the review day, then Record level. The app records the plan; clinicians set it.",
    desks: ["ward", "ed", "coordinator"],
    acts: ["RECORD_OBSERVATION_LEVEL"],
    go: ["wards", "ed", "home"],
    showMe: [
      {
        target: { sel: '[data-testid="ward-observation-change"]' },
        title: "Change observation level",
        body: "Opens a short form.",
      },
      {
        target: { sel: '[data-testid="ward-observation-save"]' },
        title: "Record level",
        body: "Saves it with the time.",
      },
    ],
  },

  /* Discharges */
  {
    id: "expected-discharge-date",
    topic: "Beds and referrals",
    title: "Change a patient's expected discharge date",
    keywords: "discharge date expected leave day move the date change edd estimated",
    answer:
      "On the bed board, choose the bed and press Move the date. Set the discharge day and time, then Save departure date. On the patient page, use Discharge date, then Save date.",
    desks: ["ward", "coordinator"],
    acts: ["UPDATE_EXPECTED_DISCHARGE"],
    go: ["wards", "home"],
    showMe: [
      { target: button("Move the date"), title: "Move the date", body: "On the chosen bed's panel." },
      {
        target: { sel: "#ward-board-date-edit" },
        title: "The new date",
        body: "Day and time, then Save departure date.",
      },
    ],
  },
  {
    id: "record-discharge",
    topic: "Beds and referrals",
    title: "Record that a patient has left the ward",
    keywords: "discharged left gone home departure record discharge leaving",
    answer:
      "On the bed board, choose the bed, say where they are going and press Record that they have left. On Discharges, press Record discharge. The bed is then free for the ward to prepare.",
    desks: ["ward", "coordinator"],
    acts: ["RECORD_PATIENT_DISCHARGE", "RECORD_LEAVING"],
    go: ["discharges", "wards", "home"],
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-board-record-leaving-submit"]' },
          { sel: '[data-testid="ward-discharge-record-departure"]' },
        ],
        title: "Record the departure",
        body: "Undo shows straight after.",
      },
    ],
  },
  {
    id: "discharge-arrangements",
    topic: "Beds and referrals",
    title: "Track the arrangements a discharge needs",
    keywords: "discharge arrangements outstanding follow up appointment medication accommodation owner checklist",
    answer:
      "On Discharges, open the discharge. Under Discharge arrangements, name the arrangement and who owns it, then Add as outstanding. Mark each one done, Not needed or Reconfirm as it moves. Nothing here frees the bed.",
    desks: ["ward", "coordinator"],
    acts: ["RECORD_DISCHARGE_DEPENDENCY"],
    go: "discharges",
    showMe: [
      {
        target: { sel: '[data-testid="ward-discharge-dependency-add"]' },
        title: "Add as outstanding",
        body: "Practical arrangements only, each with an owner.",
      },
    ],
  },
  {
    id: "step-down-candidate",
    topic: "Beds and referrals",
    title: "Mark a patient for step-down care",
    keywords: "step down subacute candidate mark flag transfer lower care",
    answer:
      "On the bed board, choose the bed and press Mark for step-down. It reads Marked for step-down; press it again to clear. It is a marker for planning only.",
    desks: ["ward", "coordinator"],
    acts: ["SET_STEP_DOWN_CANDIDATE"],
    go: ["wards", "home"],
    showMe: [
      {
        target: { sel: '[data-testid="ward-board-stepdown-toggle"]' },
        title: "Mark for step-down",
        body: "The same button clears it.",
      },
    ],
  },

  /* ED */
  {
    id: "arrival-plan",
    topic: "Transport",
    title: "Set the expected arrival time and transport plan",
    keywords: "arrival time plan expected eta when arriving transport plan update",
    answer:
      "Press Set arrival plan on the ED row or referral, or Set arrival time on the patient page. Fill in Update arrival time & transport and press Save arrival plan. The receiving ward sees it.",
    desks: ["coordinator", "ed", "ward", "community"],
    acts: ["SET_ARRIVAL_DETAILS"],
    go: ["ed", "home"],
    showMe: [
      {
        target: [
          { sel: '[data-testid^="ward-ed-arrival-plan-toggle-"]' },
          { sel: '[data-testid="save-arrival-plan-button"]' },
        ],
        title: "Arrival plan",
        body: "Time and transport, saved together.",
      },
    ],
  },
  {
    id: "ed-arrival-checks",
    topic: "Beds and referrals",
    title: "Record the arrival checks for the receiving ward",
    keywords: "arrival checklist contraband search medication chart checks done",
    answer:
      "Open the person on the ED board. The Arrival checklist shows how many of the two checks are recorded. Press Record done for each; Take back undoes one.",
    desks: ["ed", "coordinator"],
    acts: ["RECORD_ARRIVAL_CHECK"],
    go: "ed",
    showMe: [
      {
        target: { sel: '[data-testid="ward-ed-admission-checklist"]' },
        title: "Arrival checklist",
        body: "The search and the medication chart.",
      },
    ],
  },
  {
    id: "ed-no-transport",
    topic: "Transport",
    title: "Record that no transport is needed",
    keywords: "no transport needed walk own way family driving",
    answer: "On the ED board, open the row's actions and press Record no transport needed.",
    desks: ["ed"],
    acts: ["RECORD_TRANSPORT_NEED"],
    go: "ed",
    showMe: [
      {
        target: { sel: '[data-testid^="ward-ed-no-transport-needed-"]' },
        title: "No transport needed",
        body: "Clears the transport step for this patient.",
      },
    ],
  },
  {
    id: "ed-medical-deterioration",
    topic: "Beds and referrals",
    title: "Record a medical deterioration after clearance",
    keywords: "medically unwell deteriorated not cleared anymore release reservation pause placement",
    answer:
      "Open the person on the ED board and press Record medical deterioration, then confirm. It cancels the allocation, releases the bed, cancels transport not yet collected and pauses placement until cleared again.",
    desks: ["ed", "coordinator"],
    acts: ["RECORD_ED_MEDICAL_DETERIORATION"],
    go: "ed",
    showMe: [
      {
        target: { sel: '[data-testid^="ward-ed-medical-placement-"]' },
        title: "Medical clearance and placement",
        body: "Record medical deterioration is here. It asks first.",
      },
    ],
  },

  /* Seclusion */
  {
    id: "end-seclusion",
    topic: "Beds and referrals",
    title: "Record the end of seclusion or restraint",
    keywords: "end seclusion restraint finished stop record end time",
    answer:
      "Open Seclusion and restraint. On the live episode, press Record end, type the time it ended and press Save end time. Times are as typed; nothing works out a legal limit.",
    desks: ["ward", "coordinator"],
    acts: ["RECORD_RESTRICTIVE_PRACTICE_END"],
    go: "seclusion",
    showMe: [
      {
        target: { sel: '[data-testid="seclusion-end-open"]' },
        title: "Record end",
        body: "Ends the live episode with the time you type.",
      },
    ],
  },
];
