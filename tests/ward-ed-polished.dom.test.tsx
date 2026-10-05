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
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

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

  it("keeps engine records and recorded worklists intact when changing screen-only form and clearance drafts", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="rph-ed" />
        <ClinicalStateProbe />
      </WardFlowProvider>,
    );
    const originalState = screen.getByTestId("clinical-state").textContent;
    const recordedFormsTab = screen.getByRole("tab", { name: /^Forms,/ }).getAttribute("aria-label");
    const row = screen.getAllByTestId(/^ward-ed-patient-WF-/)[0];
    const form = within(row).getByRole("combobox", { name: /^Legal form for/ });
    const clearance = within(row).getByRole("combobox", { name: /^Medical clearance for/ });
    fireEvent.change(form, { target: { value: "6A" } });
    fireEvent.change(clearance, { target: { value: "yes" } });
    fireEvent.click(within(row).getByRole("button", { name: /^Review status/ }));
    fireEvent.click(screen.getByRole("option", { name: /^Awaiting collateral$/ }));
    expect(form).toHaveValue("6A");
    expect(clearance).toHaveValue("yes");
    expect(screen.getByTestId("clinical-state").textContent).toBe(originalState);
    expect(screen.getByRole("tab", { name: /^Forms,/ })).toHaveAttribute("aria-label", recordedFormsTab);
    expect(screen.getByText("Unsaved changes · This screen only")).toBeInTheDocument();
  });
});
