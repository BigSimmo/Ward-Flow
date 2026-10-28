/** Optional, short teaching topics. No commands, records or provider calls live here.
 * Route grants come from ROLE_SCREENS; the destination's own scope/action gates still apply.
 * Home's proposed My List/Waiting/Watch tabs are intentionally not described as current screens. */
import { ROLE_SCREENS, screenForPath } from "../ward-role-access";
import { DOWNTIME_PACK_HREF } from "../reports/report-routes";
import type { TourRole, TourStep } from "./ward-tour-steps";

export type TourTopic = "orientation" | "workflows" | "safe-use";
export const TOUR_TOPICS: readonly { id: TourTopic; label: string }[] = [
  { id: "orientation", label: "Your desk" },
  { id: "workflows", label: "Daily workflows" },
  { id: "safe-use", label: "Safe use and recovery" },
];

export function topicForTourStep(id: string | undefined): TourTopic {
  return id?.startsWith("workflow-") ? "workflows" : id?.startsWith("safe-") ? "safe-use" : "orientation";
}

const DESTINATIONS = {
  referrals: { label: "Open Referrals", href: "/ward-flow/referrals" },
  movements: { label: "Open Movements", href: "/ward-flow/movements" },
  waiting: { label: "Open Waiting", href: "/ward-flow/waiting" },
  handover: { label: "Open Handover", href: "/ward-flow/handover" },
  legal: { label: "Open Legal forms", href: "/ward-flow/legal-forms" },
  alerts: { label: "Open Alerts", href: "/ward-flow/alerts" },
  capacity: { label: "Open Capacity", href: "/ward-flow/capacity" },
  statistics: { label: "Open Statistics", href: "/ward-flow/statistics" },
  settings: { label: "Open Settings", href: "/ward-flow/settings" },
  downtime: { label: "Open Downtime pack", href: DOWNTIME_PACK_HREF },
} as const;
type Row = readonly [id: string, title: string, body: string, destination?: keyof typeof DESTINATIONS];

const WORKFLOWS: Record<TourRole, readonly Row[]> = {
  coordinator: [
    [
      "referrals",
      "Follow a referral",
      "Open Referrals to read the request, its current owner and the recorded response. An accepted referral, a bed pull and an arrival are separate steps. Follow the checks shown; the tutorial does not decide whether a bed is suitable.",
      "referrals",
    ],
    [
      "placement",
      "A ready bed and a safe journey",
      "Find a bed filters the recorded bed criteria; it does not rank wards. A bed being made ready is not yet Ready. Placement, fit to travel, handover and transport each have their own recorded checks.",
      "capacity",
    ],
    [
      "movement",
      "Booking is not arrival",
      "Movements follows the journey. Book by phone first, then record the booking details the form requires. Record a collection or arrival only when it has happened. A disabled action explains what is still missing.",
      "movements",
    ],
    [
      "waiting",
      "Waiting and Activity answer different questions",
      "Waiting shows recorded waits and blockers. My list on Home helps you follow work. Activity records notices and what happened. A wait or alert is a prompt to check the record, not a clinical instruction.",
      "waiting",
    ],
    [
      "handover",
      "Hand work to the next shift",
      "Handover collects work needing attention and items due before the next shift. Check Before you sign and use the existing sign-off controls. Printing or copying a list does not complete the work on it.",
      "handover",
    ],
  ],
  ward: [
    [
      "capacity",
      "Check the beds before confirming",
      "Check ready, occupied, pulled and closed beds before Confirm numbers. Being made ready is a separate state. Confirming records that the figures were checked; it does not complete preparation or make every bed available.",
    ],
    [
      "referrals",
      "Answer requests to your ward",
      "Read the referral and its checks before using the available response. Accepting in principle, pulling a ready bed and recording arrival are different steps. A referral waiting for an answer is not an admission.",
      "referrals",
    ],
    [
      "discharge",
      "Keep the discharge record current",
      "Open a bed or patient to check the expected discharge date and recorded blockers. Record an actual discharge only when it has happened. Follow the separate bed-preparation step before treating the released bed as Ready.",
    ],
    [
      "legal",
      "Use the recorded form time",
      "Legal forms shows the due time entered from the checked form. It does not calculate the legal period for you. Verify the source document and use the responsible clinician or on-call service for uncertainty.",
      "legal",
    ],
    [
      "handover",
      "Pass on unresolved work",
      "Read Act now and work due before handover, then check Before you sign. A shift brief, a printout and a signed handover have different purposes. Confirm the record after saving; the tour does not sign anything.",
      "handover",
    ],
  ],
  ed: [
    [
      "examination",
      "Record what has been checked",
      "Open a row for the examination, medical clearance and legal-form details your desk may record. Enter the checked information; a waiting-time colour or suggested next step does not replace clinical assessment.",
    ],
    [
      "referrals",
      "Follow your referral's answer",
      "Raise a referral from your ED, then follow its response and recorded destination. Find a bed filters the recorded criteria and never ranks a clinical choice. A response from a ward does not itself record transfer or arrival.",
      "referrals",
    ],
    [
      "journey",
      "Prepare the handover and journey",
      "An accepted bed, fit to travel, handover readiness and transport booking are separate gates. Phone-book first and record the required booking details. Keep the actual stage current rather than advancing it to clear a warning.",
      "movements",
    ],
    [
      "legal",
      "Check the form, not a calculated countdown",
      "Use Legal forms to follow recorded due times and missing information for your own journeys. Verify changes against the checked paper form. Contact the responsible clinician or on-call service when the record is uncertain.",
      "legal",
    ],
    [
      "handover",
      "Keep waiting work visible",
      "Use Handover for unresolved work and the next shift. Elapsed time and access targets are recorded workflow signals; they do not decide the patient's care or discharge.",
      "handover",
    ],
  ],
  community: [
    [
      "caseload",
      "Follow the person through the service",
      "Your team's caseload separates people in the community from people in a bed and referrals awaiting action. Check the current owner and next contact. Opening a record does not complete the contact or hand work to another team.",
    ],
    [
      "referrals",
      "Follow your team's referrals",
      "Raise a referral in your team's name and follow its recorded response. Your desk sees the records and actions its scope permits. Other teams' work is not made available by this tutorial.",
      "referrals",
    ],
    [
      "transport",
      "Arrange your own journeys",
      "For a journey your team sends, follow the handover and transport prerequisites shown. Book by phone first, then record the required details. Recording a booking is different from recording that someone has arrived.",
      "movements",
    ],
    [
      "legal",
      "Keep the checked form details current",
      "Use the recorded legal-form due time for your own journeys and check it against the source document. The app does not calculate the legal period or make a legal or clinical decision.",
      "legal",
    ],
    [
      "contact",
      "Make the next contact clear",
      "Check your team's contact details and the recorded owner before handing work on. Your menu has On-call for contact information. Handover and Downtime pack are not screens granted to this desk.",
    ],
  ],
  officer: [
    [
      "assignment",
      "Start with the assigned job",
      "Your jobs list shows the transport jobs assigned to this desk. Check the route, stage and required documents. It is not a general patient search or a list of every journey.",
    ],
    [
      "stages",
      "Record the stage that happened",
      "Use the job's next action to record acceptance, travel, collection or arrival when that stage has actually happened. The stages and required fields remain enforced; the tour never advances a job.",
    ],
    [
      "documents",
      "Missing information stays visible",
      "Read the reason beside a disabled step and check missing documents with the sending team. A transport record does not grant authority to change a referral, allocate a bed or decide clinical clearance.",
    ],
    [
      "alerts",
      "Check your own alerts",
      "Open Alerts for items addressed to this desk. Read the job and its current stage before acting. An alert does not mean the sending team has completed handover or that a bed is ready.",
      "alerts",
    ],
    [
      "contact",
      "Hand over the transport work",
      "Copy handover describes the job list for the next shift; it does not complete the jobs. Use On-call and the sending team's contact details for missing information. This role has no general Handover or Downtime pack screen.",
    ],
  ],
  bed_manager: [
    [
      "capacity",
      "Check your site's capacity",
      "Capacity shows your site's wards and bed counts. Confirm checked capacity where the control is offered. Pulled, closed, occupied, being made ready and Ready are distinct states; a planned admission is not an occupied bed.",
      "capacity",
    ],
    [
      "referrals",
      "Read incoming referrals within your site",
      "Your site's referral view is read only for referral decisions. Read the request and contact the nurse in charge or coordinator for a response. Opening the screen does not grant its decision actions.",
      "referrals",
    ],
    [
      "movement",
      "Follow your site's flow",
      "Movements and Waiting show the journeys and blockers within your site. Check the underlying record and its update time. A mismatch count describes the recorded demand and beds; it does not choose a placement.",
      "movements",
    ],
    [
      "meeting",
      "Use the meeting and handover views",
      "The bed meeting and Handover help your site share current work. Check the figures before presenting or printing. A TV or exported copy has its own timestamp and may show record details; choose where it is displayed carefully.",
      "handover",
    ],
    [
      "scope",
      "Other-site counts have limits",
      "Information about another site's beds does not grant access to its patient records or actions. Ask the coordinator when work crosses your site's scope. Your own statistics are counts, with the display rules shown by the report.",
    ],
  ],
  executive: [
    [
      "report",
      "Read the report's scope and time",
      "Statistics shows released aggregate counts for your statewide or service scope. Check the report time and whether updates are paused. An older or unavailable report must not be read as the network's current state.",
      "statistics",
    ],
    [
      "capacity",
      "Capacity is a count view",
      "Capacity is available as bed counts without patient names. Use it to understand recorded capacity, not to choose a patient's placement or change a ward's bed state.",
      "capacity",
    ],
    [
      "suppression",
      "Small counts stay protected",
      "A figure shown as fewer than 5 is not zero or an exact count. Follow the notes on what each measure includes. Do not try to reconstruct suppressed counts from neighbouring figures.",
    ],
    [
      "export",
      "An export is a dated copy",
      "Use Export the figures where it is offered. Check the scope, report time and measure notes before sharing. The export does not keep updating, and aggregate access does not grant individual patient records.",
    ],
    [
      "activity",
      "Shell controls do not grant operational access",
      "Tasks and Activity may be visible in the shell, but individual operational activity and patient actions are unavailable to this desk. Use the appropriate operational desk for follow-up; the tutorial adds no authority.",
    ],
  ],
  admin: [
    [
      "access",
      "Check the person, place and duration",
      "In Settings, Access lists the available role administration controls. Check the person, role, place and end date before submitting. Nobody gives themselves a role; existing approval and expiry checks still apply.",
      "settings",
    ],
    [
      "requests",
      "Answer an access request deliberately",
      "Read the requested desk and place before using Give for 90 days or Decline where offered. Wait for the actual result. A closed form or dismissed message does not prove that access was granted.",
      "settings",
    ],
    [
      "remove",
      "Removing access changes what can be opened",
      "Check the person and grant before Remove. Removal ends that grant; changing a label or viewing a role is different from granting it. This tutorial never gives, extends or removes anyone's access.",
      "settings",
    ],
    [
      "governance",
      "Screen access and record access are separate",
      "The Governance route does not grant every audit record or review action. Individual records and review controls have separate restrictions. If the screen says records are unavailable, follow that restriction rather than borrowing another desk's authority.",
    ],
    [
      "clinical",
      "Access administration is not clinical work",
      "This desk has Settings and its permitted Governance view. It has no patient-record or clinical workflow authority. Refer patient work to the authorised operational desk; changing access is not a way to complete that work.",
    ],
  ],
};

function recoveryRows(role: TourRole): readonly Row[] {
  const executive = role === "executive";
  const admin = role === "admin";
  return [
    [
      "freshness",
      "Check how current the information is",
      executive
        ? "Check the report's as-at time and pause state. Offline means this report is not updating. If statistics are unavailable, follow the workspace's recovery message. A blank or suppressed figure is not a fresh zero."
        : admin
          ? "Check the latest access update, current role, place and end date. Access can expire or be removed while a screen is open. A screen you opened earlier does not preserve permission to submit a change now."
          : "Check the recorded update or confirmation time, not just the clock in the header. Offline means nothing is updating. Confirm numbers only after checking them. A recent visit to a screen does not make its underlying figures fresh.",
    ],
    [
      "saves",
      executive ? "An unavailable report is not a saved action" : "Wait for a confirmed save",
      executive
        ? "This desk reads released counts. A report that is paused, offline or unavailable is not evidence that another desk's action saved. Follow the displayed recovery message and ask the authorised desk about operational changes."
        : "In a shared workspace, Saving or not confirmed is not success. Keep the page open; do not reload an unconfirmed action or submit a duplicate. Follow the displayed Retry or conflict instructions. Local demo device copies scrub typed text, so a reload may lose those details.",
    ],
    [
      "signals",
      executive ? "Read the measure notes" : admin ? "Read the actual outcome" : "An alert is a prompt to check",
      executive
        ? "Read each measure's scope and exclusions. Fewer than 5 protects a small count; it is not zero. These counts support review and do not make a clinical or placement decision."
        : admin
          ? "A refusal records an action that was not applied; an unresolved save needs its recovery message. Route access and a visible button do not override role, place or approval checks."
          : "Alerts are addressed to a role and place. Read the current record, owner and next step before acting. A red colour, elapsed time or legal-form due time is not a clinical instruction or a calculated legal decision.",
      executive || admin ? undefined : "alerts",
    ],
    [
      "privacy",
      "Protect what is on this device",
      executive
        ? "Keep suppressed and unavailable counts protected. Check the scope and time on exported copies before sharing. Lock or sign out when leaving a shared screen; counts-only access must not become individual-record access."
        : "Use synthetic information only in this prototype. Check name-display preferences where available, and check printed or copied material before sharing. Lock or sign out when leaving a shared screen. The tutorial stores only role and progress identifiers, not patient details.",
    ],
    [
      "settings",
      "Keep your preferences and return later",
      "Settings holds the options available to your desk. Closing the tour keeps its topic and step on this device; Skip tour finishes it. Help or Settings can reopen it. Use Restart topic to start the current topic again.",
      "settings",
    ],
    ...(ROLE_SCREENS[role].downtime
      ? [
          [
            "downtime",
            "Have a dated fallback",
            "Downtime pack can be printed or saved as a PDF. Check when it was generated and protect the copy. Offline or stale information needs the established local downtime process; returning online does not prove that an uncertain action saved.",
            "downtime",
          ] as const,
        ]
      : []),
  ];
}

export function workflowTourSteps(role: TourRole, topic: Exclude<TourTopic, "orientation">): readonly TourStep[] {
  const prefix = topic === "workflows" ? "workflow" : "safe";
  const rows = topic === "workflows" ? WORKFLOWS[role] : recoveryRows(role);
  return [
    {
      id: `${prefix}-start`,
      chapter: "Your desk",
      title: topic === "workflows" ? "Choose a daily workflow" : "Use the prototype safely",
      body: "This prototype uses synthetic data. The tour explains the controls without changing a record. Open screen pauses the tour before navigating. Close keeps your place; you can return from Help. Practice steps, if you start them separately, are real saves on this demo device.",
    },
    ...rows.map(([id, title, body, destination]): TourStep => {
      const open = destination ? DESTINATIONS[destination] : undefined;
      const screen = open && screenForPath(open.href)?.screen;
      return {
        id: `${prefix}-${id}`,
        title,
        body,
        chapter: topic === "workflows" ? "Your daily work" : "Finding your way",
        ...(open && screen && ROLE_SCREENS[role][screen] ? { open } : {}),
      };
    }),
  ];
}
