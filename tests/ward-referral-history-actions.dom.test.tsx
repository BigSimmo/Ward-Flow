import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/referrals",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-awaiting-pull";
import { DecidedSection } from "@/components/ward-management/referrals/referral-board-sections";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** RQ7 (Josh, 3 Nov 2026): a decided row carries its own next step. Synthetic seed only. */
const SEED = seedWardFlowState();
const QUEUED_IDS = new Set(referralQueueOrder(SEED.referrals).map(({ id }) => id));
const decided = SEED.referrals.filter(({ id }) => !QUEUED_IDS.has(id));
const awaiting = acceptedReferralsAwaitingPull(decided, SEED.units, []);
const pullId = awaiting[0]?.referral.id ?? "";

const NOTE =
  "Acceptance records the decision only. No bed is pulled, no patient is moved and no transport is arranged.";

function renderDecided({
  onPull,
  movements = [],
}: {
  onPull?: Parameters<typeof DecidedSection>[0]["onPull"];
  movements?: Movement[];
} = {}) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DecidedSection
        decided={decided}
        decidedTotal={decided.length}
        units={SEED.units}
        movements={movements}
        now={NOW_ANCHOR}
        onSelect={vi.fn()}
        onPull={onPull}
      />
    </WardFlowProvider>,
  );
}

function pullControl(id: string, suffix = ""): HTMLElement | null {
  return (
    screen.queryByTestId(`ward-referral-board-decided-pull-${id}${suffix}`) ??
    screen.queryByTestId(`ward-referral-board-decided-hold-${id}${suffix}`)
  );
}

afterEach(() => {
  cleanup();
});

describe("Recently decided row actions (RQ7)", () => {
  it("has an accepted ward referral with no bed pulled in the seed, or this file is vacuous", () => {
    expect(pullId).not.toBe("");
  });

  it("offers Pull bed in the table and the card list, and calls onPull with that referral", () => {
    const onPull = vi.fn();
    renderDecided({ onPull });
    const inTable = pullControl(pullId);
    const inCard = pullControl(pullId, "-card");
    expect(inTable).toHaveTextContent("Pull bed");
    expect(inCard).toHaveTextContent("Pull bed");
    fireEvent.click(inTable!);
    expect(onPull).toHaveBeenCalledTimes(1);
    expect(onPull.mock.calls[0]![0].referral.id).toBe(pullId);
  });

  it("shows no Pull bed when onPull is left out", () => {
    renderDecided();
    expect(screen.queryByText("Pull bed")).toBeNull();
    expect(screen.queryByRole("radio", { name: /Bed to pull/u })).toBeNull();
    expect(screen.queryByRole("button", { name: /Bed to pull/u })).toBeNull();
  });

  it("shows Open movement, linking to the movement, once a journey exists", () => {
    const movement = { id: "MV-SYNTH-RQ7", referralId: pullId } as unknown as Movement;
    renderDecided({ onPull: vi.fn(), movements: [movement] });
    const link = screen.getByTestId(`ward-referral-board-decided-movement-${pullId}`);
    expect(link).toHaveTextContent("Open movement");
    expect(link).toHaveAttribute("href", movementHref(movement.id));
    expect(pullControl(pullId)).toBeNull();
    expect(pullControl(pullId, "-card")).toBeNull();
  });

  it("narrows the list to beds still to pull with the Bed to pull filter", () => {
    renderDecided({ onPull: vi.fn() });
    const cards = screen.getByTestId("ward-referral-board-decided-cards");
    const before = within(cards).getAllByRole("listitem").length;
    const option = screen.getByText("Bed to pull").closest("button, [role='radio'], label") as HTMLElement;
    fireEvent.click(option);
    const after = within(cards).getAllByRole("listitem");
    expect(after.length).toBeGreaterThan(0);
    expect(after.length).toBeLessThan(before);
    for (const item of after) {
      const id = item.getAttribute("data-testid")!.replace("ward-referral-board-decided-card-", "");
      expect(pullControl(id, "-card"), `${id} is listed under Bed to pull without a Pull bed control`).not.toBeNull();
    }
  });

  it("keeps the note that acceptance moves nobody", () => {
    renderDecided({ onPull: vi.fn() });
    expect(screen.getByTestId("ward-referral-board-decided-note")).toHaveTextContent(NOTE);
  });
});
