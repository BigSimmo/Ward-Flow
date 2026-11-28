/**
 * Show me targets and shared walks used by the how-to lists (`ward-help-howto.ts` and
 * `ward-help-howto-jobs-late.ts`). Test ids, ids and accessible text only, never class names.
 */
import type { WardTourRole } from "./ward-help-store";
import type { TourTarget } from "./ward-tour-steps";
import type { ShowMeStep } from "./ward-help-howto";

export const EVERY_DESK = "all";
export const CLINICAL_DESKS: readonly WardTourRole[] = [
  "coordinator",
  "ward",
  "ed",
  "community",
  "bed_manager",
  "officer",
];

export const PRIMARY_ACTION: TourTarget = {
  sel: '[data-testid="ward-bar-primary-action"], [data-testid="ward-phone-create"]',
};
export const DESK_SWITCH: TourTarget = {
  sel: '[data-testid="ward-rail-persona-trigger"], [data-testid="ward-bar-phone-menu"]',
};
/** A Settings row; on a phone, whose rows sit in a sheet per tab, the tab's row in the list. */
export const setting = (id: string, tab: string): TourTarget => ({
  sel: `[data-setting="${id}"], [data-testid="ward-settings-phone-area-${tab}"]`,
});

/** A control by its test id, or by the fixed start of a test id built per record. */
export const tid = (testId: string): TourTarget => ({ sel: `[data-testid="${testId}"]` });
export const tidStart = (testId: string): TourTarget => ({ sel: `[data-testid^="${testId}"]` });
/**
 * A control inside the sheet or dialog the person has just opened, found by its words. `up` climbs
 * from a field's label to the field round it, so the box and its label are lit together.
 */
export const opened = (element: string, text: string, up?: number): TourTarget => ({
  sel: `[role="dialog"] ${element}`,
  text,
  ...(up ? { up } : {}),
});
/** A control on the page itself, found by its words. */
export const onPage = (element: string, text: string): TourTarget => ({ sel: `#main-content ${element}`, text });

/**
 * The transport booking form every screen opens (`transport-booking-form.tsx`), in the order it asks.
 * Each step lights the field in the dialog or sheet the person opened, so one walk fits every desk.
 */
export const BOOKING_FORM: readonly ShowMeStep[] = [
  {
    target: opened("label", "Who is collecting", 2),
    title: "Who is collecting",
    body: "Choose the provider the booking was made with by phone.",
  },
  {
    target: opened("label", "CAD transport number", 2),
    title: "CAD transport number",
    body: "Read it off the call with the provider. Left empty, the booking saves as CAD to follow.",
  },
  {
    target: opened("label", "Estimated time", 2),
    title: "Estimated time",
    body: "The time the provider quoted, like 2:40 pm or 14:40, or press a quick time. Then answer Today or tomorrow?",
  },
  {
    target: opened("fieldset", "Escort needed?"),
    title: "Escort needed?",
    body: "Choose Escort required or No escort required.",
  },
  {
    target: opened("fieldset", "voluntary or involuntary"),
    title: "Voluntary or involuntary",
    body: "Legal now shows under it to check against. If your answer differs, the form asks why.",
  },
  {
    target: opened("button", "Record booking"),
    title: "Record booking",
    body: "Saves once every answer is in. Pressed early, it takes you to the first answer still needed.",
  },
];

/** The referral form New referral opens, in the order it asks, from its own test ids. */
export const REFERRAL_FORM: readonly ShowMeStep[] = [
  {
    target: tidStart("ward-referral-refer-to-"),
    title: "Refer to",
    body: "A ward, a community team or an ED. The steps below change to suit.",
  },
  {
    device: "desk",
    target: [tid("ward-referral-new-patient-toggle"), tid("ward-referral-no-patient")],
    title: "The patient",
    body: "Find the patient, or choose Add patient for someone new. Not yet identified covers a person whose name is not known.",
  },
  {
    device: "desk",
    target: [
      tid("ward-referral-use-catchment"),
      tid("ward-referral-catchment-not-known"),
      tid("ward-referral-suburb-note"),
    ],
    title: "Catchment",
    body: "Worked out from the suburb on the record. Use this catchment to accept it, or choose another.",
  },
  {
    target: [tid("ward-referral-summary-rail"), tid("ward-referral-phone-continue")],
    title: "Before you send",
    body: "Lists each step still needed. Choose the destinations and the legal status if known; a step opens from its row.",
  },
  {
    device: "desk",
    target: tid("ward-referral-save-draft"),
    title: "Save draft",
    body: "Keeps the referral in this tab until it reloads, if you are called away.",
  },
  {
    target: [tid("ward-referral-send-locked"), tid("ward-referral-send-early"), tid("ward-referral-phone-continue")],
    title: "Review and send",
    body: "Stays locked until every step is in. Then Review and send shows a last check: press Confirm and send.",
  },
];
