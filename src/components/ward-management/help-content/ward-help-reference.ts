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
