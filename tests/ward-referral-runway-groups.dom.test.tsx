import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WaitRunway, runwayGroups } from "@/components/ward-management/referrals/wait-runway";
import type { Referral } from "@/components/ward-management/ward-model";
import { referrals } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** RQ6 (Josh, 3 Nov 2026): markers that would touch become one counted group. Synthetic seed only. */
function fake(id: string, raisedAt = NOW_ANCHOR): Referral {
  return { ...referrals[0]!, id, raisedAt, triagedAt: undefined };
}

function entry(id: string, x: number) {
  return { referral: fake(id), minutes: 0, x };
}

const ids = (groups: ReturnType<typeof runwayGroups>) => groups.map((group) => group.entries.map((e) => e.referral.id));

describe("runwayGroups", () => {
  it("merges entries closer than the gap into one group", () => {
    const groups = runwayGroups([entry("a", 10), entry("b", 12)], 4);
    expect(ids(groups)).toEqual([["a", "b"]]);
  });

  it("places a group at the mean x of its members", () => {
    const [group] = runwayGroups([entry("a", 10), entry("b", 12), entry("c", 14)], 4);
    expect(group!.entries).toHaveLength(3);
    expect(group!.x).toBeCloseTo(12);
  });

  it("chains entries through a re-centred group and never leaves two groups within the gap", () => {
    // 0 and 3.9 group at 1.95; 5.9 is 3.95 from that mean, so it joins too (re-centring keeps
    // pulling the group right). Its mean is then 3.27, so 9.9 (6.63 away) opens a second group.
    const groups = runwayGroups([entry("a", 0), entry("b", 3.9), entry("c", 5.9), entry("d", 9.9), entry("e", 12)], 4);
    expect(ids(groups)).toEqual([
      ["a", "b", "c"],
      ["d", "e"],
    ]);
    expect(groups[0]!.x).toBeCloseTo((0 + 3.9 + 5.9) / 3);
    expect(groups[1]!.x).toBeCloseTo((9.9 + 12) / 2);
    for (let index = 1; index < groups.length; index += 1) {
      expect(groups[index]!.x - groups[index - 1]!.x).toBeGreaterThanOrEqual(4);
    }
  });

  it("keeps far-apart entries as single markers", () => {
    const groups = runwayGroups([entry("a", 10), entry("b", 40), entry("c", 80)], 4);
    expect(ids(groups)).toEqual([["a"], ["b"], ["c"]]);
    expect(groups.map((group) => group.x)).toEqual([10, 40, 80]);
  });
});

/** Four synthetic referrals a minute apart: one group at any track width. */
function closeWaits() {
  return [5, 6, 7, 8].map((minutes, index) => fake(`RF-GROUP-${index}`, NOW_ANCHOR - minutes));
}

function renderRunway(onSelect = vi.fn(), compact = false) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(600);
  render(
    <WaitRunway
      compact={compact}
      queued={closeWaits()}
      now={NOW_ANCHOR}
      selectedId={undefined}
      isHighlighted={() => false}
      nameOf={(referral) => `Name ${referral.id}`}
      onSelect={onSelect}
    />,
  );
  return onSelect;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WaitRunway group marker", () => {
  it("draws one counted group with a spoken count", () => {
    renderRunway();
    const markers = within(screen.getByRole("group", { name: /Waiting time/u })).getAllByRole("button");
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveAttribute("data-count", "4");
    expect(markers[0]!.getAttribute("aria-label")).toMatch(/^4 referrals/u);
  });

  it("opens a card listing each person on click, and selects the one pressed", () => {
    const onSelect = renderRunway();
    fireEvent.click(screen.getByTestId("ward-referral-runway-group-RF-GROUP-0"));
    const card = screen.getByTestId("ward-referral-runway-card");
    const people = within(card).getAllByRole("button");
    expect(people).toHaveLength(4);
    for (let index = 0; index < 4; index += 1) {
      expect(within(card).getByRole("button", { name: new RegExp(`Name RF-GROUP-${index}`, "u") })).toBeVisible();
    }
    fireEvent.click(within(card).getByRole("button", { name: /Name RF-GROUP-2/u }));
    expect(onSelect).toHaveBeenCalledWith("RF-GROUP-2");
  });

  it("keeps the card inside the chart in the phone sheet, so the sheet's focus trap and inert scope include it", () => {
    const onSelect = renderRunway(vi.fn(), true);
    fireEvent.click(screen.getByTestId("ward-referral-runway-group-RF-GROUP-0"));
    const card = screen.getByTestId("ward-referral-runway-card");
    expect(screen.getByTestId("ward-referral-runway")).toContainElement(card);
    fireEvent.click(within(card).getByRole("button", { name: /Name RF-GROUP-1/u }));
    expect(onSelect).toHaveBeenCalledWith("RF-GROUP-1");
  });

  it("closes the card on Escape", () => {
    renderRunway();
    const group = screen.getByTestId("ward-referral-runway-group-RF-GROUP-0");
    fireEvent.click(group);
    expect(screen.getByTestId("ward-referral-runway-card")).toBeInTheDocument();
    expect(group).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(group).toHaveAttribute("aria-expanded", "false");
    // The click also focused the marker (a peek); blur it so only the pinned state is tested.
    fireEvent.blur(group);
    expect(screen.queryByTestId("ward-referral-runway-card")).toBeNull();
  });
});
