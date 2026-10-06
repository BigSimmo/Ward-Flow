/** Navigation for the Work Mode phone. Synthetic demonstration only. */

export const MODE_IDS = ["day", "rost", "teach", "assess", "cpd", "admin"] as const;

export type ModeId = (typeof MODE_IDS)[number];

export type ModeSpec = {
  id: ModeId;
  name: string;
  icon: string;
  watermark: string;
  /** CSS class that carries this area's colour tokens. Assessments share Teaching. */
  tone: string;
  tabs: readonly string[];
};

export const MODES: readonly ModeSpec[] = [
  {
    id: "day",
    name: "My Day",
    icon: "sun",
    watermark: "wm-sun",
    tone: "day",
    tabs: ["Today", "Week", "Hours", "More"],
  },
  {
    id: "rost",
    name: "Roster",
    icon: "cal",
    watermark: "wm-cal",
    tone: "rost",
    tabs: ["Month", "Team", "Swaps|1", "More"],
  },
  {
    id: "teach",
    name: "Teaching",
    icon: "board",
    watermark: "wm-board",
    tone: "teach",
    tabs: ["Today", "Week", "Logbook", "More"],
  },
  {
    id: "assess",
    name: "Assessments",
    icon: "doc",
    watermark: "wm-board",
    tone: "teach",
    tabs: ["To do|4", "Progress", "Supervision", "More"],
  },
  {
    id: "cpd",
    name: "CPD",
    icon: "award",
    watermark: "wm-award",
    tone: "cpd",
    tabs: ["Summary", "Log", "Learning", "More"],
  },
  {
    id: "admin",
    name: "Admin",
    icon: "case",
    watermark: "wm-case",
    tone: "admin",
    tabs: ["Today", "Renewals", "New job", "More"],
  },
];

export function modeSpec(id: ModeId): ModeSpec {
  const found = MODES.find((mode) => mode.id === id);
  if (!found) throw new Error(`Unknown work mode ${id}`);
  return found;
}

export type Overlay = null | "modes" | "more" | "add" | "swap" | "search" | "customise";

export type WorkView = "main" | "needs";

export type SearchAnswer = null | "nights" | "tomorrow" | "due";

export type WorkModeState = {
  mode: ModeId;
  tab: number;
  view: WorkView;
  weekAsMonth: boolean;
  swapAccepted: boolean;
  leaveSigned: boolean;
  supervisionConfirmed: boolean;
  toast: string | null;
  searchQuery: string;
  searchAnswer: SearchAnswer;
  overlay: Overlay;
};

export const initialWorkModeState: WorkModeState = {
  mode: "day",
  tab: 0,
  view: "main",
  weekAsMonth: false,
  swapAccepted: false,
  leaveSigned: false,
  supervisionConfirmed: false,
  toast: null,
  searchQuery: "",
  searchAnswer: null,
  overlay: null,
};

export type WorkModeAction =
  | { type: "tab"; index: number }
  | { type: "mode"; mode: ModeId; tab?: number }
  | { type: "overlay"; overlay: Overlay }
  | { type: "close" }
  | { type: "view"; view: WorkView }
  | { type: "weekMonth"; month: boolean }
  | { type: "acceptSwap" }
  | { type: "signLeave" }
  | { type: "confirmSupervision" }
  | { type: "search"; query: string }
  | { type: "answer"; answer: SearchAnswer; query: string }
  | { type: "toast"; message: string | null }
  | { type: "undo" };

export function reduceWorkMode(state: WorkModeState, action: WorkModeAction): WorkModeState {
  switch (action.type) {
    case "tab":
      if (action.index >= 3) return { ...state, overlay: "more", toast: null };
      return { ...state, tab: action.index, view: "main", overlay: null, toast: null };
    case "mode":
      return {
        ...state,
        mode: action.mode,
        tab: action.tab ?? 0,
        view: "main",
        overlay: null,
        toast: null,
        weekAsMonth: false,
      };
    case "overlay":
      return {
        ...state,
        overlay: action.overlay,
        searchQuery: action.overlay === "search" ? "" : state.searchQuery,
        searchAnswer: action.overlay === "search" ? null : state.searchAnswer,
      };
    case "close":
      return { ...state, overlay: null };
    case "view":
      return { ...state, view: action.view, overlay: null, toast: null };
    case "weekMonth":
      return { ...state, weekAsMonth: action.month, tab: 1, view: "main", overlay: null };
    case "acceptSwap":
      return {
        ...state,
        swapAccepted: true,
        overlay: null,
        mode: "rost",
        tab: 2,
        view: "main",
        toast: "Swap accepted. Dr Grant approves next.",
      };
    case "signLeave":
      return { ...state, leaveSigned: true, toast: "Leave form signed and sent." };
    case "confirmSupervision":
      return { ...state, supervisionConfirmed: true, toast: "Supervision confirmed. Sending in 10 seconds." };
    case "search":
      return { ...state, overlay: "search", searchQuery: action.query, searchAnswer: null };
    case "answer":
      return { ...state, overlay: "search", searchQuery: action.query, searchAnswer: action.answer };
    case "toast":
      return { ...state, toast: action.message };
    case "undo":
      return {
        ...state,
        toast: null,
        swapAccepted: state.toast?.startsWith("Swap accepted") ? false : state.swapAccepted,
        leaveSigned: state.toast?.startsWith("Leave form") ? false : state.leaveSigned,
        supervisionConfirmed: state.toast?.startsWith("Supervision") ? false : state.supervisionConfirmed,
      };
    default:
      return state;
  }
}

export type HeaderCopy = {
  time: string;
  sub: string;
  eyebrow: string;
  title: string;
  action?: string;
  right: "search" | "bell";
  dot: boolean;
  back: boolean;
};

export function headerCopy(state: WorkModeState): HeaderCopy {
  const mode = modeSpec(state.mode);
  if (state.view === "needs") {
    return {
      time: "07:45",
      sub: "Needs you",
      eyebrow: "Overdue first, then by deadline",
      title: "Needs you",
      action: "sliders",
      right: "search",
      dot: false,
      back: true,
    };
  }
  const tables: Record<ModeId, HeaderCopy[]> = {
    day: [
      {
        time: "07:40",
        sub: "Today",
        eyebrow: "Tuesday 6 October",
        title: "Good morning, Josh",
        action: "plus",
        right: "search",
        dot: false,
        back: false,
      },
      {
        time: "07:42",
        sub: state.weekAsMonth ? "Week" : "Week",
        eyebrow: state.weekAsMonth ? "October 2026" : "5 to 11 October",
        title: state.weekAsMonth ? "This month" : "This week",
        action: "share",
        right: "search",
        dot: false,
        back: false,
      },
      {
        time: "07:44",
        sub: "Hours",
        eyebrow: "Rostered, not pay",
        title: "Hours",
        right: "search",
        dot: false,
        back: false,
      },
    ],
    rost: [
      {
        time: "07:42",
        sub: "October",
        eyebrow: "Tue 6 October",
        title: "Roster",
        action: "plus",
        right: "search",
        dot: false,
        back: false,
      },
      {
        time: "08:20",
        sub: "Team",
        eyebrow: "Ward 4 consultants · 7 people",
        title: "Team",
        action: "sliders",
        right: "search",
        dot: false,
        back: false,
      },
      {
        time: state.swapAccepted ? "07:49" : "07:47",
        sub: "Swaps",
        eyebrow: state.swapAccepted ? "Nothing to answer · 2 sent" : "1 to answer · 1 sent",
        title: "Swaps",
        action: "plus",
        right: "search",
        dot: false,
        back: false,
      },
    ],
    teach: [
      {
        time: "07:45",
        sub: "Today",
        eyebrow: "Tue 6 October",
        title: "Teaching",
        action: "qrc",
        right: "search",
        dot: false,
        back: false,
      },
      {
        time: "16:20",
        sub: "Week",
        eyebrow: "Term 4 · week 6 of 10",
        title: "This week",
        action: "cal",
        right: "search",
        dot: false,
        back: false,
      },
      {
        time: "17:10",
        sub: "Logbook",
        eyebrow: "Term 4 · week 6 of 10",
        title: "Logbook",
        action: "share",
        right: "search",
        dot: false,
        back: false,
      },
    ],
    assess: [
      {
        time: "11:40",
        sub: "Assessments",
        eyebrow: "Term 4 · week 6 of 10",
        title: "Assessments",
        right: "search",
        dot: false,
        back: false,
      },
      {
        time: "11:42",
        sub: "Assessments",
        eyebrow: "Term 4 · week 6 of 10",
        title: "Progress",
        action: "share",
        right: "search",
        dot: false,
        back: false,
      },
      {
        time: "13:35",
        sub: "Assessments",
        eyebrow: "Term 4 · confirmed hours",
        title: "Supervision",
        right: "search",
        dot: false,
        back: false,
      },
    ],
    cpd: [
      {
        time: "12:40",
        sub: "Summary",
        eyebrow: "Records loaded 12:40",
        title: "CPD 2026",
        action: "sliders",
        right: "search",
        dot: false,
        back: false,
      },
      {
        time: "12:42",
        sub: "Log",
        eyebrow: "41 activities · 32.5 h",
        title: "Log",
        action: "sliders",
        right: "search",
        dot: false,
        back: false,
      },
      {
        time: "12:52",
        sub: "Learning",
        eyebrow: "Western Australia · checked Thu 1 Oct",
        title: "Learning",
        action: "cal",
        right: "search",
        dot: false,
        back: false,
      },
    ],
    admin: [
      {
        time: "07:40",
        sub: "Today",
        eyebrow: "Tuesday 6 October",
        title: "Good morning, Josh",
        right: "bell",
        dot: true,
        back: false,
      },
      {
        time: "07:42",
        sub: "Renewals",
        eyebrow: "Source: Medical Board · 26 Sep",
        title: "Renewals",
        action: "sliders",
        right: "bell",
        dot: true,
        back: false,
      },
      {
        time: "07:48",
        sub: "New job",
        eyebrow: "Before you start, and when you leave",
        title: "New job",
        right: "bell",
        dot: true,
        back: false,
      },
    ],
  };
  return tables[mode.id][state.tab] ?? tables[mode.id][0];
}
