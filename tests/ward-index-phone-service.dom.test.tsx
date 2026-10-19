// shell-15 (Josh, 13 Oct 2026): on a phone All wards draws no region chips; it follows the header's
// service, and shows no "22 of 22" while nothing is filtered. Desktop keeps its own chips.
import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/wards",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { resetServiceScopeForTests, setServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { WardIndex } from "@/components/ward-management/wards/ward-index";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

function renderIndex(phone: boolean) {
  installMatchMediaStub(phone);
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardIndex />
    </WardFlowProvider>,
  );
}

afterEach(() => {
  installMatchMediaStub(false);
  act(() => resetServiceScopeForTests());
});

describe("All wards service control on a phone (shell-15)", () => {
  it("draws no Health service chips and no 'N of N wards' while nothing is filtered", () => {
    renderIndex(true);
    expect(screen.queryByLabelText("Health service")).toBeNull();
    expect(screen.getByTestId("ward-index-count-note")).not.toHaveTextContent(/of \d+ wards/u);
  });

  it("follows the header's service", () => {
    act(() => setServiceScope("East Metro"));
    renderIndex(true);
    const eastMetro = allUnits().filter((unit) => unitHealthService(unit) === "East Metro").length;
    expect(eastMetro).toBeGreaterThan(0);
    expect(screen.getByTestId("ward-index-count-note")).toHaveTextContent(
      new RegExp(`^Every ward${eastMetro} of \\d+ wards highlighted`, "u"),
    );
  });

  it("keeps the desktop chips", () => {
    renderIndex(false);
    expect(screen.getByLabelText("Health service")).toBeInTheDocument();
  });
});
