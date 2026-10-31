import { HOW_TOS, type HowTo } from "@/components/ward-management/help/ward-help-howto";
import type { WardTourRole } from "@/components/ward-management/help/ward-help-store";

/**
 * The How do I… list for the Help mock-up (final round, D-91), kept small: the 33 tasks, their
 * titles, answers, desks, places and Show me steps come from the real list on this branch
 * (`help/ward-help-howto.ts`, word for word the same as draft PR #1119's). This file adds only what
 * #1119 adds to each task, so the mock-up can draw its How do I… tab:
 * - `topic`, the fixed group it is listed under (grouping only, never ranking);
 * - `computerOnly` for the three jobs a phone has no button for;
 * - #1119's corrected places and first Show me steps for the tasks the mock-up demonstrates on Home.
 * The real build takes #1119's `ward-help-howto.ts` whole and deletes this file.
 */

/** The groups How do I… lists a desk's tasks under (Josh, 30 Oct 2026), in this order. */
export const TASK_TOPICS = [
  "Beds and referrals",
  "Transport",
  "Handover and reports",
  "Finding your way",
  "Settings and display",
] as const;
type TaskTopic = (typeof TASK_TOPICS)[number];

const TOPIC_OF: Readonly<Record<string, TaskTopic>> = {
  "pull-bed": "Beds and referrals",
  "release-pulled-bed": "Beds and referrals",
  "decide-referral": "Beds and referrals",
  "ask-more-wards": "Beds and referrals",
  "log-call": "Beds and referrals",
  "new-referral": "Beds and referrals",
  "confirm-numbers": "Beds and referrals",
  "answer-ward-referrals": "Beds and referrals",
  "bed-board": "Beds and referrals",
  "find-bed": "Beds and referrals",
  "ed-raise": "Beds and referrals",
  "book-transport": "Transport",
  "cancel-transport": "Transport",
  "transport-job": "Transport",
  "sign-off-handover": "Handover and reports",
  "print-handover": "Handover and reports",
  tv: "Handover and reports",
  "mha-times": "Handover and reports",
  downtime: "Handover and reports",
  statistics: "Handover and reports",
  "go-to-desk": "Finding your way",
  "service-in-view": "Finding your way",
  alerts: "Finding your way",
  "search-patient": "Finding your way",
  "pin-ward": "Finding your way",
  undo: "Finding your way",
  tour: "Finding your way",
  theme: "Settings and display",
  density: "Settings and display",
  notifications: "Settings and display",
  buzz: "Settings and display",
  rules: "Settings and display",
  "give-access": "Settings and display",
};

/** The controls are drawn on a computer only, so a phone is told so instead of offered Show me. */
const COMPUTER_ONLY: ReadonlySet<string> = new Set(["print-handover", "tv", "downtime"]);

type ShowMeStep = NonNullable<HowTo["showMe"]>[number];

/** #1119's corrections to a task's place or Show me steps, for the tasks Home demonstrates. */
const FROM_1119: Readonly<Record<string, { go?: readonly string[]; showMe?: readonly ShowMeStep[] }>> = {
  tv: { go: ["capacity", "home"] },
  "decide-referral": {
    showMe: [
      {
        // Decide is a link on the coordinator's list and a button elsewhere; a phone's hero count stands in.
        target: [
          { sel: "#main-content a, #main-content button", text: "Decide" },
          { sel: "#main-content button", text: "To decide" },
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
  "release-pulled-bed": {
    showMe: [
      {
        // A phone's list opens each row in a sheet; the hero's Act now count stands in.
        target: [
          { sel: "#main-content button", text: "Release pulled bed" },
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
};

export type MockTask = Omit<HowTo, "go" | "computerOnly"> & {
  readonly topic: TaskTopic;
  readonly go?: string | readonly string[];
  readonly computerOnly: boolean;
};

const TASKS: readonly MockTask[] = HOW_TOS.map((howTo) => ({
  ...howTo,
  ...FROM_1119[howTo.id],
  topic: TOPIC_OF[howTo.id] ?? "Finding your way",
  computerOnly: COMPUTER_ONLY.has(howTo.id),
}));

export function taskById(id: string): MockTask | undefined {
  return TASKS.find((task) => task.id === id);
}

/** This desk's tasks: those for every desk, and those named for it. */
export function tasksForDesk(role: WardTourRole): readonly MockTask[] {
  return TASKS.filter((task) => task.desks === "all" || task.desks.includes(role));
}

/**
 * The What's new line for How do I…, worded for the mock-up. #1119's line promised Show me ("each
 * with Show me to walk you through it on screen"), but the live Show me switch stays off in the real
 * app until Josh has seen it (D-91), so the line names only what everyone gets.
 */
export const HOW_DO_I_NEWS = {
  id: "2026-10-31-help-how-do-i",
  date: "2026-10-31",
  line: "Help opens on How do I…: your desk's common tasks, with this screen's first.",
} as const;
