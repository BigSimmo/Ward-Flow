// tests/ward-planned-admissions-panel.dom.test.tsx
//
// The planned admissions panel on the Capacity screen (stream D): the fourteen-day strip, the
// agenda, and booking, cancelling and recording an arrival through the real provider.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { PlannedAdmissionsPanel } from "@/components/ward-management/capacity/planned-admissions-panel";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderPanel() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PlannedAdmissionsPanel now={NOW_ANCHOR} />
    </WardFlowProvider>,
  );
}

describe("planned admissions panel", () => {
  it("counts the seeded bookings per day and lists them, flagging the overdue one", () => {
    renderPanel();
    expect(screen.getByTestId("ward-planned-day-0")).toHaveTextContent("1");
    expect(screen.getByTestId("ward-planned-day-1")).toHaveTextContent("1");
    expect(screen.getByTestId("ward-planned-day-2")).toHaveTextContent("·");
    expect(screen.getByTestId("ward-planned-day-3")).toHaveTextContent("1");
    const list = screen.getByRole("list", { name: "Booked planned admissions" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByTestId("ward-planned-PA-SEED-03")).toHaveTextContent(/arrival not recorded/);
    expect(screen.getByTestId("ward-planned-PA-SEED-01")).toHaveTextContent("Initials JM");
    // A linked patient is shown by name through the resolver, never by record id.
    expect(screen.getByTestId("ward-planned-PA-SEED-02")).not.toHaveTextContent("PT-007");
    // No booking id is ever shown.
    expect(document.body.textContent).not.toMatch(/PA-/);
  });

  it("shows a refusal from the eligibility gates without the booking id", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("ward-planned-book"));
    fireEvent.change(screen.getByTestId("ward-planned-who"), { target: { value: "initials" } });
    fireEvent.change(screen.getByTestId("ward-planned-initials"), { target: { value: "cd" } });
    fireEvent.change(screen.getByTestId("ward-planned-unit"), { target: { value: "fsh-adult-secure" } });
    fireEvent.click(screen.getByTestId("ward-planned-submit"));
    fireEvent.click(within(screen.getByTestId("ward-planned-PA-01")).getByRole("button", { name: "Arrived" }));
    expect(screen.getByTestId("ward-planned-refusal")).toHaveTextContent(/gender_designation/);
    expect(screen.getByTestId("ward-planned-PA-01")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/PA-/);
  });

  it("names the person on the overdue row in Alerts, never the booking id", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );
    expect(screen.getAllByText("Initials RK").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/PA-SEED/);
    for (const link of Array.from(document.querySelectorAll("a[href]")))
      expect(link.getAttribute("href")).not.toMatch(/PA-/);
  });

  it("books initials only, and refuses initials that are not one to three letters", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("ward-planned-book"));
    fireEvent.change(screen.getByTestId("ward-planned-who"), { target: { value: "initials" } });
    fireEvent.change(screen.getByTestId("ward-planned-initials"), { target: { value: "Alice" } });
    fireEvent.click(screen.getByTestId("ward-planned-submit"));
    expect(screen.getByTestId("ward-planned-form-refusal")).toHaveTextContent("one to three letters");

    fireEvent.change(screen.getByTestId("ward-planned-initials"), { target: { value: "x.y" } });
    fireEvent.change(screen.getByTestId("ward-planned-sex"), { target: { value: "Female" } });
    fireEvent.change(screen.getByTestId("ward-planned-reason"), { target: { value: "planned_ect" } });
    fireEvent.click(screen.getByTestId("ward-planned-submit"));
    expect(screen.queryByTestId("ward-planned-form-refusal")).toBeNull();
    const booked = screen.getByTestId("ward-planned-PA-01");
    expect(booked).toHaveTextContent("Initials XY");
    expect(booked).toHaveTextContent("Planned ECT");
  });

  it("cancels a booking with a listed reason, and records an arrival", () => {
    renderPanel();
    fireEvent.click(within(screen.getByTestId("ward-planned-PA-SEED-01")).getByRole("button", { name: "Cancel" }));
    fireEvent.change(screen.getByTestId("ward-planned-cancel-reason"), { target: { value: "rebooked" } });
    fireEvent.click(screen.getByTestId("ward-planned-cancel-confirm"));
    expect(screen.queryByTestId("ward-planned-PA-SEED-01")).toBeNull();

    fireEvent.click(within(screen.getByTestId("ward-planned-PA-SEED-03")).getByRole("button", { name: "Arrived" }));
    expect(screen.queryByTestId("ward-planned-PA-SEED-03")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("keeps an overdue booking's own day when it is changed, and saves other edits", () => {
    renderPanel();
    fireEvent.click(within(screen.getByTestId("ward-planned-PA-SEED-03")).getByRole("button", { name: "Change" }));
    // Seed: due 09:30 today and already past. The form shows that day and time, not "now".
    expect(screen.getByTestId("ward-planned-day")).toHaveValue("0");
    expect(screen.getByTestId("ward-planned-time")).toHaveValue("09:30");
    fireEvent.change(screen.getByTestId("ward-planned-stay"), { target: { value: "9" } });
    fireEvent.click(screen.getByTestId("ward-planned-submit"));
    expect(screen.queryByTestId("ward-planned-form-refusal")).toBeNull();
    expect(screen.getByTestId("ward-planned-PA-SEED-03")).toHaveTextContent(/arrival not recorded/);
  });

  it("refuses an expected stay that is not a whole number of days, with a message", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("ward-planned-book"));
    fireEvent.change(screen.getByTestId("ward-planned-who"), { target: { value: "initials" } });
    fireEvent.change(screen.getByTestId("ward-planned-initials"), { target: { value: "gh" } });
    fireEvent.change(screen.getByTestId("ward-planned-stay"), { target: { value: "abc" } });
    fireEvent.click(screen.getByTestId("ward-planned-submit"));
    expect(screen.getByTestId("ward-planned-form-refusal")).toHaveTextContent(
      /Enter the expected stay as a whole number of days/,
    );
    expect(screen.queryByTestId("ward-planned-PA-01")).toBeNull();
  });

  it("opens the overdue booking in the Alerts drawer with its own facts, not a movement's", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /for Initials RK$/ })[0]!);
    const drawer = screen.getByRole("dialog");
    expect(drawer).toHaveTextContent("Initials RK");
    const booking = within(drawer).getByTestId("alerts-drawer-booking");
    expect(booking).toHaveTextContent("Legal status");
    expect(booking).toHaveTextContent("Voluntary");
    expect(booking).toHaveTextContent("Planned ward");
    expect(drawer).not.toHaveTextContent("Emergency Dept");
    expect(drawer).not.toHaveTextContent("Declines logged");
    expect(drawer.textContent).not.toMatch(/PA-SEED/);
  });
});
