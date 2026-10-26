import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { ToastProvider } from "@/components/wf";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  EdInboxReferralFixture,
  markNotYetIdentified,
  openRaiseIntoMovementForm,
} from "./helpers/ed-raise-into-movement";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

/**
 * Overall review (20 Oct 2026): the ED "Ask for a bed" form refused Send with a reason but
 * did not mark the missing fields or move focus to them. It now does what the registration form
 * does (DA-12): every unanswered question is marked, listed, and the first takes focus.
 */
function MovementCount() {
  const { movements } = useWardFlow();
  return <p data-testid="movement-count">{movements.length}</p>;
}

function renderEd() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <EdInboxReferralFixture edId="jhc-ed" />
        <EdScreen edId="jhc-ed" />
        <MovementCount />
      </ToastProvider>
    </WardFlowProvider>,
  );
  openRaiseIntoMovementForm();
  markNotYetIdentified();
}

describe("ED raise form marks what is still unanswered", () => {
  it("marks nothing before a raise is tried", () => {
    renderEd();
    expect(screen.queryByTestId("ward-ed-referral-missing")).toBeNull();
    expect(screen.getByTestId("ward-ed-referral-cohort")).not.toHaveAttribute("aria-invalid");
  });

  it("on a blocked click marks every unanswered field, lists them and focuses the first", () => {
    renderEd();
    fireEvent.change(screen.getByTestId("ward-ed-referral-cohort"), { target: { value: "Adult" } });
    const before = screen.getByTestId("movement-count").textContent;

    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));

    expect(screen.getByTestId("movement-count").textContent).toBe(before);
    const list = screen.getByTestId("ward-ed-referral-missing");
    expect(list).toHaveAttribute("role", "alert");
    expect(list).toHaveTextContent(
      "Still to answer: Security, Sex, Gender, Legal status, Urgency, Observation level, High-acuity nursing.",
    );
    expect(screen.getByTestId("ward-ed-referral-cohort")).not.toHaveAttribute("aria-invalid");
    for (const testId of [
      "ward-ed-referral-security",
      "ward-ed-referral-sex",
      "ward-ed-referral-gender",
      "ward-ed-referral-legal-status",
      "ward-ed-referral-urgency",
      "ward-ed-referral-observation",
    ]) {
      expect(screen.getByTestId(testId), testId).toHaveAttribute("aria-invalid", "true");
    }
    // A radio pair cannot carry aria-invalid; its group is described as not answered instead.
    for (const name of ["High-acuity nursing"]) {
      expect(screen.getByRole("group", { name }), name).toHaveAccessibleDescription("Not answered");
    }
    expect(screen.getAllByText("Not answered")).toHaveLength(7);
    expect(screen.getByTestId("ward-ed-referral-security")).toHaveFocus();
  });

  it("does the same when Enter submits the form, and clears each mark once answered", () => {
    renderEd();
    fireEvent.submit(screen.getByTestId("ward-ed-referral-form"));
    expect(screen.getByTestId("ward-ed-referral-cohort")).toHaveFocus();
    expect(screen.getByTestId("ward-ed-referral-cohort")).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(screen.getByTestId("ward-ed-referral-cohort"), { target: { value: "Adult" } });
    expect(screen.getByTestId("ward-ed-referral-cohort")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByTestId("ward-ed-referral-missing")).not.toHaveTextContent("Cohort");
  });

  it("names the patient first when nobody is chosen", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-referral-unidentified"));
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
    expect(screen.getByTestId("ward-ed-referral-missing")).toHaveTextContent(/^Still to answer: Patient, Cohort/u);
    expect(screen.getByTestId("ward-ed-referral-patient")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("ward-ed-referral-patient")).toHaveFocus();
  });

  it("starts unmarked when the form is closed and opened again", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
    expect(screen.getByTestId("ward-ed-referral-missing")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    openRaiseIntoMovementForm();
    expect(screen.queryByTestId("ward-ed-referral-missing")).toBeNull();
  });
});
