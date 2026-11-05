/**
 * GUIDED CHECKLISTS IN HELP (Josh, 2 Nov 2026, approved word for word): short lists of what to do at
 * the start of a shift, at handover, before the bed meeting and if Ward Flow is down. Each step may
 * name where it is done (`go`: "home", a rail entry id or "settings#<tab>") and a Show me (`showMe`:
 * a `HOW_TOS` id). Ticks are reminders only: ticking a step records no event and changes nothing.
 *
 * A desk sees only the checklists named for it, and inside them only the links and Show mes it may
 * use: a step whose screen the desk cannot open keeps its words and loses the link, so Help never
 * offers a door the guard would shut.
 *
 * The ticks for this browser tab are kept in session storage under `CHECKLIST_TICKS_STORAGE_KEY`, as
 * fixed "checklistId:stepIndex" ids only, each checked against the known ids on read. No typed text
 * is ever written there.
 */
import { deskOpens, EVERY_LOGIN, howToFor } from "./ward-help-access";
import { howToHref } from "./ward-help-href";
import { HOW_TOS } from "./ward-help-howto";
import type { WardTourRole } from "./ward-help-store";

export type ChecklistId = "start-of-shift" | "handover" | "bed-meeting" | "downtime";

type ChecklistStep = {
  readonly text: string;
  readonly note?: string;
  /** Where the step is done: "home", a rail entry id or "settings#<tab>". */
  readonly go?: string;
  /** The `HOW_TOS` id whose Show me walks this step. */
  readonly showMe?: string;
};

export type Checklist = {
  readonly id: ChecklistId;
  readonly title: string;
  readonly subtitle: string;
  readonly desks: readonly WardTourRole[] | "all";
  readonly steps: readonly ChecklistStep[];
};

/** Said under every checklist's title. */
export const CHECKLIST_SUBTITLE = "Reminders only. Ticking a step records nothing.";

export const CHECKLISTS: readonly Checklist[] = [
  {
    id: "start-of-shift",
    title: "Start of shift",
    subtitle: CHECKLIST_SUBTITLE,
    desks: ["coordinator"],
    steps: [
      {
        text: "Open Home and work down My list: Act now first, then referrals to decide.",
        note: "Each row opens the record it is about.",
        go: "home",
      },
      { text: "Open Alerts in the header for everything addressed to this desk.", showMe: "alerts" },
      {
        text: "On Capacity, ask for an update when a ward's figure is old.",
        go: "capacity",
        showMe: "around-capacity",
      },
      {
        text: "On Waiting, use Due soon or on you, Form due and For handover.",
        go: "delays",
        showMe: "around-delays",
      },
      { text: "Check “Is it saved?”: a short message after each action says it was recorded." },
    ],
  },
  {
    id: "handover",
    title: "Handover",
    subtitle: CHECKLIST_SUBTITLE,
    desks: EVERY_LOGIN.filter((role) => deskOpens(role, "handover")),
    steps: [
      {
        text: "Read Act now first, then anything due before the next handover.",
        go: "handover",
        showMe: "around-handover",
      },
      { text: "Chase the overdue ward promises first." },
      { text: "Check the Before you sign list." },
      { text: "Choose Sign off.", showMe: "sign-off-handover" },
      { text: "Print handover and Present are under More." },
    ],
  },
  {
    id: "bed-meeting",
    title: "Bed meeting",
    subtitle: CHECKLIST_SUBTITLE,
    desks: ["coordinator"],
    steps: [
      {
        text: "On Capacity, read Mismatch: people waiting against beds that fit, for each kind of bed.",
        go: "capacity",
        showMe: "around-capacity",
      },
      { text: "Open Bed meeting, or Open on TV for the meeting room screen (read only).", showMe: "tv" },
      {
        text: "On Referrals, press Bed meeting to open the agenda at its referrals.",
        go: "referrals",
        showMe: "around-referrals",
      },
      { text: "On Out of area, copy the bed meeting summary from the header.", go: "out-of-area" },
    ],
  },
  {
    id: "downtime",
    title: "If Ward Flow is down",
    subtitle: CHECKLIST_SUBTITLE,
    desks: "all",
    steps: [
      { text: "Tell the bed coordinator on shift. They decide when everyone switches to paper." },
      {
        text: "Use the printed Downtime pack: beds by ward, the ED queue, pending moves and legal forms.",
        showMe: "downtime",
      },
      { text: "Work from paper and the phone until the coordinator says Ward Flow is back." },
      { text: "Then record what happened in the meantime." },
    ],
  },
];

/** A step as one desk sees it: its place in the list, with only the links that desk may use. */
type DeskChecklistStep = {
  readonly index: number;
  readonly text: string;
  readonly note?: string;
  readonly go?: string;
  readonly showMe?: string;
};

export type DeskChecklist = Omit<Checklist, "steps" | "desks"> & { readonly steps: readonly DeskChecklistStep[] };

function forDesk(checklist: Checklist, role: WardTourRole): DeskChecklist {
  return {
    id: checklist.id,
    title: checklist.title,
    subtitle: checklist.subtitle,
    steps: checklist.steps.map((step, index) => {
      // "home" always resolves for a signed-in desk, so any address stands in for it here.
      const go = step.go && howToHref(step.go, role, "/ward-flow") !== undefined ? step.go : undefined;
      const howTo = step.showMe ? HOW_TOS.find((each) => each.id === step.showMe) : undefined;
      const showMe = howTo && howToFor(howTo, role) ? howTo.id : undefined;
      return {
        index,
        text: step.text,
        ...(step.note ? { note: step.note } : {}),
        ...(go ? { go } : {}),
        ...(showMe ? { showMe } : {}),
      };
    }),
  };
}

function namesDesk(checklist: Checklist, role: WardTourRole): boolean {
  return checklist.desks === "all" || checklist.desks.includes(role);
}

/** The checklists for this desk, in order, each step keeping only the links and Show mes it may use. */
export function checklistsForDesk(role: WardTourRole): readonly DeskChecklist[] {
  return CHECKLISTS.filter((checklist) => namesDesk(checklist, role)).map((checklist) => forDesk(checklist, role));
}

/** One checklist as this desk sees it, or undefined when it is not one of this desk's. */
export function checklistForDesk(id: string, role: WardTourRole): DeskChecklist | undefined {
  const checklist = CHECKLISTS.find((each) => each.id === id);
  return checklist && namesDesk(checklist, role) ? forDesk(checklist, role) : undefined;
}

/* ── Ticks ────────────────────────────────────────────────────────────────────────────────── */

export const CHECKLIST_TICKS_STORAGE_KEY = "ward-flow-help-checklist-ticks";

/** The id a tick is stored under: fixed checklist id and step number, never any words. */
export function checklistTickId(id: ChecklistId, index: number): string {
  return `${id}:${index}`;
}

/** Every tick id a checklist step can have. Anything else read from storage is dropped. */
export const CHECKLIST_TICK_IDS: ReadonlySet<string> = new Set(
  CHECKLISTS.flatMap((checklist) => checklist.steps.map((_, index) => checklistTickId(checklist.id, index))),
);

/** The known tick ids in a stored comma-separated list, in order, without repeats. */
export function parseChecklistTicks(raw: string | null | undefined): ReadonlySet<string> {
  return new Set((raw ?? "").split(",").filter((id) => CHECKLIST_TICK_IDS.has(id)));
}

/** The stored form: known tick ids joined by commas, or "" when none are ticked. */
export function serialiseChecklistTicks(ticks: Iterable<string>): string {
  return [...new Set(ticks)].filter((id) => CHECKLIST_TICK_IDS.has(id)).join(",");
}
