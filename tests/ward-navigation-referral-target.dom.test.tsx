import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/ward-flow/referrals");
});
function mount() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReferralBoard defaultSelectFirst />
    </WardFlowProvider>,
  );
}
function detail() {
  return screen.getByRole("region", { name: "Selected referral detail" });
}
async function navigate(id: string) {
  await act(async () => {
    window.history.pushState(window.history.state, "", `/ward-flow/referrals?referral=${encodeRecordAddress(id)}`);
  });
}
describe("navigation 97 referral targets", () => {
  it("does not substitute the first queued record for a missing explicit target", async () => {
    window.history.replaceState(
      null,
      "",
      `/ward-flow/referrals?referral=${encodeRecordAddress("RF-SYNTHETIC-MISSING")}`,
    );
    mount();
    expect(await screen.findByText(/requested referral is unavailable/)).toBeInTheDocument();
    expect(detail()).toHaveAttribute("data-has-selection", "false");
  });
  it("honours a new same-route target after manual selection and after close", async () => {
    window.history.replaceState(null, "", "/ward-flow/referrals");
    const view = mount();
    const rows = screen.getAllByTestId(/^ward-referral-board-(card-)?select-/);
    const first = rows[0]!;
    const second = rows.find((row) => row.getAttribute("data-testid") !== first.getAttribute("data-testid"))!;
    const id = second.getAttribute("data-testid")!.replace(/^ward-referral-board-(card-)?select-/, "");
    fireEvent.click(first);
    await navigate(id);
    await waitFor(() => expect(screen.getByTestId(`ward-referral-inspector-priority-${id}`)).toBeInTheDocument());
    view.rerender(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralBoard defaultSelectFirst />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId(`ward-referral-inspector-priority-${id}`)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(detail()).toHaveAttribute("data-has-selection", "false"));
    await navigate("RF-SYNTHETIC-MISSING");
    await navigate(id);
    await waitFor(() => expect(screen.getByTestId(`ward-referral-inspector-priority-${id}`)).toBeInTheDocument());
  });
});
