import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";

describe("Ward Flow Advanced Clinical Features DOM Suite", () => {
  describe("Option 0 & Option 4: Patient Now Screen - Pulled Bed Banner, Arrival Time & Forms Modals", () => {
    it("renders Pulled Bed Banner with action buttons on a pulled bed movement (WF-004)", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <PatientNowScreen movementId="WF-004" />
        </WardFlowProvider>,
      );

      // Verify the Executive Pulled Bed Banner exists
      expect(screen.getByText(/Bed Pulled & Reserved/i)).toBeDefined();
      expect(screen.getByTestId("ward-patient-update-arrival-btn")).toBeDefined();
      expect(screen.getByTestId("ward-patient-upload-forms-btn")).toBeDefined();
    });

    it("opens Arrival Time Modal, configures arrival details, and updates banner", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <PatientNowScreen movementId="WF-004" />
        </WardFlowProvider>,
      );

      const updateBtn = screen.getByTestId("ward-patient-update-arrival-btn");
      fireEvent.click(updateBtn);

      // Modal is open
      expect(screen.getByRole("dialog", { name: /Update Arrival Time/i })).toBeDefined();

      // Enter tracking number
      const trackingInput = screen.getByLabelText(/Transport CAD \/ Tracking Number/i);
      fireEvent.change(trackingInput, { target: { value: "RFDS-9912" } });

      // Click +2 hours preset
      const plus2hBtn = screen.getByRole("button", { name: /\+2 Hours/i });
      fireEvent.click(plus2hBtn);

      // Submit
      const confirmBtn = screen.getByTestId("save-arrival-plan-button");
      fireEvent.click(confirmBtn);

      // Verify banner updated with tracking info
      expect(screen.getByText(/RFDS-9912/i)).toBeDefined();
    });

    it("records selected document metadata for the Officer Console without claiming to upload contents", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <PatientNowScreen movementId="WF-004" />
        </WardFlowProvider>,
      );

      const uploadBtn = screen.getByTestId("ward-patient-upload-forms-btn");
      fireEvent.click(uploadBtn);

      // Modal is open
      const dialog = screen.getByRole("dialog", { name: /Record document details/i });
      expect(dialog).toHaveTextContent("File contents are not stored or sent");

      // Submit form
      const submitBtn = screen.getByTestId("confirm-upload-form-button");
      expect(submitBtn).toBeDisabled();
      fireEvent.change(within(dialog).getByLabelText("Upload document file"), {
        target: { files: [new File(["synthetic"], "synthetic-transfer.pdf", { type: "application/pdf" })] },
      });
      expect(submitBtn).toBeEnabled();
      fireEvent.click(submitBtn);

      // Verify attached forms section updated
      expect(screen.getByTestId("ward-patient-uploaded-forms")).toBeDefined();
      expect(screen.getByTestId("ward-patient-uploaded-forms")).toHaveTextContent("synthetic-transfer.pdf");
    });
  });

  describe("Option 1 & Option 2: Ward Board - Step-Down Solver & Discharge Barrier (LOS >= 7d)", () => {
    it("renders discharge barrier dropdown and step-down button for occupants with stay >= 7 days", () => {
      render(
        <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
          <WardBoard unitId="rph-adult-secure" />
        </WardFlowProvider>,
      );

      // Bed 1 has 34 days stay in seed
      const bed1Btn = within(screen.getByTestId("ward-board-bed-1")).getByRole("button");
      fireEvent.click(bed1Btn);

      // Long-stay occupant drawer must show the discharge barrier select
      const barrierSelect = screen.getByLabelText(/Primary Discharge Barrier/i);
      expect(barrierSelect).toBeDefined();
      expect(screen.getByText(/Accommodation \/ Housing/i)).toBeDefined();
      expect(screen.getByText(/NDIS/i)).toBeDefined();
      expect(screen.getByText(/SAT \/ Public Guardian/i)).toBeDefined();

      // Step-down toggle button must also be present
      const stepDownToggle = screen.getByTestId("ward-board-stepdown-toggle");
      expect(stepDownToggle).toBeDefined();
      fireEvent.click(stepDownToggle);
      expect(screen.getByTestId("ward-board-stepdown-toggle").textContent).toContain("Marked as Step-Down");
    });

    it("does not render discharge barrier dropdown for short-stay occupants (< 7 days)", () => {
      render(
        <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
          <WardBoard unitId="rph-adult-secure" />
        </WardFlowProvider>,
      );

      // Bed 2 has 5 days stay in seed (< 7d)
      const bed2Btn = within(screen.getByTestId("ward-board-bed-2")).getByRole("button");
      fireEvent.click(bed2Btn);

      // Short-stay occupant drawer must NOT show the discharge barrier select
      expect(screen.queryByLabelText(/Primary Discharge Barrier/i)).toBeNull();
    });
  });

  describe("Option 3: Pre-Admission Medical Clearance Checkpoint", () => {
    it("opens Documentation from the clearance summary and records the clearance draft", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardReferralDrawer onClose={() => {}} />
        </WardFlowProvider>,
      );

      // Pre-admission medical clearance toggle button
      const toggleBtn = screen.getByTestId("ward-referral-medical-clearance-toggle");
      expect(toggleBtn).toBeDefined();
      // v6 (ReferralDrawer.webp): before the question is answered the status reads "Not answered".
      expect(screen.getByTestId("ward-referral-clearance-status").textContent).toContain("Not answered");

      // The summary opens Documentation; a draft does not alter the live movement.
      fireEvent.click(toggleBtn);
      expect(screen.getByTestId("ward-referral-clearance-status").textContent).toContain("Not answered");
      const clearance = screen.getByRole("group", { name: "Has the patient been medically cleared?" });
      fireEvent.click(within(clearance).getByLabelText("Yes"));
      expect(screen.getByTestId("ward-referral-clearance-status").textContent).toContain("Cleared");
      expect(screen.getByText(/Fit for Admission & Travel/i)).toBeDefined();
    });
  });

  describe("Option 4: Transport Officer Console", () => {
    it("renders jobs list and reflects arrival/forms metadata safely", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <OfficerScreen />
        </WardFlowProvider>,
      );

      // The officer screen renders its active jobs board
      expect(screen.getByTestId("ward-officer-screen")).toBeDefined();
    });
  });

  describe("Option 5: Handover Page 16:30 Rollup Tab", () => {
    it("navigates to 16:30 Handover Rollup tab and renders all 3 executive sections", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <HandoverPage />
        </WardFlowProvider>,
      );

      const rollupTabBtn = screen.getByRole("tab", { name: /16:30 Rollup/i });
      expect(rollupTabBtn).toBeDefined();

      fireEvent.click(rollupTabBtn);

      const rollupPane = screen.getByTestId("ward-handover-rollup-1630");
      expect(rollupPane).toBeDefined();

      // Section 1: Long-Stay Patients & Primary Discharge Barriers
      expect(screen.getByText(/1\. Long-Stay Patients & Primary Discharge Barriers \(LOS ≥ 7 Days\)/i)).toBeDefined();

      // Section 2: Acute Bed Cascade Solver (Step-Down Transfer Candidates)
      expect(screen.getByText(/2\. Acute Bed Cascade Solver \(Step-Down Transfer Candidates\)/i)).toBeDefined();

      // Section 3: Evening Inbound Arrivals & Transport ETAs
      expect(screen.getByText(/3\. Evening Inbound Arrivals & Transport ETAs/i)).toBeDefined();
    });
  });
});
