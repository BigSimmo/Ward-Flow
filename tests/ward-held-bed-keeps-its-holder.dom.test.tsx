import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// The ward screen renders next/link anchors and jsdom cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

/**
 * Audit 1, CS-01 (20 Oct 2026): one tap on "Accept in principle" relabelled a held bed. The pulled
 * bed took its name and hold timer from the open movements accepted for the ward by list position,
 * and a referral accepted with no bed pulled could sit first in that list. The real holder and her
 * timer dropped off the board while the records stayed right. Synthetic demo data only.
 */

const UNIT = "sjgs-adult-open";

function Probe() {
  const { dispatch, admissions, movements, resolvePatientIdentity } = useWardFlow();
  const heldAdmission = admissions.find((admission) => admission.unitId === UNIT && admission.state === "pulled");
  const held = movements.find(
    (movement) =>
      heldAdmission !== undefined &&
      (movement.id === heldAdmission.movementId || movement.admissionId === heldAdmission.id),
  );
  const candidate = movements.find(
    (movement) =>
      movement.closure === undefined &&
      movement.acceptedUnitId === undefined &&
      movement.stage === "destination_review" &&
      movement.referredUnitIds.includes(UNIT),
  );
  return (
    <>
      <output data-testid="held-name">{held ? resolvePatientIdentity(held).formalName : ""}</output>
      <output data-testid="candidate-name">{candidate ? resolvePatientIdentity(candidate).formalName : ""}</output>
      <button
        type="button"
        onClick={() => {
          if (!candidate) return;
          dispatch({
            type: "ACCEPT_IN_PRINCIPLE",
            role: "ward",
            now: NOW_ANCHOR,
            movementId: candidate.id,
            unitId: UNIT,
          });
        }}
      >
        Accept the synthetic referral
      </button>
    </>
  );
}

/** The text on every bed card on the board. */
function bedCardText(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='ward-bed-card-']")).map(
    (card) => card.textContent ?? "",
  );
}

describe("a held bed keeps its holder (audit 1, CS-01)", () => {
  it("leaves the held bed's name and hold alone when another referral is accepted with no bed", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Probe />
          <WardScreen unitId={UNIT} />
        </ToastProvider>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-open-bed-board"));
    const heldName = screen.getByTestId("held-name").textContent ?? "";
    const candidateName = screen.getByTestId("candidate-name").textContent ?? "";
    expect(heldName, "the demo ward holds a bed pulled for a named referral").not.toBe("");
    expect(candidateName, "the demo ward has a referral awaiting its answer").not.toBe("");
    expect(bedCardText().some((text) => text.includes(heldName))).toBe(true);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Accept the synthetic referral" }));
    });

    const cards = bedCardText();
    expect(
      cards.some((text) => text.includes(heldName)),
      "the holder stays on her bed",
    ).toBe(true);
    expect(
      cards.some((text) => text.includes(candidateName)),
      "a referral accepted with no bed pulled takes no bed",
    ).toBe(false);
  });
});
