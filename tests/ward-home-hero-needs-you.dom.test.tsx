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
    // Controls 1 (C003): the title keeps only the total; the parts are said once, in the lines under it.
    const titled = /^(\d+) needs? you$/u.exec(answer);
    expect(titled, answer).not.toBeNull();
    const total = Number(titled![1]);
    const detail = screen.getByTestId("hero-next-detail").textContent ?? "";
    const actParts = /^(\d+) act now/u.exec(detail);
    expect(actParts, detail).not.toBeNull();
    const act = Number(actParts![1]);
    const decideLine = screen.queryByTestId("hero-overdue-referral") ?? screen.getByTestId("hero-decide-line");
    const decideParts = /^(\d+) to decide/u.exec(decideLine.textContent ?? "");
    expect(decideParts, decideLine.textContent ?? "").not.toBeNull();
    const decide = Number(decideParts![1]);
    expect(total).toBe(act + decide);
  });
});
