import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { BedsReady, bedsReadySummary } from "@/components/ward-management/referrals/referral-board-parts";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const phone = vi.hoisted(() => ({ value: false }));
vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => phone.value,
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/ward-management/shell/ward-service-store", async (importOriginal) => ({
  ...(await importOriginal()),
  useServiceScope: () => null,
}));

/**
 * P096, P100, P101 (audit 27 Oct 2026, capacity labels): each figure says what it counts. The highlight
 * chips count wards, occupancy says it includes pulled beds (D-81), and the Referrals band shows its
 * total, cohort cells that add up to it, and locked as a part of them.
 */
describe("capacity labels say what each figure counts", () => {
  function renderCapacity(onPhone: boolean) {
    phone.value = onPhone;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
      </WardFlowProvider>,
    );
  }

  it("Capacity names wards on the chips and pulled beds in the bed map occupancy", () => {
    renderCapacity(false);
    expect(screen.getByRole("button", { name: /^Wards with any bed ready/u })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Wards with a locked bed ready/u })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Wards with an open bed ready/u })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Locked bed ready/u })).toBeNull();
    expect(screen.getAllByText(/\d+\.\d% occupancy \(includes \d+ pulled\)/u).length).toBeGreaterThan(0);
  });

  it("Capacity phone hero says occupancy includes pulled beds", () => {
    const seed = seedWardFlowState();
    renderCapacity(true);
    const pulled = screen.getAllByText(/^Of beds in use, including (\d+) pulled$/u);
    expect(pulled.length).toBeGreaterThan(0);
    expect(Number(/(\d+) pulled/u.exec(pulled[0]!.textContent ?? "")?.[1])).toBeGreaterThan(0);
    expect(seed.units.length).toBeGreaterThan(0);
  });

  it("Referrals band shows its total, cells that add up to it, and locked as a part", () => {
    const seed = seedWardFlowState();
    const summary = bedsReadySummary(seed.units, seed.admissions, seed.bedReleases, NOW_ANCHOR);
    render(<BedsReady summary={summary} />);
    const band = screen.getByTestId("ward-referral-beds-ready");
    expect(band).toHaveTextContent(`Beds ready statewide (your desk's admissions): ${summary.total}`);
    const cohort = within(band).getAllByRole("link", { name: /beds ready\. Open Places$/u });
    expect(cohort.map((cell) => cell.textContent)).toEqual([
      expect.stringMatching(/Adult$/u),
      expect.stringMatching(/Older adult$/u),
      expect.stringMatching(/Youth$/u),
    ]);
    const sum = cohort.reduce((total, cell) => total + Number(/^\d+/u.exec(cell.textContent ?? "")?.[0]), 0);
    expect(sum).toBe(summary.total);
    const locked = summary.cells.find((cell) => cell.label === "Locked")!.value;
    expect(within(band).getByLabelText(`${locked} of these beds are locked`)).toHaveTextContent(
      `of which ${locked} locked`,
    );
  });
});
