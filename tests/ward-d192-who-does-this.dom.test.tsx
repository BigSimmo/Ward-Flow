import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ role: "bed_manager" as string }));
vi.mock("@/components/ward-management/ward-role-gate", async (original) => ({
  ...(await original<object>()),
  useRouteRole: () => route.role,
}));

import {
  NOTHING_FOR_YOUR_DESK,
  PatientNextStepCard,
} from "@/components/ward-management/patients/patient-now-ward-cards";
import type { NextStep } from "@/components/ward-management/patients/patient-now-ward";
import { roleOwnerHint } from "@/components/ward-management/ward-role-permissions";
import { whoDoesThisLine } from "@/components/ward-management/ward-who-does-this";

/*
 * D-192 (shared design parts item 6, Josh 13 Nov 2026; F-109): a desk never sees a button it can
 * never use. Where it still sees the work, one quiet foot line names who does it, and a Next step
 * that is not this desk's says "Nothing for your desk now." Owners come from EVENT_ROLE through the
 * WF-20 rule (the bed coordinator alone when it owns the step). Synthetic data only.
 */
afterEach(() => cleanup());

describe("whoDoesThisLine", () => {
  it("names the owner once and every step it takes", () => {
    expect(whoDoesThisLine("bed_manager", ["RECORD_MOVEMENT_MEDICAL_CLEARANCE", "BOOK_TRANSPORT"])).toBe(
      "The bed coordinator records clearance and logs transport.",
    );
  });

  it("agrees with the lock line's owner (WF-20)", () => {
    expect(roleOwnerHint("bed_manager", "UPDATE_EXPECTED_DISCHARGE")).toBe("Ask the bed coordinator to do this.");
    expect(whoDoesThisLine("bed_manager", ["UPDATE_EXPECTED_DISCHARGE"])).toBe(
      "The bed coordinator updates the discharge date.",
    );
  });

  it("says nothing when there is no step to name", () => {
    expect(whoDoesThisLine("bed_manager", [])).toBeUndefined();
  });

  it("lists three or more steps with commas", () => {
    expect(
      whoDoesThisLine("bed_manager", ["RECORD_CARE_PLAN", "RECORD_TRIBUNAL_HEARING", "SET_CULTURAL_SUPPORT_REQUEST"]),
    ).toMatch(/^The [a-zA-Z ]+ adds care plans, records hearing dates and records cultural support\.$/u);
  });
});

describe("Next step on a desk that can never take it", () => {
  const step: NextStep = {
    key: "set-discharge",
    title: "Update the discharge date",
    detail: "Expected Wed 11 Nov has passed and was not confirmed.",
    tone: "warning",
    action: { label: "Update the discharge date", event: "UPDATE_EXPECTED_DISCHARGE", onClick: () => {} },
  };

  it("says Nothing for your desk now, keeps the fact and names who does it", () => {
    route.role = "bed_manager";
    render(<PatientNextStepCard step={step} roleLimit={() => null} />);
    const card = screen.getByTestId("ward-patient-next-step");
    expect(screen.getByRole("heading", { name: NOTHING_FOR_YOUR_DESK })).toBeInTheDocument();
    expect(card).toHaveTextContent(step.detail);
    expect(card.querySelector("[data-wf-who-does-this]")).toHaveTextContent(
      "The bed coordinator updates the discharge date.",
    );
    expect(screen.queryByRole("button", { name: "Update the discharge date" })).toBeNull();
  });

  it("keeps the step and its button for a desk that may take it", () => {
    route.role = "coordinator";
    render(<PatientNextStepCard step={step} roleLimit={() => undefined} />);
    expect(screen.getByRole("heading", { name: "Update the discharge date" })).toBeInTheDocument();
    expect(screen.queryByText(NOTHING_FOR_YOUR_DESK)).toBeNull();
    expect(document.querySelector("[data-wf-who-does-this]")).toBeNull();
  });
});
