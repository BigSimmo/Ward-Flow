import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { DischargeBoard, groupDischarges } from "@/components/ward-management/discharges/discharge-board";
import { WardDemoPanel } from "@/components/ward-management/tools/ward-demo-panel";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { bedMapCards, wardCardName } from "./helpers/capacity-ward-table";

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
  it("returns focus to the bed map's ward card after the ward drawer closes", () => {
    renderCapacity();
    // Capacity redesign (31 Oct 2026): each ward card on the bed map opens the ward drawer; the old
    // "Beds freeing" list and its openers went with the ready-now section.
    const opener = bedMapCards()[0];
    expect(opener, "the bed map must draw at least one ward card").toBeDefined();
    const wardName = wardCardName(opener!);

    opener!.focus();
    fireEvent.click(opener!);
    const drawer = screen.getByTestId("ward-capacity-ward-drawer");
    expect(within(drawer).getByRole("heading", { name: wardName })).toBeInTheDocument();
    fireEvent.click(within(drawer).getByRole("button", { name: "Close" }));

    expect(screen.queryByTestId("ward-capacity-ward-drawer")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("opens a ward's explicit linked discharge record through the guarded Capacity journey", () => {
    renderCapacity();
    const ward = allUnits().find((unit) => unit.id === "rph-adult-secure")!;
    const card = bedMapCards().find((candidate) => wardCardName(candidate) === ward.name);
    expect(card, `the bed map must draw ${ward.name}`).toBeDefined();
    fireEvent.click(card!);
    const drawer = within(screen.getByTestId("ward-capacity-ward-drawer"));
    fireEvent.click(drawer.getByRole("radio", { name: /^Discharges/u }));

    const opener = drawer.getByRole("button", { name: /Marrowby, Ines/u });
    fireEvent.click(opener);

    const detail = screen.getByRole("region", { name: "Discharge record detail" });
    expect(within(detail).getByRole("heading", { name: "Marrowby, Ines" })).toHaveFocus();
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
