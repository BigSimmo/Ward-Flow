import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { FixedQuestionsCard } from "@/components/ward-management/reports/fixed-questions-card";
import { WaitingStagesCard } from "@/components/ward-management/reports/waiting-stages-card";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("closing-the-loop Statistics cards", () => {
  it("opens the journeys behind a waiting-stage count, each linking to its record", () => {
    const state = seedWardFlowState();
    render(<WaitingStagesCard movements={state.movements} admissions={state.admissions} now={NOW_ANCHOR} />);
    const button = screen.getByTestId("ward-waiting-stage-awaiting_transport-notRecorded");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const list = screen.getByTestId("ward-waiting-stage-journeys");
    const links = list.querySelectorAll("a");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^\/ward-flow\/movements\//);
      expect(link.textContent).not.toMatch(/WF-/);
    }
    expect(list.textContent).toContain("Not recorded");
  });

  it("answers a fixed question with rows that link to their records", () => {
    const state = seedWardFlowState();
    render(
      <FixedQuestionsCard
        movements={state.movements}
        bedReleases={state.bedReleases}
        admissions={state.admissions}
        units={state.units}
        now={NOW_ANCHOR}
      />,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByTestId("ward-fixed-question-dependencies_no_owner"));
    const answer = screen.getByTestId("ward-fixed-answer");
    const links = answer.querySelectorAll("a");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.getAttribute("href")).toMatch(/^\/ward-flow\/discharges\?admissionId=/);
  });
});
