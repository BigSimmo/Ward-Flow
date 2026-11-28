/**
 * The later feature-crawl how-tos in `CRAWL_JOBS` (`ward-help-howto-more.ts`), in their own file to
 * stay under the line limit. Listed in the same order, so search finds them exactly as before.
 */
import type { HowTo } from "./ward-help-howto";
import {
  button,
  inDialog,
  MOVEMENT_ROW,
  MOVEMENT_DRAWER_OPEN,
  WORKFLOW_CONTROLS,
  WORKFLOW_ACTIONS,
  ED_ACTIONS,
  ED_PERSON,
  ED_SHEET,
  WARD_BED,
  REFERRAL_ROW,
  LEGAL_ROW,
  DISCHARGE_ROW,
  PATIENT_CHANGE_CARD,
} from "./ward-help-howto-more-targets";

export const CRAWL_JOBS_LATE: readonly HowTo[] = [
  {
    id: "provide-referral-information",
    topic: "Beds and referrals",
    title: "Answer a ward's request for more information",
    keywords: "ward needs information requested provided supply missing details referral",
    answer:
      "Open your referral. Information requested lists what the ward still needs. Once you have sent each item, press Provided beside it. Only the desk that sent the referral can do this. The ward then sees it under Provided by the referrer.",
    desks: ["ed", "community", "ward", "coordinator"],
    acts: ["MARK_REFERRAL_INFORMATION_MET"],
    go: ["referrals", "ed", "community", "home"],
    showMe: [
      {
        target: [{ sel: '[data-testid="ward-referral-needs-panel"]' }, ...REFERRAL_ROW],
        title: "Information requested",
        body: "What the ward asked for before it can decide. Open your referral to see it.",
      },
      {
        target: [
          { sel: "[role='tab']", text: "Timeline" },
          button("Written history and corrections"),
          button("Show timeline"),
        ],
        title: "Timeline",
        body: "If the list is not in view, it is on the Timeline tab. On a phone, press Show timeline.",
      },
      {
        target: button("Provided"),
        title: "Provided",
        body: "Marks one item as sent. Press it only once you have sent it.",
      },
      {
        target: { sel: '[data-testid="ward-referral-needs-panel"]' },
        title: "What is left",
        body: "Items still needed stay listed. The ward sees each one you mark.",
      },
    ],
  },
  {
    id: "referral-correction",
    topic: "Beds and referrals",
    title: "Correct or add to a referral already sent",
    keywords: "correct referral mistake wrong update addendum amend edit sent history note",
    answer:
      "Open the referral and go to Written history. Type the correction under Add a correction note and press Add a correction. Notes are added, never edited or removed, so Corrections shows both. Only the sending desk can add one.",
    desks: ["community", "ed", "ward", "coordinator"],
    acts: ["ADD_REFERRAL_CORRECTION"],
    go: ["referrals", "ed", "community", "home"],
    showMe: [
      {
        target: [{ sel: '[data-testid="ward-referral-add-correction"]' }, ...REFERRAL_ROW],
        title: "Add a correction",
        body: "Adds a dated note to the referral's history. Open the referral first.",
      },
      {
        target: [
          { sel: "[role='tab']", text: "Timeline" },
          button("Written history and corrections"),
          button("Show timeline"),
        ],
        title: "Timeline",
        body: "Written history and corrections are on the Timeline tab. On a phone, press Show timeline.",
      },
      {
        target: { sel: '[data-testid="ward-referral-history-text"]' },
        title: "Written history",
        body: "What was sent. It is never changed.",
      },
      {
        target: { sel: '[data-testid="ward-referral-correction-note"]' },
        title: "Add a correction note",
        body: "Type the correction. Name roles and facts, not opinions about the person.",
      },
      {
        target: { sel: '[data-testid="ward-referral-add-correction"]' },
        title: "Add a correction",
        body: "Greyed until you type a note.",
      },
      {
        target: [
          { sel: '[data-testid="ward-referral-corrections-list"]' },
          { sel: '[data-testid="ward-referral-corrections-empty"]' },
        ],
        title: "Corrections",
        body: "Each correction with its time and desk, under the history.",
      },
    ],
  },
  {
    id: "referrer-withdrawal",
    topic: "Beds and referrals",
    title: "Record that the referrer cancelled a referral",
    keywords: "referrer cancelled withdraw referral no longer needed cancel",
    answer:
      "On Referrals, open the referral and choose Record referrer cancellation, then Withdraw referral and Confirm withdrawal. Keep referral leaves it as it is. Every destination still waiting is marked withdrawn; answers already given stand.",
    desks: ["coordinator", "community", "ward"],
    acts: ["RECORD_REFERRER_WITHDRAWAL"],
    go: ["referrals", "community", "home"],
    showMe: [
      {
        target: [{ sel: '[data-testid="ward-referral-match-withdraw"]' }, ...REFERRAL_ROW],
        title: "Withdraw referral",
        body: "Open the referral first. It asks you to confirm before it withdraws.",
      },
      {
        target: { sel: '[data-testid="ward-referral-match-more-actions"] summary' },
        title: "Record referrer cancellation",
        body: "Opens the cancellation. Use it only when the referrer has cancelled.",
      },
      {
        target: { sel: '[data-testid="ward-referral-match-withdraw-recorder"]' },
        title: "Recorded by",
        body: "Choose who is recording the cancellation.",
      },
      {
        target: { sel: '[data-testid="ward-referral-match-withdraw"]' },
        title: "Withdraw referral",
        body: "Asks you to confirm.",
      },
      {
        target: { sel: '[data-testid="ward-referral-match-confirm-withdraw"]' },
        title: "Confirm withdrawal",
        body: "Withdraws every destination still waiting. Keep referral leaves it as it is.",
      },
    ],
  },
  {
    id: "change-urgency-legal-status",
    topic: "Beds and referrals",
    title: "Change a patient's urgency or legal status",
    keywords: "urgency tier change legal status voluntary involuntary update reason retier",
    answer:
      "Press Change urgency or Change legal status: in the placement panel, an ED row's actions, a ward bed or a community team's Sent tab. Choose the new tier or status, give a reason and press Record urgency change or Record legal status change. The history shows the old and new.",
    desks: ["coordinator", "ed", "ward", "community"],
    acts: ["CHANGE_URGENCY", "CHANGE_LEGAL_STATUS"],
    go: ["home", "ed"],
    showMe: [
      {
        target: [
          { sel: '[data-testid^="ward-change-urgency-toggle"]' },
          { sel: '[data-testid="sent-journey-urgency-toggle"]' },
          ...ED_ACTIONS,
          { sel: '[data-testid="home-my-list"]' },
        ],
        title: "Change urgency",
        body: "In the person's placement panel, or in the row's actions on the ED board.",
      },
      {
        target: [{ sel: '[data-testid="home-my-list"] button[aria-label^="Open "]' }, ...ED_ACTIONS],
        title: "Choose the person",
        body: "Press their row in Needs you, or their row's actions on the ED board. Then press Change urgency.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-change-urgency-tier-"]' },
          { sel: '[data-testid="sent-journey-urgency"] select' },
          { sel: '[data-testid^="ward-change-urgency-toggle"]' },
        ],
        title: "The new tier",
        body: "Press Change urgency, then choose the urgency tier now.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-change-urgency-reason-"]' },
          { sel: '[data-testid="sent-journey-urgency"]' },
        ],
        title: "Reason",
        body: "Choose why it changed, then press Record urgency change.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-change-legal-status-toggle"]' },
          { sel: '[data-testid="sent-journey-legal-status-toggle"]' },
        ],
        title: "Change legal status",
        body: "Record what the paperwork says.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-change-legal-status-value-"]' },
          { sel: '[data-testid="sent-journey-legal-status"] select' },
        ],
        title: "The status on the paperwork",
        body: "Choose the legal status as written, and a reason. Then press Record legal status change.",
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
      "Open the movement, choose why it is urgent and press Flag this patient as urgent. It then leads the queue ahead of every tier. Remove the urgent flag puts it back in order by tier, then wait.",
    desks: ["coordinator", "ed"],
    acts: ["FLAG_MOVEMENT_URGENT", "CLEAR_MOVEMENT_URGENT_FLAG"],
    go: "movements",
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "The flag is in its drawer and on its page." },
      {
        target: MOVEMENT_DRAWER_OPEN,
        title: "The movement's panel",
        body: "Press the name to open its panel beside the list.",
      },
      {
        target: [
          { sel: '[data-testid="ward-movement-drawer-urgent-toggle"]' },
          { sel: '[data-testid="ward-console-urgent-flag-toggle"]' },
        ],
        title: "Urgent flag",
        body: "Needs a reason. The same control removes it.",
      },
      {
        target: [
          { sel: '[data-testid="ward-movement-drawer-urgent-reason"]' },
          { sel: '[data-testid="ward-console-urgent-flag-reason"]' },
        ],
        title: "Why it is urgent",
        body: "Choose the reason. Flag this patient as urgent stays greyed until you do.",
      },
      {
        target: [
          { sel: '[data-testid="ward-movement-drawer-urgent-toggle"]' },
          { sel: '[data-testid="ward-console-urgent-flag-toggle"]' },
        ],
        title: "Flag this patient as urgent",
        body: "It then says Flagged urgent and leads the queue. Remove the urgent flag takes it off.",
      },
    ],
  },
  {
    id: "movement-hold-up",
    topic: "Beds and referrals",
    title: "Record what is holding up a movement",
    keywords: "movement held up delay blocker waiting clean room record it clear",
    answer:
      "On the movement's page, open Additional workflow controls. Type what is holding it up under What is holding this up and press Record it. Name wards, roles and jobs only, never patient details. Press Clear when nothing is holding it up.",
    desks: ["ed", "community", "ward", "coordinator", "officer"],
    acts: ["RECORD_MOVEMENT_BLOCKER", "CLEAR_MOVEMENT_BLOCKER"],
    go: ["movements", "home"],
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Choose it in the list. Its page holds these tools." },
      {
        target: { sel: '#main-content a[href^="/bedchart/movements/"]' },
        device: "phone",
        title: "Choose the person",
        body: "Press their row in the open group. Their movement page opens.",
      },
      {
        target: WORKFLOW_CONTROLS,
        title: "Additional workflow controls",
        body: "Opens the hold-ups, urgency and transport tools.",
      },
      {
        target: { sel: '[data-testid="ward-patient-blocker"]' },
        title: "What is holding this up",
        body: "Says what is recorded now, if anything.",
      },
      {
        target: { sel: '[data-testid="ward-console-blocker-input"]' },
        title: "Type the hold-up",
        body: "A short note, such as Awaiting single-room clean.",
      },
      {
        target: { sel: '[data-testid="ward-patient-blocker"] button', text: "Record it" },
        title: "Record it",
        body: "Saves the note. It shows on the movement and in handover.",
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
      "On the movement's page, open Additional workflow controls, then Withdraw the ward's acceptance. Choose a reason and press Withdraw acceptance. The ward is told it no longer stands, a pulled bed is released and the movement goes back to Destination review.",
    desks: ["coordinator"],
    acts: ["WITHDRAW_ACCEPTANCE"],
    go: "movements",
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "The page holds the less common steps." },
      {
        target: { sel: '#main-content a[href^="/bedchart/movements/"]' },
        device: "phone",
        title: "Choose the person",
        body: "Press their row in the open group. Their movement page opens.",
      },
      { target: WORKFLOW_CONTROLS, title: "Additional workflow controls", body: "Opens the less common steps." },
      {
        target: { sel: '[data-testid="ward-patient-withdraw-acceptance"]' },
        title: "Withdraw the ward's acceptance",
        body: "Says whether a pulled bed will be released. Cancel transport first if it is booked.",
      },
      {
        target: { sel: '[data-testid="ward-console-withdraw-reason"]' },
        title: "Reason",
        body: "Choose why the acceptance no longer stands.",
      },
      {
        target: { sel: '[data-testid="ward-console-withdraw-acceptance"]' },
        title: "Withdraw acceptance",
        body: "Names the patient. Greyed until you choose a reason. The movement goes back to Destination review.",
      },
    ],
  },
  {
    id: "step-back-stage",
    topic: "Beds and referrals",
    title: "Correct a stage recorded by mistake",
    keywords: "wrong stage step back correct record mistake earlier stage",
    answer:
      "On the movement's page, open Additional workflow controls, then Correct the recorded stage. Choose the stage to go back to and a reason, then press Correct the record. It corrects the record only; nobody moves.",
    desks: ["coordinator"],
    acts: ["STEP_BACK_STAGE"],
    go: "movements",
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Choose it in the list. Its page holds these tools." },
      {
        target: { sel: '#main-content a[href^="/bedchart/movements/"]' },
        device: "phone",
        title: "Choose the person",
        body: "Press their row in the open group. Their movement page opens.",
      },
      { target: WORKFLOW_CONTROLS, title: "Additional workflow controls", body: "Opens the less common steps." },
      {
        target: { sel: '[data-testid="ward-patient-step-back-stage"]' },
        title: "Correct the recorded stage",
        body: "The history keeps both the mistake and the correction.",
      },
      {
        target: { sel: '[data-testid="ward-console-step-back-to"]' },
        title: "Stage to go back to",
        body: "Choose the stage that should have been recorded.",
      },
      {
        target: { sel: '[data-testid="ward-console-step-back-reason"]' },
        title: "Reason",
        body: "Choose why it is corrected.",
      },
      {
        target: { sel: '[data-testid="ward-console-step-back-stage"]' },
        title: "Correct the record",
        body: "Greyed until both are chosen. If a bed is still pulled, release it separately.",
      },
    ],
  },
  {
    id: "stop-transport",
    topic: "Transport",
    title: "Stop transport after the patient is collected",
    keywords: "stop transport collected turn back divert abandon where are they now",
    answer:
      "On the movement's page, open Additional workflow controls. Under Stop transport, choose a reason and where the patient is now, then press Stop transport. The officer is told; the bed stays pulled until someone releases it.",
    desks: ["coordinator", "ed"],
    acts: ["STOP_TRANSPORT"],
    go: ["movements", "ed"],
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Choose it in the list. Its page holds these tools." },
      {
        target: { sel: '#main-content a[href^="/bedchart/movements/"]' },
        device: "phone",
        title: "Choose the person",
        body: "Press their row in the open group. Their movement page opens.",
      },
      { target: WORKFLOW_CONTROLS, title: "Additional workflow controls", body: "Transport exceptions are here." },
      {
        target: { sel: '[data-testid="ward-patient-stop-transport"]' },
        title: "Stop transport",
        body: "Only once the patient is collected. Before that, cancel transport instead.",
      },
      {
        target: { sel: '[data-testid="ward-console-stop-transport-reason"]' },
        title: "Reason",
        body: "Choose why transport is stopped.",
      },
      {
        target: { sel: '[data-testid="ward-console-stop-transport-whereabouts"]' },
        title: "Where they are now",
        body: "Choose where the patient is.",
      },
      {
        target: { sel: '[data-testid="ward-console-stop-transport"]' },
        title: "Stop transport",
        body: "Greyed until both are chosen. The officer is told; the bed stays pulled.",
      },
    ],
  },
  {
    id: "support-notifications",
    topic: "Handover and reports",
    title: "Record that the carer, PSP or MHAS were told",
    keywords: "carer personal support person psp mhas advocacy notification told informed",
    answer:
      "Open the Carer, PSP and MHAS panel on the movement, a discharge or Legal forms. Press Record on a row, choose the outcome, who was told and when, then Save. The panel counts how many of the three are done. It is a reminder, not a legal check.",
    desks: ["ward", "coordinator"],
    acts: ["RECORD_SUPPORT_NOTIFICATION"],
    go: ["movements", "legal-forms", "home"],
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Choose it in the list. Its page holds these tools." },
      {
        target: { sel: '#main-content a[href^="/bedchart/movements/"]' },
        device: "phone",
        title: "Choose the person",
        body: "Press their row in the open group. Their movement page opens.",
      },
      {
        target: { sel: '[data-testid="ward-support-notifications"]' },
        title: "Carer, PSP and MHAS",
        body: "One row each. Record or Change opens the short form.",
      },
      {
        target: { sel: '[data-testid="ward-support-notifications"] button', text: "Record" },
        title: "Record",
        body: "Opens the form for that row. Change edits one already recorded.",
      },
      {
        target: { sel: '[data-testid="ward-support-notifications"] form' },
        title: "Outcome, who and when",
        body: "Choose Told or Not applicable. For Told, name who was told and the day and time.",
      },
      {
        target: { sel: '[data-testid="ward-support-notifications"] button', text: "Save" },
        title: "Save",
        body: "The row then shows the outcome. The panel counts how many of the three are done.",
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
      "On Legal forms, choose the form, type the time received as on the form if known, and press Mark Form received; it names the form, such as Form 1A. The ED board has the same in a row's actions. To fix a receipt, press Correct receipt on the ED row, choose a reason and Save correction. Undo shows straight after marking.",
    desks: ["ed", "ward", "community", "coordinator"],
    acts: ["RECORD_LEGAL_FORM_RECEIVED", "CORRECT_LEGAL_FORM_RECEIPT"],
    go: ["legal-forms", "ed"],
    showMe: [
      {
        target: [
          { sel: '[data-testid^="ward-legal-forms-mark-received-"]' },
          { sel: '[data-testid^="ed-mark-form-received-"]' },
          ...LEGAL_ROW,
          ...ED_ACTIONS,
        ],
        title: "Mark received",
        body: "Records that the form is in hand, with the time. Choose the form first.",
      },
      {
        target: { sel: '[data-testid="ward-legal-selected"]' },
        title: "The chosen form",
        body: "The form, where the person is, and its next step.",
      },
      {
        target: { sel: '[data-testid^="ward-legal-forms-received-time-"]' },
        title: "Time received",
        body: "Type the time as written on the form. Leave it blank to record now.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-legal-forms-mark-received-"]' },
          { sel: '[data-testid^="ed-mark-form-received-"]' },
        ],
        title: "Mark Form received",
        body: "Names the form, such as Mark Form 1A received. Records the receipt; Undo shows straight after.",
      },
      {
        target: { sel: '[data-testid^="ed-correct-form-receipt-toggle-"]' },
        title: "Correct receipt",
        body: "On the ED board, in the row's actions once a form is marked received.",
      },
      {
        target: { sel: '[data-testid^="ed-correct-form-receipt-reason-"]' },
        title: "Reason for correction",
        body: "Choose why, then press Save correction.",
      },
    ],
  },
  {
    id: "legal-form-expiry",
    topic: "Handover and reports",
    title: "Record a legal form's expiry or extension",
    keywords: "form expiry expires end time extension extend renew legal form",
    answer:
      "On Legal forms, choose the form, press Extend recorded form, type the new expiry date and time and press Confirm extension. On the ED board, use Record expiry from the form or Record an extension, then Save. Type the time exactly as the form states it. The app never works it out.",
    desks: ["ed", "coordinator", "ward"],
    acts: ["RECORD_LEGAL_FORM_EXPIRY"],
    go: ["legal-forms", "ed"],
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-legal-forms-renew-confirm"]' },
          { sel: '[data-testid^="ward-ed-legal-form-expiry-save-"]' },
          ...LEGAL_ROW,
          ...ED_ACTIONS,
        ],
        title: "Save the time",
        body: "The time from the form. Choose the form first.",
      },
      {
        target: [button("Extend recorded form"), { sel: '[data-testid^="ward-ed-legal-form-expiry-toggle-"]' }],
        title: "Extend or record expiry",
        body: "On Legal forms, Extend recorded form. On the ED board, Record expiry from the form or Record an extension.",
      },
      {
        target: [
          { sel: '[data-testid="ward-legal-forms-renew-date"]' },
          { sel: '[data-testid^="ward-ed-legal-form-expiry-date-"]' },
        ],
        title: "Date",
        body: "The date written on the form.",
      },
      {
        target: [
          { sel: '[data-testid="ward-legal-forms-renew-expiry"]' },
          { sel: '[data-testid^="ward-ed-legal-form-expiry-time-"]' },
        ],
        title: "Time",
        body: "The time written on the form, exactly as it states it.",
      },
      {
        target: [
          { sel: '[data-testid="ward-legal-forms-renew-confirm"]' },
          { sel: '[data-testid^="ward-ed-legal-form-expiry-save-"]' },
        ],
        title: "Save",
        body: "Confirm extension, or Save expiry or Save extension on the ED board. The row then shows the typed time.",
      },
    ],
  },
  {
    id: "legal-mismatch",
    topic: "Handover and reports",
    title: "Flag that the legal form does not match the ward",
    keywords: "legal mismatch wrong ward form placement does not match authorised flag",
    answer:
      "On the movement's page, open Additional workflow controls. Under Movement workflow actions, press Flag current legal placement mismatch. It flags the movement for review; it does not judge the paperwork.",
    desks: ["ward", "coordinator"],
    acts: ["FLAG_LEGAL_MISMATCH"],
    go: ["movements", "home"],
    showMe: [
      { target: MOVEMENT_ROW, title: "Open the movement", body: "Choose it in the list. Its page holds these tools." },
      {
        target: { sel: '#main-content a[href^="/bedchart/movements/"]' },
        device: "phone",
        title: "Choose the person",
        body: "Press their row in the open group. Their movement page opens.",
      },
      { target: WORKFLOW_CONTROLS, title: "Additional workflow controls", body: "The less used tools." },
      {
        target: WORKFLOW_ACTIONS,
        title: "Movement workflow actions",
        body: "The movement's flags and requests.",
      },
      {
        target: button("Flag current legal placement mismatch"),
        title: "Flag mismatch",
        body: "Raises it for review. A person checks the paperwork.",
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
      "Open the patient. On Record a change, press Start leave, choose the kind of leave and when they are expected back, then Record leave; the bed is kept. Press Record return when they are back. If they do not come back, press Mark absent, then Confirm. Undo shows straight after.",
    desks: ["ward", "coordinator"],
    acts: ["RECORD_LEAVE_BED", "END_LEAVE_BED", "RECORD_ABSENT_WITHOUT_LEAVE"],
    go: ["wards", "home"],
    showMe: [
      {
        target: [PATIENT_CHANGE_CARD, ...WARD_BED],
        title: "Record a change",
        body: "Leave, Gone to ED and the discharge date sit here, on the patient's page.",
      },
      {
        target: [
          { sel: '[data-testid="ward-patient-change-card"] button', text: "Start leave" },
          button("Record return"),
        ],
        title: "Start or end leave",
        body: "The bed is held while they are away.",
      },
      {
        target: { sel: '[aria-label="Kind of leave"]' },
        title: "Kind of leave",
        body: "Choose the kind of leave. The authority on record shows above it.",
      },
      {
        target: [{ sel: "button", text: "Tomorrow 10:00" }, { sel: '[data-testid="ward-patient-change-card"] input' }],
        title: "Expected back",
        body: "Choose a time, or type the day and time they are expected back.",
      },
      {
        target: button("Record leave"),
        title: "Record leave",
        body: "Waits until both are chosen. Undo shows straight after.",
      },
      {
        target: [button("Record return"), button("Mark absent")],
        title: "Back, or absent",
        body: "Record return when they are back. Mark absent if they have not come back.",
      },
    ],
  },
  {
    id: "patient-gone-to-ed",
    topic: "Beds and referrals",
    title: "Record that a patient went to an ED and came back",
    keywords: "gone to ed emergency department medical transfer away back returned",
    answer:
      "Open the patient and press Gone to ED, or Gone to an ED on the bed board, and confirm if asked. The bed stays theirs while they are away and shows At an ED. When they are back, press Record return.",
    desks: ["ward", "coordinator"],
    acts: ["RECORD_AWAY_AT_EMERGENCY_DEPARTMENT", "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT"],
    go: ["wards", "home"],
    showMe: [
      {
        target: [{ sel: '[data-testid="ward-board-record-away-submit"]' }, button("Gone to ED"), ...WARD_BED],
        title: "Gone to ED",
        body: "Keeps the bed while they are away. Open the patient or their bed first.",
      },
      {
        target: inDialog("Confirm"),
        title: "Confirm",
        body: "The bed board may ask first. The trip does not free the bed.",
      },
      {
        target: [{ sel: '[data-testid="ward-board-away-at-ed"]' }, ...WARD_BED],
        title: "At an ED",
        body: "The bed then shows At an ED, still held for them.",
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
      "Open the patient's bed and press Move to another bed. Tap the new bed and press Move to bed. Choose another bed goes back a step. Undo puts the bed and the person back where they were.",
    desks: ["ward", "coordinator"],
    acts: ["PLACE_IN_BED"],
    go: ["wards", "home"],
    showMe: [
      {
        target: [button("Move to another bed"), ...WARD_BED],
        title: "Move to another bed",
        body: "Picks the patient up on the bed board. Open their bed first.",
      },
      {
        // The whole plan, so the beds stay tappable while this step is lit.
        target: [{ sel: '[data-testid="ward-bed-board-plan"]' }, { sel: '[data-testid="ward-board-say"]' }],
        title: "Choose the new bed",
        body: "Tap the new bed. The line above the beds says what to do next.",
      },
      {
        target: { sel: '[data-testid="ward-board-confirm"]' },
        title: "Check the bed",
        body: "Says which bed and anything to check. Choose another bed goes back.",
      },
      {
        target: { sel: '[data-testid="ward-board-confirm-send"]' },
        title: "Move to bed",
        body: "Confirms the new bed. Undo shows straight after.",
      },
    ],
  },
  {
    id: "observation-level",
    topic: "Beds and referrals",
    title: "Record a change in observation level",
    keywords: "observation level obs check every review change frequency",
    answer:
      "Open the bed on the ward, or the person on the ED board, and press Change observation level. Choose the level, how often checks are due and the review day and time, then Record level. The app records the plan; clinicians set it.",
    desks: ["ward", "ed", "coordinator"],
    acts: ["RECORD_OBSERVATION_LEVEL"],
    go: ["wards", "ed", "home"],
    showMe: [
      {
        target: [{ sel: '[data-testid="ward-observation-change"]' }, ...WARD_BED, ...ED_PERSON],
        title: "Change observation level",
        body: "Opens a short form. Open the bed or person first.",
      },
      {
        target: { sel: '[data-testid="ward-observation-change"]' },
        title: "In their panel",
        body: "Press Change observation level in the bed's or person's panel.",
      },
      {
        target: { sel: '[data-testid="ward-observation-current"]' },
        title: "Recorded now",
        body: "The level, check interval and review time on record.",
      },
      {
        target: { sel: '[data-testid="ward-observation-level"]' },
        title: "Observation level",
        body: "Choose the level the clinician set.",
      },
      {
        target: { sel: '[data-testid="ward-observation-interval"]' },
        title: "Check every",
        body: "How often checks are due.",
      },
      {
        target: { sel: '[data-testid="ward-observation-review-time"]' },
        title: "Review",
        body: "The day and time it is next reviewed.",
      },
      {
        target: { sel: '[data-testid="ward-observation-save"]' },
        title: "Record level",
        body: "Saves it with the time. The new level shows on the bed.",
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
      "On the bed board, choose the bed and press Move the date, set the day and time, then Save departure date. On the ward's home, open the bed and press Change discharge date, then Save date. The new date shows on the bed and on Discharges.",
    desks: ["ward", "coordinator"],
    acts: ["UPDATE_EXPECTED_DISCHARGE"],
    go: ["wards", "home"],
    showMe: [
      {
        target: [button("Move the date"), ...WARD_BED],
        title: "Move the date",
        body: "On the chosen bed's panel. Open the bed first.",
      },
      {
        target: [
          { sel: '[data-testid="bed-telemetry-drawer"] [role="tab"]', text: "Leaving" },
          { sel: "#ward-board-date-edit" },
        ],
        device: "desk",
        title: "Leaving",
        body: "On the ward's home, the bed's Leaving tab holds the expected date.",
      },
      {
        target: [
          { sel: "#ward-board-date-edit" },
          { sel: '[data-testid="ward-drawer-discharge-date"]' },
          { sel: '[data-testid="ward-drawer-discharge-date-open"]' },
        ],
        title: "The new date",
        body: "On the ward's home, the bed's panel has Change discharge date instead. It opens the same day and time.",
      },
      {
        target: [
          { sel: '#ward-board-date-edit [aria-label="Discharge day"]' },
          { sel: '[data-testid="ward-drawer-discharge-date"]' },
        ],
        title: "Discharge day",
        body: "Keep the recorded day, or choose today or tomorrow.",
      },
      {
        target: [
          { sel: '#ward-board-date-edit [aria-label="Expected discharge time"]' },
          { sel: '[data-testid="ward-drawer-discharge-date"]' },
        ],
        title: "Expected discharge time",
        body: "Type the time they are expected to leave.",
      },
      {
        target: [
          { sel: "#ward-board-date-edit button", text: "Save departure date" },
          { sel: '[data-testid="ward-drawer-discharge-date"] button', text: "Save date" },
        ],
        title: "Save departure date",
        body: "Saves it; on the ward's home the button reads Save date. Cancel leaves the date as it was.",
      },
    ],
  },
  {
    id: "record-discharge",
    topic: "Beds and referrals",
    title: "Record that a patient has left the ward",
    keywords: "discharged left gone home departure record discharge leaving",
    answer:
      "On the bed board, choose the bed, say where they are going and press Record discharge. On Discharges, open the discharge and press Record discharge. The bed is then free for the ward to prepare. Undo shows straight after.",
    desks: ["ward", "coordinator"],
    acts: ["RECORD_PATIENT_DISCHARGE", "RECORD_LEAVING"],
    go: ["discharges", "wards", "home"],
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-board-record-leaving-submit"]' },
          { sel: '[data-testid="ward-discharge-record-departure"]' },
          ...DISCHARGE_ROW,
        ],
        title: "Record the departure",
        body: "Undo shows straight after. Open the discharge or bed first.",
      },
      {
        target: [
          { sel: "#ward-board-leaving-destination" },
          { sel: '[data-testid="ward-discharge-departure-destination"]' },
          { sel: '[data-testid="ward-board-record-leaving"]' },
        ],
        title: "Where they are going",
        body: "Choose where they are going. Nothing is recorded until a person chooses it.",
      },
      {
        target: { sel: '[data-testid="ward-discharge-departure-transport"]' },
        title: "Has their transport come?",
        body: "On Discharges, answer whether their transport has come.",
      },
      {
        target: [
          { sel: '[data-testid="ward-board-record-leaving-submit"]' },
          { sel: '[data-testid="ward-discharge-record-departure"]' },
        ],
        title: "Record discharge",
        body: "Greyed until the destination is chosen. It may ask you to confirm.",
      },
      {
        target: inDialog("Confirm"),
        title: "Confirm",
        body: "Check the name, then confirm. If transport is still coming, it says so.",
      },
    ],
  },
  {
    id: "discharge-arrangements",
    topic: "Beds and referrals",
    title: "Track the arrangements a discharge needs",
    keywords: "discharge arrangements outstanding follow up appointment medication accommodation owner checklist",
    answer:
      "On Discharges, open the discharge; on a computer, choose its Held up tab. Under Discharge arrangements, choose the arrangement and who owns it, then Add as outstanding. Mark each one done, Not needed or Reconfirm as it moves. Nothing here frees the bed.",
    desks: ["ward", "coordinator"],
    acts: ["RECORD_DISCHARGE_DEPENDENCY"],
    go: "discharges",
    showMe: [
      {
        target: [{ sel: '[data-testid="ward-discharge-dependency-add"]' }, ...DISCHARGE_ROW],
        title: "Add as outstanding",
        body: "Practical arrangements only, each with an owner. Open the discharge first.",
      },
      {
        target: { sel: "[role='tab']", text: "Held up" },
        device: "desk",
        title: "Held up",
        body: "On a computer, the arrangements are on the discharge's Held up tab.",
      },
      {
        target: { sel: '[data-testid="ward-discharge-dependencies"]' },
        title: "Discharge arrangements",
        body: "Each arrangement, who owns it and where it is up to.",
      },
      {
        target: { sel: '[aria-label="Arrangement to add"]' },
        title: "Arrangement to add",
        body: "Choose the arrangement, such as a follow-up appointment.",
      },
      {
        target: { sel: '[aria-label="Who owns it"]' },
        title: "Who owns it",
        body: "Choose who is arranging it.",
      },
      {
        target: { sel: '[data-testid="ward-discharge-dependency-add"]' },
        title: "Add as outstanding",
        body: "Adds it to the list as outstanding.",
      },
      {
        target: { sel: '[data-testid^="ward-discharge-dependency-"] button', text: "Mark done" },
        title: "Mark done or Not needed",
        body: "As each one moves. The summary counts what is still outstanding.",
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
        target: [
          { sel: '[data-testid="ward-board-stepdown-toggle"]' },
          { sel: '[data-testid^="ward-board-bed-"]' },
          { sel: '[data-testid^="ward-bed-card-"]' },
          { sel: '[data-testid="ward-open-bed-board"]' },
        ],
        title: "Mark for step-down",
        body: "On the bed board's bed panel; the same button clears it. On the ward's home, press Place or move first.",
      },
      {
        target: [{ sel: '[data-testid^="ward-board-bed-"]' }, { sel: '[data-testid^="ward-bed-card-"]' }],
        title: "Choose the bed",
        body: "Press the bed on the board. Its panel opens with the bed's actions.",
      },
      {
        target: { sel: '[data-testid="ward-board-stepdown-toggle"]' },
        title: "Mark for step-down",
        body: "Marks the person as a step-down candidate, for planning only.",
      },
      {
        target: { sel: '[data-testid="ward-board-stepdown-container"]' },
        title: "Marked for step-down",
        body: "Then reads Marked for step-down. A step-down ward can be asked from here too.",
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
      "Press Set arrival plan on the ED row or referral, or Set arrival time on the patient page. Fill in Update arrival time & transport: how they are travelling, the CAD or tracking number and the estimated time of arrival, then press Save arrival plan. The receiving ward sees it.",
    desks: ["coordinator", "ed", "ward", "community"],
    acts: ["SET_ARRIVAL_DETAILS"],
    go: ["ed", "home"],
    showMe: [
      {
        target: [
          { sel: '[data-testid^="ward-ed-arrival-plan-toggle-"]' },
          { sel: '[data-testid="save-arrival-plan-button"]' },
          ...ED_ACTIONS,
        ],
        title: "Arrival plan",
        body: "Time and transport, saved together. On the ED board it is in the row's actions.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-ed-arrival-plan-toggle-"]' },
          { sel: "[aria-modal='true'] label", text: "How they are travelling" },
        ],
        title: "Set arrival plan",
        body: "In the row's actions. It opens Update arrival time & transport.",
      },
      {
        target: { sel: "[aria-modal='true'] label", text: "How they are travelling" },
        title: "How they are travelling",
        body: "Choose how they are travelling. A booked job fills this in from the transport booking.",
      },
      {
        target: { sel: "[aria-modal='true'] label", text: "CAD or tracking number" },
        title: "CAD or tracking number",
        body: "The job's number, if there is one.",
      },
      {
        target: { sel: "[aria-modal='true'] fieldset" },
        title: "Estimated time of arrival",
        body: "Type the time, such as 14:40, and choose today or tomorrow.",
      },
      {
        target: { sel: '[data-testid="save-arrival-plan-button"]' },
        title: "Save arrival plan",
        body: "The receiving ward sees the plan. The button then reads Edit arrival plan.",
      },
    ],
  },
  {
    id: "ed-arrival-checks",
    topic: "Beds and referrals",
    title: "Record the arrival checks for the receiving ward",
    keywords: "arrival checklist contraband search medication chart checks done",
    answer:
      "Open the person on the ED board. Once a ward has accepted, the Arrival checklist shows how many checks are recorded, each Done or Outstanding. Press Record done for each; Take back undoes one.",
    desks: ["ed", "coordinator"],
    acts: ["RECORD_ARRIVAL_CHECK"],
    go: "ed",
    showMe: [
      {
        target: [{ sel: '[data-testid="ward-ed-admission-checklist"]' }, ...ED_PERSON],
        title: "Arrival checklist",
        body: "The checks the receiving ward needs. Open the person first.",
      },
      {
        target: { sel: '[data-testid="ward-ed-admission-checklist"] li' },
        title: "Each check",
        body: "Says Done or Outstanding, with what is recorded.",
      },
      {
        target: { sel: '[data-testid="ward-ed-admission-checklist"] button', text: "Record done" },
        title: "Record done",
        body: "Records one check. The count at the top goes up.",
      },
      {
        target: { sel: '[data-testid="ward-ed-admission-checklist"] button', text: "Take back" },
        title: "Take back",
        body: "Undoes a check recorded by mistake.",
      },
    ],
  },
  {
    id: "ed-no-transport",
    topic: "Transport",
    title: "Record that no transport is needed",
    keywords: "no transport needed walk own way family driving",
    answer:
      "On the ED board, open the row's actions and press Record no transport needed. The transport step is then skipped for this patient, and the ward records the arrival.",
    desks: ["ed"],
    acts: ["RECORD_TRANSPORT_NEED"],
    go: "ed",
    showMe: [
      {
        target: [{ sel: '[data-testid^="ward-ed-no-transport-needed-"]' }, ...ED_ACTIONS],
        title: "No transport needed",
        body: "Clears the transport step for this patient. It is in the row's actions.",
      },
      {
        target: { sel: '[data-testid^="ward-ed-no-transport-needed-"]' },
        title: "Record no transport needed",
        body: "Shows only while no transport is booked.",
      },
      {
        target: [{ sel: '[data-testid^="ward-ed-referral-"]' }, ED_SHEET],
        title: "Where it shows",
        body: "The row no longer asks for transport. Change on the badge records that it is needed after all.",
      },
    ],
  },
  {
    id: "ed-medical-deterioration",
    topic: "Beds and referrals",
    title: "Record a medical deterioration after clearance",
    keywords: "medically unwell deteriorated not cleared anymore release reservation pause placement",
    answer:
      "Open the person on the ED board and press Record medical deterioration, then Confirm deterioration and release reservation. It cancels the allocation, releases the bed, cancels transport not yet collected and pauses placement until cleared again.",
    desks: ["ed", "coordinator"],
    acts: ["RECORD_ED_MEDICAL_DETERIORATION"],
    go: "ed",
    showMe: [
      {
        target: [{ sel: '[data-testid^="ward-ed-medical-placement-"]' }, ...ED_PERSON],
        title: "Medical clearance and placement",
        body: "Record medical deterioration is here. Open the person first. It asks first.",
      },
      {
        target: { sel: '[data-testid^="ward-ed-medical-placement-"] button', text: "Record medical deterioration" },
        title: "Record medical deterioration",
        body: "Shows once a bed is allocated and the person is not yet collected.",
      },
      {
        target: { sel: '[data-testid^="ward-ed-medical-placement-"] fieldset' },
        title: "Read what it does",
        body: "Lists what will be cancelled and released before you confirm.",
      },
      {
        target: { sel: '[data-testid^="ward-ed-medical-placement-"] button', text: "Confirm deterioration" },
        title: "Confirm",
        body: "Records it. Cancel leaves everything as it was. Record medically cleared once a clinician clears them again.",
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
      "Open Seclusion and restraint. Under In use now, press Record end on the live episode, type the time it ended and press Save end time. The episode then leaves In use now.",
    desks: ["ward", "coordinator"],
    acts: ["RECORD_RESTRICTIVE_PRACTICE_END"],
    go: "seclusion",
    showMe: [
      {
        target: [{ sel: '[data-testid="seclusion-end-open"]' }, { sel: '[data-testid="seclusion-forms-view"]' }],
        title: "Record end",
        body: "Ends the live episode with the time you type.",
      },
      {
        target: { sel: '[data-testid="seclusion-live"]' },
        title: "In use now",
        body: "Each live episode, with who, where and when it started.",
      },
      {
        target: { sel: '[data-testid="seclusion-end-time"]' },
        title: "Ended at",
        body: "Type the time it ended, as recorded.",
      },
      {
        target: { sel: '[data-testid="seclusion-end-dialog"] button', text: "Save end time" },
        title: "Save end time",
        body: "Records the end. The episode leaves In use now.",
      },
    ],
  },
];
