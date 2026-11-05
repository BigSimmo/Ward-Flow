// PR #1474 review (5 Nov 2026): the Ward Flow 404 offers only links the desk can open. Synthetic
// values only.
import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/no-such-page",
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

import { WardFlowNotFoundBody } from "@/app/ward-flow/ward-flow-not-found-body";
import { ToastProvider } from "@/components/wf/toast-provider";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function atDesk(access: WardAccess | null) {
  act(() => setWardFeatureFlagOnDevice("role-access", access ? true : null));
  if (access) act(() => setWardAccess(access));
}

afterEach(() => {
  act(() => setWardFeatureFlagOnDevice("role-access", null));
  resetWardAccessStoreForTests();
});

function renderNotFound() {
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardFlowNotFoundBody />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

describe("the Ward Flow 404 offers only what the desk can open", () => {
  it("the coordinator gets Home and the patient search", () => {
    atDesk(null);
    renderNotFound();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/ward-flow");
    expect(screen.getByRole("link", { name: "Search patients" })).toHaveAttribute("href", "/ward-flow/search");
  });

  it.each([
    ["executive", { role: "executive", scope: { kind: "statewide" } }, "/ward-flow/statistics"],
    ["access admin", { role: "admin", scope: { kind: "statewide" } }, "/ward-flow/settings"],
  ] as const)("the %s desk gets its own home and no patient search", (_name, access, home) => {
    atDesk(access as WardAccess);
    renderNotFound();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", home);
    expect(screen.queryByRole("link", { name: "Search patients" })).not.toBeInTheDocument();
  });
});
