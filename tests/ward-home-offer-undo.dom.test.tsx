import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { ToastProvider } from "@/components/wf";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { showWholeHomeQueue } from "./helpers/ward-home-queue";

/**
 * v10 Home (pass 3): overriding the shortlist needs a reason and a second sign-off tick before
 * Record override acts.
 *
 * Home v7 (Josh, 22 Oct 2026): State bedflow moved to the foot of Capacity, where no patient is
 * chosen, so its Offer with Undo is no longer on Home and its two cases were retired with it.
 */

const MOVEMENT_ID = "WF-030";

function renderHome(movementId = MOVEMENT_ID) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <CoordinatorScreen />
      </ToastProvider>
    </WardFlowProvider>,
  );
  // Home placement redesign, Josh 19 Oct 2026: desktop Home shows the queue's top 10 behind
  // "Show all (N)"; this suite reads rows further down, so it opens the whole queue first.
  showWholeHomeQueue();
  fireEvent.click(screen.getByTestId(`ward-queue-row-${movementId}`));
}

describe("Placement override needs a second sign-off", () => {
  it("keeps Record override inert until a reason is chosen and the second sign-off is ticked", () => {
    renderHome();
    const shortlist = screen.getByLabelText("Placement");
    // L3 (12 Oct 2026): an accepted patient's card leads with the next step; the bed list and the
    // override sit behind "Find another bed".
    const another = within(shortlist).queryByTestId("ward-shortlist-find-another-bed");
    if (another) fireEvent.click(another);
    fireEvent.click(within(shortlist).getAllByTestId(/^ward-shortlist-candidate-/u)[0]!);
    fireEvent.click(within(shortlist).getByTestId("ward-shortlist-override-toggle"));

    const submit = within(shortlist).getByRole("button", { name: "Record override" });
    expect(submit).toHaveAttribute("aria-disabled", "true");

    const reason = shortlist.querySelector<HTMLSelectElement>("#ward-shortlist-override-reason")!;
    const firstReason = Array.from(reason.options).find((option) => option.value !== "")!;
    fireEvent.change(reason, { target: { value: firstReason.value } });
    expect(submit).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(within(shortlist).getByTestId("ward-shortlist-override-second-sign-off"));
    // v10 pass 3: who signed off is now recorded, so a typed name is required too.
    expect(submit).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(within(shortlist).getByTestId("ward-shortlist-override-sign-off-name"), {
      target: { value: "J. Synthetic" },
    });
    expect(submit).not.toHaveAttribute("aria-disabled");
    expect(within(shortlist).getByTestId("ward-shortlist-override-second-sign-off-note")).toHaveTextContent(
      "Recorded with the override and its audit entry.",
    );
  });
});
