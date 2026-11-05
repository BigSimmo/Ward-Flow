// Home placement redesign, Josh 19 Oct 2026: desktop Home scrolls once, so the priority queue
// shows its top 10 rows and a "Show all (N)" button reveals the rest in place. Suites that pick a
// patient further down the queue open the whole queue first, through that button, as a
// coordinator would.
//
// Home v7, Josh 22 Oct 2026: Home opens on My list, and the priority queue sits behind the
// "Everyone waiting" switch, so the queue helpers choose it first, as a coordinator would. Home and
// Activity (Josh, 31 Oct 2026) renamed that switch "Waiting", beside My List and Planned; Q260 (2 Nov
// 2026) renamed it "Open", as it lists every open movement.
//
// Home flow (Q340, Q345, 3 Nov 2026): the queue is the "Flow" tab, grouped by stage, each stage
// showing its oldest 5 rows with its own "Show all N" button.
import { fireEvent, screen } from "@testing-library/react";

/** Switches Home's list to Flow (the open movements by stage); does nothing when it is showing. */
export function showEveryoneWaiting(): void {
  const flow = screen.queryByRole("radio", { name: /^Flow/u });
  if (flow && flow.getAttribute("aria-checked") !== "true") fireEvent.click(flow);
}

/** Reveals every row in every stage; does nothing when they already show them all. */
export function showWholeHomeQueue(): void {
  showEveryoneWaiting();
  for (const showAll of screen.queryAllByRole("button", { name: /^Show all \d+/u })) {
    if (showAll.getAttribute("aria-expanded") !== "true") fireEvent.click(showAll);
  }
}
