// Home placement redesign, Josh 19 Oct 2026: desktop Home scrolls once, so the priority queue
// shows its top 10 rows and a "Show all (N)" button reveals the rest in place. Suites that pick a
// patient further down the queue open the whole queue first, through that button, as a
// coordinator would.
import { fireEvent, screen } from "@testing-library/react";

/** Reveals every queue row when the queue is capped; does nothing when it already shows them all. */
export function showWholeHomeQueue(): void {
  const showAll = screen.queryByTestId("ward-queue-show-all");
  if (showAll && showAll.getAttribute("aria-expanded") !== "true") fireEvent.click(showAll);
}
