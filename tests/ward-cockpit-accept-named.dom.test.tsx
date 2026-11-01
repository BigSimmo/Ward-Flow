import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

/**
 * Q93 (Josh approved, 1 Nov 2026): the Decisions cockpit's Accept opens the same named accept
 * dialog as the Ward answer view, with its pull time limit, and the Undo toast names the person
 * (surname first) in both its success and undone text. Synthetic seed data only.
 */

const seed = seedWardFlowState();
// A ward with a referral waiting for its answer.
const unitId =
  seed.units.find((unit) =>
    seed.movements.some(
      (movement) =>
        movement.stage === "destination_review" &&
        !movement.acceptedUnitId &&
        !movement.closure &&
        movement.referredUnitIds.includes(unit.id),
    ),
  )?.id ?? "rph-adult-secure";

function Probe() {
  const { movements } = useWardFlow();
  const accepted = movements.filter((movement) => movement.acceptedUnitId === unitId).length;
  return <output data-testid="accepted-here">{accepted}</output>;
}

/** Opens the cockpit's Intake window (desktop shows one window at a time) and returns its first Accept. */
async function openIntake(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole("button", { name: /^Intake, / }));
  const intake = screen.getByRole("region", { name: "Intake" });
  return within(intake).getAllByRole("button", { name: "Accept" })[0]!;
}

describe("the Decisions cockpit's Accept (Q93)", () => {
  it("names the person in the accept dialog first, then names them on the Undo toast", async () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Probe />
          <WardScreen unitId={unitId} />
        </WardFlowProvider>
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("tab", { name: /^Decisions \(Ward record\), / }));
    const before = Number(screen.getByTestId("accepted-here").textContent);
    const accept = await openIntake();
    expect(accept).toHaveAttribute("data-placement-action");

    fireEvent.click(accept);
    // One tap never accepts: the named dialog asks first.
    expect(Number(screen.getByTestId("accepted-here").textContent)).toBe(before);
    const dialog = screen.getByTestId("ward-accept-dialog");
    const name = dialog.querySelector("#ward-answer-allocating-movement strong")!.textContent!;
    expect(name).toMatch(/^[^,]+, [^,]+$/u);
    expect(within(dialog).getByRole("group", { name: "Pull time limit" })).toBeInTheDocument();

    within(dialog).getAllByRole("radio")[0]!.click();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Confirm acceptance" }));
      await Promise.resolve();
    });
    expect(screen.queryByTestId("ward-accept-dialog")).not.toBeInTheDocument();
    expect(Number(screen.getByTestId("accepted-here").textContent)).toBe(before + 1);
    expect(await screen.findByText(`Accepted ${name} in principle.`)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      await Promise.resolve();
    });
    expect(Number(screen.getByTestId("accepted-here").textContent)).toBe(before);
    expect(
      await screen.findByText(`Acceptance undone for ${name}. The referral is back with this ward.`),
    ).toBeInTheDocument();
  });

  it("Cancel in the dialog accepts nothing", async () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Probe />
          <WardScreen unitId={unitId} />
        </WardFlowProvider>
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("tab", { name: /^Decisions \(Ward record\), / }));
    const before = Number(screen.getByTestId("accepted-here").textContent);
    fireEvent.click(await openIntake());
    const dialog = screen.getByTestId("ward-accept-dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("ward-accept-dialog")).not.toBeInTheDocument();
    expect(Number(screen.getByTestId("accepted-here").textContent)).toBe(before);
  });
});
