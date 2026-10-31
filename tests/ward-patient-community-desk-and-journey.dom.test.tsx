// Lane L build (31 Oct 2026): the patient record's community desk branch and the Journey so far
// timeline. A community clinician follows the team's person on the ward but records none of the
// ward's changes, so Record a change and its desk switch are left out and Why admitted moves into
// that column. Journey so far lists what the movement recorded, newest first. Synthetic data only.
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
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

/** PT-093: the Midland team's referral, accepted before her admission, now on the ward. */
function renderPatient(
  access?: Parameters<typeof setWardAccess>[0],
  props: { patientId?: string; movementId?: string } = { patientId: "PT-093" },
) {
  if (access) {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <PatientNowScreen {...props} />
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

describe("patient record, community clinician's desk", () => {
  it("leaves out Record a change and its desk switch, and keeps Why admitted on the page", () => {
    renderPatient({ role: "community", scope: { kind: "team", teamName: "Midland Community Team" } });
    expect(screen.getByTestId("ward-patient-mode-pill")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-change-card")).toBeNull();
    expect(screen.queryByTestId("ward-patient-role-switch-ward")).toBeNull();
    expect(screen.getByRole("heading", { name: "Why admitted" })).toBeInTheDocument();
  });

  it("keeps Record a change for the coordinator on the same record", () => {
    renderPatient();
    expect(screen.getByTestId("ward-patient-change-card")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why admitted" })).toBeInTheDocument();
  });
});

describe("Journey so far", () => {
  it("lists the movement's recorded events newest first, with a link to the full history", () => {
    renderPatient(undefined, { movementId: "WF-012" });
    const timeline = screen.getByTestId("pn-journey-timeline");
    const items = within(timeline).getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
    // Opened is the earliest event, so it is the last row shown when the list is short.
    if (items.length <= 8) expect(items[items.length - 1]).toHaveTextContent(/^Opened at /);
    const times = Array.from(timeline.querySelectorAll("time")).map((node) =>
      Date.parse(node.getAttribute("datetime") ?? ""),
    );
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(screen.getByRole("button", { name: "Full history" })).toBeInTheDocument();
    // The near-empty duration bar is gone.
    expect(screen.queryByText("Journey since this movement opened")).toBeNull();
  });
});
