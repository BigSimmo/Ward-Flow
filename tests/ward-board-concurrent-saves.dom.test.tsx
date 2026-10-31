import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

/**
 * Review on PR #434 (audit F-02): in the shared workspace a second Bed board move can start while the
 * first is still waiting for the server. Each move must still get its own answer, so a refusal of
 * the first is never hidden behind the second's. The server is stood in for by answers the test
 * hands out by hand, in the order the moves were sent.
 */
const server = vi.hoisted(() => ({ pending: [] as ((outcome: WardCommandOutcome) => void)[] }));

vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  const useWardFlowSelect: typeof actual.useWardFlowSelect = (...keys) => {
    const picked = actual.useWardFlowSelect(...keys);
    if (!("dispatch" in picked)) return picked;
    const dispatch: WardCommandDispatch = () =>
      new Promise<WardCommandOutcome>((resolve) => {
        server.pending.push(resolve);
      });
    return { ...picked, dispatch };
  };
  return { ...actual, useWardFlowSelect };
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { getBedStep } from "./helpers/ward-bed-steps";

const UNIT = "scgh-adult-open";
const beds = () => Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='ward-board-bed-']"));
const label = (cell: HTMLElement) => cell.getAttribute("aria-label") ?? "";

/** Moves an occupied bed's person to a free bed; nothing changes on screen until the server answers. */
function move(from: HTMLElement, to: HTMLElement) {
  fireEvent.click(from);
  fireEvent.click(getBedStep("Move to another bed"));
  fireEvent.click(to);
}

afterEach(() => {
  cleanup();
  server.pending = [];
});

it("reports the first move's refusal even when a second move was sent before it was answered", async () => {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <WardScreen unitId={UNIT} />
      </ToastProvider>
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId("ward-open-bed-board"));
  const occupied = beds().filter((cell) => !/free|closed|pulled/.test(label(cell)));
  const free = beds().filter((cell) => /, ready$/.test(label(cell)));
  expect(occupied.length).toBeGreaterThanOrEqual(2);
  expect(free.length).toBeGreaterThanOrEqual(2);

  move(occupied[0]!, free[0]!);
  move(occupied[1]!, free[1]!);
  expect(server.pending).toHaveLength(2);

  await act(async () => {
    server.pending[0]!({ commandId: "cmd-1", status: "refused", message: "Someone else moved this person first." });
    server.pending[1]!({ commandId: "cmd-2", status: "cancelled", message: "An earlier change was refused." });
  });

  const said = screen.getAllByTestId("toast").map((toast) => within(toast).queryByText(/Not recorded/u)?.textContent);
  expect(said).toContain("Not recorded: Someone else moved this person first. Nothing was changed.");
  expect(said).toContain("Not recorded: An earlier change was refused. Nothing was changed.");
});
