// Master audit M22 (10 Nov 2026), part (b): a desk scoped to one ward that searches for a person
// who is only on another ward gets nothing back, not even a count. The screen is given the same
// cut of the workspace the server sends that desk (`scopeWardFlowState`), as the shell does.
// Synthetic seed data only; the person searched for is found by rule from the seed, never typed.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { searchWardFlow } from "@/components/ward-management/search/ward-smart-search";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { WardGlobalSearch, clearGlobalSearchRecents } from "@/components/ward-management/ward-global-search";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Patient } from "@/components/ward-management/ward-patients";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { installMatchMediaStub } from "./setup/jsdom.setup";

afterEach(() => {
  cleanup();
  clearGlobalSearchRecents();
});

const full = seedWardFlowState();
const places = wardPlaceLookup(full.units);

/** A ward desk, and a person in a bed on a different ward whom that desk is not sent. */
function deskAndOutsider(): { access: WardAccess; scoped: WardFlowState; outsider: Patient } {
  const fold = (value: string) => value.toLowerCase();
  for (const unit of full.units) {
    const access: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [unit.id] } };
    const { state: scoped } = scopeWardFlowState(full, access, { now: NOW_ANCHOR, places });
    const visible = new Set(scoped.patients.map((patient) => patient.id));
    const outsider = full.admissions
      .filter((admission) => admission.unitId !== unit.id && admission.state === "occupied" && admission.patientId)
      .map((admission) => full.patients.find((patient) => patient.id === admission.patientId))
      .find(
        (patient): patient is Patient =>
          patient !== undefined &&
          !visible.has(patient.id) &&
          // Unique surname in the whole workspace, so "nothing found" cannot be a near-miss.
          full.patients.filter((other) => fold(other.familyName) === fold(patient.familyName)).length === 1 &&
          // Nobody the desk can see shares any part of the name either.
          !scoped.patients.some(
            (other) =>
              fold(`${other.givenName} ${other.familyName}`).includes(fold(patient.familyName)) ||
              fold(`${other.givenName} ${other.familyName}`).includes(fold(patient.givenName)),
          ),
      );
    if (outsider) return { access, scoped, outsider };
  }
  throw new Error("the seed has no ward desk with a person only on another ward");
}

const { access, scoped, outsider } = deskAndOutsider();
const queries = [
  `${outsider.givenName} ${outsider.familyName}`,
  `${outsider.familyName}, ${outsider.givenName}`,
  outsider.familyName,
  outsider.umrn,
];

function search(state: WardFlowState, query: string) {
  return searchWardFlow({
    query,
    patients: state.patients,
    movements: state.movements,
    units: state.units,
    referrals: state.referrals,
    now: NOW_ANCHOR,
    plannedAdmissions: state.plannedAdmissions,
    admissions: state.admissions,
  });
}

describe("a ward desk's search stays inside its own ward (M22b)", () => {
  it("the whole workspace does find the person, so the scoped answer below is not a near-miss", () => {
    expect(access.scope.kind).toBe("ward");
    for (const query of queries) expect(search(full, query).people.map((patient) => patient.id)).toContain(outsider.id);
  });

  it.each(queries.map((query, index) => [["full name", "surname first", "surname", "UMRN"][index]!, query]))(
    "searching the %s on the scoped desk finds no person, journey or referral",
    (_label, query) => {
      const found = search(scoped, query);
      expect(found.people).toEqual([]);
      expect(found.movements).toEqual([]);
      expect(found.referrals).toEqual([]);
      // Nothing anywhere: no bed, task or place row names them either, so no group can count them.
      expect(found.totalCount).toBe(0);
      expect(found.hasAny).toBe(false);
      expect(found.truncatedGroups.filter((group) => ["people", "movements", "referrals"].includes(group))).toEqual([]);
    },
  );

  function ScopedDesk({ children }: { children: ReactNode }) {
    const context = useWardFlow();
    return <WardFlowOverride value={{ ...context, ...scoped }}>{children}</WardFlowOverride>;
  }

  it.each(queries)("the header search shows nothing and no count for %s", (query) => {
    installMatchMediaStub(false);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ScopedDesk>
          <WardGlobalSearch
            movements={scoped.movements}
            patients={scoped.patients}
            referrals={scoped.referrals}
            units={scoped.units}
            plannedAdmissions={scoped.plannedAdmissions}
            now={NOW_ANCHOR}
          />
        </ScopedDesk>
      </WardFlowProvider>,
    );
    const input = screen.getByTestId("ward-global-search-input");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: query } });
    const popup = screen.getByTestId("ward-global-search-popup");
    // The empty state echoes what was typed ("Nothing found for ..."); nothing else may name them.
    expect(screen.getByTestId("ward-global-search-empty")).toBeInTheDocument();
    const shown = (popup.textContent ?? "").replace(`\u201c${query}\u201d`, "");
    expect(shown).not.toContain(outsider.familyName);
    expect(shown).not.toContain(outsider.umrn);
    expect(document.querySelector(`[data-testid$="-${outsider.id}"]`)).toBeNull();
    expect(screen.queryAllByTestId(/^ward-global-search-result-(patient|person|people|movement|referral)-/u)).toEqual(
      [],
    );
    for (const kind of ["people", "movements", "referrals", "journeys"]) {
      expect(screen.queryByTestId(`ward-global-search-kind-${kind}`)).toBeNull();
    }
  });
});
