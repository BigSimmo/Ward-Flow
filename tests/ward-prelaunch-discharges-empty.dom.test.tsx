import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// The board renders next/link anchors and this suite never checks routing (as ward-discharge-board.dom.test.tsx).
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { useWardFlow, WardFlowOverride, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { BedRelease } from "@/components/ward-management/ward-model-bed-release";

const DAY_MINUTES = 24 * 60;

/* Q277 (pre-launch review E5, 2 Nov 2026): with no discharges and every filter on All, the list says
   plainly that there is nothing, instead of blaming filters nobody set. */
function BoardWith({ releases }: { releases: (flow: ReturnType<typeof useWardFlow>) => BedRelease[] }) {
  const flow = useWardFlow();
  return (
    <WardFlowOverride value={{ ...flow, bedReleases: releases(flow) }}>
      <DischargeBoard />
    </WardFlowOverride>
  );
}

function renderWith(releases: (flow: ReturnType<typeof useWardFlow>) => BedRelease[]) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <BoardWith releases={releases} />
    </WardFlowProvider>,
  );
}

describe("Q277: Discharges says plainly when nothing is open", () => {
  it("says No discharges open. when no filter is set", () => {
    renderWith(() => []);
    expect(screen.getAllByText("No discharges open.").length).toBeGreaterThan(0);
    expect(screen.queryByText("No discharges match these filters.")).toBeNull();
  });

  it("says No discharges to work now. when every open discharge is due later and not held up", () => {
    renderWith((flow) =>
      flow.bedReleases
        .filter((release) => release.state !== "discharged")
        .map((release) => ({
          ...release,
          state: "expected" as const,
          expectedAt: NOW_ANCHOR + 5 * DAY_MINUTES,
          waitingOn: null,
          blocker: null,
          blockedBy: null,
        })),
    );
    expect(screen.getAllByText("No discharges to work now.").length).toBeGreaterThan(0);
    expect(screen.queryByText("No discharges open.")).toBeNull();
    expect(screen.queryByText("No discharges match these filters.")).toBeNull();
  });
});
