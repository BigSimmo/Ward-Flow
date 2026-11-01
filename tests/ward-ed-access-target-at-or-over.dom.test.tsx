// tests/ward-ed-access-target-at-or-over.dom.test.tsx
import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { queueWaitThresholds } from "@/components/ward-management/coordinator/priority-queue";
import { edWaitTone } from "@/components/ward-management/ed/ed-screen-model";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ED_ACCESS_TARGET_MINUTES } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";

/**
 * The one ED long-wait rule (ward-pressure.ts, ops-16, 13 Oct 2026) is red "once the longest wait
 * reaches the ED access target": AT OR OVER. These pin the boundary minute, where `>` and `>=`
 * disagree, on the ED board's row marker and wait tone.
 */
describe("the ED board marks a wait that reaches the access target, not only one past it", () => {
  it("edWaitTone is danger exactly at the target and not a minute before", () => {
    const urgency = 5;
    // A target below this tier's due-soon line, so only the access target can make the minute red.
    const target = Math.floor(queueWaitThresholds(urgency).dueSoon / 2);
    expect(edWaitTone(urgency, target - 1, target)).toBeUndefined();
    expect(edWaitTone(urgency, target, target)).toBe("danger");
    expect(edWaitTone(urgency, target + 1, target)).toBe("danger");
  });

  it("A1 (26 Oct 2026): a tier-overdue wait under the access target is amber, not red", () => {
    const urgency = 1;
    const { overdue } = queueWaitThresholds(urgency);
    const target = overdue * 4;
    expect(edWaitTone(urgency, overdue, target)).toBe("warning");
    expect(edWaitTone(urgency, target - 1, target)).toBe("warning");
    expect(edWaitTone(urgency, target, target)).toBe("danger");
  });

  it("the row's access-target marker turns on at the exact target minute and reads 'at target'", () => {
    let current!: ReturnType<typeof useWardFlow>;
    function Harness({ edId }: { edId: string }) {
      const value = useWardFlow();
      useEffect(() => {
        current = value;
      });
      return <EdScreen edId={edId} />;
    }
    const waiting = wardMovements.find((movement) => isOpen(movement) && isWaitingInEd(movement));
    if (!waiting) throw new Error("fixture no longer has an open movement waiting in an ED");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness edId={waiting.originEdId!} />
      </WardFlowProvider>,
    );
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-minutes-in-department]"));
    const row = rows
      .map((element) => ({ element, minutes: Number(element.getAttribute("data-minutes-in-department")) }))
      .find(
        ({ element, minutes }) =>
          minutes < ED_ACCESS_TARGET_MINUTES - 1 && element.querySelector('[data-testid^="ward-ed-access-target-"]'),
      );
    if (!row) throw new Error("no board row is under the access target to advance to it");
    const marker = () => row.element.querySelector<HTMLElement>('[data-testid^="ward-ed-access-target-"]')!;
    const advance = (minutes: number) =>
      act(() => {
        current.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current.now, minutes });
      });

    advance(ED_ACCESS_TARGET_MINUTES - 1 - row.minutes);
    expect(Number(row.element.getAttribute("data-minutes-in-department"))).toBe(ED_ACCESS_TARGET_MINUTES - 1);
    expect(marker()).toHaveAttribute("data-state", "under");

    advance(1);
    expect(Number(row.element.getAttribute("data-minutes-in-department"))).toBe(ED_ACCESS_TARGET_MINUTES);
    expect(marker()).toHaveAttribute("data-state", "over");
    expect(marker()).toHaveTextContent(/at target/iu);
    expect(marker()).toHaveTextContent(/At the access target\./);
  });
});
