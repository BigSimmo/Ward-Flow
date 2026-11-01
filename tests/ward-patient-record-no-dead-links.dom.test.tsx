// Access audit (31 Oct 2026): the patient record leaves off any link this desk cannot open, so none
// leads to "Not part of your role". Chronology is the coordinator's; Legal forms is closed to the site
// bed manager. Synthetic data only.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PatientLegalNowCard } from "@/components/ward-management/patients/patient-now-cards";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  usePathname: () => "/ward-flow/people/PT-093",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  setWardFeatureFlagOnDevice("role-access", null);
  resetWardAccessStoreForTests();
});

function as(access?: Parameters<typeof setWardAccess>[0]) {
  if (!access) return;
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess(access);
}

function renderInShell(node: React.ReactNode) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>{node}</WardAccessScope>
    </WardFlowProvider>,
  );
}

const formless = seedWardFlowState().movements.find((movement) => isOpen(movement) && !movement.legalForm);

describe("Record a form on the patient record's Legal card", () => {
  it("is offered to the coordinator", () => {
    expect(formless, "the seed has an open move with no form").toBeDefined();
    renderInShell(<PatientLegalNowCard movement={formless} onAllForms={() => undefined} now={NOW_ANCHOR} />);
    expect(screen.getAllByRole("link", { name: "Record a form" }).length).toBeGreaterThan(0);
  });

  it("is left off for the site bed manager, who cannot open Legal forms", () => {
    as({ role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } });
    renderInShell(<PatientLegalNowCard movement={formless} onAllForms={() => undefined} now={NOW_ANCHOR} />);
    expect(screen.getByText("No form recorded")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Record a form" })).toBeNull();
  });
});

describe("Chronology on the patient record's History", () => {
  it("is left off for a community desk, which cannot open the chronology", () => {
    as({ role: "community", scope: { kind: "team", teamName: "Midland Community Team" } });
    renderInShell(<PatientNowScreen patientId="PT-093" />);
    // History mounts when first opened, so open it before checking what it offers.
    fireEvent.click(screen.getByRole("tab", { name: /^History/u }));
    expect(screen.getByRole("heading", { name: "Episodes of care" })).toBeInTheDocument();
    expect(screen.queryByTestId("pn-history-chronology")).toBeNull();
  });

  it("is offered to the coordinator", () => {
    renderInShell(<PatientNowScreen patientId="PT-093" />);
    fireEvent.click(screen.getByRole("tab", { name: /^History/u }));
    expect(screen.getByTestId("pn-history-chronology")).toBeInTheDocument();
  });
});
