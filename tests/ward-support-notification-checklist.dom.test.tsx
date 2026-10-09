import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { SupportNotificationChecklist } from "@/components/ward-management/movements/support-notification-checklist";
import { contactClockTextToInstant } from "@/components/ward-management/ward-support-notifications";
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

  it("keeps yesterday and two-days-ago morning contacts on those days instead of collapsing to today", () => {
    renderChecklist({ movementId: "WF-300", role: "coordinator" });

    fireEvent.click(screen.getByRole("button", { name: "Record Carer" }));
    const carer = screen.getByRole("form", { name: "Record Carer" });
    fireEvent.change(within(carer).getByLabelText("Who was told"), { target: { value: "Synthetic carer" } });
    fireEvent.click(within(carer).getByRole("radio", { name: "Yesterday" }));
    fireEvent.change(within(carer).getByLabelText(/Time told/), { target: { value: "09:00" } });
    fireEvent.click(within(carer).getByRole("button", { name: "Save" }));
    expect(screen.getByTestId("ward-support-notification-carer")).toHaveTextContent(
      "Told Synthetic carer · 09:00 yesterday",
    );

    fireEvent.click(screen.getByRole("button", { name: "Record Personal support person" }));
    const psp = screen.getByRole("form", { name: "Record Personal support person" });
    fireEvent.change(within(psp).getByLabelText("Who was told"), { target: { value: "Synthetic PSP" } });
    fireEvent.click(within(psp).getByRole("radio", { name: "2 days ago" }));
    fireEvent.change(within(psp).getByLabelText(/Time told/), { target: { value: "08:30" } });
    fireEvent.click(within(psp).getByRole("button", { name: "Save" }));
    expect(screen.getByTestId("ward-support-notification-personal_support_person")).toHaveTextContent(
      "Told Synthetic PSP · 08:30, 2 days ago",
    );
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
    expect(screen.getByText(/Enter the time as HH:MM/)).toBeInTheDocument();
  });
});

describe("contact day and clock time to instant", () => {
  it("keeps yesterday and two-days-ago morning on those days instead of the latest same clock time", () => {
    const now = 3 * 1440 + 600; // 10:00 on day 3
    expect(contactClockTextToInstant("09:00", "today", now)).toBe(3 * 1440 + 540);
    expect(contactClockTextToInstant("09:00", "yesterday", now)).toBe(2 * 1440 + 540);
    expect(contactClockTextToInstant("09:00", "two_days_ago", now)).toBe(1 * 1440 + 540);
    expect(contactClockTextToInstant("10:00", "today", now)).toBe(now);
    expect(contactClockTextToInstant("11:00", "today", now)).toBeNull();
    expect(contactClockTextToInstant("9:00", "today", now)).toBeNull();
    expect(contactClockTextToInstant("24:00", "yesterday", now)).toBeNull();
  });
});
