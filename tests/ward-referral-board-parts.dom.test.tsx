import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReferralTimeline, wardArm } from "@/components/ward-management/referrals/referral-board-parts";
import { referrals } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const wardReferral = referrals.find((referral) =>
  referral.destinations.some(
    (arm) => arm.destination.kind === "psychiatric_ward" && arm.state === "queued" && arm.withdrawnAt === undefined,
  ),
)!;

describe("Referrals board parts", () => {
  it("reads the live ward request when an earlier ward request was already declined", () => {
    const live = wardReferral.destinations.find((arm) => arm.destination.kind === "psychiatric_ward")!;
    const declined = { ...live, state: "declined" as const, decidedAt: wardReferral.raisedAt + 1 };
    const referral = { ...wardReferral, destinations: [declined, live] };
    expect(wardArm(referral)?.arm).toBe(live);
  });

  it("puts an overdue decision's due time before Now on the timeline", () => {
    const overdue = referrals.find((referral) => referral.id === "RF-015")!;
    render(<ReferralTimeline referral={overdue} units={allUnits()} now={NOW_ANCHOR} />);
    const items = within(screen.getByRole("list", { name: "Referral timeline" }))
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    const due = items.findIndex((text) => text.includes("Decision was due"));
    const nowAt = items.findIndex((text) => text.includes("Now, waiting"));
    expect(due, "RF-015 is no longer overdue at the anchor").toBeGreaterThanOrEqual(0);
    expect(nowAt).toBeGreaterThan(due);
  });
});
