import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { SupportNotificationChecklist } from "@/components/ward-management/movements/support-notification-checklist";
import { clockTextToInstantNotAfter } from "@/components/ward-management/ward-support-notifications";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderChecklist(props: Parameters<typeof SupportNotificationChecklist>[0]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <SupportNotificationChecklist {...props} />
    </WardFlowProvider>,
  );
}

describe("carer, PSP and MHAS checklist", () => {
  it("shows three outstanding parties for an involuntary arrival, advisory, with no legal deadline", () => {
    renderChecklist({ movementId: "WF-300", role: "coordinator" });
    const panel = screen.getByTestId("ward-support-notifications");
    expect(within(panel).getByText(/Admission · Advisory · 0 of 3/)).toBeInTheDocument();
    expect(within(panel).getAllByText("Not recorded")).toHaveLength(3);
    expect(panel.textContent).not.toMatch(/due|deadline|overdue|within \d+ (hours|days)/i);
  });

  it("renders nothing for a move the checklist does not cover", () => {
    renderChecklist({ movementId: "WF-001", role: "coordinator" });
    expect(screen.queryByTestId("ward-support-notifications")).not.toBeInTheDocument();
  });

  it("records who was told, then not applicable with a reason", () => {
    renderChecklist({ movementId: "WF-300", role: "coordinator" });
    fireEvent.click(screen.getByRole("button", { name: "Record Carer" }));
    const form = screen.getByRole("form", { name: "Record Carer" });
    expect(within(form).getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(within(form).getByLabelText("Who was told"), { target: { value: "Synthetic carer" } });
    fireEvent.change(within(form).getByLabelText(/Time told/), { target: { value: "09:15" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(screen.queryByRole("form", { name: "Record Carer" })).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-support-notification-carer")).toHaveTextContent("Told Synthetic carer · 09:15");

    fireEvent.click(screen.getByRole("button", { name: "Record Mental Health Advocacy Service" }));
    const mhas = screen.getByRole("form", { name: "Record Mental Health Advocacy Service" });
    fireEvent.click(within(mhas).getByRole("radio", { name: "Not applicable" }));
    fireEvent.change(within(mhas).getByLabelText("Reason"), { target: { value: "Synthetic reason" } });
    fireEvent.click(within(mhas).getByRole("button", { name: "Save" }));
    expect(screen.getByTestId("ward-support-notification-mhas")).toHaveTextContent("Not applicable · Synthetic reason");
    expect(screen.getByText(/2 of 3/)).toBeInTheDocument();
  });

  it("keeps the form open and says why when the time is not a clock time", () => {
    renderChecklist({ admissionId: "AD-LEFT-01", role: "coordinator" });
    expect(screen.getByText(/Discharge · Advisory/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Record Personal support person" }));
    const form = screen.getByRole("form", { name: "Record Personal support person" });
    fireEvent.change(within(form).getByLabelText("Who was told"), { target: { value: "Synthetic PSP" } });
    fireEvent.change(within(form).getByLabelText(/Time told/), { target: { value: "25:00" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(screen.getByRole("form", { name: "Record Personal support person" })).toBeInTheDocument();
    expect(screen.getByText(/Enter a 24-hour time/)).toBeInTheDocument();
  });
});

describe("clock time to instant", () => {
  it("takes today's time when it has passed and yesterday's when it has not", () => {
    const now = 3 * 1440 + 600; // 10:00 on day 3
    expect(clockTextToInstantNotAfter("09:00", now)).toBe(3 * 1440 + 540);
    expect(clockTextToInstantNotAfter("10:00", now)).toBe(now);
    expect(clockTextToInstantNotAfter("11:00", now)).toBe(2 * 1440 + 660);
    expect(clockTextToInstantNotAfter("9:00", now)).toBeNull();
    expect(clockTextToInstantNotAfter("24:00", now)).toBeNull();
  });
});
