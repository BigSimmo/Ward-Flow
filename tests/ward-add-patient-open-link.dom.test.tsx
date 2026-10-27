import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { AddPatientForm } from "@/components/ward-management/patients/add-patient";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { decodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";

/*
 * Audit P143 (Josh, 27 Oct 2026, 8:57 PM: "add the Open patient link for the refer path only").
 * Register & start referral goes on to the referral form, so the "added" toast offers a way
 * to the new person's page. A plain Add patient already opens that page, so its toast is unchanged.
 * Synthetic seed data only.
 */
function renderForm() {
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AddPatientForm />
      </WardFlowProvider>
    </ToastProvider>,
  );
  fireEvent.change(screen.getByLabelText(/Record number|UMRN/i), { target: { value: "UM999999" } });
  fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Testable" } });
  fireEvent.change(screen.getByLabelText("Family name"), { target: { value: "Newcomer" } });
  fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "1990-01-01" } });
}

afterEach(() => {
  cleanup();
  router.push.mockClear();
});

describe("Add patient toast, Open patient link (audit P143)", () => {
  it("offers Open patient after Register & start referral", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /Register & start referral/ }));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect(router.push.mock.calls[0][0]).toMatch(/new=1/);
    expect(await screen.findByTestId("toast")).toHaveTextContent("Testable Newcomer added, UM999999");
    // #1020 review: an in-app move, never a page load, so the record just added in demo mode is kept.
    expect(screen.queryByRole("link", { name: "Open patient" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open patient" }));
    expect(router.push).toHaveBeenCalledTimes(2);
    const href = router.push.mock.calls[1][0] as string;
    expect(href).toMatch(/^\/ward-flow\/people\/[0-9a-z]+$/);
    expect(decodeRecordAddress(href.split("/").at(-1)!)).toMatch(/^PT-A\d+$/);
  });

  it("leaves the plain Add patient toast without the link", async () => {
    renderForm();
    fireEvent.click(screen.getByTestId("ward-add-patient-submit"));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId("toast")).toHaveTextContent("Testable Newcomer added, UM999999");
    expect(screen.queryByRole("button", { name: "Open patient" })).toBeNull();
  });
});
