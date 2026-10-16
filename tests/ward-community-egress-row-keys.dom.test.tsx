import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The discharge follow-up rows open the person's drawer from the keyboard, and the contact button
 * inside a row keeps its own Enter and Space (October 2026 review). Synthetic data only.
 */
describe("community discharge follow-up rows", () => {
  it("open from the keyboard without taking keys from the contact button inside", () => {
    // The follow-up register shows in the demonstration cohort.
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityScreen teamId={COMMUNITY_TEAM_PAGES[0]!.id} demonstration />
      </WardFlowProvider>,
    );
    const row = Array.from(container.querySelectorAll<HTMLTableRowElement>("tr[data-pt-id][tabindex]")).find(
      (candidate) => candidate.querySelector("button"),
    );
    expect(row, "a follow-up row with a contact button").toBeDefined();
    expect(row!.tabIndex).toBe(0);

    const button = row!.querySelector("button")!;
    // fireEvent returns false when a handler called preventDefault, which would cancel the button.
    expect(fireEvent.keyDown(button, { key: " " })).toBe(true);
    expect(fireEvent.keyDown(button, { key: "Enter" })).toBe(true);
    expect(fireEvent.keyDown(row!, { key: "Enter" })).toBe(false);
  });
});
