import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { EdPlanPicker, EdReviewStatus } from "@/components/ward-management/ed/ed-board-controls";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import type { Movement } from "@/components/ward-management/ward-model";

function PlanHarness() {
  const [labels, setLabels] = useState<string[]>([]);
  return (
    <>
      <EdPlanPicker patientName="Synthetic patient" labels={labels} onChange={setLabels} />
      <output data-testid="plan-values">{JSON.stringify(labels)}</output>
      <button type="button" onClick={() => {}}>
        Outside picker
      </button>
    </>
  );
}

describe("ED plan labels", () => {
  it("adds presets and custom labels without case-insensitive duplicates, and removes labels", () => {
    render(<PlanHarness />);
    const open = () => fireEvent.click(screen.getByRole("button", { name: "Edit plan for Synthetic patient" }));
    open();
    fireEvent.click(screen.getByRole("option", { name: "Social work review" }));
    open();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "  Contact guardian  " } });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(screen.getByTestId("plan-values")).toHaveTextContent('["Social work review","Contact guardian"]');
    open();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "CONTACT GUARDIAN" } });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(screen.getByTestId("plan-values")).toHaveTextContent('["Social work review","Contact guardian"]');
    fireEvent.click(screen.getByRole("button", { name: "Remove Social work review from plan for Synthetic patient" }));
    expect(screen.getByTestId("plan-values")).toHaveTextContent('["Contact guardian"]');
  });

  it("selects a filtered preset using arrows and Enter instead of creating the partial search text", () => {
    render(<PlanHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Edit plan for Synthetic patient" }));
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Social" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("plan-values")).toHaveTextContent('["Social work review"]');
  });

  it("creates typed labels when leaving the picker and cancels uncommitted text on Escape", () => {
    render(<PlanHarness />);
    const trigger = screen.getByRole("button", { name: "Edit plan for Synthetic patient" });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Review with liaison team" } });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside picker" }));
    expect(screen.getByTestId("plan-values")).toHaveTextContent('["Review with liaison team"]');
    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Cancelled label" } });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(screen.getByTestId("plan-values")).not.toHaveTextContent("Cancelled label");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

function ClinicalStateProbe() {
  const { movements, referrals } = useWardFlow();
  return <output data-testid="clinical-state">{JSON.stringify({ movements, referrals })}</output>;
}

describe("ED compact draft selectors", () => {
  it("keeps each department browser count consistent with the physically waiting rows of its board", () => {
    for (const department of allEmergencyDepartments()) {
      const view = render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <EdScreen edId={department.id} />
          <ClinicalStateProbe />
        </WardFlowProvider>,
      );
      // The board keeps transit rows it is still accountable for; the strip's "waiting" counts
      // only the board rows physically waiting in the department (isWaitingInEd).
      const { movements } = JSON.parse(screen.getByTestId("clinical-state").textContent!) as {
        movements: Movement[];
      };
      const byId = new Map<string, Movement>(movements.map((movement) => [movement.id, movement]));
      const count = screen
        .queryAllByTestId(/^ward-ed-patient-WF-/)
        .map((row) => byId.get(row.dataset.testid!.replace("ward-ed-patient-", "")))
        .filter((movement) => movement !== undefined && isWaitingInEd(movement)).length;
      // v6: the department strip is always shown, so there is no "Other EDs" toggle to open first.
      const strip = screen.getByRole("navigation", { name: "Emergency departments" });
      const currentDepartment = within(strip).getByRole("link", { current: "page" });
      const boardCount = within(currentDepartment).getByText("waiting").parentElement!;
      expect(boardCount).toHaveTextContent(new RegExp(`^${count}\\s*waiting$`));
      view.unmount();
    }
  });

  it("supports review status keyboard navigation, selection and Escape with focus return", () => {
    const onChange = vi.fn();
    render(
      <EdReviewStatus
        patientName="Synthetic patient"
        value="Awaiting review"
        options={["Awaiting review", "Awaiting collateral", "Examination recorded"]}
        className="review"
        tone="warn"
        onChange={onChange}
      />,
    );
    const trigger = screen.getByRole("button", { name: /^Review status/ });
    fireEvent.click(trigger);
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveFocus();
    fireEvent.keyDown(options[0], { key: "ArrowDown" });
    expect(options[1]).toHaveFocus();
    fireEvent.click(options[1]);
    expect(onChange).toHaveBeenCalledWith("Awaiting collateral");
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  // Finding 9 (Josh, 27 Oct 2026): legal form, clearance and review status are read-only views of
  // the record. There is no screen-only draft that could disagree with it.
  it("shows the recorded legal form, clearance and review status, with no screen-only control", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="rph-ed" />
        <ClinicalStateProbe />
      </WardFlowProvider>,
    );
    const { movements } = JSON.parse(screen.getByTestId("clinical-state").textContent!) as {
      movements: Movement[];
    };
    // Device audit 11 Oct 2026 (owner pick A2): board edits live in the person sheet; the row name opens it.
    const row = screen.getAllByTestId(/^ward-ed-patient-WF-/)[0];
    const movement = movements.find((entry) => `ward-ed-patient-${entry.id}` === row.dataset.testid)!;
    fireEvent.click(within(row).getByTestId(/^ward-ed-row-name-/));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).queryByRole("combobox", { name: /^Legal form for/ })).toBeNull();
    expect(within(sheet).queryByRole("combobox", { name: /^Medical clearance for/ })).toBeNull();
    expect(within(sheet).queryByRole("button", { name: /^Review status/ })).toBeNull();
    expect(within(sheet).getByTestId(`ward-ed-form-pill-${movement.id}`)).toHaveTextContent(
      movement.legalForm ? `Form ${movement.legalForm.code}` : "No form recorded",
    );
    expect(within(sheet).getByTestId(`ward-ed-review-status-${movement.id}`)).toHaveTextContent(
      movement.examination ? "Examination recorded" : "Awaiting review",
    );
    expect(within(sheet).getByTestId(`ward-ed-cleared-${movement.id}`)).toHaveTextContent(/^(Not recorded|Yes|No)$/);
  });
});
