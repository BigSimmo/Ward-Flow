import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * A12-04 (Audit 12, Josh approved 13 Nov 2026): "Open patient" on a single ED board opened the ED's
 * own record panel, while the same words on All EDs open the patient page. It now opens the patient
 * page on the wide side panel and the phone sheet alike. The department's time record ("Where their
 * time went") stays reachable under its own label, and no Needs you item says "Open patient".
 */
const original = window.matchMedia;

function phone(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: matches && query === "(max-width: 46.4375rem)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => push.mockClear());
afterEach(() => {
  window.matchMedia = original;
});

function openSheet(isPhone: boolean) {
  phone(isPhone);
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId="peel-ed" />
    </WardFlowProvider>,
  );
  // Wide: the row's name opens the side panel. Phone: the compact row is one button.
  fireEvent.click(
    isPhone
      ? within(screen.getByTestId("ward-ed-patient-WF-009")).getByRole("button")
      : screen.getByTestId("ward-ed-row-name-WF-009"),
  );
  return screen.getByTestId("ward-ed-phone-sheet-WF-009");
}

describe.each([
  ["the wide side panel", false],
  ["the phone sheet", true],
])("ED board, %s", (_where, isPhone) => {
  it("Open patient goes to the patient page, never the ED record panel", () => {
    const sheet = openSheet(isPhone);
    fireEvent.click(within(sheet).getByRole("button", { name: "Open patient" }));
    expect(push).toHaveBeenCalledTimes(1);
    const href = push.mock.calls[0][0] as string;
    expect(href).toMatch(/^\/ward-flow\/people\/[^/]+$/u);
    // D-39: the address carries a code, never the record number.
    expect(href).not.toContain("WF-009");
    expect(screen.queryByRole("button", { name: "Close patient details", hidden: true })).toBeNull();
  });

  it("Where their time went still opens the ED record", () => {
    const sheet = openSheet(isPhone);
    fireEvent.click(within(sheet).getByRole("button", { name: "Where their time went" }));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Where their time went", hidden: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close patient details", hidden: true })).toBeInTheDocument();
  });
});

describe("ED board Needs you", () => {
  it("offers no Open patient action that would open the ED record panel", () => {
    phone(false);
    for (const edId of ["peel-ed", "rph-ed", "arm-ed"]) {
      const { unmount } = render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <EdScreen edId={edId} />
        </WardFlowProvider>,
      );
      for (const list of screen.queryAllByTestId("ward-ed-needs-you")) {
        expect(within(list).queryByRole("button", { name: "Open patient", hidden: true })).toBeNull();
      }
      unmount();
    }
  });
});
