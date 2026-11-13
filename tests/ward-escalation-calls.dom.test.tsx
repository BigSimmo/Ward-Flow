// Escalation calls (item 3, D-133): the ED board's "Who to call" link opens the step's on-call
// contact with a mock number to copy, and an outcome button records the call, which then shows
// beside the step. Synthetic seed and mock numbers only.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { MOCK_NUMBER_PREFIX } from "@/components/ward-management/on-call/on-call-directory";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";

describe("ED board: who to call and what happened", () => {
  it("shows the step's contact, records an outcome with no choice made for the user, and shows it beside the step", async () => {
    const edIds = [...new Set(wardMovements.filter((m) => isOpen(m) && isWaitingInEd(m)).map((m) => m.originEdId!))];
    let link: HTMLElement | undefined;
    let unmount = () => {};
    for (const edId of edIds) {
      const view = render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <EdScreen edId={edId} />
        </WardFlowProvider>,
      );
      link = document.querySelector<HTMLElement>('[data-testid^="ward-escalation-who-"]') ?? undefined;
      if (link) {
        unmount = view.unmount;
        break;
      }
      view.unmount();
    }
    if (!link) throw new Error("no seeded ED row has reached a wait step");
    const movementId = link.getAttribute("data-testid")!.replace("ward-escalation-who-", "");

    fireEvent.click(link);
    const sheet = await screen.findByTestId("ward-escalation-call-sheet", undefined, { timeout: 10_000 });
    expect(within(sheet).getByTestId("ward-escalation-number").textContent).toMatch(
      new RegExp(`^${MOCK_NUMBER_PREFIX} \\d{4}$`, "u"),
    );
    expect(within(sheet).getByTestId("ward-escalation-checked").textContent).toMatch(/Checked .* Kept up to date by /u);
    expect(sheet.querySelector('a[href^="tel:"]')).toBeNull();

    const outcomes = within(sheet).getAllByRole("button", { name: /Agreed a plan|No bed|No answer|Left a message/u });
    expect(outcomes.map((button) => button.textContent)).toEqual([
      "Agreed a plan",
      "No bed",
      "No answer",
      "Left a message",
    ]);
    // No clinical choice pre-selected: none pressed, none checked.
    for (const button of outcomes) expect(button).not.toHaveAttribute("aria-pressed", "true");
    expect(within(sheet).getByTestId("ward-escalation-last")).toHaveTextContent("No call recorded for this step.");

    await act(async () => {
      fireEvent.click(within(sheet).getByTestId("ward-escalation-outcome-no_answer"));
    });
    expect(await screen.findByTestId(`ward-escalation-last-${movementId}`)).toHaveTextContent(/No answer \d\d:\d\d/u);
    unmount();
  }, 30_000);
});
