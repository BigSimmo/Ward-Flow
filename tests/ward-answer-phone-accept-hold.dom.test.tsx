// Ward answer on a phone (Josh, 31 Oct 2026: nothing pre-selected in any choice). The Accept in
// principle sheet's Pull time limit starts with neither choice pressed, and the sheet's Accept waits
// for one and says why. Synthetic seed data only.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => true,
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { WardAnswerView } from "@/components/ward-management/ward/ward-answer-view";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => cleanup());

function Harness({ dispatch, children }: { dispatch: (event: WardFlowEvent) => void; children: ReactNode }) {
  const state = useWardFlow();
  return <WardFlowOverride value={{ ...state, dispatch }}>{children}</WardFlowOverride>;
}

describe("ward answer phone sheet: the pull time limit starts with nothing chosen", () => {
  it("holds Accept in principle until a pull time limit is chosen, and says why", () => {
    const dispatch = vi.fn<(event: WardFlowEvent) => void>();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness dispatch={dispatch}>
          <WardAnswerView unitId="sjgm-adult-open" />
        </Harness>
      </WardFlowProvider>,
    );
    const id = screen.getByTestId(/^ward-incoming-/).dataset.testid!.replace("ward-incoming-", "");
    fireEvent.click(screen.getByTestId(`ward-accept-${id}`));
    const sheet = screen.getByTestId(`ward-accept-sheet-${id}`);
    const hold = within(sheet).getByRole("group", { name: "Pull time limit" });
    const choices = within(hold).getAllByRole("button");
    expect(choices).toHaveLength(2);
    for (const choice of choices) expect(choice).toHaveAttribute("aria-pressed", "false");

    const accept = within(sheet).getByRole("button", { name: "Accept in principle" });
    expect(accept).toHaveAttribute("aria-disabled", "true");
    expect(accept).toHaveAccessibleDescription("Choose a pull time limit first");
    fireEvent.click(accept);
    expect(dispatch.mock.calls.some(([event]) => event.type === "ACCEPT_IN_PRINCIPLE")).toBe(false);

    fireEvent.click(within(hold).getByRole("button", { name: /extra travel$/ }));
    expect(within(hold).getByRole("button", { name: /extra travel$/ })).toHaveAttribute("aria-pressed", "true");
    const ready = within(sheet).getByRole("button", { name: "Accept in principle" });
    expect(ready).not.toHaveAttribute("aria-disabled");
    fireEvent.click(ready);
    const accepts = dispatch.mock.calls.map(([event]) => event).filter((event) => event.type === "ACCEPT_IN_PRINCIPLE");
    expect(accepts).toHaveLength(1);
    expect(accepts[0]).toMatchObject({ movementId: id, extendedHold: true });
  });
});
