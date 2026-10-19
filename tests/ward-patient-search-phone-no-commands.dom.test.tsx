// shell-17 (13 Oct 2026): the phone Patients page has no Commands launcher. It repeated Add patient,
// Menu and the chips, and offered a bulk copy of patient rows on a handheld. Add patient stays.
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
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
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

afterEach(() => installMatchMediaStub(false));

describe("phone Patients page has no Commands launcher", () => {
  it("shows Add patient and no Commands button or sheet", () => {
    installMatchMediaStub(true);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-patient-search-add")).toHaveTextContent("Add patient");
    expect(screen.queryByTestId("ward-patient-search-commands-open")).toBeNull();
    expect(screen.queryByRole("button", { name: "Commands" })).toBeNull();
    expect(screen.queryByText(/rows as text/u)).toBeNull();
  });
});
