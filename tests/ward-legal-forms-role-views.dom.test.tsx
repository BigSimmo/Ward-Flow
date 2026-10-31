import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { legalFormGroupRows } from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { TYPED_TIME_KEY } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

/**
 * Legal forms redesign (Josh approved the mock-ups, 31 Oct 2026). Synthetic seed data only.
 * - Every desk: the one colour key near the list, counts that name their noun, and "Add the time"
 *   opening its own pop-up with a DD/MM/YYYY date and a typed 24-hour time.
 * - Nurse in charge (ward desk): no hero "Next to end" card, and no greyed Record a form while nobody
 *   is admitted on a form (the Admitted on a form group says where the ward records one).
 */
const seed = seedWardFlowState();
const noDeadline = legalFormGroupRows(seed.movements, NOW_ANCHOR, "no-deadline");

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <LegalFormsScreen />
    </WardFlowProvider>,
  );
}

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
  setDeskRole("coordinator");
});

describe("Legal forms redesign, coordinator desk", () => {
  it("shows the colour key, counts that name their noun and the next form to end", () => {
    renderScreen();
    expect(screen.getByText(TYPED_TIME_KEY)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /forms? to act on/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /forms?, time not written/ })).toBeInTheDocument();
    expect(screen.getByText(/^(Next to end|Passed)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record a form" })).toBeInTheDocument();
  });

  it("opens Add the time as its own pop-up with a DD/MM/YYYY date and a typed 24-hour time", () => {
    renderScreen();
    fireEvent.click(screen.getAllByRole("button", { name: /^Add the time for / })[0]!);
    const dialog = screen.getByRole("dialog", { name: "Add the time" });
    const date = within(dialog).getByLabelText(/^Date written/);
    expect(date).toHaveAttribute("type", "text");
    expect(date).toHaveAttribute("placeholder", "DD/MM/YYYY");
    const time = within(dialog).getByLabelText(/^Time/);
    expect(time).not.toHaveAttribute("type", "time");
    expect(time).toHaveAttribute("placeholder", "HH:MM");
    // Nothing chosen for the person: region and age band open on Not recorded unless the form holds one.
    expect(within(dialog).getByText("Only the written time is recorded. No expiry is calculated.")).toBeInTheDocument();
    const save = within(dialog).getByRole("button", { name: /^Save time/ });
    expect(save).toHaveAttribute("aria-disabled", "true");
    // Nothing typed, so Cancel closes at once.
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Add the time" })).toBeNull();
  });

  it("asks before dropping a typed, unsaved time", () => {
    renderScreen();
    fireEvent.click(screen.getAllByRole("button", { name: /^Add the time for / })[0]!);
    const dialog = screen.getByRole("dialog", { name: "Add the time" });
    fireEvent.change(within(dialog).getByLabelText(/^Time/), { target: { value: "09:30" } });
    const asked: string[] = [];
    const original = window.confirm;
    window.confirm = (message?: string) => {
      asked.push(message ?? "");
      return false;
    };
    try {
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    } finally {
      window.confirm = original;
    }
    expect(asked).toEqual(["You have a typed time that is not saved. Discard it?"]);
  });
});

describe("Legal forms redesign, nurse in charge (ward desk)", () => {
  it("drops the hero's Next to end card and the greyed Record a form while nobody is admitted on a form", () => {
    expect(noDeadline.length).toBeGreaterThan(0);
    const ward = allUnits()[0]!;
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [ward.id] } });
    });
    setDeskRole("ward");
    renderScreen();
    expect(screen.queryByText(/^Next to end/)).toBeNull();
    // The title names the ward's own place.
    expect(document.body.textContent).toMatch(new RegExp(`\\d+ forms? on moves to ${ward.name}`));
    expect(screen.queryByRole("button", { name: "Record a form" })).toBeNull();
    const admitted = screen.getByTestId("ward-legal-forms-admitted");
    expect(admitted).toHaveTextContent("Admitted on a form");
    expect(admitted).toHaveTextContent(
      "The ward records the next form for a person admitted to its bed, under Admitted on a form.",
    );
  });
});
