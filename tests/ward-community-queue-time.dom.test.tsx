import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/mockups/ward-flow/community/midland",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import {
  DEMO_COMMUNITY_CASELOAD,
  DEMO_COMMUNITY_EGRESS,
} from "@/components/ward-management/community/community-demo-cohort";
import { WardFlowContext, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import type { Referral, ReferralAddressingState } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seed = seedWardFlowStateAt(NOW_ANCHOR);
const midland = COMMUNITY_TEAM_PAGES.find((team) => team.id === "midland")!;

function Override({ children, referrals }: { children: ReactNode; referrals: Referral[] }) {
  const flow = useWardFlow();
  return <WardFlowContext.Provider value={{ ...flow, referrals }}>{children}</WardFlowContext.Provider>;
}

function renderTeam(teamId = "midland", referrals: Referral[] = [], explicit = false) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Override referrals={referrals}>
        <CommunityScreen teamId={teamId} demonstration {...(explicit ? { admissions: [], referrals } : {})} />
      </Override>
    </WardFlowProvider>,
  );
}

function referral(
  id: string,
  urgency: Referral["urgency"],
  source: Referral["source"],
  state: ReferralAddressingState = "queued",
): Referral {
  return {
    ...seed.referrals[0],
    id,
    urgency,
    source,
    destinations: [{ destination: { kind: "community_team", teamName: midland.name }, state }],
  };
}

function expectTotals(container: HTMLElement, total: number, urgent: number) {
  expect(container.querySelector("#cardTriageVal")?.textContent?.trim()).toBe(String(total));
  expect(container.querySelector("#cardTriageBadge")).toHaveTextContent(`${urgent} Urgent`);
  expect(container.querySelector("#tabBtn-triage span:last-child")?.textContent?.trim()).toBe(String(total));
}

beforeEach(() => localStorage.clear());

describe("community queue population and minute precision", () => {
  it("uses Midland's two demo rows, not its generated seven-referral headline", () => {
    const { container } = renderTeam();
    expectTotals(container, 2, 1);
    const queue = screen.getByTestId("ward-community-waiting");
    expect(screen.getByTestId("ward-community-waiting-list").children).toHaveLength(2);
    const filters = [
      ["All Referrals", 2],
      ["Priority 1 Immediate", 0],
      ["Priority 2 Urgent", 1],
      ["Priority 3 Routine", 1],
      ["ED Liaison & Crisis", 0],
    ] as const;
    for (const [label, count] of filters) {
      const button = within(queue).getByRole("button", { name: new RegExp(label) });
      expect(button.querySelector("span:last-child")).toHaveTextContent(String(count));
      fireEvent.click(button);
      expect(screen.queryByTestId("ward-community-waiting-list")?.children.length ?? 0).toBe(count);
      expectTotals(container, 2, 1);
    }
  });

  it("shows zero waiting and urgent for a demo team without cohort rows", () => {
    const emptyTeam = COMMUNITY_TEAM_PAGES.find(
      (team) => !["midland", "alma-street-fremantle", "fremantle"].includes(team.id),
    )!;
    expect(emptyTeam).toBeDefined();
    const { container } = renderTeam(emptyTeam.id);
    expectTotals(container, 0, 0);
    expect(screen.getByTestId("ward-community-waiting-empty")).toBeInTheDocument();
  });

  it("keeps explicit empty source props empty despite demonstration being requested", () => {
    const { container } = renderTeam("midland", [], true);
    expectTotals(container, 0, 0);
    expect(screen.getByTestId("ward-community-waiting-empty")).toBeInTheDocument();
  });

  it("counts and filters the supplied source queue rather than the demo cohort", () => {
    const { container } = renderTeam(
      "midland",
      [referral("COUNT-1", 1, "community"), referral("COUNT-2", 2, "ed_medical"), referral("COUNT-3", 3, "community")],
      true,
    );
    expectTotals(container, 3, 2);
    expect(screen.getByTestId("ward-community-waiting-list").children).toHaveLength(3);
    const queue = screen.getByTestId("ward-community-waiting");
    fireEvent.click(within(queue).getByRole("button", { name: /ED Liaison & Crisis/ }));
    expect(screen.getByTestId("ward-community-waiting-list").children).toHaveLength(1);
    expectTotals(container, 3, 2);
  });

  it.each(["accepted", "declined"] as const)(
    "does not invent demo waiting rows after a source referral was %s",
    (state) => {
      const { container } = renderTeam("midland", [referral("COUNT-ANSWERED", 2, "community", state)]);
      expectTotals(container, 0, 0);
      expect(screen.getByTestId("ward-community-waiting-empty")).toBeInTheDocument();
    },
  );

  it("preserves the five original half-hour instants in their display fields", () => {
    expect(DEMO_COMMUNITY_EGRESS.find((row) => row.id === "EGR-03")?.kpiStatusLabel).toBe("Due Today 4:30pm");
    for (const [id, text] of [
      ["CL-02", "20 Sep 11:30am (Clinic)"],
      ["CL-04", "18 Sep 9:30am (Home)"],
      ["CL-10", "12 Sep 3:30pm (Telehealth)"],
      ["CL-15", "19 Sep 2:30pm (Clinic)"],
    ] as const) {
      expect(DEMO_COMMUNITY_CASELOAD.find((row) => row.id === id)?.lastContact).toBe(text);
    }
    expect(DEMO_COMMUNITY_EGRESS.find((row) => row.id === "EGR-03")?.dischargeDatePlan).toBe("Today 11:30");
    expect(DEMO_COMMUNITY_CASELOAD.find((row) => row.id === "CL-05")?.lastContact).toBe("17 Sep 4pm (Clinic)");
  });

  it("preserves Room 2's original 9am to 4:30pm operating window", () => {
    const { container } = renderTeam();
    fireEvent.click(container.querySelector<HTMLButtonElement>("#tabBtn-team")!);
    const room = screen.getByText("Room 2 · Depot & Physical Health").parentElement!;
    expect(room).toHaveTextContent("9am – 4:30pm");
  });
});
