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
  usePathname: () => "/ward-flow/handover",
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

// 1 Nov 2026 redesign: Copy summary sits in the toolbar's More handover actions; Print handover is
// the sheet bar's one primary button.
function copySummary() {
  const copyName = /^(Copy summary|Copied)$/;
  if (!screen.queryByRole("button", { name: copyName }))
    fireEvent.click(screen.getByRole("button", { name: "More handover actions" }));
  fireEvent.click(screen.getByRole("button", { name: copyName }));
}

describe("handover labels describe the records the desk can access", () => {
  it("names a one-ward desk's own ward on screen, in copy and on the print sheet, with no scope picker", async () => {
    const label = "Mabu Liyan / Broome Mental Health Unit";
    const writeText = renderAtDesk({ role: "ward", scope: { kind: "ward", unitIds: ["brm-adult-secure"] } });
    expect(screen.queryByRole("combobox", { name: "Filter the sheet" })).toBeNull();
    expect(screen.getByTestId("ward-handover-page")).toHaveTextContent(label);
    copySummary();
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]?.[0]).toContain(label);
    fireEvent.click(screen.getByTestId("ward-handover-print"));
    const print = screen.getByTestId("ward-handover-print-sheet");
    expect(print).toHaveTextContent(label);
    expect(print).not.toHaveTextContent("Whole network");
  });

  it.each([
    [TWO_WARD_DESK, "All records you can access"],
    [{ role: "coordinator", scope: { kind: "statewide" } }, "Whole network"],
  ] satisfies readonly (readonly [WardAccess, string])[])(
    "uses the same all-records label on screen, in copy and on the print sheet for %j",
    async (access, label) => {
      const writeText = renderAtDesk(access);
      const select = screen.getByRole("combobox", { name: "Filter the sheet" }) as HTMLSelectElement;
      expect(select.selectedOptions[0]?.textContent).toBe(label);
      expect(screen.getByTestId("ward-handover-page")).toHaveTextContent(label);
      copySummary();
      await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
      expect(writeText.mock.calls[0]?.[0]).toContain(label);
      fireEvent.click(screen.getByTestId("ward-handover-print"));
      const print = screen.getByTestId("ward-handover-print-sheet");
      expect(print).toHaveTextContent(label);
      if (access.role === "ward") expect(print).not.toHaveTextContent("Whole network");
    },
  );

  it("keeps the explicit ward and service selection labels", async () => {
    const writeText = renderAtDesk(TWO_WARD_DESK);
    const select = screen.getByRole("combobox", { name: "Filter the sheet" });
    for (const optionName of ["Mabu Liyan / Broome Mental Health Unit", "WACHS"]) {
      const option = within(select).getByRole("option", { name: optionName }) as HTMLOptionElement;
      fireEvent.change(select, { target: { value: option.value } });
      copySummary();
      await waitFor(() => expect(writeText.mock.calls.at(-1)?.[0]).toContain(optionName));
    }
  });
});
