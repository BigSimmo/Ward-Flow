// WH1 (Josh, 3 Nov 2026): the bed drawer's pick one lists are kit chips (a labelled group of
// pressed buttons), not browser drop-downs. These read and change one the way a test used to read
// and change a select.
import { fireEvent, screen, within } from "@testing-library/react";
import {
  observationLevelName,
  observationRatio,
  type ObservationLevel,
} from "@/components/ward-management/ward-observation";

/** The chip group named `name` ("Held up by", "Where are they going?"). */
export function getChoice(name: string | RegExp, container?: HTMLElement): HTMLElement {
  return (container ? within(container) : screen).getByRole("group", { name });
}

/** Presses the chip labelled `label` in the group named `name`. */
export function chooseChip(name: string | RegExp, label: string | RegExp, container?: HTMLElement) {
  fireEvent.click(within(getChoice(name, container)).getByRole("button", { name: label }));
}

/** The pressed chip's label in the group named `name`, or "" when none is pressed. */
export function chosenChip(name: string | RegExp, container?: HTMLElement): string {
  return (
    within(getChoice(name, container))
      .queryAllByRole("button", { pressed: true })
      .map((chip) => chip.textContent ?? "")[0] ?? ""
  );
}

/** The observation level chip as the control labels it ("Constant within sight (1:1)"). */
function levelLabel(level: ObservationLevel): string {
  const ratio = observationRatio(level);
  return ratio ? `${observationLevelName(level)} (${ratio})` : observationLevelName(level);
}

/** Chooses an observation level in an open observation control. */
export function pickObservationLevel(level: ObservationLevel, container?: HTMLElement) {
  const group = (container ? within(container) : screen).getByTestId("ward-observation-level");
  fireEvent.click(within(group).getByRole("button", { name: levelLabel(level) }));
}

/** Chooses how often Intermittent observation checks, in an open observation control. */
export function pickObservationInterval(minutes: number, container?: HTMLElement) {
  const group = (container ? within(container) : screen).getByTestId("ward-observation-interval");
  fireEvent.click(within(group).getByRole("radio", { name: `${minutes} minutes` }));
}
