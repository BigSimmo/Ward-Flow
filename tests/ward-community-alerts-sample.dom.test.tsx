import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => cleanup());

/** #1476 review: the team menu names the drawer it opens, Alerts, not the retired word Tasks. */
describe("the community team's More menu", () => {
  it("offers an Alerts sample, never a Tasks sample", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityScreen teamId={COMMUNITY_TEAM_PAGES[0]!.id} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("menuitem", { name: "Alerts sample" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Tasks sample" })).not.toBeInTheDocument();
  });
});
