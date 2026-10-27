/**
 * ASK HELP: THE HOW-TO LIST (Josh, 26 Oct 2026: "write a question ... and show you easily").
 *
 * A fixed, reviewed list of the jobs staff ask about, each with a short answer in the screens' own
 * button names, the desks it is for, where it is done, and optional "Show me" steps that spotlight
 * the real controls on that screen. `askHelp` matches typed words against it with a fixed list of
 * word families, so "reserve a bed" finds "Pull a bed". No AI and no network: the same words always
 * give the same answers, and the typed question is never stored or sent.
 *
 * Nothing here ranks, scores or suggests a ward, places a patient, re-sorts a queue, works out
 * Mental Health Act times or releases a pulled bed. Show me only points at buttons a person presses.
 * A bed kept for an incoming patient is "pulled"; "held" is only a patient's own bed while they are
 * on leave or away (D-81). Show me targets use test ids, ids, `data-setting` and accessible text,
 * never class names; `tests/ward-help-howto.test.ts` fails when a test id leaves the source.
 */
import type { WardTourRole } from "./ward-help-store";
import { HELP_SYNONYMS } from "./ward-help-synonyms";
import { nearestWord } from "./ward-help-typo";
import type { TourTarget } from "./ward-tour-steps";

/**
 * One spotlight in a Show me. Its targets are tried in order and the first on screen is lit, so a
 * step can name the desktop control and a phone stand-in. A step whose control is not on screen
 * shows its card with no spotlight.
 */
type ShowMeStep = {
  readonly target?: TourTarget | readonly TourTarget[];
  readonly title: string;
  readonly body: string;
};

export type HowTo = {
  readonly id: string;
  /** The job as a person would ask it, shown as the answer's heading. */
  readonly title: string;
  /** Extra words people use for it, beyond those in the title and answer. */
  readonly keywords: string;
  /** Two or three sentences, naming the buttons as the screens show them. */
  readonly answer: string;
  /** The desks that do this job. Others still find it, under "Done by another desk". */
  readonly desks: readonly WardTourRole[] | "all";
  /** Where it is done: "home" (the desk's own home), a rail entry id, or "settings#<tab>". */
  readonly go?: string;
  readonly showMe?: readonly ShowMeStep[];
};

const EVERY_DESK = "all";
const CLINICAL_DESKS: readonly WardTourRole[] = ["coordinator", "ward", "ed", "community", "bed_manager", "officer"];

const PRIMARY_ACTION: TourTarget = {
  sel: '[data-testid="ward-bar-primary-action"], [data-testid="ward-phone-create"]',
};
const DESK_SWITCH: TourTarget = {
  sel: '[data-testid="ward-rail-persona-trigger"], [data-testid="ward-bar-phone-menu"]',
};
/** A Settings row; on a phone, whose rows sit in a sheet per tab, the tab's row in the list. */
const setting = (id: string, tab: string): TourTarget => ({
  sel: `[data-setting="${id}"], [data-testid="ward-settings-phone-area-${tab}"]`,
});

export const HOW_TOS: readonly HowTo[] = [
  {
    id: "pull-bed",
    title: "Pull the bed for a patient",
    keywords: "reserve keep book bed accepted placement",
    answer:
      "Once a ward accepts, open the movement and press Pull the bed. The bed is kept for the patient within the pull time limit. A person always chooses the bed; nothing is placed automatically.",
    desks: ["coordinator"],
    go: "movements",
    showMe: [
      {
        target: [
          { sel: '#main-content a[href^="/ward-flow/movements/"]', text: "Pull the bed" },
          // On a phone the list is grouped by stage, so the Accepted group stands in for the button.
          { sel: '[data-testid="movements-group-toggle-accepted_awaiting_bed"]' },
        ],
        title: "Find a movement ready for a pull",
        body: "Rows where a ward has accepted show Pull the bed. Open one to see the bed, transport and legal form together.",
      },
      {
        title: "Press Pull the bed",
        body: "On the movement, check the bed and press Pull the bed. It is kept within the pull time limit, which is set in Settings, Rules.",
      },
    ],
  },
  {
    id: "release-pulled-bed",
    title: "Release a pulled bed",
    keywords: "unpull give back free cancel pull expired",
    answer:
      "Open the movement and use Release the pulled bed. Cancel transport first if it is booked. A pulled bed is never released by itself: when the pull time limit passes it shows in Act now as Pull expired, bed still pulled.",
    desks: ["coordinator"],
    go: "home",
    showMe: [
      {
        target: { sel: "#main-content button", text: "Release pulled bed" },
        title: "Pulls past their limit are in Act now",
        body: "Release pulled bed opens the movement at the release step. You decide whether to release it or keep it.",
      },
    ],
  },
  {
    id: "decide-referral",
    title: "Accept or decline a referral",
    keywords: "decide answer approve reject refuse referral",
    answer:
      "Press Decide on the referral, read it, then Accept referral or Decline referral. A decline needs a reason. Only the ward or team it was sent to can answer for itself.",
    desks: ["coordinator", "ward", "community"],
    go: "home",
    showMe: [
      {
        target: { sel: "#main-content button", text: "Decide" },
        title: "Referrals to decide",
        body: "They stay in wait order, oldest first. Press Decide to open one.",
      },
    ],
  },
  {
    id: "ask-more-wards",
    title: "Ask more wards",
    keywords: "send another ward more destinations parallel enquiry",
    answer:
      "Open the referral and choose Ask more wards, then tick the wards. They are listed A to Z and never ranked, and only a ward that fits can be ticked. The number asked at once is limited by Wards asked at once in Settings.",
    desks: ["coordinator"],
    go: "referrals",
    showMe: [
      {
        target: { sel: '[data-testid^="ward-referral-board-select-"]' },
        title: "Open the referral",
        body: "Select the patient's referral. Its panel has Ask more wards.",
      },
    ],
  },
  {
    id: "book-transport",
    title: "Book transport",
    keywords: "ambulance car transfer move patient escort",
    answer:
      "On the movement, press Book transport, or record that none is needed. The app records the booking for the transport officer; it does not order the vehicle itself.",
    desks: ["coordinator"],
    go: "movements",
  },
  {
    id: "cancel-transport",
    title: "Cancel transport",
    keywords: "stop ambulance unbook transfer",
    answer:
      "Open the movement and cancel the booked transport there. Do this before you release a pulled bed, so the officer is not sent for a patient whose bed has gone.",
    desks: ["coordinator"],
    go: "movements",
  },
  {
    id: "log-call",
    title: "Log a call",
    keywords: "phone rang record contact follow up callback",
    answer:
      "Open the referral and use Log a call, choosing who was rung and the outcome from the list. The next person sees who was called and when.",
    desks: ["coordinator"],
    go: "referrals",
    showMe: [
      {
        target: { sel: '[data-testid^="ward-referral-board-select-"]' },
        title: "Open the referral",
        body: "Log a call is in the referral's panel, with the owner desk.",
      },
    ],
  },
  {
    id: "new-referral",
    title: "Raise a new referral",
    keywords: "refer send create start new referral",
    answer:
      "Press New referral, choose the destinations (several can go at once), record the legal status if known, then send. Each destination answers on its own.",
    desks: ["coordinator", "ed", "community", "ward"],
    showMe: [
      {
        target: PRIMARY_ACTION,
        title: "New referral",
        body: "Starts a referral from any screen. Shift+R does the same on a keyboard.",
      },
    ],
  },
  {
    id: "sign-off-handover",
    title: "Hand over to the next shift",
    keywords: "handover handoff sign off shift change",
    answer:
      "Open Handover. Read Act now first, then what is due before the next handover. Work through Before you sign, then choose Sign off.",
    desks: ["coordinator", "ward", "bed_manager"],
    go: "handover",
    showMe: [
      {
        target: { sel: '[data-testid="ward-handover-kpi-strip"]' },
        title: "Start with Act now",
        body: "These counts open the rows they describe, act now first.",
      },
      {
        target: { sel: '[data-testid="ward-handover-sign-off-checks"]' },
        title: "Before you sign",
        body: "Each line here should be checked before you sign.",
      },
      {
        target: { sel: '[data-testid="ward-handover-sign-off-button"]' },
        title: "Sign off",
        body: "Records that the handover was given, with the time.",
      },
    ],
  },
  {
    id: "print-handover",
    title: "Print the handover sheet",
    keywords: "print paper copy present meeting",
    answer: "Open Handover and choose More, then Print handover. Present is there too, for the meeting screen.",
    desks: ["coordinator", "ward", "bed_manager"],
    go: "handover",
    showMe: [
      {
        target: { sel: '[data-testid="ward-handover-more"]' },
        title: "More",
        body: "Print handover and Present are in this menu.",
      },
    ],
  },
  {
    id: "confirm-numbers",
    title: "Confirm the ward's bed numbers",
    keywords: "morning count bed state update numbers census",
    answer:
      "On your ward's home, press Confirm numbers after checking ready, pulled, closed and occupied beds. The time you confirm shows on every screen, so others know how fresh the figure is.",
    desks: ["ward"],
    go: "home",
    showMe: [
      {
        target: { sel: '[data-testid^="ward-unit-card-"] button', text: "Confirm numbers" },
        title: "Confirm numbers",
        body: "Press this once the figures match the ward. The morning count is due by the time set in Settings.",
      },
    ],
  },
  {
    id: "answer-ward-referrals",
    title: "Answer the ward's referrals",
    keywords: "accept decline ward referral answer one by one",
    answer:
      "Open Referrals to answer, or Answer one by one on your ward's home, and accept or decline each. A decline needs a reason. A bed manager can see them but cannot answer for the ward.",
    desks: ["ward"],
    go: "home",
    showMe: [
      {
        target: { sel: '#main-content a[href$="/answer"]' },
        title: "Answer one by one",
        body: "Steps through the ward's referrals in wait order.",
      },
    ],
  },
  {
    id: "bed-board",
    title: "See every bed on the ward",
    keywords: "bed board list beds occupied ready closed leave place move",
    answer:
      "Every bed on your ward's home shows who is in each bed or whether it is ready, pulled, closed or held for a patient on leave. Use Place or move to put someone waiting in a bed or move someone to another bed.",
    desks: ["ward"],
    go: "home",
    showMe: [
      {
        target: { sel: '[data-testid="ward-open-bed-board"]' },
        title: "Place or move",
        body: "Opens the bed board to place someone waiting or move someone between beds. Open a bed for the patient in it.",
      },
    ],
  },
  {
    id: "tv",
    title: "Put the ward or bed meeting on a TV",
    keywords: "tv television screen display wall big screen meeting",
    answer:
      "Use On TV on a ward's home, or Open on TV on Capacity for the bed meeting. Open the link on the TV's browser; it is read only and shows names in full.",
    desks: ["coordinator", "ward", "bed_manager"],
    go: "capacity",
    showMe: [
      {
        target: { sel: '[data-testid="capacity-bed-meeting-tv"], [data-testid="ward-open-tv"]' },
        title: "Open on TV",
        body: "Opens the large-type view to show on the meeting room or ward TV.",
      },
    ],
  },
  {
    id: "find-bed",
    title: "See which wards have a bed that fits",
    keywords: "find bed vacancy availability free beds",
    answer:
      "Use Find a bed in the side menu: choose the age group, bed type, sex and legal status, then read the wards that fit and their free beds. They are listed in a fixed order; the app never picks one.",
    desks: ["ed"],
  },
  {
    id: "ed-raise",
    title: "Refer a patient from the ED",
    keywords: "ed emergency raise referral board patient",
    answer:
      "On your ED board, open the patient and use Raise referral. The ED's waiting list stays in wait order; flags highlight a row but never move it.",
    desks: ["ed"],
    go: "home",
    showMe: [
      {
        target: { sel: '[data-testid="ward-ed-raise-referral-toggle"], [data-testid^="ward-ed-patient-"]' },
        title: "Raise a referral",
        body: "Start from the patient's row on the board.",
      },
    ],
  },
  {
    id: "transport-job",
    title: "Record a transport job",
    keywords: "officer job collected pickup arrived",
    answer:
      "Open the job on My jobs to see the pickup, the destination and the booking, then record when the patient is collected.",
    desks: ["officer"],
    go: "home",
  },
  {
    id: "go-to-desk",
    title: "Go to another desk",
    keywords: "switch role desk change view ward ed workstation",
    answer:
      "Open the person menu at the foot of the side menu (the menu button on a phone) and choose Go to a desk. Each desk shows the screens its role uses.",
    desks: EVERY_DESK,
    showMe: [
      {
        target: DESK_SWITCH,
        title: "Go to a desk",
        body: "Opens the list of desks.",
      },
    ],
  },
  {
    id: "service-in-view",
    title: "Look at one health service",
    keywords: "service scope north south east metro wachs filter statewide",
    answer:
      "Use the service selector in the header to show one health service or the whole state. It changes what this screen shows, not anyone's access.",
    desks: ["coordinator", "bed_manager", "executive"],
    showMe: [
      {
        target: { sel: '[data-testid="ward-bar-service-trigger"]' },
        title: "Service in view",
        body: "Statewide, or one service.",
      },
    ],
  },
  {
    id: "alerts",
    title: "See alerts for my desk",
    keywords: "alerts tasks notifications bell to do",
    answer:
      "Press Alerts in the header (Tasks on some desks). Shift+T opens it on a keyboard. Each alert opens the record it is about.",
    desks: EVERY_DESK,
    showMe: [
      {
        target: { sel: '[data-testid="ward-bar-tasks-trigger"], [data-testid="ward-phone-dock"]' },
        title: "Alerts",
        body: "Everything addressed to this desk, newest first.",
      },
    ],
  },
  {
    id: "search-patient",
    title: "Find a patient",
    keywords: "search patient name umrn look up lookup",
    answer:
      "Type a name or UMRN in the header search. / or Ctrl+K jumps there on a keyboard. Questions such as no bed yet also work.",
    desks: CLINICAL_DESKS,
    showMe: [
      {
        target: { sel: '[data-testid="ward-global-search-input"]' },
        title: "Search",
        body: "Names, UMRNs, places and a few common questions.",
      },
    ],
  },
  {
    id: "pin-ward",
    title: "Pin a ward to my menu",
    keywords: "pin favourite my wards shortcut",
    answer: "Open the ward, then in the side menu choose Pin this ward. It stays under My wards on this device.",
    desks: ["coordinator", "bed_manager"],
    go: "wards",
  },
  {
    id: "theme",
    title: "Use dark mode or the glare theme",
    keywords: "dark light night glare bright theme colour appearance",
    answer: "Settings, Display, Theme: Auto, Light, Dark or Glare (for a bright room). It changes this device only.",
    desks: EVERY_DESK,
    go: "settings#display",
    showMe: [
      {
        target: setting("theme", "display"),
        title: "Theme",
        body: "In Settings, Display. It saves at once, on this device only.",
      },
    ],
  },
  {
    id: "density",
    title: "Fit more rows on screen",
    keywords: "compact density smaller rows more on screen",
    answer: "Settings, Display, Row density: Compact fits more rows on each screen.",
    desks: EVERY_DESK,
    go: "settings#display",
    showMe: [
      {
        target: setting("density", "display"),
        title: "Row density",
        body: "In Settings, Display: Comfortable or Compact.",
      },
    ],
  },
  {
    id: "notifications",
    title: "Get alerts when I am on another screen",
    keywords: "notifications browser phone push alert notify lock screen",
    answer:
      "Settings, Alerts: turn on Browser notifications for this computer, or Phone alerts for your phone. Both are for act-now and red alerts only.",
    desks: EVERY_DESK,
    go: "settings#alerts",
    showMe: [
      {
        target: setting("browser-notifications", "alerts"),
        title: "Browser notifications",
        body: "In Settings, Alerts. For this computer.",
      },
      {
        target: setting("phone-alerts", "alerts"),
        title: "Phone alerts",
        body: "In Settings, Alerts. For your phone, including the lock screen.",
      },
    ],
  },
  {
    id: "buzz",
    title: "Turn the buzz sound on or off",
    keywords: "sound chime audio noise mute buzz",
    answer: "Settings, Alerts, Buzz sound. Use its test to hear it.",
    desks: EVERY_DESK,
    go: "settings#alerts",
    showMe: [
      {
        target: setting("buzz", "alerts"),
        title: "Buzz sound",
        body: "In Settings, Alerts. A chime on an urgent buzz.",
      },
    ],
  },
  {
    id: "rules",
    title: "Change the pull time limit or ED target",
    keywords: "rules settings pull time limit ed target wards asked morning count warning surge",
    answer:
      "Settings, Rules. Change the value, then Save to apply. Each save is recorded in the audit and changes what every screen shows. Surge switches all timings to the busy-day set.",
    desks: ["coordinator", "admin"],
    go: "settings#rules",
    showMe: [
      {
        target: setting("pull-hold", "rules"),
        title: "Pull time limit",
        body: "In Settings, Rules. How long a pulled bed is kept for the patient.",
      },
      {
        target: setting("ed-target", "rules"),
        title: "ED wait target",
        body: "In Settings, Rules. An access measure only.",
      },
    ],
  },
  {
    id: "mha-times",
    title: "Why the app does not work out Mental Health Act times",
    keywords: "mha legal form time expiry due calculate detention",
    answer:
      "Ward Flow never works out Mental Health Act times or expiry. It shows only times someone typed from the paper form, and warns before those typed times using the form warnings in Settings.",
    desks: EVERY_DESK,
  },
  {
    id: "undo",
    title: "Undo something I just did",
    keywords: "undo mistake wrong reverse back",
    answer:
      "Many saves show Undo in the message at the foot of the screen while it is showing. After that, change the record back yourself; the history keeps both steps.",
    desks: EVERY_DESK,
  },
  {
    id: "downtime",
    title: "What to do if Ward Flow is down",
    keywords: "down offline outage paper downtime not working broken support help",
    answer:
      "Switch to the paper process. The downtime pack on Handover prints what you need. The app shows when it last saved, and says so when it is offline.",
    desks: EVERY_DESK,
    go: "handover",
    showMe: [
      {
        target: { sel: '#main-content a[href="/ward-flow/reports/downtime"]' },
        title: "Downtime pack",
        body: "Print it before you need it.",
      },
    ],
  },
  {
    id: "tour",
    title: "Take the tour again",
    keywords: "tour tutorial guide walkthrough learn start",
    answer: "Open Help and press Take the tour, or use Replay the tour in Settings, Display.",
    desks: EVERY_DESK,
  },
  {
    id: "statistics",
    title: "See the statistics",
    keywords: "statistics stats trends reports figures numbers",
    answer: "Open Statistics for the network's trends. Every figure is from synthetic records.",
    desks: ["executive", "coordinator", "bed_manager"],
    go: "statistics",
  },
  {
    id: "give-access",
    title: "Give or remove someone's access",
    keywords: "access account user role permission admin",
    answer: "Settings, Access: find the person, then give or remove a desk. Each change is recorded.",
    desks: ["admin"],
    go: "settings#access",
  },
];

/* Matching ----------------------------------------------------------------------------------- */

/** Words that carry no meaning in a question. */
const STOP = new Set(
  "a an and are can cant could do does for from get how i im in is it its me my of on or please should the this to use what when where which who why will with you your".split(
    " ",
  ),
);

/** Lower case with a few endings off, so "pulled", "pulls" and "pull", or "times" and "time", meet. */
function bareStem(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (w.length > 4 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 3 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 3 && /(ch|sh|x|ss)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

const STEM_FAMILY: ReadonlyMap<string, string> = new Map(
  HELP_SYNONYMS.map(([word, family]) => [bareStem(word), bareStem(family)]),
);

/** A word's stem, then its family. */
function stem(word: string): string {
  const bare = bareStem(word);
  return STEM_FAMILY.get(bare) ?? bare;
}

/** Every answer id, for checking a stored count against the answers that exist. */
export const HOW_TO_IDS: ReadonlySet<string> = new Set(HOW_TOS.map((howTo) => howTo.id));

/** The question's meaningful word stems, in order, without repeats. */
export function questionWords(query: string): readonly string[] {
  const words = query
    .split(/[\s,.?!/]+/)
    .filter((word) => word && !STOP.has(word.toLowerCase().replace(/'/g, "")))
    .map(stem)
    .filter((word) => word.length > 1);
  return [...new Set(words)];
}

const indexed = new WeakMap<HowTo, { strong: Set<string>; weak: Set<string> }>();
function wordsOf(howTo: HowTo) {
  let entry = indexed.get(howTo);
  if (!entry) {
    entry = {
      strong: new Set(questionWords(`${howTo.title} ${howTo.keywords}`)),
      weak: new Set(questionWords(howTo.answer)),
    };
    indexed.set(howTo, entry);
  }
  return entry;
}

let vocabulary: { list: readonly string[]; known: ReadonlySet<string> } | undefined;
/** Every word stem the how-tos hold, title and keyword words first, in list order. */
function howToVocabulary() {
  if (!vocabulary) {
    const strong = HOW_TOS.flatMap((howTo) => [...wordsOf(howTo).strong]);
    const weak = HOW_TOS.flatMap((howTo) => [...wordsOf(howTo).weak]);
    const list = [...new Set([...strong, ...weak])];
    vocabulary = { list, known: new Set(list) };
  }
  return vocabulary;
}

/**
 * Question words with small typos mended (P9): a word Help does not hold becomes the nearest word
 * it does, one slip away up to six letters and two beyond. Same words in, same words out.
 */
export function correctWords(words: readonly string[]): readonly string[] {
  const { list, known } = howToVocabulary();
  return [...new Set(words.map((word) => nearestWord(word, list, known)))];
}

export type HowToMatch = { readonly howTo: HowTo; readonly forThisDesk: boolean };

/**
 * The how-tos that answer `query`. A how-to answers when at least half the question's words are
 * in it. Those holding more of the words come first, then this desk's own, then those whose title
 * or keywords hold the words (three times a word in the answer). Ties keep the list's own order,
 * so the same words always give the same answers. Answers scoring under half the best are dropped.
 */
export function askHelp(query: string, role: WardTourRole, limit = 6): readonly HowToMatch[] {
  const words = correctWords(questionWords(query));
  if (words.length === 0) return [];
  const needed = Math.max(1, Math.ceil(words.length / 2));
  const scored = HOW_TOS.flatMap((howTo, order) => {
    const { strong, weak } = wordsOf(howTo);
    let hits = 0;
    let score = 0;
    for (const word of words) {
      if (strong.has(word)) {
        hits += 1;
        score += 3;
      } else if (weak.has(word)) {
        hits += 1;
        score += 1;
      }
    }
    if (hits < needed) return [];
    const forThisDesk = howTo.desks === EVERY_DESK || howTo.desks.includes(role);
    return [{ howTo, forThisDesk, hits, score, order }];
  });
  // An answer far weaker than the best (one shared word such as "bed") is noise, not a lead.
  const best = Math.max(0, ...scored.map((entry) => entry.score));
  return scored
    .filter((entry) => entry.score * 2 >= best)
    .sort(
      (a, b) =>
        b.hits - a.hits || Number(b.forThisDesk) - Number(a.forThisDesk) || b.score - a.score || a.order - b.order,
    )
    .slice(0, limit)
    .map(({ howTo, forThisDesk }) => ({ howTo, forThisDesk }));
}

/**
 * When nothing answers (P9): up to `limit` how-tos sharing any one question word, most shared first,
 * this desk's own before others, then list order. Empty when no word is shared at all.
 */
export function closestHowTos(query: string, role: WardTourRole, limit = 3): readonly HowToMatch[] {
  const words = correctWords(questionWords(query));
  if (words.length === 0) return [];
  return HOW_TOS.flatMap((howTo, order) => {
    const { strong, weak } = wordsOf(howTo);
    const score = words.reduce((sum, word) => sum + (strong.has(word) ? 3 : weak.has(word) ? 1 : 0), 0);
    const forThisDesk = howTo.desks === EVERY_DESK || howTo.desks.includes(role);
    return score ? [{ howTo, forThisDesk, score, order }] : [];
  })
    .sort((a, b) => b.score - a.score || Number(b.forThisDesk) - Number(a.forThisDesk) || a.order - b.order)
    .slice(0, limit)
    .map(({ howTo, forThisDesk }) => ({ howTo, forThisDesk }));
}
