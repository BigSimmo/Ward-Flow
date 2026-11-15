/**
 * HELP HOW-TOS FROM THE FEATURE CRAWL (Josh, 8 Nov 2026: "deeply understand and crawl the site ...
 * create further guides and add further questions to the Help"). Each job here is one a desk can
 * record on a screen that Help did not yet explain: broadcast alerts, the coordinator's alert queue,
 * notices, bed meeting actions, bookings, closures, discharge readiness, and the patient, referral
 * and movement tools. Listed in `HOW_TOS` after the older jobs, so a question that matches an older
 * job equally well still finds that one first.
 *
 * Full walkthroughs (Josh, 15 Nov 2026: "for each task a full walkthrough ... tailored to the screen
 * they are on"): each Show me goes from where to start, through every control and field the person
 * uses in order, to where the saved result then shows. A step after a press names a control that
 * appears only once the person presses; Show me never presses anything itself, and a step whose
 * control is not on screen yet shows its card with the "not on the screen" note. Step 1 still lights
 * what it lit before; a later fallback in its list lights the way in when that control is not drawn.
 *
 * Each answer is written from the screen's own source, in the button names the screen draws. Show me
 * targets use test ids, ids and accessible text, never class names (`tests/ward-help-howto.test.ts`
 * fails when a test id leaves the source). Nothing here ranks, places, suggests a ward or works out a
 * legal time; a person presses every button.
 */
import type { HowTo } from "./ward-help-howto";
import {
  CLINICAL_DESKS,
  button,
  inDialog,
  ALERTS_DRAWER,
  CAPACITY_WARD,
  CAPACITY_DRAWER,
  MOVEMENT_ROW,
  MOVEMENT_DRAWER_OPEN,
  WORKFLOW_CONTROLS,
  WORKFLOW_ACTIONS,
  ALERT_ROW,
  BROADCASTS_TAB,
  LIVE_BROADCAST,
  ED_ACTIONS,
  ED_SHEET,
  WARD_BED,
  BED_PANEL,
} from "./ward-help-howto-more-targets";
import { CRAWL_JOBS_LATE } from "./ward-help-howto-more-late";

export const CRAWL_JOBS: readonly HowTo[] = [
  /* Broadcast alerts */
  {
    id: "broadcast-acknowledge",
    topic: "Finding your way",
    title: "Acknowledge a broadcast alert",
    keywords: "broadcast banner directive acknowledge seen read top of screen alert message",
    answer:
      "A live broadcast shows as a banner at the top of every screen. For a directive, press Acknowledge and it reads Acknowledged for your desk. A bed call is answered instead, with your desk's answer on the call. Alerts, then Broadcasts, shows the same alert with every desk's answer.",
    desks: [...CLINICAL_DESKS],
    acts: ["ACKNOWLEDGE_BROADCAST_ALERT"],
    showMe: [
      {
        target: { sel: '[data-testid="ward-broadcast-banner"]' },
        title: "The banner",
        body: "Shows while a broadcast is live. It stays on every screen until it ends or is stood down.",
      },
      {
        target: [{ sel: '[data-testid="ward-broadcast-banner"] button', text: "Acknowledge" }, button("Acknowledge")],
        title: "Acknowledge",
        body: "Records that your desk has seen the directive. It then reads Acknowledged on the banner.",
      },
      {
        target: [{ sel: '[data-testid="ward-broadcast-banner"]' }, LIVE_BROADCAST],
        title: "Who has acknowledged",
        body: "The banner counts how many desks have acknowledged so far, such as 3 of 5 acknowledged.",
      },
      {
        target: { sel: '[data-testid="ward-broadcast-more-toggle"]' },
        title: "More waiting",
        body: "When several broadcasts are live, this opens the others. Acknowledge each directive there too.",
      },
    ],
  },
  {
    id: "broadcast-extend-stand-down",
    topic: "Finding your way",
    title: "Extend or stand down a broadcast alert",
    keywords: "broadcast extend longer stand down end stop cancel alert bed call 30 minutes",
    answer:
      "On the banner, or Alerts then Broadcasts, press Extend 30m for half an hour more. Press Stand down to end it; it asks you to confirm first. The time left shows on the banner and the live card.",
    desks: ["coordinator", "bed_manager"],
    acts: ["EXTEND_BROADCAST_ALERT", "STAND_DOWN_BROADCAST_ALERT"],
    go: "alerts",
    showMe: [
      {
        target: [{ sel: '[data-testid="ward-broadcast-extend"]' }, BROADCASTS_TAB],
        title: "Extend 30m",
        body: "Keeps the alert live for 30 more minutes. It is on the banner, and on the live card under Broadcasts.",
      },
      {
        target: [{ sel: '[data-testid="ward-broadcast-stand-down"]' }, { sel: '[aria-label="Stand down this alert"]' }],
        title: "Stand down",
        body: "Ends the alert for everyone it went to, after you confirm.",
      },
      {
        target: inDialog("Stand down"),
        title: "Confirm the stand-down",
        body: "Press Stand down to end it, or Keep as is to leave it live.",
      },
      {
        target: [LIVE_BROADCAST, BROADCASTS_TAB],
        title: "Live and ended broadcasts",
        body: "Broadcasts shows the live card with its time left and answers. A stood-down alert moves to the ended list.",
      },
    ],
  },
  {
    id: "broadcast-add-desks",
    topic: "Finding your way",
    title: "Add desks to a broadcast alert",
    keywords: "broadcast add desks more wards widen ask more units bed call",
    answer:
      "Open Alerts, choose Broadcasts, then press Add desks on the live alert. Tick the desks to ask, or All for a group, and press Add, which names how many. The button is greyed when every desk is already asked.",
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
        target: LIVE_BROADCAST,
        title: "The live alert",
        body: "Shows who it went to, the time left and each desk's answer.",
      },
      {
        target: [{ sel: '[data-testid="ward-alerts-live"] button', text: "Add desks" }, button("Add desks")],
        title: "Add desks",
        body: "Opens the desks not yet asked. Those already asked are not listed again.",
      },
      {
        target: inDialog("All"),
        title: "Tick the desks",
        body: "Tick each desk to ask, or press All beside a group to tick the whole group.",
      },
      {
        target: inDialog("Add "),
        title: "Add",
        body: "Names how many desks, such as Add 2 desks. They see the banner straight away.",
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
      "Open the alert from Alerts, or the Alerts bell at the top, and press Take; it then reads Yours. To give it back, press Hand back and confirm. The alert returns to the queue and Undo shows for a short while. Yours at the top of Alerts counts the alerts you own.",
    desks: ["coordinator"],
    acts: ["TAKE_INBOX_ITEM_OWNERSHIP", "RELEASE_INBOX_ITEM_OWNERSHIP"],
    go: "alerts",
    showMe: [
      {
        target: ALERTS_DRAWER,
        title: "The Alerts bell",
        body: "Opens your alerts without leaving the page. On Alerts, the queue below lists the same.",
      },
      {
        target: ALERT_ROW,
        title: "Open the alert",
        body: "Press its title. Its details open in a panel with Take at the foot.",
      },
      {
        target: [inDialog("Take"), button("Take")],
        title: "Take",
        body: "Marks the alert as yours, so others know it is being handled. It then reads Yours.",
      },
      {
        target: [inDialog("Hand back"), button("Hand back")],
        title: "Hand back",
        body: "Shows on an alert you took. It asks before it returns the alert to the queue.",
      },
      {
        target: { sel: '[data-testid="alerts-release-ownership-confirm"] button', text: "Hand back" },
        title: "Confirm",
        body: "Press Hand back to return it, or Cancel to keep it. Undo shows for a short while after.",
      },
      {
        target: { sel: '[data-testid="ward-alerts-yours"]' },
        title: "Yours",
        body: "Counts the alerts you own. Press it to see just those.",
      },
    ],
  },
  {
    id: "alert-snooze",
    topic: "Finding your way",
    title: "Snooze or acknowledge an alert",
    keywords: "snooze later remind defer acknowledge seen watch return now waiting callback",
    answer:
      "Open the alert, then More actions. Snooze asks when it should come back and why. Acknowledge marks it Seen and leaves it on watch. Return now brings a snoozed alert back. Act now alerts can only be snoozed for a short time.",
    desks: ["coordinator"],
    acts: ["SNOOZE_INBOX_ITEM", "UNSNOOZE_INBOX_ITEM", "ACKNOWLEDGE_INBOX_ITEM"],
    go: "alerts",
    showMe: [
      {
        target: [{ sel: '[data-testid="alerts-more-actions"]' }, ALERT_ROW],
        title: "More actions",
        body: "Open an alert from the queue. Snooze, Acknowledge and Return now sit under More actions.",
      },
      {
        target: [inDialog("Acknowledge"), inDialog("Seen")],
        title: "Acknowledge",
        body: "Marks it Seen and leaves it on watch, with your name and the time.",
      },
      {
        target: inDialog("Snooze"),
        title: "Snooze",
        body: "Opens a short list: when it comes back, then why.",
      },
      {
        target: { sel: "[role='dialog'] [role='group'] button", text: "min" },
        title: "Back in",
        body: "Choose when it comes back. The line under it says the exact time. Act now alerts offer only short times.",
      },
      {
        target: inDialog("Waiting on ward"),
        title: "Snooze because",
        body: "Press the reason, such as Awaiting call back. That snoozes it straight away.",
      },
      {
        target: [{ sel: '[data-testid="ward-alerts-snoozed"]' }, inDialog("Return now")],
        title: "Snoozed alerts",
        body: "Snoozed alerts wait here and come back on their own. Return now brings one back early.",
      },
    ],
  },
  {
    id: "alert-mark-done",
    topic: "Finding your way",
    title: "Mark an alert done, or reopen it",
    keywords: "alert done complete finished tick close reopen undone",
    answer:
      "Open the Alerts bell at the top and press Mark done on the alert's row. The row then says Done by, with who and when. Press Reopen on a done row to put it back on the queue.",
    desks: ["coordinator"],
    acts: ["COMPLETE_INBOX_ITEM", "REOPEN_INBOX_ITEM"],
    showMe: [
      {
        target: ALERTS_DRAWER,
        title: "The Alerts bell",
        body: "Your alerts, in a drawer over the page you are on. On a phone, Alerts is in the dock.",
      },
      {
        target: { sel: '[data-testid^="ward-task-complete-"]' },
        title: "Mark done",
        body: "Closes the alert and records who did it.",
      },
      {
        target: { sel: '[data-testid^="ward-task-done-"]' },
        title: "Done by",
        body: "The row then says who marked it done and when.",
      },
      {
        target: { sel: '[data-testid^="ward-task-reopen-"]' },
        title: "Reopen",
        body: "Shows on a done row in place of Mark done. It puts the alert back on the queue.",
      },
    ],
  },
  {
    id: "notice-read",
    topic: "Finding your way",
    title: "Mark a notice as read",
    keywords: "notice activity read unread message update news bell",
    answer:
      "Press Activity at the top of the screen, then the Notices tab; its number is how many are unread. Unread notices show newest first. Press Mark read on one, or Mark all read for every one. Read notices move under Earlier. Opening the drawer alone marks nothing.",
    desks: [...CLINICAL_DESKS],
    acts: ["MARK_NOTICE_READ"],
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-bar-activity-trigger"]' },
          { sel: '[data-testid="ward-phone-menu-activity"]' },
        ],
        title: "Activity",
        body: "Notices and recent activity for your desk. A dot shows when a notice is unread.",
      },
      {
        target: [
          { sel: "#ward-bar-activity-drawer [role='tab']", text: "Notices" },
          { sel: '[data-testid="ward-activity-notice-line"]' },
        ],
        title: "Notices",
        body: "The Notices tab. Its number is how many notices for this desk are still unread.",
      },
      {
        target: [{ sel: '[aria-label="Unread notices"]' }, { sel: '[data-testid="ward-activity-notices-about"]' }],
        title: "Unread notices",
        body: "Messages sent to this desk, newest first, each with where it came from and when.",
      },
      {
        target: [
          { sel: "#ward-bar-activity-drawer button", text: "Mark read" },
          { sel: '[data-testid="ward-activity-notices-about"]' },
        ],
        title: "Mark read",
        body: "Marks that one notice read. Opening the drawer alone marks nothing.",
      },
      {
        target: [
          { sel: "#ward-bar-activity-drawer button", text: "Mark all read" },
          { sel: '[data-testid="ward-activity-notice-line"]' },
        ],
        title: "Mark all read",
        body: "Marks every unread notice for this desk read at once.",
      },
      {
        target: [
          { sel: "#ward-bar-activity-drawer summary", text: "Earlier" },
          { sel: '[data-testid="ward-activity-notice-line"]' },
        ],
        title: "Earlier",
        body: "Read notices move here. The line at the top then reads that every notice is read.",
      },
    ],
  },
  {
    id: "on-call-checked",
    topic: "Finding your way",
    title: "Record that an on-call number was checked",
    keywords: "on call directory checked verified number phone correct stale date",
    answer:
      "Open On-call and choose the entry. Its card ends with when the number was last checked and who keeps it up to date. Once you have checked the number is right, press Mark checked now. It then reads Check recorded.",
    desks: [...CLINICAL_DESKS],
    acts: ["RECORD_DIRECTORY_CHECK"],
    go: "on-call",
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-on-call-mark-checked"]' },
          { sel: '[data-testid="ward-on-call-directory"]' },
          { sel: '#main-content [role="tablist"]' },
        ],
        title: "Mark checked now",
        body: "At the foot of the chosen entry's card. Choose an entry in the directory first.",
      },
      {
        target: { sel: '[data-testid^="ward-on-call-row-"]' },
        device: "desk",
        title: "Choose the entry",
        body: "Each row is one line. Choosing it opens its card beside the list.",
      },
      {
        target: { sel: '[data-testid="ward-on-call-check-foot"]' },
        title: "When it was checked",
        body: "Says when it was last checked and by which desk. A Not checked in note shows when it may be stale.",
      },
      {
        target: { sel: '[data-testid="ward-on-call-owner"]' },
        title: "Who keeps it up to date",
        body: "Call this desk if the number is wrong. Do not mark it checked until it is right.",
      },
      {
        target: { sel: '[data-testid="ward-on-call-mark-checked"]' },
        title: "Mark checked now",
        body: "Records the check with today's time. Check recorded shows beside it.",
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
      "Open the patient. The Agreed at the bed meeting card lists each action with when it is due: press Mark done. The coordinator can also press Done on the Actions card of the Meeting agenda. Undo shows in the message straight after.",
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
      {
        target: [{ sel: '[data-testid="meeting-actions-due"]' }, { sel: '[data-testid="bed-meeting-action-list"]' }],
        title: "The agreed actions",
        body: "Each action and when it is due. Was due marks one past its time.",
      },
      {
        target: { sel: '[data-testid="bed-meeting-action-summary"]' },
        title: "What is left",
        body: "On the agenda, counts the actions still open. A done action leaves the list.",
      },
    ],
  },
  {
    id: "handover-ready",
    topic: "Transport",
    title: "Mark a patient's handover ready",
    keywords: "handover ready transport officer accept job sending team ready to go",
    answer:
      "On the ED board, press Handover ready as the row's next step, or Mark handover ready in its actions. A sending community team uses Mark handover ready on the patient's transit panel. The transport officer can then accept the job.",
    desks: ["ed", "community", "coordinator"],
    acts: ["HANDOVER_READY"],
    go: ["ed", "home"],
    showMe: [
      {
        target: [{ sel: '[data-testid^="ward-ed-handover-"]' }, button("Handover ready"), ...ED_ACTIONS],
        title: "Handover ready",
        body: "Tells the transport officer the patient is ready to be handed over. It is also in the row's actions.",
      },
      {
        target: { sel: '[data-testid^="ward-ed-next-"]' },
        device: "desk",
        title: "The row's next step",
        body: "Reads Handover ready once every earlier step is done. Greyed, it says what is still needed.",
      },
      {
        target: ED_ACTIONS,
        title: "The row's actions",
        body: "Mark handover ready is also here. On a phone, open the person to see their actions.",
      },
      {
        target: [{ sel: '[data-testid^="ward-ed-referral-"]' }, ED_SHEET],
        title: "Where it shows",
        body: "The row then says handover is ready, and the job shows on the transport officer's list.",
      },
    ],
  },
  {
    id: "undo-handover-sign-off",
    topic: "Handover and reports",
    title: "Undo a handover sign-off",
    keywords: "undo sign off handover take back mistake signed wrong",
    answer:
      "On Handover, open the sign-off panel; once signed it reads Signed off at, with the time. Press Undo sign-off. A site bed manager presses Undo sign-off on the Site handover card. A coordinator who signed as cover cannot undo a site sign-off.",
    desks: ["coordinator", "ward", "bed_manager"],
    acts: ["UNDO_HANDOVER_SIGN_OFF", "UNDO_SITE_HANDOVER_SIGN_OFF"],
    go: "handover",
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-handover-sign-off-undo"]' },
          { sel: '[data-testid="ward-handover-site-undo"]' },
          { sel: '[data-testid="ward-handover-phone-sign-off"]' },
          { sel: '[data-testid="ward-handover-sign-off"]' },
          { sel: '[data-testid="ward-handover-site-sign-off"]' },
          { sel: '[data-testid="ward-handover-sign-off-note"]' },
        ],
        title: "Undo sign-off",
        body: "In the sign-off panel once it is signed. It takes the sign-off back. On a phone, Signed opens the panel.",
      },
      {
        target: [
          { sel: '[data-testid="ward-handover-sign-off-visible-status"]' },
          { sel: '[data-testid="ward-handover-site-signed"]' },
        ],
        title: "What was signed",
        body: "Says when it was signed off and as which desk. Check it is the one to undo.",
      },
      {
        target: [
          { sel: '[data-testid="ward-handover-sign-off"]' },
          { sel: '[data-testid="ward-handover-site-sign-off"]' },
        ],
        title: "Sign again when ready",
        body: "Sign-off undone shows. The panel offers Sign off again once Before you sign is clear.",
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
      "On the ward's home, press Confirm bed numbers when the line says they are due, or Confirm numbers on the ward's card. It records the morning figures and how many discharges are planned today. The due time is set in Settings.",
    desks: ["ward", "bed_manager", "coordinator"],
    acts: ["CONFIRM_MORNING_ROLLUP"],
    go: ["wards", "home"],
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-confirm-morning-rollup-btn"]' },
          { sel: '[data-testid="ward-morning-rollup-overdue-banner"]' },
          { sel: '[data-testid="ward-confirm-numbers"]' },
        ],
        title: "Confirm bed numbers",
        body: "Shows when the morning figures are due or overdue. At other times, Confirm numbers sits at the top.",
      },
      {
        target: { sel: '[data-testid^="ward-unit-card-"] button', text: "Confirm numbers" },
        title: "Or Confirm numbers",
        body: "Confirming the ward's numbers here also confirms the morning figures, if not yet done today.",
      },
      {
        target: { sel: '[data-testid="ward-morning-rollup-confirmed-banner"]' },
        title: "Confirmed",
        body: "Then reads Morning bed numbers confirmed, with the discharges planned today.",
      },
    ],
  },
  {
    id: "change-planned-admission",
    topic: "Beds and referrals",
    title: "Change or cancel a planned admission",
    keywords: "planned admission booking change date move cancel elective booked",
    answer:
      "On Capacity, open the Planned tab and choose the booking. Press Change booking, edit the ward, day, time or stay and press Save. Or press Cancel booking, choose a reason and confirm; Keep as is leaves it booked. Undo shows straight after.",
    desks: ["coordinator", "bed_manager", "ward"],
    acts: ["CHANGE_PLANNED_ADMISSION", "CANCEL_PLANNED_ADMISSION"],
    go: ["capacity", "home"],
    showMe: [
      {
        target: [
          { sel: '[data-testid^="ward-planned-"]' },
          { sel: '[data-testid="capacity-tabs"] button', text: "Planned" },
        ],
        title: "The booking",
        body: "On Capacity, open the Planned tab, then choose the booking. Its details open in a drawer.",
      },
      {
        target: { sel: 'li[data-testid^="ward-planned-"] button' },
        title: "Choose the booking",
        body: "Each row shows when they are expected, the reason, the stay and legal status. Press it to open.",
      },
      {
        target: { sel: '[data-testid="capacity-planned-detail"]' },
        title: "The booking's details",
        body: "When they are expected, the ward and the reason. Change and cancel are at the foot.",
      },
      {
        target: inDialog("Change booking"),
        title: "Change booking",
        body: "Opens the booking form with what is booked now.",
      },
      {
        target: [{ sel: '[data-testid="ward-planned-unit"]' }, { sel: '[data-testid="ward-planned-day"]' }],
        title: "Ward and day",
        body: "Change the ward, the day, the arrival time or the expected stay.",
      },
      {
        target: { sel: '[data-testid="ward-planned-submit"]' },
        title: "Save",
        body: "Saves the change. The booking moves to its new day on the Planned tab.",
      },
      {
        target: inDialog("Cancel booking"),
        title: "Cancel booking",
        body: "Opens Cancel planned admission instead.",
      },
      {
        target: { sel: '[data-testid="ward-planned-cancel-reason"]' },
        title: "Reason",
        body: "Choose why it is cancelled. The cancel button stays greyed until you do.",
      },
      {
        target: { sel: '[data-testid="ward-planned-cancel-confirm"]' },
        title: "Cancel the booking",
        body: "Names who it is for. Keep as is leaves it booked. Undo shows straight after.",
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
      {
        target: [CAPACITY_DRAWER, ...CAPACITY_WARD],
        title: "Closed to admissions",
        body: "A closed ward says so at the top of its panel.",
      },
      { target: button("Closures"), title: "Closures", body: "The last button at the foot of the panel." },
      {
        target: { sel: '[data-testid="ward-closure-panel"]' },
        title: "The closure",
        body: "Why the ward is closed and when it was due for review.",
      },
      {
        target: { sel: '[data-testid="ward-closure-transition"]' },
        title: "Still pointed at this ward",
        body: "Referrals, bookings or moves to reassign or cancel on their own record, then Mark dealt with.",
      },
      {
        target: { sel: '[data-testid="ward-closure-reopen"]' },
        title: "Reopen",
        body: "Names the ward. It asks first.",
      },
      {
        target: { sel: '[data-testid="ward-closure-reopen-confirm"] button', text: "Reopen" },
        title: "Confirm",
        body: "Reopens it straight away. Keep as is leaves the ward closed.",
      },
    ],
  },
  {
    id: "ask-ward-confirm-beds",
    topic: "Beds and referrals",
    title: "Ask a ward to confirm its bed numbers",
    keywords: "ask ward confirm beds stale old figures refresh update numbers chase",
    answer:
      "On Capacity, open the ward and press Ask the ward. On Places, press Ask to confirm. The ward is asked to confirm its beds. Capacity then reads Update requested, and Places reads Asked, with the time. The ward confirms on its own home.",
    desks: ["coordinator"],
    acts: ["REQUEST_CAPACITY_REFRESH"],
    go: "capacity",
    showMe: [
      { target: CAPACITY_WARD, title: "Open the ward", body: "Its panel shows when the numbers were last confirmed." },
      {
        target: CAPACITY_DRAWER,
        title: "How fresh the numbers are",
        body: "The panel says when the ward last confirmed its beds.",
      },
      {
        target: [button("Ask the ward"), button("Ask to confirm")],
        title: "Ask the ward",
        body: "Sends the ward a request.",
      },
      {
        target: [{ sel: '[data-testid="ward-capacity-ward-drawer"] span', text: "Update requested" }, CAPACITY_DRAWER],
        title: "Update requested",
        body: "Then reads Update requested, with the time, and Ask the ward greys until the ward confirms.",
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
      "On the ward's discharges list, press Confirm ready on the expected discharge. A Discharge support notices card then opens: press Send notice for each service that needs to know. Each then reads Notice sent.",
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
        target: { sel: '[data-testid^="ward-today-release-state-"]' },
        title: "Its state",
        body: "Each discharge today says Expected or Confirmed, with what it is waiting on and held up by.",
      },
      {
        target: { sel: '[data-testid="ward-discharge-notices"]' },
        title: "Discharge support notices",
        body: "Opens once confirmed. One row for each service.",
      },
      {
        target: { sel: '[data-testid="ward-discharge-notices"] button', text: "Send notice" },
        title: "Send notice",
        body: "Press it for each service that needs to know. Each then reads Notice sent.",
      },
      {
        target: { sel: '[data-testid="ward-discharge-notices"] button', text: "Close" },
        title: "Close",
        body: "Closes the card. The discharge stays Confirmed on the list.",
      },
    ],
  },
  {
    id: "record-hold-up",
    topic: "Beds and referrals",
    title: "Record what is holding up a discharge",
    keywords: "hold-up held-up blocker delay discharge waiting barrier reason",
    answer:
      "Open the bed on the ward and press Record hold-up. Choose what it is held up by and press Save hold-up. On the bed board the same question opens as a dialog with Confirm blocker. Press Clear hold-up once it is sorted; the stage does not change.",
    desks: ["ward", "bed_manager", "coordinator"],
    acts: ["BLOCK_BED_RELEASE", "CLEAR_BED_RELEASE_BLOCK"],
    go: ["wards", "home"],
    showMe: [
      {
        target: [button("Record hold-up"), ...WARD_BED],
        title: "Record hold-up",
        body: "Open the bed first. Record hold-up opens the list of reasons.",
      },
      {
        target: [
          { sel: '[data-testid="ward-blocker-choice"]' },
          { sel: '[data-testid="ward-board-blocker-dialog"] fieldset' },
        ],
        title: "Held up by",
        body: "Choose what is holding the discharge up.",
      },
      {
        target: [{ sel: '[data-testid="ward-blocker-save"]' }, { sel: '[data-testid="ward-board-blocker-dialog"]' }],
        title: "Save hold-up",
        body: "The hold-up shows on Discharges and in handover until cleared. On the bed board, press Confirm blocker.",
      },
      {
        target: [{ sel: '[data-testid="ward-drawer-hold-up-today"]' }, ...BED_PANEL],
        title: "Where it shows",
        body: "The bed's panel says Today, with the hold-up. Update hold-up changes it.",
      },
      {
        target: button("Clear hold-up"),
        title: "Clear hold-up",
        body: "Once it is sorted. The discharge keeps its stage.",
      },
    ],
  },
  {
    id: "bed-ready",
    topic: "Beds and referrals",
    title: "Mark a cleaned bed ready",
    keywords: "bed ready cleaned prepared turnaround available again offer",
    answer:
      "Open the bed on the ward. While it is being prepared, the panel shows the cleaning step: press Ready once it can take a patient. It is offered again straight away and the bed shows as ready.",
    desks: ["ward", "bed_manager", "coordinator"],
    acts: ["SET_BED_PREPARATION"],
    go: ["wards", "home"],
    showMe: [
      {
        target: [{ sel: "[role='dialog'] button", text: "Ready" }, ...WARD_BED],
        title: "Ready",
        body: "Shows on a bed being prepared. Open the bed first.",
      },
      {
        target: [{ sel: '[data-testid="ward-drawer-cleaning-reminder"]' }, ...BED_PANEL],
        title: "Being prepared",
        body: "The panel says the bed is being prepared until someone marks it ready.",
      },
      {
        target: WARD_BED,
        title: "Ready on the board",
        body: "The bed then shows as ready and counts in the ward's ready beds.",
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
      "Open the movement and press Pull now. The ward is asked to pull the patient, and the button then reads Pull now sent, answer by, with the time. It also shows on the ward's banner. The ward still decides.",
    desks: ["coordinator"],
    acts: ["RAISE_PULL_NOW"],
    go: "movements",
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Its panel opens beside the list." },
      {
        target: MOVEMENT_DRAWER_OPEN,
        title: "The movement's panel",
        body: "Press the name to open its panel. On a phone, open the stage group first.",
      },
      { target: button("Pull now"), title: "Pull now", body: "Sends the ward the request." },
      {
        target: [{ sel: "[role='dialog']", text: "Pull now sent" }, { sel: '[data-testid="ward-broadcast-banner"]' }],
        title: "Answer by",
        body: "Then reads Pull now sent, answer by, with the time. The ward sees it on its banner.",
      },
    ],
  },
  {
    id: "ward-capacity-review",
    topic: "Beds and referrals",
    title: "Ask a ward to review its bed numbers from a movement",
    keywords: "buzz ward review check beds numbers nudge",
    answer:
      "Open the movement, then Additional workflow controls. Under Movement workflow actions, press Request ward capacity review. The ward is asked to review and confirm its capacity.",
    desks: ["coordinator", "bed_manager"],
    acts: ["SEND_WARD_BUZZ"],
    go: "movements",
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "The movement's page has its tools." },
      {
        target: { sel: '#main-content a[href^="/ward-flow/movements/"]' },
        device: "phone",
        title: "Choose the person",
        body: "Press their row in the open group. Their movement page opens.",
      },
      { target: WORKFLOW_CONTROLS, title: "Additional workflow controls", body: "Opens the less used tools." },
      {
        target: WORKFLOW_ACTIONS,
        title: "Movement workflow actions",
        body: "The movement's flags and requests, in one group.",
      },
      { target: button("Request ward capacity review"), title: "Request review", body: "Sends the ward the request." },
    ],
  },
  {
    id: "expectation-flag",
    topic: "Beds and referrals",
    title: "Raise or clear an expectation review flag",
    keywords: "expectation review flag voluntary involuntary raise clear",
    answer:
      "Open the movement, then Additional workflow controls. Under Movement workflow actions, press Raise expectation review flag to mark the movement for an expectation review. The same button then reads Clear expectation review flag.",
    desks: ["coordinator", "ward", "ed", "community"],
    acts: ["RAISE_EXPECT_FLAG", "CLEAR_EXPECT_FLAG"],
    go: ["movements", "home"],
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Choose it in the list. Its page holds these tools." },
      {
        target: { sel: '#main-content a[href^="/ward-flow/movements/"]' },
        device: "phone",
        title: "Choose the person",
        body: "Press their row in the open group. Their movement page opens.",
      },
      { target: WORKFLOW_CONTROLS, title: "Additional workflow controls", body: "On the movement's page." },
      {
        target: WORKFLOW_ACTIONS,
        title: "Movement workflow actions",
        body: "The flag sits at the top of this group.",
      },
      {
        target: [button("Raise expectation review flag"), button("Clear expectation review flag")],
        title: "The flag",
        body: "One button raises the flag or clears it. It names which it will do.",
      },
    ],
  },
  {
    id: "record-escalation",
    topic: "Beds and referrals",
    title: "Record an escalation when no bed is found",
    keywords: "escalate escalation no bed found exhausted search contact next manager",
    answer:
      "In the placement panel from Home, press Record escalation. Choose the role or service being contacted next and press Record escalation. Escalate also shows on an exhausted bed search alert. The escalation shows on the movement and in handover.",
    desks: ["coordinator"],
    acts: ["RECORD_ESCALATION"],
    go: "home",
    showMe: [
      {
        target: [{ sel: '[data-testid="ward-shortlist-escalation-toggle"]' }, { sel: '[data-testid="home-my-list"]' }],
        title: "Record escalation",
        body: "Choose the person from Needs you to open their placement panel. Update escalation records a further one.",
      },
      {
        target: { sel: '[data-testid="home-my-list"] button[aria-label^="Open "]' },
        title: "Choose the person",
        body: "Press their row in Needs you. Their placement panel opens, with each ward asked.",
      },
      {
        target: [
          { sel: '[data-testid="ward-shortlist-escalation-contact"]' },
          { sel: '[data-testid="ward-shortlist-escalation-toggle"]' },
        ],
        title: "Who is contacted next",
        body: "Press Record escalation in the panel, then choose the role or service being contacted next.",
      },
      {
        target: { sel: '[data-testid="ward-shortlist-escalation-submit"]' },
        title: "Save it",
        body: "Stays greyed until you choose who. The escalation shows on the movement and in handover.",
      },
      {
        target: { sel: '[data-testid="ward-shortlist-escalation-record"]' },
        title: "What was recorded",
        body: "The panel then shows the escalation. Earlier ones stay in the history.",
      },
    ],
  },
  {
    id: "withdraw-ward-request",
    topic: "Beds and referrals",
    title: "Withdraw a request to one ward",
    keywords: "withdraw request one ward take back cancel ask others stay",
    answer:
      "In the placement panel, press Withdraw this request? on that ward's request, choose a reason and press Withdraw request, which names the ward. Only that request ends; the movement and the other wards' requests stay. Undo shows straight after.",
    desks: ["coordinator"],
    acts: ["WITHDRAW_WARD_REQUEST"],
    go: "home",
    showMe: [
      {
        target: [{ sel: '[data-testid^="ward-shortlist-withdraw-toggle-"]' }, { sel: '[data-testid="home-my-list"]' }],
        title: "Withdraw this request?",
        body: "On each ward's request in the placement panel. Choose the person from Needs you to open it.",
      },
      {
        target: { sel: '[data-testid="home-my-list"] button[aria-label^="Open "]' },
        title: "Choose the person",
        body: "Press their row in Needs you. Their placement panel opens, with each ward asked.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-shortlist-withdraw-reason-"]' },
          { sel: '[data-testid^="ward-shortlist-withdraw-toggle-"]' },
        ],
        title: "Reason",
        body: "Press Withdraw this request? beside the ward, then choose why it is withdrawn.",
      },
      {
        target: { sel: '[data-testid^="ward-shortlist-withdraw-submit-"]' },
        title: "Confirm",
        body: "Names the ward. Needs a reason first. Undo shows straight after.",
      },
    ],
  },
  {
    id: "archive-patient",
    topic: "Finding your way",
    title: "Remove a patient record added in error",
    keywords: "archive delete remove wrong patient duplicate added in error mistake",
    answer:
      "Open the patient, then their Details tab, and find the Record added in error card. Choose why it should go, press Archive this record, then Archive record to confirm. The record leaves every list and only the audit trail shows it. Undo shows straight after.",
    desks: ["coordinator"],
    acts: ["ARCHIVE_PATIENT"],
    go: "search",
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-patient-archive-start"]' },
          { sel: '[data-testid="ward-global-search-input"]' },
          { sel: '[data-testid="ward-patient-typeahead-input"]' },
        ],
        title: "Archive this record",
        body: "For a record added in error only. Find the patient first; the card is on their page.",
      },
      {
        target: [{ sel: "#pntab-details" }, { sel: '[data-testid="ward-patient-archive"]' }],
        title: "Details",
        body: "On the patient's page, open the Details tab. The card is at its foot.",
      },
      {
        target: { sel: '[data-testid="ward-patient-archive"]' },
        title: "Record added in error",
        body: "Choose why it should go. If archive is not available, the card says why.",
      },
      {
        target: { sel: '[data-testid="ward-patient-archive-start"]' },
        title: "Archive this record",
        body: "Asks before it archives.",
      },
      {
        target: { sel: '[data-testid="ward-patient-archive-confirm"]' },
        title: "Archive record",
        body: "Archives it. The record leaves every list. Undo shows straight after.",
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
      "On Movements, press the name to open the movement's panel. Under Acceptance conditions, choose the condition in Add a condition, when the bed is offered from if asked, and who it was agreed with, then press Record condition. Press Mark met once it is done; the row then shows when and by which desk.",
    desks: ["coordinator", "ward"],
    acts: ["RECORD_ACCEPTANCE_CONDITION", "MARK_ACCEPTANCE_CONDITION_MET"],
    go: ["movements", "home"],
    showMe: [
      {
        target: MOVEMENT_ROW,
        title: "Find the movement",
        body: "Find the accepted movement in the list. The conditions are in its panel, not on its page.",
      },
      {
        target: MOVEMENT_DRAWER_OPEN,
        title: "The movement's panel",
        body: "Press the name to open its panel beside the list.",
      },
      {
        target: { sel: '[data-testid="acceptance-conditions"]' },
        title: "Acceptance conditions",
        body: "Shows once a ward has accepted. Each condition the ward attached is listed here.",
      },
      {
        target: { sel: '[data-testid="acceptance-condition-kind"]' },
        title: "Add a condition",
        body: "Choose the condition the ward set.",
      },
      {
        target: { sel: '[data-testid="acceptance-condition-after"]' },
        title: "Bed offered from",
        body: "Shows for a bed offered later. Choose when.",
      },
      {
        target: { sel: '[data-testid="acceptance-condition-agreed-with"]' },
        title: "Agreed with",
        body: "Choose who agreed it.",
      },
      {
        target: { sel: '[data-testid="acceptance-condition-add"]' },
        title: "Record condition",
        body: "Adds the condition to the list.",
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
      "On the ward's Referrals, tick what you need under Need before we can decide, then press Ask the referrer. The list then shows under Waiting on the referrer. The sending desk presses Provided against each item as it comes in.",
    desks: ["ward", "coordinator"],
    acts: ["REQUEST_REFERRAL_INFORMATION"],
    go: ["wards", "home"],
    showMe: [
      {
        target: [{ sel: '[data-testid^="ward-referral-needs-ask-"]' }, { sel: '[data-testid="ward-tab-referrals"]' }],
        title: "Ask the referrer",
        body: "Sends the ticked items to the desk that referred. It is under each referral on Referrals.",
      },
      {
        target: { sel: '[data-testid^="ward-referral-needs-"] fieldset' },
        title: "Need before we can decide",
        body: "Tick each item you need before you can decide.",
      },
      {
        target: { sel: '[data-testid^="ward-referral-needs-ask-"]' },
        title: "Ask the referrer",
        body: "Sends the ticked items.",
      },
      {
        target: { sel: '[data-testid^="ward-referral-needs-"]', text: "Waiting on the referrer" },
        title: "Waiting on the referrer",
        body: "The items asked for. Each moves to Provided by the referrer when it comes in.",
      },
    ],
  },
  ...CRAWL_JOBS_LATE,
];
