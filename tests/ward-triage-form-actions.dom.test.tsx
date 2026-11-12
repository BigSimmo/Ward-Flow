import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { TriageScreen } from "@/components/ward-management/triage/triage-risk-form";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/triage/new",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * Review finding 4 (12 Nov 2026): the triage form's foot had Save draft and Awaiting information,
 * which only said they were not wired. They are hidden until they do something.
 */
describe("triage form foot", () => {
  it("offers no control that only says it is not wired", () => {
    const patientId = seedWardFlowState().patients[0]!.id;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <TriageScreen patientId={patientId} />
        </ToastProvider>
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("triage-not-found")).not.toBeInTheDocument();
    expect(screen.getByTestId("triage-sign-foot")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Awaiting information" })).not.toBeInTheDocument();
  });
});
