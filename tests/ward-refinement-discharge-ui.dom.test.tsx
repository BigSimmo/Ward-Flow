import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { DischargeBoard, groupDischarges } from "@/components/ward-management/discharges/discharge-board";
import { WardDemoPanel } from "@/components/ward-management/tools/ward-demo-panel";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ensureWardTable } from "./helpers/capacity-ward-table";

/**
 * Flags one bed as freeing later today, for a real occupant with no live release. Since 25 September
 * 2026 the seed's releases come from each stay's own recorded discharge date, and none is due later
 * today, so the "Freeing today" list starts empty; the focus journey below needs one opener to press.
 */
function FlagOneBedFreeingToday() {
  const { dispatch, now, admissions, bedReleases: live } = useWardFlow();
  const occupant = admissions.find(
    (a) => a.state === "occupied" && !live.some((r) => r.admissionId === a.id && r.state !== "discharged"),
  );
  return (
    <button
      type="button"
      data-testid="test-flag-freeing-today"
      onClick={() =>
        occupant &&
        dispatch({
          type: "FLAG_BED_RELEASE",
          role: "ward",
          now,
          unitId: occupant.unitId,
          actingUnitId: occupant.unitId,
          admissionId: occupant.id,
          waitingOn: "Awaiting ward round",
          expectedAt: now + 60,
        })
      }
    >
      flag a bed freeing today
    </button>
  );
}

/**
 * How many seeded stays carry a discharge record AND name a patient who exists, counted from the seed
 * itself rather than typed in: every seeded record now names a real patient (Josh, 25 Sept 2026), so
 * the old pinned "exactly two" no longer holds and would move again with every linked stay (R8, R18).
 */
function seededLinkedDischargeRecordCount(): number {
  const seed = seedWardFlowState();
  const patientIds = new Set(seed.patients.map((patient) => patient.id));
  return seed.admissions.filter(
    (admission) =>
      (admission.expectedDischargeAt !== null ||
        admission.dischargeConfirmedAt !== null ||
        admission.leftAt !== null) &&
      admission.patientId !== null &&
      patientIds.has(admission.patientId),
  ).length;
}

function renderCapacity() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
      <FlagOneBedFreeingToday />
    </WardFlowProvider>,
  );
}

function renderDischarges({ controls = false }: { controls?: boolean } = {}) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      {controls ? <WardDemoPanel /> : null}
      <DischargeBoard />
    </WardFlowProvider>,
  );
}

function showAdmissionRecords() {
  fireEvent.click(screen.getByRole("button", { name: /^History, admission records \d+$/u }));
}

function showLinkedPatients() {
  fireEvent.change(screen.getByRole("combobox", { name: "Patient link" }), { target: { value: "linked" } });
}

function openInesRecord() {
  const opener = within(screen.getByRole("region", { name: "Discharge worklist" })).getByRole("button", {
    name: "Marrowby, Ines",
  });
  fireEvent.click(opener);
  return opener;
}

function populationCount(button: HTMLElement): number {
  const match = button.textContent?.match(/(\d+)\s*$/u);
  expect(match, `population button has no count: ${button.textContent}`).not.toBeNull();
  return Number(match![1]);
}

describe("Q004 Capacity and Discharges refinement journeys", () => {
  it("returns focus to the Beds freeing ward opener after the ward sidebar remounts the network", () => {
    const { container } = renderCapacity();
    fireEvent.click(screen.getByTestId("test-flag-freeing-today"));
    const opener = container.querySelector<HTMLButtonElement>('button[id^="capacity-freeing-ward-"]');
    expect(opener, "the fixed fixture must expose a ward freeing a bed today").not.toBeNull();
    const openerId = opener!.id;
    const wardName = opener!.textContent!.trim();

    fireEvent.click(opener!);
    expect(screen.getByRole("heading", { level: 2, name: wardName })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Back to network" }));

    const restored = document.getElementById(openerId);
    expect(restored, "the network remount did not recreate the original useful opener").not.toBeNull();
    expect(restored).toHaveFocus();
  });

  it("opens a ward's explicit linked discharge record through the guarded Capacity journey", () => {
    renderCapacity();
    ensureWardTable();
    const rphRow = screen.getByTestId("ward-capacity-network-row-rph-adult-secure");
    fireEvent.click(within(rphRow).getByRole("button", { name: "Dabakarn" }));
    fireEvent.click(screen.getByRole("tab", { name: "Discharges" }));

    const opener = screen.getByRole("button", { name: /Ines Marrowby/u });
    fireEvent.click(opener);

    const detail = screen.getByRole("region", { name: "Discharge record detail" });
    expect(within(detail).getByRole("heading", { name: "Ines Marrowby" })).toHaveFocus();
    expect(detail).toHaveTextContent("UM100003");
  });

  it("discards an opened identity and its old handle when the real scenario reset remounts the board", () => {
    renderDischarges({ controls: true });
    showAdmissionRecords();
    showLinkedPatients();
    openInesRecord();
    expect(screen.getByRole("region", { name: "Selected discharge details" })).toHaveTextContent("UMRN UM100003");

    // DA-10: Reset demo asks first; the reset happens on the dialog's own Reset demo button.
    fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Reset the demo?" })).getByRole("button", { name: "Reset demo" }),
    );

    expect(screen.getByRole("button", { name: /^Now, \d+ to work now$/u })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Record detail" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Selected discharge details" })).not.toHaveTextContent("UM100003");

    showAdmissionRecords();
    showLinkedPatients();
    openInesRecord();
    expect(screen.getByRole("region", { name: "Selected discharge details" })).toHaveTextContent("UMRN UM100003");
  });

  it("keeps bed releases and admission records as separate counted populations", () => {
    renderDischarges();
    // Discharges redesign (approved 31 Oct 2026): Now names the hero's figure, the releases listed to
    // work now; History keeps its count of admission records.
    const releases = screen.getByRole("button", { name: /^Now, \d+ to work now$/u });
    const records = screen.getByRole("button", { name: /^History, admission records \d+$/u });
    const recordCount = populationCount(records);
    expect(recordCount).toBeGreaterThan(0);
    const groups = groupDischarges(bedReleases, NOW_ANCHOR, { heldUpAnyDate: true });
    const toWork = groups.blocked.length + groups.confirmed.length + groups.expected.length;
    expect(toWork).toBeGreaterThan(0);
    expect(releases).toHaveAccessibleName(`Now, ${toWork} to work now`);
    // The headline counts the rows listed; "open" beside it is every release not yet discharged.
    const open = bedReleases.filter((release) => release.state !== "discharged").length;
    expect(screen.getByRole("heading", { name: new RegExp(`^${toWork} to work now`, "u") })).toBeInTheDocument();
    expect(screen.getByTestId("ward-discharge-bed-days-past")).toHaveTextContent(new RegExp(`of ${open} open`, "u"));
    // Josh, 30 Oct: "All statuses" carries no count, so no third total sits beside the hero's two.
    const allStatuses = () =>
      within(screen.getByRole("combobox", { name: "Status" })).getByRole("option", { name: /^All statuses/u });
    expect(allStatuses()).toHaveTextContent(/^All statuses$/u);

    fireEvent.click(records);
    expect(allStatuses()).toHaveTextContent(/^All statuses$/u);
    expect(screen.getByRole("heading", { name: /^\d+ admission records? open/u })).toBeInTheDocument();
  });

  it("filters to the linked patients, opens one, and clears that identity on filter and population changes", () => {
    renderDischarges();
    showAdmissionRecords();
    showLinkedPatients();

    const worklist = screen.getByRole("region", { name: "Discharge worklist" });
    const recordButtons = within(worklist).getAllByRole("button");
    const expected = seededLinkedDischargeRecordCount();
    expect(expected, "the seed has fewer than two linked stays with a discharge record").toBeGreaterThanOrEqual(2);
    expect(recordButtons, "one button per linked stay with a discharge record in the seed").toHaveLength(expected);
    expect(recordButtons.map((button) => button.textContent)).toEqual(
      // AD-LEFT-01 (RF-010) names PT-010, Farah Davenporton, since 53105ca6ea; it named Talia Halloway before.
      expect.arrayContaining([
        expect.stringContaining("Marrowby, Ines"),
        expect.stringContaining("Davenporton, Farah"),
      ]),
    );

    openInesRecord();
    const details = screen.getByRole("region", { name: "Selected discharge details" });
    // D-39: the admission number is no longer shown beside the person.
    expect(details).not.toHaveTextContent("AD-RPHS-14");
    expect(details).toHaveTextContent("UMRN UM100003");

    fireEvent.change(screen.getByRole("combobox", { name: "Patient link" }), {
      target: { value: "missing" },
    });
    expect(screen.getByRole("heading", { name: "Record detail" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Selected discharge details" })).not.toHaveTextContent("UM100003");

    fireEvent.click(screen.getByRole("button", { name: /^Now, \d+ to work now$/u }));
    expect(screen.getByRole("heading", { name: "Record detail" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Selected discharge details" })).not.toHaveTextContent("UM100003");
  });
});
