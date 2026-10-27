import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/ed/rph-ed",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  discardReferralDraft();
  window.sessionStorage.clear();
});

/** A synthetic person already on record, chosen from search rather than added in the form. */
function RegisteredPatientSeeder() {
  const { dispatch } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "ADD_PATIENT",
          role: "ed",
          now: NOW_ANCHOR,
          givenName: "Clara",
          familyName: "Vance",
          dateOfBirth: "1991-04-12",
          gender: "Female",
          umrn: "UM999001",
        })
      }
    >
      Seed patient
    </button>
  );
}

/**
 * Walk-through WT-28 (26 Oct 2026): "Patient & referral details pre-filled from record" showed for a
 * patient just added in the referral form, when nothing had been pre-filled. It now shows only for
 * a patient chosen from the record. Synthetic people only.
 */
describe("the pre-filled banner only claims what was pre-filled (WT-28)", () => {
  it("is absent for a patient added in the form, and present for one chosen from the record", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RegisteredPatientSeeder />
        <WardReferralDrawer onClose={vi.fn()} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-referral-new-patient-toggle"));
    const newPatientForm = within(screen.getByTestId("ward-referral-new-patient"));
    fireEvent.change(newPatientForm.getByLabelText(/Family name/), { target: { value: "Rostova" } });
    fireEvent.change(newPatientForm.getByLabelText(/Given name/), { target: { value: "Elena" } });
    fireEvent.change(newPatientForm.getByLabelText(/Date of birth/), { target: { value: "1991-05-15" } });
    fireEvent.change(newPatientForm.getByLabelText(/UMRN/), { target: { value: "UM999002" } });
    fireEvent.change(newPatientForm.getByLabelText(/Gender/), { target: { value: "Female" } });
    fireEvent.click(newPatientForm.getByRole("button", { name: "Add patient" }));
    expect(screen.getByText("Rostova, Elena (35F)")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-fast-track")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Seed patient" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a patient" }), { target: { value: "UM999001" } });
    fireEvent.click(within(screen.getByRole("listbox", { name: "Matching patients" })).getAllByRole("option")[0]!);
    expect(screen.getByText("Vance, Clara (35F)")).toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-fast-track")).toBeInTheDocument();
  });
});
