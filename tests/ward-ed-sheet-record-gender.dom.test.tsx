import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";

function MovementsProbe() {
  const { movements } = useWardFlow();
  return <output data-testid="movements">{JSON.stringify(movements)}</output>;
}

const read = () => JSON.parse(screen.getByTestId("movements").textContent!) as Movement[];

/** R-LEGAL-6 (D-234, Josh 14 Nov 2026): the row sheet records gender where it reads "Not yet recorded". */
describe("Record gender in the ED row sheet", () => {
  it("offers Record gender beside Not yet recorded, choosing nothing for the clinician", () => {
    let found = false;
    for (const department of allEmergencyDepartments()) {
      const view = render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <EdScreen edId={department.id} />
          <MovementsProbe />
        </WardFlowProvider>,
      );
      const rows = screen.queryAllByTestId(/^ward-ed-patient-WF-/);
      const row = rows.find((candidate) => {
        const movement = read().find((entry) => `ward-ed-patient-${entry.id}` === candidate.dataset.testid);
        return movement && movement.gender === undefined && !movement.closure;
      });
      if (!row) {
        view.unmount();
        continue;
      }
      found = true;
      const id = row.dataset.testid!.replace("ward-ed-patient-", "");
      fireEvent.click(within(row).getByTestId(/^ward-ed-row-name-/));
      const sheet = screen.getByRole("dialog");
      expect(within(sheet).getByTestId(`ward-ed-sheet-gender-${id}`)).toHaveTextContent("Not yet recorded");
      const select = within(sheet).getByTestId(`ward-ed-sheet-record-gender-${id}`) as HTMLSelectElement;
      expect(select.value).toBe("");
      const submit = within(sheet).getByTestId(`ward-ed-sheet-record-gender-submit-${id}`);
      expect(submit).toHaveAttribute("aria-disabled", "true");
      fireEvent.change(select, { target: { value: select.options[1]!.value } });
      fireEvent.click(submit);
      expect(read().find((entry) => entry.id === id)?.gender).toBe(select.options[1]!.value);
      view.unmount();
      break;
    }
    expect(found).toBe(true);
  });
});
