import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Movements redesign (Josh approved the mock-up, 31 Oct 2026): the stage pipeline under the hero,
 * Tier 1 now atop the side column, and the community clinician desk's branch of the same screen
 * (D-76): the team's eyebrow, no officers' Transport board or coordinator queue, and one empty
 * panel when the team has no journey at all.
 */
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
    expect(screen.getByText(`Movements · ${siteByCode("FSH")?.name}`)).toBeInTheDocument();
    expect(screen.queryByText("Movements · Statewide")).not.toBeInTheDocument();
  });

  it("keeps Statewide for the coordinator", () => {
    desk.phone = true;
    renderScreen();
    expect(screen.getByText("Movements · Statewide")).toBeInTheDocument();
  });
});

describe("Movements redesign: the coordinator's board", () => {
  it("draws one stage pipeline whose stages highlight the worklist, in place of the hero's stage chips", () => {
    renderScreen();
    const pipeline = screen.getByRole("navigation", { name: "Stages" });
    const stages = within(pipeline).getAllByRole("button");
    expect(stages.length).toBe(6);
    for (const stage of stages) {
      expect(stage).toHaveAttribute("aria-pressed", "false");
      expect(stage.textContent).toMatch(/none waiting|longest /);
    }
    fireEvent.click(stages[0]!);
    expect(stages[0]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(stages[0]!);
    expect(stages[0]).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("group", { name: "Highlight a stage" })).not.toBeInTheDocument();
  });

  it("puts Tier 1 now at the top of the side column, and the title no longer counts who is moving", () => {
    renderScreen();
    const side = screen.getByRole("complementary", { name: "Movement details" });
    const tierOne = within(side).getByTestId("movements-needs-you");
    expect(within(tierOne).getByRole("heading", { name: "Tier 1 now" })).toBeInTheDocument();
    expect(side.firstElementChild).toBe(tierOne);
    expect(screen.getByText(/resolved today · \d+ active corridors/).textContent).not.toMatch(/moving/);
  });

  it("offers the officers' Transport board and the coordinator's queue on the coordinator desk", () => {
    renderScreen();
    expect(screen.getByRole("link", { name: "Transport" })).toHaveAttribute("href", "/ward-flow/transport/officer");
    expect(screen.getByRole("button", { name: /Next in my queue/ })).toBeInTheDocument();
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
    expect(screen.getByText("No journeys for the team")).toBeInTheDocument();
    expect(screen.getByText("Shows once a ward accepts a team referral")).toBeInTheDocument();
    const panel = screen.getByRole("region", { name: "The team's journeys" });
    expect(within(panel).getByRole("link", { name: "Refer from team" })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Team’s inpatients" })).toHaveAttribute(
      "href",
      "/ward-flow/community/midland",
    );
    expect(screen.queryByRole("navigation", { name: "Stages" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("movements-needs-you")).not.toBeInTheDocument();
  });

  it("keeps the coordinator's board, not the team panel, when the coordinator's data has no journey", () => {
    desk.noMovements = true;
    renderScreen();
    expect(screen.queryByText("No journeys for the team")).not.toBeInTheDocument();
    expect(screen.getByTestId("movements-needs-you")).toBeInTheDocument();
  });
});
