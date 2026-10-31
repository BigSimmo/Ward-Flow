// tests/ward-planned-admissions-panel.dom.test.tsx
//
// The planned admissions panel on the Capacity screen (stream D): the short list of bookings,
// the agenda, and booking, cancelling and recording an arrival through the real provider.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { PlannedAdmissionsPanel } from "@/components/ward-management/capacity/planned-admissions-panel";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";

/** Converts the seeded initials-only booking, then names the stay it became through both screen resolvers. */
function ConvertedStayNames() {
  const { admissions, plannedAdmissions = [], resolvePatientIdentity, dispatch } = useWardFlow();
  const patientOf = usePatientOf();
  const booking = plannedAdmissions.find((planned) => planned.id === "PA-SEED-03");
  const stay = admissions.find((admission) => admission.id === booking?.admissionId);
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          dispatch({
            type: "CONVERT_PLANNED_ADMISSION",
            role: "coordinator",
            now: NOW_ANCHOR,
            plannedAdmissionId: "PA-SEED-03",
            unitId: "fre-adult-open",
          });
        }}
      >
        Convert
      </button>
      {stay ? (
        <>
          <p data-testid="provider-name">{resolvePatientIdentity(stay).displayName}</p>
          <p data-testid="hook-name">{patientOf(stay).displayName}</p>
        </>
      ) : null}
    </div>
  );
}

function renderPanel() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PlannedAdmissionsPanel now={NOW_ANCHOR} />
    </WardFlowProvider>,
  );
}

/** WT-13: a booking opens with no reason, ward or legal status chosen, so each test picks them. */
function chooseRequired() {
  for (const id of ["ward-planned-reason", "ward-planned-unit", "ward-planned-legal"]) {
    const select = screen.getByTestId(id) as HTMLSelectElement;
    const first = Array.from(select.options).find((option) => option.value !== "" && !option.disabled);
    if (select.value === "" && first) fireEvent.change(select, { target: { value: first.value } });
  }
}

describe("planned admissions panel", () => {
  it("opens the patient, reason, ward and legal status blank, and Book says what is missing", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("ward-planned-book"));
    for (const id of ["ward-planned-patient", "ward-planned-reason", "ward-planned-unit", "ward-planned-legal"]) {
      expect(screen.getByTestId(id)).toHaveValue("");
    }
    expect(screen.getByTestId("ward-planned-time")).toHaveValue("10:00");
    expect(screen.getByTestId("ward-planned-stay")).toHaveValue(7);
    expect(screen.getByTestId("ward-planned-submit")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Choose the patient first")).toBeVisible();
    fireEvent.click(screen.getByTestId("ward-planned-submit"));
    expect(screen.queryByTestId("ward-planned-PA-01")).toBeNull();
  });

  it("lists the seeded bookings as a short list, flagging the overdue one", () => {
    renderPanel();
    // Device audit option A (11 Oct 2026): a short list with its count, and no 14-day strip.
    expect(screen.queryByTestId("ward-planned-strip")).toBeNull();
    expect(screen.getByTestId("ward-capacity-planned-admissions")).toHaveTextContent("3 booked");
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
    chooseRequired();
    fireEvent.change(screen.getByTestId("ward-planned-who"), { target: { value: "initials" } });
    fireEvent.change(screen.getByTestId("ward-planned-initials"), { target: { value: "cd" } });
    fireEvent.change(screen.getByTestId("ward-planned-unit"), { target: { value: "fsh-adult-secure" } });
    fireEvent.click(screen.getByTestId("ward-planned-submit"));
    fireEvent.click(within(screen.getByTestId("ward-planned-PA-01")).getByRole("button", { name: "Arrived" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm arrival" }));
    expect(screen.getByTestId("ward-planned-refusal")).toHaveTextContent(/gender_designation/);
    expect(screen.getByTestId("ward-planned-PA-01")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/PA-/);
  });

  it("records a picked gender on an initials-only booking, so a matching single-sex ward takes it", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("ward-planned-book"));
    chooseRequired();
    // A linked patient's gender is shown from the record, never picked.
    expect(screen.queryByTestId("ward-planned-gender")).toBeNull();
    // The patient list opens blank; once one is chosen, their recorded gender is shown.
    expect(screen.queryByTestId("ward-planned-record-gender")).toBeNull();
    const patient = screen.getByTestId("ward-planned-patient") as HTMLSelectElement;
    expect(patient.value).toBe("");
    fireEvent.change(patient, { target: { value: patient.options[1]!.value } });
    expect(screen.getByTestId("ward-planned-record-gender")).toHaveTextContent(/patient record/);
    fireEvent.change(screen.getByTestId("ward-planned-who"), { target: { value: "initials" } });
    expect(screen.queryByTestId("ward-planned-record-gender")).toBeNull();
    fireEvent.change(screen.getByTestId("ward-planned-initials"), { target: { value: "cd" } });
    fireEvent.change(screen.getByTestId("ward-planned-sex"), { target: { value: "Male" } });
    fireEvent.change(screen.getByTestId("ward-planned-gender"), { target: { value: "Male" } });
    fireEvent.change(screen.getByTestId("ward-planned-unit"), { target: { value: "fsh-adult-secure" } });
    fireEvent.click(screen.getByTestId("ward-planned-submit"));
    fireEvent.click(within(screen.getByTestId("ward-planned-PA-01")).getByRole("button", { name: "Arrived" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm arrival" }));
    expect(screen.queryByTestId("ward-planned-refusal")).toBeNull();
    expect(screen.queryByTestId("ward-planned-PA-01")).toBeNull();
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
    chooseRequired();
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
    // Audit 1 (WP-12): no reason is chosen for the coordinator, and Cancel booking waits for one.
    expect(screen.getByTestId("ward-planned-cancel-reason")).toHaveValue("");
    fireEvent.click(screen.getByTestId("ward-planned-cancel-confirm"));
    expect(screen.getByTestId("ward-planned-PA-SEED-01")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("ward-planned-cancel-reason"), { target: { value: "rebooked" } });
    fireEvent.click(screen.getByTestId("ward-planned-cancel-confirm"));
    expect(screen.queryByTestId("ward-planned-PA-SEED-01")).toBeNull();

    fireEvent.click(within(screen.getByTestId("ward-planned-PA-SEED-03")).getByRole("button", { name: "Arrived" }));
    // Finding 185: the arrival identity check comes first, as on a movement. Cancel changes nothing.
    expect(screen.getByTestId("ward-planned-arrival-identity-check")).toHaveTextContent(/^Check: /u);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("ward-planned-PA-SEED-03")).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("ward-planned-PA-SEED-03")).getByRole("button", { name: "Arrived" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm arrival" }));
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
    chooseRequired();
    fireEvent.change(screen.getByTestId("ward-planned-who"), { target: { value: "initials" } });
    fireEvent.change(screen.getByTestId("ward-planned-initials"), { target: { value: "gh" } });
    fireEvent.change(screen.getByTestId("ward-planned-stay"), { target: { value: "abc" } });
    fireEvent.click(screen.getByTestId("ward-planned-submit"));
    expect(screen.getByTestId("ward-planned-form-refusal")).toHaveTextContent(
      /Enter the expected stay as a whole number of days/,
    );
    expect(screen.queryByTestId("ward-planned-PA-01")).toBeNull();
  });

  it("opens the overdue booking in the Alerts panel with its own facts, not a movement's", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: / for Initials RK$/ })[0]!);
    const drawer = screen.getByRole("complementary", { name: "Selected alert" });
    expect(drawer).toHaveTextContent("Initials RK");
    const booking = within(drawer).getByTestId("alerts-drawer-booking");
    expect(booking).toHaveTextContent("Legal status");
    expect(booking).toHaveTextContent("Voluntary");
    expect(booking).toHaveTextContent("Planned ward");
    expect(drawer).not.toHaveTextContent("Emergency Dept");
    expect(drawer).not.toHaveTextContent("Declines logged");
    expect(drawer.textContent).not.toMatch(/PA-SEED/);
  });

  it("names a converted initials-only stay through the provider's resolver and usePatientOf", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ConvertedStayNames />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Convert" }));
    expect(screen.getByTestId("provider-name")).toHaveTextContent("Initials RK");
    expect(screen.getByTestId("hook-name")).toHaveTextContent("Initials RK");
    expect(document.body.textContent).not.toMatch(/Name not recorded/);
  });
});

/** The panel as a signed-in desk sees it: inside the browser's access projection. */
function renderScopedPanel() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <PlannedAdmissionsPanel now={NOW_ANCHOR} />
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

// Josh, 27 Oct 2026: every desk that reads Capacity sees the bookings, offered only the steps its role takes.
describe("planned admissions panel for a desk that does not book", () => {
  afterEach(() => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", null);
      resetWardAccessStoreForTests();
    });
  });

  it("shows the executive the bookings with nobody named and no Book, Change, Cancel or Arrived", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "executive", scope: { kind: "statewide" } });
    });
    renderScopedPanel();
    expect(screen.queryByTestId("ward-planned-book")).toBeNull();
    const list = screen.getByRole("list", { name: "Booked planned admissions" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveTextContent("Name not shown to this desk");
      expect(within(row).queryByRole("button")).toBeNull();
    }
  });

  it("keeps Book for a bed manager, who may book", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } });
    });
    renderScopedPanel();
    expect(screen.getByTestId("ward-planned-book")).toBeInTheDocument();
    // Through the browser's own access projection: the site's bookings, and only the site's.
    expect(screen.getByTestId("ward-planned-PA-SEED-01")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-planned-PA-SEED-02")).toBeNull();
  });
});

it("distinguishes existing patients by record number and carries the selected identity into booking review", () => {
  renderPanel();
  fireEvent.click(screen.getByTestId("ward-planned-book"));
  const select = screen.getByTestId("ward-planned-patient") as HTMLSelectElement;
  const option = Array.from(select.options).find((candidate) => candidate.value !== "" && !candidate.disabled)!;
  expect(option.textContent).toMatch(/UM\d{6}/);
  fireEvent.change(select, { target: { value: option.value } });
  expect(screen.getByTestId("ward-planned-selected-identity")).toHaveTextContent(option.textContent!);
  expect(screen.getByTestId("ward-planned-submit")).toHaveAccessibleDescription(/UM\d{6}/);
});
