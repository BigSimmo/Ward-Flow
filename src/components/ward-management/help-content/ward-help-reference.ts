import { HOW_TOS } from "../help/ward-help-howto";
import { SCREEN_HELP } from "../help/ward-help-content";
import { SAVED_OR_NOT, WHEN_IT_IS_DOWN } from "../help/ward-help-guide";

/** Existing desk-guide wording; shared by Reference and local search. */
export const ACCESSIBILITY_HELP = [
  {
    title: "The colour code works without colour",
    text: "Each colour has its own shape, everywhere in the app, and the word beside it says what it means. A screen reader reads the word, not the shape.",
  },
  { title: "Display settings", text: "Open Settings, then Display." },
  {
    title: "Theme",
    text: "Auto, Light, Dark or Bright light. Bright light is a plain light screen for strong light. It stays light even if your device is dark.",
  },
  { title: "High contrast", text: "Stronger edges and ink. Faint lines and grey words become full ink." },
  { title: "Reduce motion", text: "Stops slides and pulses." },
  {
    title: "Keyboard",
    text: "Ctrl+K (Cmd+K on a Mac) always opens search. Settings can turn off the single-key shortcuts. Shortcuts never fire while you are typing in a field.",
  },
] as const;

/** Answers remain references to their existing source, never independently maintained copies. */
export const COMMON_QUESTIONS = [
  ...SAVED_OR_NOT.map((answer, index) => ({
    question:
      [
        "How do I know an action was saved?",
        "What if an action was not recorded?",
        "What if the connection is unavailable?",
      ][index] ?? "Is it saved?",
    answer,
  })),
  { question: "What if Ward Flow is down?", answer: WHEN_IT_IS_DOWN.join(" ") },
  ...Object.values(SCREEN_HELP).flatMap((screen) => screen.questions ?? []),
].filter((item, index, all) => all.findIndex((other) => other.question === item.question) === index);

/** Touch, navigation and the existing guided controls; no invented gestures. */
export const INTERACTIONS_HELP = [
  { title: "Touch", text: SCREEN_HELP.referrals.phoneActions?.[2] ?? SCREEN_HELP.referrals.actions[0] },
  {
    title: "Show me",
    text: "Show me highlights a control on the screen.",
  },
  { title: "Go there", text: "Go there opens the screen for that job. Help only links to screens your desk can open." },
  { title: "Undo", text: HOW_TOS.find((item) => item.id === "undo")!.answer },
];

/** The kinds of device Reference speaks to: a phone, a tablet (touch, perhaps a keyboard) and a computer. */
export type HelpDevice = "phone" | "tablet" | "desk";

/**
 * TOUCH AND GESTURES (Help expansion, 5 Nov 2026): only the gestures the app really answers, each
 * with the devices it applies to. Checked against the source: the sheet grip and the phone referral
 * panel close on a downward drag (`wf/sheet.tsx`, `use-ward-referral-drawer-state.ts`), chip rows
 * scroll sideways, the page never blocks the browser's own zoom (`app/layout.tsx` viewport), and the
 * tour and Show me step on a sideways swipe (`ward-tour.tsx`, `ward-show-me.tsx`). No long press,
 * pull to refresh or pinch inside a chart, because none is built.
 */
export const TOUCH_HELP: readonly { title: string; text: string; devices: readonly HelpDevice[] }[] = [
  {
    title: "Tap to open",
    text: "Tap a row to open it. The back arrow returns to the list.",
    devices: ["phone", "tablet"],
  },
  {
    title: "Swipe down to close",
    text: "Drag a panel's grip, the short bar at its top, down to close it. A short drag springs back.",
    devices: ["phone"],
  },
  {
    title: "Swipe in the tour and Show me",
    text: "Swipe left for the next step and right to go back. Next and Back do the same.",
    devices: ["phone", "tablet"],
  },
  {
    title: "Scroll a row of choices",
    text: "A row of chips that runs off the edge scrolls sideways with one finger.",
    devices: ["phone"],
  },
  {
    title: "Pinch to zoom",
    text: "Pinch to make the page bigger, as in any browser. Ward Flow never blocks it. For larger text everywhere, use your device's text size.",
    devices: ["phone", "tablet"],
  },
  {
    title: "Greyed buttons say why",
    text: "A greyed button says why it cannot be used yet. Point at it or move to it with Tab to read the reason.",
    devices: ["desk", "tablet"],
  },
];

/** How each kind of device is used, for Reference's device card and the keys button beneath it. */
export const DEVICE_INPUT_HELP: Readonly<Record<HelpDevice, { title: string; text: string; keys: boolean }>> = {
  phone: {
    title: "Phone, touch",
    text: "The menu button at the top opens every screen your desk uses. Keyboard shortcuts need a keyboard, so a phone mostly uses touch.",
    keys: false,
  },
  tablet: {
    title: "Tablet, touch and keyboard",
    text: "Touch works as on a phone. With a keyboard attached, the same shortcuts work as on a computer, and they never fire while you type in a field.",
    keys: true,
  },
  desk: {
    title: "Computer, mouse and keyboard",
    text: "Ctrl+K (Cmd+K on a Mac) opens search from anywhere. Press ? for every shortcut your desk can use.",
    keys: true,
  },
};
