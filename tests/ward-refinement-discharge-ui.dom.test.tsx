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
 * Recorded (DC4, Josh, 3 Nov 2026) lists only departed stays whose leftAt falls in the last 7 days,
 * counted from the seed rather than typed in.
 */
function seededRecentDepartureCount(): number {
  const since = NOW_ANCHOR - 7 * 24 * 60;
  return seedWardFlowState().admissions.filter(
    (admission) => admission.state === "departed" && admission.leftAt !== null && admission.leftAt >= since,
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

function showRecorded() {
  fireEvent.click(screen.getByRole("button", { name: "Recorded, discharges in the last 7 days" }));
}

/** A kit Menu radio picker: open its pill, then choose the option. */
function pick(label: string, option: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}: `, "u") }));
  fireEvent.click(within(screen.getByRole("menu", { name: label })).getByRole("menuitemradio", { name: option }));
}

/** Farah Davenporton (AD-LEFT-01, UM100010) is a linked patient who left within the last 7 days. */
function openFarahRecord() {
  const opener = within(screen.getByRole("region", { name: "Discharge worklist" })).getByRole("button", {
    name: "Davenporton, Farah",
  });
  fireEvent.click(opener);
  return opener;
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
    showRecorded();
    openFarahRecord();
    expect(screen.getByRole("region", { name: "Selected discharge details" })).toHaveTextContent("UMRN UM100010");

    // DA-10: Reset demo asks first; the reset happens on the dialog's own Reset demo button.
    fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Reset the demo?" })).getByRole("button", { name: "Reset demo" }),
    );

    expect(screen.getByRole("button", { name: /^Now, \d+ to work now$/u })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Record detail" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Selected discharge details" })).not.toHaveTextContent("UM100010");

    showRecorded();
    openFarahRecord();
    expect(screen.getByRole("region", { name: "Selected discharge details" })).toHaveTextContent("UMRN UM100010");
  });

  it("keeps bed releases and recorded discharges as separate counted populations", () => {
    renderDischarges();
    // Discharges redesign (approved 31 Oct 2026): Now names the hero's figure, the releases listed to
    // work now. DC4 (3 Nov 2026): Recorded is the last 7 days of discharges and carries no count.
    const releases = screen.getByRole("button", { name: /^Now, \d+ to work now$/u });
    const recorded = screen.getByRole("button", { name: "Recorded, discharges in the last 7 days" });
    const groups = groupDischarges(bedReleases, NOW_ANCHOR, { heldUpAnyDate: true });
    const toWork = groups.blocked.length + groups.confirmed.length + groups.expected.length;
    expect(toWork).toBeGreaterThan(0);
    expect(releases).toHaveAccessibleName(`Now, ${toWork} to work now`);
    // The headline counts the rows listed; "open" beside it is every release not yet discharged.
    const open = bedReleases.filter((release) => release.state !== "discharged").length;
    expect(screen.getByRole("heading", { name: new RegExp(`^${toWork} to work now`, "u") })).toBeInTheDocument();
    expect(screen.getByTestId("ward-discharge-bed-days-past")).toHaveTextContent(new RegExp(`of ${open} open`, "u"));
    // DC2 (3 Nov 2026): the in-list status chip row is gone in both populations.
    expect(screen.queryByRole("group", { name: "Status" })).toBeNull();

    fireEvent.click(recorded);
    expect(recorded).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("group", { name: "Status" })).toBeNull();
    const recent = seededRecentDepartureCount();
    expect(recent, "the seed has no discharge in the last 7 days").toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: new RegExp(`^${recent} discharges? recorded`, "u") }),
    ).toBeInTheDocument();
    const worklist = screen.getByRole("region", { name: "Discharge worklist" });
    expect(within(worklist).getAllByRole("button")).toHaveLength(recent);
    // An open admission record (Ines Marrowby, held up or expected) stays on Now only.
    expect(within(worklist).queryByRole("button", { name: "Marrowby, Ines" })).toBeNull();
  });

  it("filters Recorded by destination, opens one, and clears that identity on filter and population changes", () => {
    renderDischarges();
    showRecorded();

    const worklist = screen.getByRole("region", { name: "Discharge worklist" });
    expect(within(worklist).getAllByRole("button")).toHaveLength(seededRecentDepartureCount());
    // The identity filter was removed (DC2); Recorded offers Going to instead of Held up by, and no Sort.
    expect(screen.queryByRole("button", { name: /^Patient link: /u })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Held up by: /u })).toBeNull();
    expect(screen.queryByTestId("ward-discharges-sort")).toBeNull();

    pick("Going to", "Discharged to the community");
    const community = within(worklist).getAllByRole("button");
    expect(community.map((button) => button.textContent)).toEqual(
      // AD-LEFT-01 (RF-010) names PT-010, Farah Davenporton, since 53105ca6ea; it named Talia Halloway before.
      expect.arrayContaining([expect.stringContaining("Davenporton, Farah")]),
    );
    expect(community.length).toBeLessThan(seededRecentDepartureCount());

    openFarahRecord();
    const details = screen.getByRole("region", { name: "Selected discharge details" });
    // D-39: the admission number is no longer shown beside the person.
    expect(details).not.toHaveTextContent("AD-LEFT-01");
    expect(details).toHaveTextContent("UMRN UM100010");

    pick("Going to", "Left against advice");
    expect(screen.getByRole("heading", { name: "Record detail" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Selected discharge details" })).not.toHaveTextContent("UM100010");

    pick("Going to", "All");
    openFarahRecord();
    expect(screen.getByRole("region", { name: "Selected discharge details" })).toHaveTextContent("UMRN UM100010");
    fireEvent.click(screen.getByRole("button", { name: /^Now, \d+ to work now$/u }));
    expect(screen.getByRole("heading", { name: "Record detail" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Selected discharge details" })).not.toHaveTextContent("UM100010");
  });
});
