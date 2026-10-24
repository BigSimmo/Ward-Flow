import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useEffect, type ReactNode } from "react";
import { StatisticsServiceScreen } from "@/components/ward-management/statistics/statistics-service-screen";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { activateScenarioNetwork, scenarioWardNetwork } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardBar } from "@/components/ward-management/shell/ward-bar";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

let flow: ReturnType<typeof useWardFlow>;
function Probe() {
  const current = useWardFlow();
  useEffect(() => {
    flow = current;
  }, [current]);
  return null;
}
afterEach(() => activateScenarioNetwork("standard"));

it("updates a mounted service screen across fictional and standard networks", () => {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Probe />
      <StatisticsServiceScreen serviceId="North Metro" />
    </WardFlowProvider>,
  );
  const main = screen.getByTestId("ward-statistics-service-screen");
  for (const scenario of ["standard", "wa-synthetic", "standard"] as const) {
    if (flow.scenario !== scenario)
      act(() => flow.dispatch({ type: "SET_SCENARIO", role: "demo", now: flow.now, scenario }));
    expect(screen.getByTestId("ward-statistics-service-screen")).toBe(main);
    const sites = scenarioWardNetwork(scenario).sites.filter((site) => site.service === "North Metro");
    const identity = screen.getByTestId("ward-statistics-service-identity");
    for (const site of sites) expect(identity).toHaveTextContent(site.name);
    expect(identity).toHaveTextContent(`Wards${sites.flatMap((site) => site.units).length}`);
    expect(identity).toHaveTextContent(
      `${sites.filter((site) => site.emergencyDepartment).length} emergency departments`,
    );
    if (scenario === "wa-synthetic") expect(identity).not.toHaveTextContent("Sir Charles Gairdner");
    else expect(identity).not.toHaveTextContent("Fictional");
  }
});

it("keeps the synthetic disclosure accurate for both naming conventions", () => {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Probe />
      <WardBar />
    </WardFlowProvider>,
  );
  for (const scenario of ["standard", "wa-synthetic"] as const) {
    if (flow.scenario !== scenario)
      act(() => flow.dispatch({ type: "SET_SCENARIO", role: "demo", now: flow.now, scenario }));
    const mark = screen.getByTitle(/Patient and flow data are synthetic/);
    expect(mark).toHaveTextContent("Synthetic prototype");
    expect(mark).toHaveAttribute(
      "title",
      expect.stringContaining("Service names depend on the selected demonstration scenario"),
    );
    expect(mark.getAttribute("title")).not.toContain("names are real");
  }
});
