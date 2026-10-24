// Home placement redesign, Josh 19 Oct 2026: desktop Home scrolls once, so the priority queue
// shows its top 10 rows and a "Show all (N)" button reveals the rest in place. Suites that pick a
// patient further down the queue open the whole queue first, through that button, as a
// coordinator would.
//
// Home v7, Josh 22 Oct 2026: Home opens on My list, and the priority queue sits behind the
// "Everyone waiting" switch, so the queue helpers choose it first, as a coordinator would.
import { fireEvent, screen } from "@testing-library/react";

/** Switches Home's list to Everyone waiting (the priority queue); does nothing when it is showing. */
export function showEveryoneWaiting(): void {
  const everyone = screen.queryByRole("radio", { name: /^Everyone waiting/u });
  if (everyone && everyone.getAttribute("aria-checked") !== "true") fireEvent.click(everyone);
}

/** Reveals every queue row when the queue is capped; does nothing when it already shows them all. */
export function showWholeHomeQueue(): void {
  showEveryoneWaiting();
  const showAll = screen.queryByTestId("ward-queue-show-all");
  if (showAll && showAll.getAttribute("aria-expanded") !== "true") fireEvent.click(showAll);
}
