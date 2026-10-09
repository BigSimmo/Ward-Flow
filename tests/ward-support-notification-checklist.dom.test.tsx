import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { SupportNotificationChecklist } from "@/components/ward-management/movements/support-notification-checklist";
import { clockTextOnDay } from "@/components/ward-management/ward-support-notifications";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderChecklist(props: Parameters<typeof SupportNotificationChecklist>[0]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <SupportNotificationChecklist {...props} />
    </WardFlowProvider>,
  );
}

describe("carer, PSP and MHAS checklist", () => {
  it("shows three outstanding parties for an involuntary discharge, advisory, with no legal deadline", () => {
    renderChecklist({ admissionId: "AD-LEFT-01", role: "coordinator" });
    const panel = screen.getByTestId("ward-support-notifications");
    expect(within(panel).getByText(/Discharge · Advisory · 0 of 3/)).toBeInTheDocument();
    expect(within(panel).getAllByText("Not recorded")).toHaveLength(3);
    expect(panel.textContent).not.toMatch(/due|deadline|overdue|within \d+ (hours|days)/i);
  });

  it("renders nothing for a move the checklist does not cover", () => {
    renderChecklist({ movementId: "WF-001", role: "coordinator" });
    expect(screen.queryByTestId("ward-support-notifications")).not.toBeInTheDocument();
  });

  it("is read-only for a role the event does not allow", () => {
    renderChecklist({ admissionId: "AD-LEFT-01", role: "ed" });
    expect(screen.getByTestId("ward-support-notifications")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Record / })).not.toBeInTheDocument();
  });

  it("keeps the day told, so yesterday and two-days-ago morning stay on those days", () => {
    renderChecklist({ admissionId: "AD-LEFT-01", role: "ward" });
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

  it("records who was told, then not applicable with a reason", () => {
    renderChecklist({ admissionId: "AD-LEFT-01", role: "coordinator" });
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
    expect(screen.getByText(/Enter the time as HH:MM/)).toBeInTheDocument();
  });
});

describe("clock time on a chosen day", () => {
  it("places the typed time on today, yesterday or the day before, and refuses anything else", () => {
    const now = 3 * 1440 + 600; // 10:00 on day 3
    expect(clockTextOnDay("09:00", 0, now)).toBe(3 * 1440 + 540);
    expect(clockTextOnDay("10:00", 0, now)).toBe(now);
    expect(clockTextOnDay("11:00", 0, now)).toBe(3 * 1440 + 660);
    expect(clockTextOnDay("11:00", 1, now)).toBe(2 * 1440 + 660);
    expect(clockTextOnDay("23:30", 2, now)).toBe(1 * 1440 + 1410);
    expect(clockTextOnDay("9:00", 0, now)).toBeNull();
    expect(clockTextOnDay("24:00", 0, now)).toBeNull();
    expect(clockTextOnDay("09:00", 3, now)).toBeNull();
  });

  it("keeps yesterday and two-days-ago morning off today's latest same clock time", () => {
    const now = 3 * 1440 + 600; // 10:00 on day 3
    const todayMorning = clockTextOnDay("09:00", 0, now);
    const yesterdayMorning = clockTextOnDay("09:00", 1, now);
    const twoDaysAgoMorning = clockTextOnDay("09:00", 2, now);
    expect(todayMorning).toBe(3 * 1440 + 540);
    expect(yesterdayMorning).toBe(2 * 1440 + 540);
    expect(twoDaysAgoMorning).toBe(1 * 1440 + 540);
    expect(yesterdayMorning).not.toBe(todayMorning);
    expect(twoDaysAgoMorning).not.toBe(todayMorning);
    expect(twoDaysAgoMorning).not.toBe(yesterdayMorning);
  });

  it("says so, and keeps the form open, when today's time is later than now", () => {
    renderChecklist({ admissionId: "AD-LEFT-01", role: "coordinator" });
    fireEvent.click(screen.getByRole("button", { name: "Record Carer" }));
    const form = screen.getByRole("form", { name: "Record Carer" });
    fireEvent.change(within(form).getByLabelText("Who was told"), { target: { value: "Synthetic carer" } });
    fireEvent.change(within(form).getByLabelText(/Time told/), { target: { value: "23:59" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(screen.getByRole("form", { name: "Record Carer" })).toBeInTheDocument();
    expect(screen.getByText("That time is later than now")).toBeInTheDocument();
  });
});
