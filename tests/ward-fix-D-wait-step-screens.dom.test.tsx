import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The night view's step rows are drawn from `nightEdWaits`; this lets one test mark every person at
// Step 1 as already asked, which the seed never does. The real counting is tested in
// `tests/ward-fix-D-wording-and-wait-step.test.ts`.
const night = vi.hoisted(() => ({ allAskedAtStep1: false }));
vi.mock("@/components/ward-management/night-view-figures", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/night-view-figures")>();
  return {
    ...actual,
    nightEdWaits: (...args: Parameters<typeof actual.nightEdWaits>) => {
      const waits = actual.nightEdWaits(...args);
      if (!night.allAskedAtStep1) return waits;
      return {
        ...waits,
        steps: waits.steps.map((step) => (step.step === 1 ? { ...step, actionDoneCount: step.count } : step)),
      };
    },
  };
});

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { NightViewScreen } from "@/components/ward-management/night/night-view-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Package D, 3.1 (K6, Josh 13 Nov 2026): the ED wait step reads the journey. Once the step's own
 * action is recorded (a ward asked, or accepted), the ED board shows the journey's words in place of
 * the suggested next step and offers no "Who to call"; the night view drops a step's suggestion when
 * everyone at that step already has it recorded. Thresholds and wording are unchanged. Synthetic data.
 */
afterEach(() => {
  cleanup();
  night.allAskedAtStep1 = false;
});

function renderEd(edId: string) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId={edId} />
    </WardFlowProvider>,
  );
}

describe("3.1 the ED board hides the prompt and the call only behind a recorded action", () => {
  it("shows Keira's accepted journey in words, with no next step and no Who to call", () => {
    const keira = seedWardFlowState().movements.find((movement) => movement.id === "WF-003")!;
    renderEd(keira.originEdId!);
    expect(screen.getByTestId("ward-ed-wait-step-WF-003")).toBeInTheDocument();
    expect(screen.getByTestId("ward-ed-wait-journey-WF-003")).toHaveTextContent("Accepted, awaiting bed");
    expect(screen.queryByTestId("ward-ed-wait-next-step-WF-003")).toBeNull();
    expect(screen.queryByTestId("ward-escalation-who-WF-003")).toBeNull();
  });

  it("on every ED board, a row shows either the journey's words or the next step with its call, never both", () => {
    const eds = [...new Set(seedWardFlowState().movements.flatMap((movement) => movement.originEdId ?? []))];
    let done = 0;
    let owed = 0;
    for (const edId of eds) {
      renderEd(edId);
      for (const step of screen.queryAllByTestId(/^ward-ed-wait-step-/u)) {
        const id = step.getAttribute("data-testid")!.replace("ward-ed-wait-step-", "");
        const journey = screen.queryByTestId(`ward-ed-wait-journey-${id}`);
        const next = screen.queryByTestId(`ward-ed-wait-next-step-${id}`);
        const call = screen.queryByTestId(`ward-escalation-who-${id}`);
        expect(journey === null, `${edId} ${id}: journey words or next step, exactly one`).toBe(next !== null);
        if (journey) {
          expect(call, `${edId} ${id}: no call once the action is recorded`).toBeNull();
          done += 1;
        } else {
          owed += 1;
        }
      }
      cleanup();
    }
    // Both kinds are on the seeded boards, so neither branch passes by never being drawn.
    expect(done).toBeGreaterThan(0);
    expect(owed).toBeGreaterThan(0);
  });
});

describe("3.1 the night view drops a step's suggestion once everyone there has it recorded", () => {
  it("shows the suggestion while anyone at the step still needs it", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <NightViewScreen />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("night-step-1")).toHaveTextContent("Suggested next step: Ask wards with a free bed");
  });

  it("hides it when every person at the step has it recorded, and keeps the count", () => {
    night.allAskedAtStep1 = true;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <NightViewScreen />
      </WardFlowProvider>,
    );
    const step1 = screen.getByTestId("night-step-1");
    expect(step1).not.toHaveTextContent("Suggested next step");
    expect(within(step1).getByText(/waiting/u)).toBeInTheDocument();
    expect(screen.getByTestId("night-step-2")).toHaveTextContent("Suggested next step");
  });
});
