import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Feature 44: the Waiting list's Export button hands the browser a CSV of the rows on screen, with
// provenance first and no patient names (synthetic seed only).
const { createObjectURL, revokeObjectURL } = URL;
afterEach(() => {
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  vi.restoreAllMocks();
});

it("exports the Waiting list without names", async () => {
  let file: Blob | undefined;
  // Spy, not stub: replacing the whole URL global breaks the lazy import of the export builder.
  URL.createObjectURL = (blob: Blob) => {
    file = blob;
    return "blob:synthetic-export";
  };
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DelaysScreen />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Export this list as a spreadsheet" }));
  await waitFor(() => expect(file).toBeDefined(), { timeout: 10_000 });
  const csv = await file!.text();
  const lines = csv.split("\r\n");
  expect(lines[0]).toBe('"Data","Synthetic, not clinical records"');
  expect(lines[2]).toContain("Waiting; everyone on the list");
  expect(lines[5]?.startsWith('"Record","UMRN","ED"')).toBe(true);
  expect(lines.length).toBeGreaterThan(6);
  const state = seedWardFlowState();
  for (const movement of state.movements) {
    const person = resolveSubjectPatient(movement, state);
    if (person.patient) expect(csv).not.toContain(person.patient.familyName);
  }
});
