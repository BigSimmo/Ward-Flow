import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button, ErrorSummary, Field, TextInput } from "@/components/wf";
import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  documentationProblems,
  EMPTY_DOCUMENTATION,
} from "@/components/ward-management/referrals/referral-flow-panels";
import { chooseSampleReferralPerson } from "./helpers/referral-drawer-person";

/**
 * Error summary on a refused submit (mock-up, 24 Oct 2026): one counted list at the top of the
 * form, each problem a link to its field, focus on the heading. Synthetic fixtures only.
 */
afterEach(() => {
  cleanup();
  discardReferralDraft();
});

function Harness({ items }: { items: { id: string; text: string }[] }) {
  const [refused, setRefused] = useState(0);
  return (
    <form>
      <ErrorSummary items={items} action="before saving" focusKey={refused} />
      <Field label="Movement" id="demo-movement">
        <TextInput />
      </Field>
      <Field label="Time on form" id="demo-time">
        <TextInput />
      </Field>
      <Button onClick={() => setRefused((count) => count + 1)}>Save</Button>
    </form>
  );
}

describe("ErrorSummary", () => {
  it("renders nothing when there is nothing to fix", () => {
    const { container } = render(<ErrorSummary items={[]} action="before saving" focusKey={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("counts the problems in words and keeps their order", () => {
    render(
      <Harness
        items={[
          { id: "demo-movement", text: "Choose a movement" },
          { id: "demo-time", text: "Enter the time written on the form" },
        ]}
      />,
    );
    const summary = screen.getByRole("group", { name: "2 things to fix before saving" });
    const links = within(summary).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Choose a movement", "Enter the time written on the form"]);
    expect(links[0]).toHaveAttribute("href", "#demo-movement");
  });

  it("says thing for one problem", () => {
    render(<ErrorSummary items={[{ id: "x", text: "Choose a movement" }]} action="before saving" />);
    expect(screen.getByRole("heading", { name: "1 thing to fix before saving" })).toBeInTheDocument();
  });

  it("moves focus to the heading on each refused submit, not on first render", () => {
    render(<Harness items={[{ id: "demo-time", text: "Enter the time written on the form" }]} />);
    const heading = screen.getByRole("heading", { name: "1 thing to fix before saving" });
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(heading).not.toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(heading).toHaveFocus();
  });

  it("moves focus to the field a link names without changing the address", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scrollIntoView, configurable: true });
    const before = window.location.href;
    render(<Harness items={[{ id: "demo-time", text: "Enter the time written on the form" }]} />);
    fireEvent.click(screen.getByRole("link", { name: "Enter the time written on the form" }));
    expect(screen.getByLabelText("Time on form")).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
    expect(window.location.href).toBe(before);
  });
});

describe("Button onUnavailablePress", () => {
  it("reports a press while a reason holds, and never runs the action", () => {
    const onClick = vi.fn();
    const onUnavailablePress = vi.fn();
    render(
      <Button disabledReason="Choose a movement first." onClick={onClick} onUnavailablePress={onUnavailablePress}>
        Save form
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    expect(onUnavailablePress).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is not called when the button is available", () => {
    const onUnavailablePress = vi.fn();
    render(<Button onUnavailablePress={onUnavailablePress}>Save form</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    expect(onUnavailablePress).not.toHaveBeenCalled();
  });
});

describe("Record a form: error summary", () => {
  it("lists every missing answer when the locked Save is pressed, then shrinks as they are given", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <LegalFormsScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Record a form" }));
    const sheet = screen.getByTestId("ward-legal-record");
    expect(within(sheet).queryByRole("group", { name: /to fix before saving/u })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ward-legal-forms-register-confirm"));
    const heading = within(sheet).getByRole("heading", { name: "2 things to fix before saving" });
    expect(heading).toHaveFocus();
    const movement = within(sheet).getByLabelText("Movement") as HTMLSelectElement;
    expect(movement).toHaveAttribute("aria-invalid", "true");
    expect(within(sheet).getByLabelText("Time on form")).toHaveAttribute("aria-invalid", "true");
    // The locked button keeps its own reason (no change to how Save looks).
    expect(screen.getByTestId("ward-legal-forms-register-confirm")).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(within(sheet).getByRole("link", { name: "Choose a movement" }));
    expect(movement).toHaveFocus();
    const option = Array.from(movement.options).find((entry) => entry.value !== "")!;
    fireEvent.change(movement, { target: { value: option.value } });
    expect(within(sheet).getByRole("heading", { name: "1 thing to fix before saving" })).toBeInTheDocument();
    expect(movement).not.toHaveAttribute("aria-invalid");
  });
});

describe("Referral patient step: error summary", () => {
  it("leads a refused Next with a counted summary whose links reach the fields", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} />
      </WardFlowProvider>,
    );
    await screen.findByRole("searchbox", { name: "Find a patient" });
    fireEvent.click(screen.getByTestId("ward-referral-unidentified"));
    fireEvent.click(screen.getByRole("button", { name: /^Next, referral/u }));
    const summary = await screen.findByRole("group", { name: /things? to fix before the next step/u });
    const heading = within(summary).getByRole("heading");
    await waitFor(() => expect(heading).toHaveFocus());
    const links = within(summary).getAllByRole("link");
    expect(links[0]).toHaveTextContent("Describe the person");
    fireEvent.click(links[0]!);
    expect(screen.getByTestId("ward-referral-unidentified-description")).toHaveFocus();
  });
});

describe("documentationProblems", () => {
  it("lists every missing answer in panel order, clearance only for the community short form", () => {
    expect(documentationProblems(EMPTY_DOCUMENTATION, "d").map((problem) => problem.id)).toEqual([
      "d-medical",
      "d-triage",
      "d-medication-upload",
      "d-observation-upload",
      "d-additional",
    ]);
    expect(
      documentationProblems({ ...EMPTY_DOCUMENTATION, medical: "no" }, "d", true).map((problem) => problem.text),
    ).toEqual(["Enter the expected clearance time", "Enter a contact name", "Enter a contact phone number"]);
  });
});

describe("Referral later steps: error summary", () => {
  function step(name: string) {
    return within(screen.getByRole("group", { name: "Referral sections" })).getByRole("button", { name });
  }

  async function openWithPatientDone() {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} />
      </WardFlowProvider>,
    );
    await screen.findByRole("searchbox", { name: "Find a patient" });
    chooseSampleReferralPerson();
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.change(screen.getByLabelText("Patient suburb"), { target: { value: "Perth" } });
    fireEvent.change(screen.getByLabelText("Search catchment"), { target: { value: "Inner City Clinic" } });
    fireEvent.change(screen.getByLabelText("Home region"), { target: { value: "Perth Metropolitan" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm catchment" }));
  }

  function currentPanel() {
    return document.getElementById(document.querySelector("[data-error-summary]")!.closest("[id]")!.id)!;
  }

  it("leads a refused Clearance step with every documentation answer still needed", async () => {
    await openWithPatientDone();
    fireEvent.click(screen.getByRole("button", { name: /^Next, referral/u }));
    await waitFor(() => expect(step("Referral")).toHaveAttribute("aria-pressed", "true"));
    // The sample person's Referral step is already complete, so Next reaches Clearance.
    fireEvent.click(screen.getByRole("button", { name: /^Next, /u }));
    await waitFor(() => expect(step("Clearance")).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(screen.getByRole("button", { name: /^Next, /u }));
    const heading = await screen.findByRole("heading", { name: "5 things to fix before the next step" });
    expect(currentPanel().id).toMatch(/-documentation$/u);
    await waitFor(() => expect(heading).toHaveFocus());
    fireEvent.click(screen.getByRole("link", { name: "Answer whether the patient has been medically cleared" }));
    expect(screen.getByRole("group", { name: "Has the patient been medically cleared?" })).toContainElement(
      document.activeElement as HTMLElement,
    );
    fireEvent.click(screen.getByRole("link", { name: "Attach the medication chart" }));
    expect(document.activeElement).toHaveTextContent("Upload");
  });

  it("leads a refused community Referral step with its short-form questions", async () => {
    await openWithPatientDone();
    fireEvent.click(screen.getByTestId("ward-referral-refer-to-community"));
    fireEvent.click(screen.getByRole("button", { name: /^Next, /u }));
    await waitFor(() => expect(step("Referral")).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(screen.getByRole("button", { name: /^Next, /u }));
    const summary = await screen.findByRole("group", { name: /things? to fix before the next step/u });
    expect(currentPanel().id).toMatch(/-referral$/u);
    await waitFor(() => expect(within(summary).getByRole("heading")).toHaveFocus());
    const texts = within(summary)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(texts.slice(0, 2)).toEqual([
      "Choose what the community referral is for",
      "Choose when the team should first make contact",
    ]);
    fireEvent.click(within(summary).getByRole("link", { name: "Choose what the community referral is for" }));
    expect(document.activeElement).toHaveAttribute("name", expect.stringMatching(/-community-purpose$/u));
  });
});
