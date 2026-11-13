import type { ScreenHelp } from "./ward-help-content";

/**
 * Help for stand-alone pages that showed "no help page yet" (11 Nov 2026): Leave, Today's review,
 * Start a triage and a person's triage form. Kept in its own module so `ward-help-content.ts`'s
 * `PAGE_HELP` takes them in one line. Each entry describes the page as its source draws it.
 *
 * The bed meeting TV (`/ward-flow/bed-meeting`) has none on purpose: it hides the header, so Help
 * cannot open there, and its help sits on the screens that open it (HF-10, `TV_QUESTION`).
 */
export const MORE_PAGE_HELP: readonly (ScreenHelp & { id: string; path: RegExp })[] = [
  {
    id: "leave",
    path: /^\/ward-flow\/leave$/u,
    title: "Leave",
    purpose:
      "Everyone on leave across your wards: their bed, the kind of leave, when they left, when they are expected back and their status.",
    actions: [
      "Overdue or absent shows only the people overdue back or absent without leave.",
      "Open ward on an overdue or absent row opens that ward's page, where leave is ended.",
      "Print makes a paper copy of the list as it shows.",
    ],
    questions: [
      {
        question: "How do I record or end leave?",
        answer:
          "This page is read only. Start leave from the patient's page with Record a change. End it on the ward's page, under Leave monitoring, with Ended.",
      },
      {
        question: "When is someone overdue?",
        answer:
          "Once the expected return recorded with their leave has passed. Absent without leave shows while the ward's absence record stands.",
      },
    ],
  },
  {
    id: "todays-review",
    path: /^\/ward-flow\/review$/u,
    title: "Today's review",
    purpose:
      "What to settle before you hand over, and every decline, override, open problem and action the app stopped today.",
    actions: [
      "Before you hand over lists overrides to review, a ward's repeated declines and problems still open.",
      "Mark reviewed on an override records your role and the time with the governance record.",
      "Show narrows Everything today to declines, overrides, problems or actions stopped by the app.",
    ],
    questions: [
      {
        question: "Who can mark an override reviewed?",
        answer: "Any coordinator on shift, including the person who made the override.",
      },
      {
        question: "Where is the full history?",
        answer: "Today's review shows today only. Governance holds the full history.",
      },
    ],
  },
  {
    id: "triage-start",
    path: /^\/ward-flow\/triage\/new$/u,
    title: "Start a triage",
    purpose: "Choose who a mental health triage and risk assessment is for.",
    actions: [
      "Search by name, UMRN or date of birth, or choose a referral awaiting triage.",
      "Filter the referrals by source, and sort them from the menu beside the tabs.",
      "Not found? Add patient makes a new record first.",
    ],
  },
  {
    id: "triage",
    path: /^\/ward-flow\/people\/[^/]+\/triage$/u,
    title: "Triage and risk",
    purpose: "One person's triage and risk assessment (SMHMR900 and SMHMR905). It opens blank.",
    actions: [
      "Work through the sections in order, from Review details to Formulation and plan.",
      "Show what's left lists the answers still needed before signing.",
      "Sign creates both records. How to explains the form.",
    ],
    questions: [
      {
        question: "Why can't I sign yet?",
        answer: "Every needed answer must be in first. Sign says how many are left, and Show what's left lists them.",
      },
      {
        question: "Does the form decide the urgency or the risk?",
        answer: "No. You choose every clinical answer. Nothing clinical is filled in for you.",
      },
    ],
  },
];
