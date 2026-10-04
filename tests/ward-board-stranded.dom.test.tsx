import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { admissionsForUnit } from "@/components/ward-management/ward-admissions";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { strandedFlags } from "@/components/ward-management/ward-stranded";
import { wardSites } from "@/components/ward-management/ward-sites";

function renderWardBoard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardBoard unitId={unitId} requireConfirmation={false} />
    </WardFlowProvider>,
  );
}

/** A seeded ward with at least one prompt, chosen from the seed rather than hard-coded. */
const UNIT_ID = wardSites
  .flatMap((site) => site.units)
  .map((unit) => unit.id)
  .find((id) => strandedFlags(admissionsForUnit(wardAdmissions, id), WARD_ADMISSIONS_ANCHOR).length > 0);

describe("ward board stranded-patient prompts", () => {
  it("lists exactly this ward's prompts and opens the chosen bed", () => {
    if (UNIT_ID === undefined) throw new Error("No seeded ward has a stranded prompt to show.");
    const expected = strandedFlags(admissionsForUnit(wardAdmissions, UNIT_ID), WARD_ADMISSIONS_ANCHOR);
    const { getByTestId } = renderWardBoard(UNIT_ID);

    const panel = getByTestId("ward-board-stranded");
    const rows = within(panel).getAllByRole("listitem");
    expect(rows.map((row) => row.dataset.testid)).toEqual(
      expected.map((flag) => `ward-board-stranded-${flag.admissionId}`),
    );

    fireEvent.click(within(rows[0]!).getByRole("button"));
    expect(getByTestId("ward-board-detail-person")).toBeTruthy();
  });

  it("shows no panel on a ward with nothing to prompt", () => {
    const quiet = wardSites
      .flatMap((site) => site.units)
      .find((unit) => strandedFlags(admissionsForUnit(wardAdmissions, unit.id), WARD_ADMISSIONS_ANCHOR).length === 0);
    if (quiet === undefined) return;
    const { queryByTestId } = renderWardBoard(quiet.id);
    expect(queryByTestId("ward-board-stranded")).toBeNull();
  });
});
