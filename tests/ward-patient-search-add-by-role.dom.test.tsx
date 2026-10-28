// P165: Add patient is not offered to a desk whose role cannot add one, so it never leads to a refusal page.
import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/ward-flow/search",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
  installMatchMediaStub(false);
});

function renderAs(access: Parameters<typeof setWardAccess>[0], phone: boolean) {
  installMatchMediaStub(phone);
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  });
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientSearchPage />
    </WardFlowProvider>,
  );
}

describe("Add patient by role", () => {
  for (const phone of [false, true]) {
    it(`is hidden from a site bed manager (${phone ? "phone" : "desktop"})`, () => {
      renderAs({ role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } }, phone);
      expect(screen.queryByTestId("ward-patient-search-add")).toBeNull();
    });
    it(`stays for the bed coordinator (${phone ? "phone" : "desktop"})`, () => {
      renderAs({ role: "coordinator", scope: { kind: "statewide" } }, phone);
      expect(screen.getByTestId("ward-patient-search-add")).toHaveTextContent("Add patient");
    });
  }
});
