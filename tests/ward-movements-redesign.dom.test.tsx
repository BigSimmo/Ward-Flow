import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Movements redesign (Josh approved the mock-up, 31 Oct 2026): the stage pipeline under the hero,
 * Tier 1 now atop the side column, and the community clinician desk's branch of the same screen
 * (D-76): the team's eyebrow, no officers' Transport board or coordinator queue, and one empty
 * panel when the team has no journey at all.
 */
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const desk = vi.hoisted(() => ({
  access: { role: "coordinator", scope: { kind: "statewide" } } as {
    role: string;
    scope: { kind: string; teamName?: string };
  },
  noMovements: false,
  phone: false,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/wf", async (original) => ({
  ...(await original<typeof import("../src/components/wf")>()),
  useIsPhone: () => desk.phone,
}));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => desk.access,
}));
vi.mock("@/components/ward-management/ward-flow-provider", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardFlowSelect: ((...keys: string[]) => {
      const select = actual.useWardFlowSelect as unknown as (...names: string[]) => Record<string, unknown>;
      const picked = select(...keys);
      return desk.noMovements && "movements" in picked ? { ...picked, movements: [] } : picked;
    }) as unknown as typeof actual.useWardFlowSelect,
  };
});

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MovementsScreen />
    </WardFlowProvider>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  desk.access = { role: "coordinator", scope: { kind: "statewide" } };
  desk.noMovements = false;
  desk.phone = false;
});

describe("Movements: the phone eyebrow names a placed desk's own place (Q84)", () => {
  it("names the site bed manager's site, not Statewide", () => {
    desk.access = { role: "bed_manager", scope: { kind: "site", siteCode: "FSH" } as never };
    desk.phone = true;
    renderScreen();
    // Page tops (Josh, 9 Nov 2026): the slate drops the eyebrow; the header's place chip names the
    // desk's place, so the hero never claims Statewide for a placed desk.
    expect(screen.queryByText(`Movements · ${siteByCode("FSH")?.name}`)).not.toBeInTheDocument();
    expect(screen.queryByText("Movements · Statewide")).not.toBeInTheDocument();
  });

  it("keeps Statewide for the coordinator", () => {
    desk.phone = true;
    renderScreen();
    expect(screen.queryByText("Movements · Statewide")).not.toBeInTheDocument();
  });
});

describe("Movements redesign: the coordinator's board", () => {
  // Simplification (26 Nov 2026): a stage toggles the worklist to that stage alone; pressing it again, or
  // removing the applied filter, shows every stage. (It opened a people pop-up before.)
  it("draws one stage pipeline whose stages filter the worklist to their people, in place of the hero's stage chips", () => {
    renderScreen();
    const pipeline = screen.getByRole("navigation", { name: "Stages" });
    const stages = within(pipeline).getAllByRole("button");
    expect(stages.length).toBe(6);
    for (const stage of stages) {
      expect(stage).toHaveAttribute("aria-pressed", "false");
      expect(stage).not.toHaveAttribute("data-highlighted");
      expect(stage.textContent).toMatch(/None waiting|longest /u);
    }
    const worklist = screen.getByRole("region", { name: "Movement worklist" });
    const rowCount = () => worklist.querySelectorAll("[data-ward-primitive='record-row'][data-record-key]").length;
    const allRows = rowCount();
    fireEvent.click(stages[0]!);
    expect(stages[0]).toHaveAttribute("aria-pressed", "true");
    expect(stages[0]).toHaveAttribute("data-highlighted", "true");
    const filtered = rowCount();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(allRows);
    fireEvent.click(within(worklist).getByRole("button", { name: /^Show every stage, not only /u }));
    expect(stages[0]).toHaveAttribute("aria-pressed", "false");
    expect(rowCount()).toBe(allRows);
    fireEvent.click(stages[0]!);
    fireEvent.click(stages[0]!);
    expect(stages[0]).toHaveAttribute("aria-pressed", "false");
    expect(rowCount()).toBe(allRows);
    expect(screen.queryByRole("group", { name: "Highlight a stage" })).not.toBeInTheDocument();
  });

  // Movements redesign (1 Nov 2026, Q102): no separate Tier 1 card. The hero's Tier 1 figure
  // highlights those rows, and the side column opens on Transport now.
  it("puts Tier 1 in the hero figures, not a side card, and the title no longer counts who is moving", () => {
    renderScreen();
    const side = screen.getByRole("complementary", { name: "Movement details" });
    expect(screen.queryByTestId("movements-needs-you")).not.toBeInTheDocument();
    expect(within(side).getByRole("region", { name: "Transport right now" })).toBeInTheDocument();
    const figures = screen.getByRole("group", { name: "Highlight movements" });
    const tierOne = within(figures).getByRole("button", { name: /Tier 1$/u });
    fireEvent.click(tierOne);
    // M1 (3 Nov 2026): the figure opens its patients rather than marking rows.
    expect(
      within(screen.getByTestId("movement-people-sheet")).getByRole("heading", { name: "Urgency tier 1" }),
    ).toBeInTheDocument();
    // Page tops (Josh, 9 Nov 2026): the title names the page, not who is moving.
    expect(screen.getByText(/^Movements/u, { selector: "[data-wf-hero-title]" }).textContent).not.toMatch(/moving/);
  });

  it("offers the officers' Transport board and the coordinator's queue on the coordinator desk", () => {
    renderScreen();
    expect(screen.getByRole("link", { name: "Transport" })).toHaveAttribute("href", "/bedchart/transport/officer");
    expect(screen.getByRole("button", { name: /Next in my queue/ })).toBeInTheDocument();
  });

  it("says in one line why the queue differs from the open count (live walk 16 Nov 2026)", () => {
    renderScreen();
    // r10: the line leads with the queue's own count; "of N open" went from it.
    expect(screen.getByTestId("movements-queue")).toHaveTextContent(/^\d+ in your queueWaiting on you/u);
  });
});

describe("Movements redesign: the community clinician desk (D-76)", () => {
  it("names the team, and leaves out the officers' Transport board and the coordinator's queue", () => {
    desk.access = { role: "community", scope: { kind: "team", teamName: "Midland" } };
    renderScreen();
    expect(screen.getByText("Movements · Midland team")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Transport" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next in my queue/ })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Stages" })).toBeInTheDocument();
  });

  it("shows one panel with the team's two ways on when the team has no journey", () => {
    desk.access = { role: "community", scope: { kind: "team", teamName: "Midland" } };
    desk.noMovements = true;
    renderScreen();
    expect(screen.getByRole("heading", { level: 1, name: "Movements" })).toBeInTheDocument();
    expect(screen.getByText("No movements for the team")).toBeInTheDocument();
    expect(screen.getByText("Shows once a ward accepts a team referral")).toBeInTheDocument();
    const panel = screen.getByRole("region", { name: "The team's movements" });
    expect(within(panel).getByRole("link", { name: "Refer from team" })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Team’s inpatients" })).toHaveAttribute(
      "href",
      "/bedchart/community/midland",
    );
    expect(screen.queryByRole("navigation", { name: "Stages" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("movements-needs-you")).not.toBeInTheDocument();
  });

  it("keeps the coordinator's board, not the team panel, when the coordinator's data has no journey", () => {
    desk.noMovements = true;
    renderScreen();
    expect(screen.queryByText("No movements for the team")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Movement worklist" })).toBeInTheDocument();
  });
});
