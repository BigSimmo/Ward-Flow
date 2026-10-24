import { afterEach, expect, it, vi } from "vitest";
import DepartmentPage, { generateMetadata } from "@/app/ward-flow/ed/[edId]/page";
import StatisticsPage from "@/app/ward-flow/statistics/ed/[edId]/page";
import { activateScenarioNetwork } from "@/components/ward-management/ward-scenarios";
import { edById } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not-found");
  },
}));
vi.mock("@/components/ward-management/ed/ed-screen", () => ({ EdScreen: () => null }));
vi.mock("@/components/ward-management/statistics/statistics-ed-screen", () => ({ StatisticsEdScreen: () => null }));
const props = (edId: string) => ({ params: Promise.resolve({ edId }) });
afterEach(() => activateScenarioNetwork("standard"));

it("admits fictional ED detail and statistics routes on the standard initial server network", async () => {
  activateScenarioNetwork("standard");
  expect(edById("syn-quartz-ed")).toBeUndefined();
  expect((await DepartmentPage(props("syn-quartz-ed"))).props.edId).toBe("syn-quartz-ed");
  expect((await StatisticsPage(props("syn-quartz-ed"))).props.edId).toBe("syn-quartz-ed");
  expect(edById("syn-quartz-ed")).toBeUndefined();
});

it("uses the fictional department name in server metadata", async () => {
  activateScenarioNetwork("standard");
  expect((await generateMetadata(props("syn-quartz-ed"))).title).toBe(
    "Fictional Quartz Emergency Department — Ward Flow",
  );
});

it("keeps standard ED routes and legacy code aliases available under another active network", async () => {
  activateScenarioNetwork("wa-synthetic");
  expect((await DepartmentPage(props("rph-ed"))).props.edId).toBe("rph-ed");
  expect((await StatisticsPage(props("RPH"))).props.edId).toBe("rph-ed");
  expect(edById("rph-ed")).toBeUndefined();
});

it("retains not-found responses for unknown ED identifiers", async () => {
  for (const page of [DepartmentPage, StatisticsPage]) {
    await expect(page(props("syn-unknown-ed"))).rejects.toThrow("not-found");
    await expect(page(props("%E0%A4%A"))).rejects.toThrow("not-found");
  }
});
