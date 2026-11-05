import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/ward-flow/bed-meeting" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardPhoneDesktopOnly } from "@/components/ward-management/shell/ward-phone-desktop-only";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";
import { BedMeetingTvScreen } from "@/components/ward-management/bed-meeting/bed-meeting-tv";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    setWardFeatureFlagOnDevice("bed-meeting-tv", null);
    resetWardAccessStoreForTests();
  });
});

function as(access: WardAccess) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardFeatureFlagOnDevice("bed-meeting-tv", true);
    setWardAccess(access);
  });
}

describe("the larger-screen card comes after the role check (WF-12)", () => {
  it("checks the role before the larger-screen card", () => {
    as({ role: "community", scope: { kind: "team", teamName: "Synthetic team" } } as WardAccess);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardPhoneDesktopOnly />
      </WardFlowProvider>,
    );
    expect(screen.queryByText(/needs a larger screen/u)).not.toBeInTheDocument();
  });

  it("still offers the larger-screen card to a desk the page is open to", () => {
    as({ role: "bed_manager", scope: { kind: "site", siteCode: "FSH" } });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardPhoneDesktopOnly />
      </WardFlowProvider>,
    );
    expect(screen.getByText(/needs a larger screen/u)).toBeInTheDocument();
  });

  it("opens on its own site's health service, not the whole state", () => {
    as({ role: "bed_manager", scope: { kind: "site", siteCode: "FSH" } });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingTvScreen />
      </WardFlowProvider>,
    );
    const service = siteByCode("FSH")?.service;
    expect(service).toBeTruthy();
    expect(screen.getAllByText(`Bed meeting · ${service}`).length).toBeGreaterThan(0);
    expect(screen.queryByText("Bed meeting · All services")).not.toBeInTheDocument();
  });
});
