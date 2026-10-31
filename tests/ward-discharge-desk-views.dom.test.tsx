import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR, siteByCode, unitById } from "@/components/ward-management/ward-sites";

/**
 * Discharges redesign (approved by Josh, 31 Oct 2026): the nurse in charge and the site bed manager read
 * the one board through role branches. Synthetic seed only.
 */
const WARD = unitById("rph-adult-secure")!;
const SITE = siteByCode(WARD.siteCode)!;

function deskAs(access: WardAccess) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  });
}

function renderBoard() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <DischargeBoard />
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

const worklistButtons = () =>
  within(screen.getByRole("region", { name: "Discharge worklist" }))
    .queryAllByRole("button")
    .map((button) => button.textContent ?? "");

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("Discharges as each desk reads it", () => {
  it("the coordinator keeps the statewide wording, every filter and Confirm date", () => {
    renderBoard();
    expect(screen.getByText("Bed release · all services")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Service" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ward" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Patient / ward" })).toBeInTheDocument();
    expect(worklistButtons()).toContain("Confirm date");
  });

  it("the nurse in charge reads its own ward, without the Service and Ward filters or the ward line", () => {
    deskAs({ role: "ward", scope: { kind: "ward", unitIds: [WARD.id] } });
    renderBoard();
    expect(screen.getByText(`Bed release · ${WARD.name}`)).toBeInTheDocument();
    expect(screen.queryByText("Bed release · all services")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Service" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Ward" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Patient" })).toBeInTheDocument();
    const worklist = screen.getByRole("region", { name: "Discharge worklist" });
    expect(within(worklist).queryByText(new RegExp(`^${WARD.name} · `))).not.toBeInTheDocument();
  });

  it("the site bed manager reads its site, keeps the Ward filter, and offers Open, not Confirm date", () => {
    deskAs({ role: "bed_manager", scope: { kind: "site", siteCode: WARD.siteCode } });
    renderBoard();
    expect(screen.getByText(`Bed release · ${SITE.name}`)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Service" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ward" })).toBeInTheDocument();
    // Only the ward or the coordinator can change an expected date (Josh, 30 Oct).
    expect(worklistButtons()).not.toContain("Confirm date");
    expect(worklistButtons()).toContain("Open");
    // One site, one service: each row names the ward alone.
    const worklist = screen.getByRole("region", { name: "Discharge worklist" });
    expect(within(worklist).queryAllByText(new RegExp(`^${WARD.name} · `))).toHaveLength(0);
  });
});
