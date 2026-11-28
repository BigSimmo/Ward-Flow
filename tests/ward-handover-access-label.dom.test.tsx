import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  usePathname: () => "/bedchart/handover",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  resetWardAccessStoreForTests();
  setWardFeatureFlagOnDevice("role-access", null);
  Reflect.deleteProperty(navigator, "clipboard");
});

function renderAtDesk(access: WardAccess) {
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess(access);
  const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <HandoverPage />
      </WardAccessScope>
    </WardFlowProvider>,
  );
  return writeText;
}

// A ward desk with one ward is the nurse in charge's own sheet (approved redesign, Josh, 31 Oct 2026):
// it is titled for that ward and has no scope picker. A ward desk with two wards keeps the picker.
const TWO_WARD_DESK: WardAccess = {
  role: "ward",
  scope: { kind: "ward", unitIds: ["brm-adult-secure", "bun-adult-open"] },
};

// Audit three #28: Copy for handover and Print handover sit under the hero's Share menu.
function openShare() {
  fireEvent.click(screen.getByTestId("ward-handover-share"));
}
function copySummary() {
  openShare();
  fireEvent.click(screen.getByRole("menuitem", { name: /^(Copy for handover|Copied)$/ }));
}
function printHandover() {
  openShare();
  fireEvent.click(screen.getByTestId("ward-handover-print"));
}

describe("handover labels describe the records the desk can access", () => {
  it("names a one-ward desk's own ward on screen, in copy and on the print sheet, with no scope picker", async () => {
    const label = "Mabu Liyan / Broome Mental Health Unit";
    const writeText = renderAtDesk({ role: "ward", scope: { kind: "ward", unitIds: ["brm-adult-secure"] } });
    expect(screen.queryByRole("button", { name: /^Show:/ })).toBeNull();
    expect(screen.getByTestId("ward-handover-page")).toHaveTextContent(label);
    copySummary();
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]?.[0]).toContain(label);
    printHandover();
    const print = screen.getByTestId("ward-handover-print-sheet");
    expect(print).toHaveTextContent(label);
    expect(print).not.toHaveTextContent("Statewide");
  });

  it.each([
    [TWO_WARD_DESK, "All records you can access"],
    [{ role: "coordinator", scope: { kind: "statewide" } }, "Statewide"],
  ] satisfies readonly (readonly [WardAccess, string])[])(
    "uses the same all-records label on screen, in copy and on the print sheet for %j",
    async (access, label) => {
      const writeText = renderAtDesk(access);
      expect(screen.getByRole("button", { name: `Show: ${label}` })).toBeInTheDocument();
      expect(screen.getByTestId("ward-handover-page")).toHaveTextContent(label);
      copySummary();
      await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
      expect(writeText.mock.calls[0]?.[0]).toContain(label);
      printHandover();
      const print = screen.getByTestId("ward-handover-print-sheet");
      expect(print).toHaveTextContent(label);
      if (access.role === "ward") expect(print).not.toHaveTextContent("Statewide");
    },
  );

  it("keeps the explicit ward and service selection labels", async () => {
    const writeText = renderAtDesk(TWO_WARD_DESK);
    for (const optionName of ["Mabu Liyan / Broome Mental Health Unit", "WACHS"]) {
      fireEvent.click(screen.getByRole("button", { name: /^Show:/ }));
      fireEvent.click(
        within(screen.getByRole("menu", { name: "Show" })).getByRole("menuitemradio", { name: optionName }),
      );
      copySummary();
      await waitFor(() => expect(writeText.mock.calls.at(-1)?.[0]).toContain(optionName));
    }
  });
});
