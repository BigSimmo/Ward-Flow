import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Home pins and the "since you were last here" line (features 31 and 40, 9 Nov 2026). Patient pins
 * hold record ids only, up to a limit; Home's Pinned card lists wards then patients in pinned order
 * and renders nothing until something is pinned; the line's words are built once, from counts.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { HomePinnedCard } from "@/components/ward-management/coordinator/home-pinned-card";
import { pinnedRows } from "@/components/ward-management/coordinator/home-pinned";
import {
  sinceBannerCounts,
  sinceBannerLead,
  sinceBannerLeadParts,
  sinceBannerText,
} from "@/components/ward-management/coordinator/home-since-text";
import type { ChangesSinceLastLook } from "@/components/ward-management/coordinator/since-last-look";
import {
  MY_PATIENTS_LIMIT,
  MY_PATIENTS_STORAGE_KEY,
  parseMyPatients,
  resetMyPatientsForTests,
  toggleMyPatient,
} from "@/components/ward-management/shell/ward-my-patients-store";
import { resetMyWardsForTests, toggleMyWard } from "@/components/ward-management/shell/ward-my-wards-store";
import { endWardFlowBrowserSession } from "@/components/ward-management/ward-browser-data";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

const seed = seedWardFlowState();
const NOW = seed.movements.reduce((latest, movement) => Math.max(latest, movement.openedAt), 0) + 60;

beforeEach(() => {
  resetMyPatientsForTests();
  resetMyWardsForTests();
});
afterEach(() => {
  resetMyPatientsForTests();
  resetMyWardsForTests();
});

describe("patient pins store", () => {
  it("keeps patient record ids only, without repeats, up to the limit", () => {
    expect(parseMyPatients(null)).toEqual([]);
    expect(parseMyPatients("not json")).toEqual([]);
    expect(parseMyPatients('["PT-001","Jane Citizen","UM123456","PT-001",4]')).toEqual(["PT-001"]);
    const many = Array.from({ length: MY_PATIENTS_LIMIT + 2 }, (_, index) => `PT-${index}`);
    expect(parseMyPatients(JSON.stringify(many))).toHaveLength(MY_PATIENTS_LIMIT);
  });

  it("toggles, refuses names and UMRNs, and stops at the limit", () => {
    expect(toggleMyPatient("Jane Citizen")).toBe("refused");
    expect(toggleMyPatient("UM100085")).toBe("refused");
    for (let index = 0; index < MY_PATIENTS_LIMIT; index++) expect(toggleMyPatient(`PT-${index}`)).toBe("pinned");
    expect(toggleMyPatient("PT-extra")).toBe("full");
    expect(toggleMyPatient("PT-0")).toBe("unpinned");
    expect(JSON.parse(window.localStorage.getItem(MY_PATIENTS_STORAGE_KEY) ?? "[]")).not.toContain("PT-0");
  });

  it("is forgotten when the signed-in session ends", () => {
    toggleMyPatient("PT-001");
    expect(window.localStorage.getItem(MY_PATIENTS_STORAGE_KEY)).toBe(JSON.stringify(["PT-001"]));
    endWardFlowBrowserSession();
    expect(window.localStorage.getItem(MY_PATIENTS_STORAGE_KEY)).toBeNull();
  });
});

const resolvePatient = createPatientResolver(seed);
const world = {
  units: seed.units,
  admissions: seed.admissions,
  bedReleases: seed.bedReleases,
  movements: seed.movements,
  referrals: seed.referrals,
  patientIdOf: (record: Parameters<typeof resolvePatient>[0]) => resolvePatient(record).patient?.id,
  patientIds: new Set(seed.patients.map((patient) => patient.id)),
  eds: allEmergencyDepartments(),
};
const hrefs = {
  ward: (id: string) => `/ward-flow/ward/${id}`,
  patient: (id: string) => `/ward-flow/people/${id}`,
  canOpen: () => true,
};
const waitingMovement = seed.movements.find((movement) => isOpen(movement) && resolvePatient(movement).patient)!;
const waitingPatientId = resolvePatient(waitingMovement).patient!.id;

describe("pinnedRows", () => {
  it("keeps pinned order, skips unknown or closed-to-this-desk pins, and reads step and wait", () => {
    const [a, b] = seed.units;
    const rows = pinnedRows(
      { wards: [b.id, "not-a-ward", a.id], patients: ["PT-NOBODY", waitingPatientId] },
      world,
      NOW,
      hrefs,
    );
    expect(rows.wards.map((row) => row.id)).toEqual([b.id, a.id]);
    expect(rows.wards[0].beds).toBe(b.beds);
    expect(rows.patients).toHaveLength(1);
    expect(rows.patients[0].id).toBe(waitingPatientId);
    expect(rows.patients[0].waitedMinutes).toBe(NOW - waitingMovement.openedAt);
    expect(rows.patients[0].step).not.toBe("Not recorded");

    const hidden = pinnedRows({ wards: [a.id], patients: [] }, world, NOW, { ...hrefs, canOpen: () => false });
    expect(hidden.wards).toEqual([]);
  });

  it("shows an inpatient transfer at its sending ward, not the ED it first came from", () => {
    const stay = seed.admissions.find((admission) => admission.state !== "departed")!;
    const ward = seed.units.find((unit) => unit.id === stay.unitId)!;
    const transfer = { ...waitingMovement, sourceAdmissionId: stay.id, transport: undefined };
    const rows = pinnedRows(
      { wards: [], patients: [waitingPatientId] },
      { ...world, movements: [transfer] },
      NOW,
      hrefs,
    );
    expect(rows.patients[0].where).toBe(ward.name);
  });
});

describe("Home Pinned card", () => {
  it("renders nothing until something is pinned, then wards before patients", () => {
    render(
      <WardFlowProvider>
        <HomePinnedCard now={NOW} phone={false} />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("home-pinned")).toBeNull();
    act(() => {
      toggleMyPatient(waitingPatientId);
      toggleMyWard(seed.units[0].id);
    });
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual(["home-pinned-ward", "home-pinned-patient"]);
    fireEvent.click(screen.getAllByTestId("home-pinned-unpin")[0]);
    expect(screen.queryAllByTestId("home-pinned-ward")).toHaveLength(0);
  });
});

describe("since banner text", () => {
  const base: ChangesSinceLastLook = {
    since: 0,
    newReferralIds: ["RF-1", "RF-2", "RF-3", "RF-4"],
    newMovementIds: [],
    bedsFreed: [
      { unitId: "u1", unitName: "Ward A", count: 2 },
      { unitId: "u2", unitName: "Ward B", count: 1 },
    ],
    newDelays: [
      { movementId: "WF-1", title: "Transport" },
      { movementId: "WF-2", title: "Transport" },
    ],
    newEscalationIds: [],
  };

  it("names counts escalations first, then delays, referrals and beds, with the review time", () => {
    expect(sinceBannerText(base, "15:02 yesterday")).toBe(
      "Since 15:02 yesterday: 2 new delays, 4 new referrals, 3 beds freed",
    );
    expect(sinceBannerLead(base, "15:02 yesterday")).toBe("Since 15:02 yesterday");
    expect(sinceBannerLeadParts(base, "15:02 yesterday")).toEqual({ lead: "Since 15:02", day: " yesterday" });
    expect(sinceBannerLeadParts(base, "15:02")).toEqual({ lead: "Since 15:02", day: "" });
    expect(sinceBannerCounts(base).map(({ count, label }) => `${count} ${label}`)).toEqual([
      "2 delays",
      "4 referrals",
      "3 beds freed",
    ]);
  });

  it("leads with This shift before any review, keeps every count for screen readers, and is empty with nothing new", () => {
    const shift = { ...base, basis: "shift" as const, newEscalationIds: ["WF-9"] };
    expect(sinceBannerLead(shift, "07:00")).toBe("This shift");
    expect(sinceBannerText(shift, "07:00")).toBe(
      "Since the shift started at 07:00: 1 new escalation, 2 new delays, 4 new referrals, 3 beds freed",
    );
    const nothing = { ...base, newReferralIds: [], bedsFreed: [], newDelays: [] };
    expect(sinceBannerCounts(nothing)).toEqual([]);
    expect(sinceBannerText(nothing, "07:00")).toBeUndefined();
  });

  it("leaves movements off the line unless they are the only change (D-164)", () => {
    const withMovements = { ...base, newMovementIds: ["WF-3", "WF-4"] };
    expect(sinceBannerCounts(withMovements).map(({ label }) => label)).not.toContain("movements");
    const onlyMovements = { ...withMovements, newReferralIds: [], bedsFreed: [], newDelays: [] };
    expect(sinceBannerText(onlyMovements, "15:02")).toBe("Since 15:02: 2 new movements");
  });
});
