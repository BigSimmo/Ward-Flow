import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/bedchart/community",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { MIDLAND_ACT_NOW_STEP_ATTR, MidlandTop } from "@/components/ward-management/community/team-2026/midland-top";
import { TeamHome } from "@/components/ward-management/community/team-2026/team-home";

/**
 * Audit four #56 (build): the community team hero's Open next runs the first act-now row's own step,
 * found by the step mark on that row, never by guessing the first button. Synthetic demo team only.
 */
describe("Community team Open next", () => {
  beforeEach(() => window.localStorage.clear());

  it("runs the first act-now row's step through the row's own handler", async () => {
    const go = vi.fn();
    render(
      <>
        <MidlandTop
          isPhone={false}
          section="home"
          open={vi.fn()}
          toAnswer={1}
          onRecordContact={vi.fn()}
          onReferFromTeam={vi.fn()}
        />
        <TeamHome go={go} now="10:00" />
      </>,
    );
    expect(screen.getByText("7-day follow-up due today")).toBeInTheDocument();
    // Each act-now row marks its own step button; the This week rows carry no mark.
    const steps = document.querySelectorAll(`[${MIDLAND_ACT_NOW_STEP_ATTR}]`);
    expect(steps).toHaveLength(3);
    for (const step of steps) expect(step.tagName).toBe("BUTTON");
    fireEvent.click(screen.getByTestId("community-top-act"));
    // The first act-now row's step is Record contact: the row now reads as done.
    await waitFor(() => expect(screen.getByText(/^Contact recorded at \d{1,2}:\d{2} [ap]m$/)).toBeInTheDocument());
    expect(go).not.toHaveBeenCalled();

    // Pressed again, the first row's step is now Open, which goes to In hospital.
    fireEvent.click(screen.getByTestId("community-top-act"));
    await waitFor(() => expect(go).toHaveBeenCalledWith("hospital"));
  });
});
