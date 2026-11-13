// Time audit C9 (13 Nov 2026): the handover meeting's length goes into History beside a board-clock
// time, so it is measured on the board clock too. Before, a real-time length was stamped with the
// board's time, and the two disagreed once the demo clock was moved.
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const announced = vi.hoisted(() => [] as string[]);
vi.mock("@/components/ward-management/shell/ward-live-region", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-live-region")>()),
  announceToWardShell: (text: string) => announced.push(text),
}));

import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function AdvanceClock() {
  const { dispatch, now } = useWardFlow();
  return (
    <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 25 })}>
      Advance the demo clock
    </button>
  );
}

it("times the meeting on the board clock", () => {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AdvanceClock />
      <HandoverPage />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Start meeting" }));
  act(() => fireEvent.click(screen.getByRole("button", { name: "Advance the demo clock" })));
  fireEvent.click(screen.getByTestId("ward-handover-meeting"));
  expect(announced).toContain("Meeting took 25 min. Added to History.");
});
