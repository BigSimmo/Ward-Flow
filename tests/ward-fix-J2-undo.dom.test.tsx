import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PullAcceptedReferral } from "@/components/ward-management/referrals/pull-accepted-referral";
import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { UNDO_WINDOW_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { ToastProvider } from "@/components/wf";

/*
 * A9-02 (Audit 9, approved by Josh 13 Nov 2026): the bed pull's message said "Undo within 5 min"
 * but closed after 8 seconds, and two of the three pull paths offered no Undo at all. Each now
 * keeps the same Undo for the whole window (or until dismissed). The 5-minute value is unchanged.
 */
const WINDOW_MS = `${UNDO_WINDOW_MINUTES * 60_000}ms`;

let current: ReturnType<typeof useWardFlow> | undefined;
function Capture() {
  const flow = useWardFlow();
  useEffect(() => {
    current = flow;
  });
  return null;
}

beforeEach(() => {
  window.sessionStorage.clear();
  current = undefined;
});
afterEach(() => cleanup());

/** The toast whose title matches, with its Undo window and button. */
async function undoToast(title: RegExp) {
  const toast = (await screen.findAllByTestId("toast")).find((candidate) => title.test(candidate.textContent ?? ""));
  expect(toast).toBeDefined();
  return toast!;
}

describe("A9-02: Home Act now pull offers Undo for the whole window", () => {
  function PullFirst() {
    const value = useWardFlow();
    const [[item]] = useState(() => acceptedReferralsAwaitingPull(value.referrals, value.units, value.movements));
    return item ? <PullAcceptedReferral item={item} onDone={() => {}} /> : <p>Nothing to pull</p>;
  }

  it("keeps Undo for the Undo window, and Undo releases that pull", async () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Capture />
          <PullFirst />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const [first] = acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements);
    const status = screen.getByTestId("ward-pull-accepted-legal-status") as HTMLSelectElement;
    const form = screen.getByTestId("ward-pull-accepted-legal-form") as HTMLSelectElement;
    const observation = screen.getByTestId("ward-pull-accepted-observation") as HTMLSelectElement;
    if (status.value === "") fireEvent.change(status, { target: { value: "Voluntary" } });
    if (form.value === "") fireEvent.change(form, { target: { value: "none" } });
    if (observation.value === "") fireEvent.change(observation, { target: { value: "general" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("ward-pull-accepted-confirm"));
    });
    const journey = () => current!.movements.find((movement) => movement.referralId === first!.referral.id)!;
    expect(journey().stage).toBe("pulled");

    const toast = await undoToast(/^Bed pulled at /u);
    // D-192 (shared design parts item 4): one clock time, no "Undo within" and no countdown.
    expect(toast).toHaveTextContent(/ · Undo until \d{2}:\d{2}/u);
    expect(toast).not.toHaveTextContent("Undo within");
    expect(toast.style.getPropertyValue("--wf-undo-ms")).toBe(WINDOW_MS);
    fireEvent.click(within(toast).getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(journey().stage).not.toBe("pulled"));
    expect(current!.rejections).toEqual([]);
    expect(await screen.findByText("Bed pull undone. The movement has started without the bed.")).toBeInTheDocument();
  });
});

describe("A9-02: the ward bed board pull offers the same Undo", () => {
  it("keeps Undo for the Undo window, and Undo releases that pull", async () => {
    let pull: HTMLElement | undefined;
    for (const unit of allUnits()) {
      render(
        <ToastProvider>
          <WardFlowProvider initialNow={NOW_ANCHOR}>
            <Capture />
            <WardScreen unitId={unit.id} />
          </WardFlowProvider>
        </ToastProvider>,
      );
      pull = screen
        .queryAllByRole("button", { name: "Pull the bed" })
        .find((button) => button.dataset.testid?.startsWith("ward-pull-") && !button.hasAttribute("aria-disabled"));
      if (pull) break;
      cleanup();
    }
    expect(pull).toBeDefined();
    const movementId = pull!.dataset.testid!.replace("ward-pull-", "");
    fireEvent.click(pull!);
    const stage = () => current!.movements.find((movement) => movement.id === movementId)!.stage;
    expect(stage()).toBe("pulled");

    const toast = await undoToast(/^Bed pulled for /u);
    // D-192 (shared design parts item 4): one clock time, no "Undo within" and no countdown.
    expect(toast).toHaveTextContent(/ · Undo until \d{2}:\d{2}/u);
    expect(toast).not.toHaveTextContent("Undo within");
    expect(toast.style.getPropertyValue("--wf-undo-ms")).toBe(WINDOW_MS);
    fireEvent.click(within(toast).getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(stage()).not.toBe("pulled"));
    expect(await screen.findByText(/^Bed pull undone for .+\.$/u)).toBeInTheDocument();
  });
});
