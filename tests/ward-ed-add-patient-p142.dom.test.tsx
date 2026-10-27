import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
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

/** P142 (Josh, 27 Oct 2026, 10:12 PM AWST): Add patient beside the referral button on the ED home. Synthetic. */
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
        departments={[department("peel-ed", "PEEL", 2)]}
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

describe("P142: the ED home offers Add patient", () => {
  it("shows Add patient beside Raise referral, going to /ward-flow/people/new", () => {
    act(() => setWardFeatureFlagOnDevice("role-access", true));
    act(() => setWardAccess(ED_DESK));
    render(overview);
    const add = screen.getAllByTestId("ward-ed-add-patient")[0]!;
    expect(add).toHaveTextContent("Add patient");
    expect(add).toHaveAttribute("href", "/ward-flow/people/new");
    const raise = screen.getAllByTestId("ward-ed-raise-referral-toggle")[0]!;
    expect(raise.parentElement).toBe(add.parentElement);
  });
});
