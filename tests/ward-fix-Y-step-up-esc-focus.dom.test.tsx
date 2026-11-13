import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  StepUpReauthContext,
  forgetStepUp,
  useStepUp,
  type StepUpResult,
} from "@/components/ward-management/shell/ward-step-up";

/*
 * F-57 (C17, design critique v2, Josh 13 Nov 2026): Esc on the "Confirm it is you" step-up closed it
 * and left focus on the page, so a keyboard user had to find their place again. Esc now gives focus
 * back to the control that asked for the step, as Cancel does. Synthetic only; no password is real.
 */
afterEach(() => {
  cleanup();
  forgetStepUp();
});

function renderGuarded(withPassword: boolean) {
  // As "Open read only" (break glass) and the Access forms do: the opener is disabled while its
  // protected step is pending, so focus cannot go back to it until the step has settled.
  function Check() {
    const { guard, dialog } = useStepUp();
    const [sending, setSending] = useState(false);
    return (
      <>
        <button
          type="button"
          disabled={sending}
          onClick={() => {
            setSending(true);
            void guard(async (): Promise<StepUpResult> => (withPassword ? "step-up" : null)).finally(() =>
              setSending(false),
            );
          }}
        >
          Open protected action
        </button>
        {dialog}
      </>
    );
  }
  const tree = (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Check />
    </WardFlowProvider>
  );
  render(
    withPassword ? <StepUpReauthContext.Provider value={async () => {}}>{tree}</StepUpReauthContext.Provider> : tree,
  );
  return screen.getByRole("button", { name: "Open protected action" });
}

describe("F-57: Esc on Confirm it is you returns focus", () => {
  for (const withPassword of [false, true]) {
    for (const how of ["Escape", "Cancel"] as const) {
      it(`${how} returns focus to the opener (${withPassword ? "password" : "demo confirm"})`, async () => {
        const opener = renderGuarded(withPassword);
        opener.focus();
        await act(async () => fireEvent.click(opener));
        const dialog = await screen.findByTestId("ward-step-up");
        await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
        if (how === "Escape") fireEvent.keyDown(document.activeElement ?? dialog, { key: "Escape" });
        else fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
        await waitFor(() => expect(screen.queryByTestId("ward-step-up")).toBeNull());
        await waitFor(() => expect(document.activeElement).toBe(opener));
      });
    }
  }
});
