import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/referrals",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

/** Role access plan v2 (D-80): the site bed manager reads Referrals and Discharges in its own name. */
const SEED = seedWardFlowState();
const bedManagerAt = (siteCode: string): WardAccess => ({ role: "bed_manager", scope: { kind: "site", siteCode } });
const QUEUED_IDS = new Set(referralQueueOrder(SEED.referrals).map(({ id }) => id));
// A site whose own lines include a referral still in the queue.
const QUEUED_SITE = [...new Set(SEED.units.map((unit) => unit.siteCode))].find((siteCode) =>
  scopeWardFlowState(SEED, bedManagerAt(siteCode), {
    now: NOW_ANCHOR,
    places: wardPlaceLookup(SEED.units),
  }).state.referrals.some(({ id }) => QUEUED_IDS.has(id)),
)!;
// Every control the board could offer to answer, place, assign, call about or amend a referral.
const ACTION = /accept|decline|assign|take this|log a call|ask more|refer to|place|pull|escalat|withdraw|correction/i;

function deskAs(access: WardAccess | null) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", access === null ? null : true);
    if (access) setWardAccess(access);
  });
}

/** The last discharge record opening in the whole workspace, read the coordinator's way. */
function LastOpening() {
  const { readAuditEvents } = useWardFlow();
  const read = readAuditEvents({ role: "coordinator" });
  const last =
    read.status === "allowed"
      ? read.value.filter((event) => event.action === "OPEN_DISCHARGE_RECORD").at(-1)
      : undefined;
  return <output data-testid="last-opening">{last ? `${last.actor.role}:${last.outcome}` : "none"}</output>;
}

function renderScoped(children: ReactNode) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>{children}</WardAccessScope>
      <LastOpening />
    </WardFlowProvider>,
  );
}

async function openFirstReferral(): Promise<{ id: string; detail: HTMLElement }> {
  const rows = await screen.findAllByTestId(/^ward-referral-board-select-(?!decided)/);
  expect(rows.length).toBeGreaterThan(0);
  const id = rows[0]!.getAttribute("data-testid")!.replace("ward-referral-board-select-", "");
  fireEvent.click(rows[0]!);
  return { id, detail: screen.getByRole("region", { name: "Selected referral detail" }) };
}

const buttonNames = (region: HTMLElement) =>
  within(region)
    .queryAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? button.textContent ?? "");

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("the site bed manager's Referrals board (D-80)", () => {
  it("opens a referral to read and offers no action control", async () => {
    expect(QUEUED_SITE).toBeDefined();
    deskAs(bedManagerAt(QUEUED_SITE));
    renderScoped(<ReferralBoard />);
    const { id, detail } = await openFirstReferral();

    expect(within(detail).getByTestId("ward-referral-read-only")).toHaveTextContent(
      "Read only. The coordinator and the receiving ward answer this referral.",
    );
    expect(within(detail).queryByRole("tab", { name: /^(Place|Decide)/ })).not.toBeInTheDocument();
    expect(within(detail).getByRole("tab", { name: /^Patient/ })).toHaveAttribute("aria-selected", "true");
    // The owner and call log show, with no Assign, Take this referral or Log a call.
    expect(await within(detail).findByTestId(`ward-referral-owner-${id}`)).toBeInTheDocument();
    expect(within(detail).queryByTestId(`ward-referral-assign-${id}`)).not.toBeInTheDocument();
    expect(within(detail).queryByTestId(`ward-referral-call-log-${id}`)).not.toBeInTheDocument();
    expect(within(detail).queryByRole("combobox")).not.toBeInTheDocument();
    expect(buttonNames(detail).filter((name) => ACTION.test(name))).toEqual([]);

    fireEvent.click(within(detail).getByRole("tab", { name: /^Timeline/ }));
    expect(await within(detail).findByTestId("ward-referral-history-and-corrections")).toBeInTheDocument();
    expect(within(detail).queryByTestId("ward-referral-correction-controls")).not.toBeInTheDocument();
    expect(within(detail).queryByRole("textbox")).not.toBeInTheDocument();
    expect(buttonNames(detail).filter((name) => ACTION.test(name))).toEqual([]);
  });

  it("keeps the coordinator's Place tab and Assign on the same board", async () => {
    deskAs(null);
    renderScoped(<ReferralBoard />);
    const { id, detail } = await openFirstReferral();
    expect(within(detail).queryByTestId("ward-referral-read-only")).not.toBeInTheDocument();
    expect(within(detail).getByRole("tab", { name: /^(Place|Decide)/ })).toBeInTheDocument();
    fireEvent.click(within(detail).getByRole("tab", { name: /^Patient/ }));
    expect(await within(detail).findByTestId(`ward-referral-assign-${id}`)).toBeInTheDocument();
  });
});

describe("the site bed manager's Discharges screen (D-80)", () => {
  it("opens its site's discharge record in its own name", () => {
    const admission = SEED.admissions.find((candidate) => candidate.expectedDischargeAt !== null)!;
    deskAs(bedManagerAt(unitById(admission.unitId)!.siteCode));
    renderScoped(<DischargeBoard />);

    fireEvent.click(screen.getByRole("button", { name: /^History/ }));
    const worklist = screen.getByRole("region", { name: "Discharge worklist" });
    const opener = within(worklist)
      .getAllByRole("row")
      .flatMap((row) => within(row).queryAllByRole("button"))[0];
    expect(opener).toBeDefined();
    const name = opener!.textContent ?? "";
    fireEvent.click(opener!);

    const detail = screen.getByRole("region", { name: "Selected discharge details" });
    expect(detail).not.toHaveTextContent("This record could not be opened.");
    expect(within(detail).getByRole("heading", { name })).toBeInTheDocument();
    expect(screen.getByTestId("last-opening")).toHaveTextContent("bed_manager:accepted");
    // The discharge itself stays with the ward.
    expect(screen.queryByTestId("ward-discharge-record-departure")).not.toBeInTheDocument();
  });
});
