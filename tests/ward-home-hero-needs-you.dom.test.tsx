// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

describe("Home hero gives one answer with its parts (R-HOME-1)", () => {
  it("adds up, and the act now line repeats the same Act now count", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    const answer = screen.getByTestId("hero-next-answer").textContent ?? "";
    const parts = /^(\d+) needs? you: (\d+) act now, (\d+) to decide$/u.exec(answer);
    expect(parts, answer).not.toBeNull();
    const [, total, act, decide] = parts!.map(Number);
    expect(total).toBe(act! + decide!);
    expect(screen.getByTestId("hero-next-detail").textContent).toMatch(new RegExp(`^${act} act now`, "u"));
    const decideLine = screen.queryByTestId("hero-overdue-referral") ?? screen.getByTestId("hero-decide-line");
    expect(decideLine.textContent).toMatch(new RegExp(`^${decide} to decide`, "u"));
  });
});
