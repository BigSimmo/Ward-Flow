import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/ed/peel-ed",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { EdOverview } from "@/components/ward-management/ed/ed-overview";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Walk-through WT-24 (26 Oct 2026): on an ED desk the other departments read "0 waiting, No one
 * waiting". An ED desk's copy holds only its own department's people, so those zeros were false.
 * The other tiles then said the figure was not shown at this desk; with that the only thing every
 * other tile could say, the ED desk redesign (Josh, 30 Oct 2026) leaves the strip out for that desk.
 * Synthetic figures only.
 */
const ED_DESK: WardAccess = { role: "ed", scope: { kind: "ed", edId: "peel-ed" } };
const department = (id: string, code: string, waiting: number) => ({
  id,
  name: `${code} Emergency Department`,
  code,
  service: "East Metro",
  waiting,
  longest: waiting ? "3h" : "—",
  breaches: 0,
});
const overview = (
  <ToastProvider>
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdOverview
        departmentId="peel-ed"
        departments={[department("peel-ed", "PEEL", 2), department("rph-ed", "RPH", 0)]}
        onBoard={2}
        chips={[]}
        highlight={null}
        onHighlight={() => {}}
        checks={[]}
        onRaiseReferral={() => {}}
      />
    </WardFlowProvider>
  </ToastProvider>
);

afterEach(() => {
  cleanup();
  act(() => setWardFeatureFlagOnDevice("role-access", null));
  resetWardAccessStoreForTests();
});

describe("an ED desk shows no false zero for another department (WT-24)", () => {
  it("leaves the department strip out on the ED desk, so no other department reads a false zero", () => {
    act(() => setWardFeatureFlagOnDevice("role-access", true));
    act(() => setWardAccess(ED_DESK));
    render(overview);
    expect(screen.queryByRole("navigation", { name: "Emergency departments" })).toBeNull();
    expect(screen.queryByText("RPH")).toBeNull();
    expect(screen.queryByText("No one waiting")).toBeNull();
    // Its own figure stays in the hero title.
    expect(screen.getByText("on the board", { exact: false })).toHaveTextContent("2 on the board");
  });

  it("keeps every figure for the coordinator", () => {
    render(overview);
    const strip = screen.getByRole("navigation", { name: "Emergency departments" });
    const rph = within(strip).getByText("RPH").closest("li")!;
    expect(within(rph).getByText("No one waiting")).toBeInTheDocument();
    expect(within(strip).getAllByRole("link")).toHaveLength(2);
  });
});
