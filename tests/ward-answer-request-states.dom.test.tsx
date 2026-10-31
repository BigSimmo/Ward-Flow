// Ward answer redesign (Josh, 31 Oct 2026). With nothing to answer, the Bed request panel is one
// line and "Only a ready bed can take a request" is said to screen readers only; with a request
// open, the sentence shows under the census. Dabakarn (rph-adult-secure) has no request in the
// synthetic world, so the open state copies a synthetic request onto it. Synthetic data only.
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { WardAnswerView } from "@/components/ward-management/ward/ward-answer-view";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

afterEach(() => cleanup());

const WARD_ID = "rph-adult-secure";
const SYNTHETIC_ID = "WF-SYNTH-ANSWER-OPEN";
const REASON = "Only a ready bed can take a request.";

const waitingOn = (movement: Movement, unitId: string) =>
  isOpen(movement) && movement.stage === "destination_review" && movement.referredUnitIds.includes(unitId);

/** Adds one synthetic request waiting on this ward, copied from a request waiting on another. */
function withRequestHere(movements: Movement[]): Movement[] {
  const source = movements.find(
    (movement) => movement.referredUnitIds.length > 0 && waitingOn(movement, movement.referredUnitIds[0]!),
  );
  if (!source) throw new Error("The synthetic world has no waiting request to copy");
  return [...movements, { ...source, id: SYNTHETIC_ID, referredUnitIds: [WARD_ID] }];
}

function Harness({ adjust, children }: { adjust: (movements: Movement[]) => Movement[]; children: ReactNode }) {
  const state = useWardFlow();
  return <WardFlowOverride value={{ ...state, movements: adjust(state.movements) }}>{children}</WardFlowOverride>;
}

function renderAnswer(adjust: (movements: Movement[]) => Movement[] = (movements) => movements) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness adjust={adjust}>
        <WardAnswerView unitId={WARD_ID} />
      </Harness>
    </WardFlowProvider>,
  );
}

describe("ward answer: the Bed request panel and the census reason follow whether a request is open", () => {
  it("with nothing to answer, shows one line and keeps the census reason for screen readers only", () => {
    renderAnswer();
    const unit = unitById(WARD_ID)!;
    expect(screen.queryByTestId(/^ward-incoming-/)).not.toBeInTheDocument();
    const line = screen.getByTestId("ward-answer-all-answered");
    expect(line).toHaveTextContent("Requests land here as they are sent.");
    expect(screen.queryByRole("heading", { name: "Bed request" })).not.toBeInTheDocument();

    const reason = document.getElementById(`ward-answer-bed-reason-${WARD_ID}`)!;
    expect(reason).toHaveTextContent(REASON);
    expect(reason.tagName).toBe("SPAN");
    expect(reason.className).toMatch(/srOnly/);

    // The safeguard line stays word for word, naming this ward only.
    expect(document.body).toHaveTextContent(`Writes to ${unit.name} only — never any other ward.`);
  });

  it("with a request open, shows the census reason under the squares", () => {
    renderAnswer(withRequestHere);
    expect(screen.getByTestId(`ward-incoming-${SYNTHETIC_ID}`)).toBeInTheDocument();
    expect(screen.queryByTestId("ward-answer-all-answered")).not.toBeInTheDocument();

    const reason = document.getElementById(`ward-answer-bed-reason-${WARD_ID}`)!;
    expect(reason).toHaveTextContent(REASON);
    expect(reason.tagName).toBe("P");
    expect(reason.className).not.toMatch(/srOnly/);
  });

  it("keys the census squares by state with the same counts", () => {
    renderAnswer();
    const key = screen.getByRole("list", { name: "Census key" });
    const items = within(key).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    const counted = items.reduce((total, item) => total + Number(item.querySelector("b")?.textContent ?? 0), 0);
    expect(counted).toBe(screen.getAllByRole("button", { name: /^Bed \d+ / }).length);
  });
});
