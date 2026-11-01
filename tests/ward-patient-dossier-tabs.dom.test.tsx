import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/WF-009",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
function MetadataProbe() {
  const { dispatch } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "UPLOAD_PATIENT_FORM",
          role: "ed",
          now: NOW_ANCHOR,
          movementId: "WF-009",
          formName: "Synthetic transport handover",
          fileType: "PDF",
          sizeBytes: 1234,
        })
      }
    >
      Record synthetic metadata
    </button>
  );
}
function setup(id = "WF-009") {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientNowScreen patientId={id} />
      <MetadataProbe />
    </WardFlowProvider>,
  );
}
function tab(name: string) {
  fireEvent.click(screen.getByRole("tab", { name: new RegExp(`^${name}`) }));
  return within(document.getElementById(`pnpane-${name.toLowerCase()}`)!);
}
describe("polished patient dossier tabs", () => {
  it("opens documents from Legal now and returns to the status card on Now with focus handoff", async () => {
    setup();
    fireEvent.click(within(screen.getByTestId("ward-patient-legal-now")).getByRole("button", { name: "Forms" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: /^Documents/ })).toHaveFocus());
    expect(screen.getByRole("region", { name: "Documents and legal authority" })).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: /^Now/ }));
    expect(screen.getByRole("region", { name: "Status" })).toBeVisible();
    expect(screen.getByTestId("ward-patient-gate-clearance")).toBeVisible();
  });
  it("makes the record-only brief shortcut open patient details", async () => {
    setup("PT-005");
    // Redesign (1 Nov 2026): the record row on Now opens each tab; Details leads with the UMRN.
    fireEvent.click(
      within(screen.getByRole("region", { name: "Patient record" })).getByRole("button", { name: /^Details/ }),
    );
    await waitFor(() => expect(screen.getByRole("tab", { name: /^Details/ })).toHaveFocus());
    expect(screen.getByRole("region", { name: "Patient details" })).toBeVisible();
    // Nothing is open, so there is no fit to travel gate to offer.
    expect(screen.queryByTestId("ward-patient-gate-clearance")).not.toBeInTheDocument();
  });
  it("keeps the current episode above earlier ones, with no free-text box over the short list", () => {
    setup();
    const pane = tab("History");
    // Removed in the search and forms review (Josh, 30 Oct 2026): a person's few episodes need no search.
    expect(pane.queryByRole("textbox")).not.toBeInTheDocument();
    // Redesign (1 Nov 2026): one Episodes of care card, this presentation first, then earlier episodes.
    expect(pane.getByRole("heading", { name: "Current presentation" })).toBeVisible();
    expect(pane.getByRole("heading", { name: "Earlier episodes" })).toBeVisible();
    expect(pane.getByText("Events are the ones recorded. Missing transitions are not inferred.")).toBeVisible();
  });
  it("keeps care catchment separate from confirmed follow-up", () => {
    setup();
    // Redesign (1 Nov 2026): Community shows only when engagement is noted; a catchment alone is in Details.
    expect(screen.queryByRole("tab", { name: /^Community/ })).not.toBeInTheDocument();
    const pane = tab("Details");
    const catchment = pane.getByText("Catchment community team", { selector: "dt" }).nextElementSibling;
    expect(catchment).toHaveTextContent("Catchment only");
    expect(pane.queryByText(/Sarah Jenkins/)).not.toBeInTheDocument();
  });
  it("leaves out placement facts without inventing movement ownership", () => {
    setup("PT-005");
    const pane = tab("Details");
    expect(pane.getByText("Name", { selector: "dt" })).toBeVisible();
    // Redesign (1 Nov 2026): nothing is guessed. With no open movement there is no owner or age band.
    expect(pane.queryByText("Owner", { selector: "dt" })).not.toBeInTheDocument();
    expect(pane.queryByText("Age band", { selector: "dt" })).not.toBeInTheDocument();
  });
  it("offers no copy of the patient's identifiers (D-71 item 7)", () => {
    setup();
    const pane = tab("Details");
    expect(pane.queryByRole("button", { name: "Copy patient identifiers" })).not.toBeInTheDocument();
  });
  it("shows transport metadata from shared state and distinguishes it from a file preview", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Record synthetic metadata" }));
    const pane = tab("Documents");
    const row = pane.getByText("Synthetic transport handover").closest("tr")!;
    expect(row).toBeVisible();
    expect(row).toHaveTextContent("PDF · 1 KB");
    expect(pane.getByText(/Document metadata only/)).toBeVisible();
  });
  it("records medical clearance only after an explicit outcome and attestation", () => {
    setup();
    const clinical = within(screen.getByTestId("ward-patient-gate-clearance"));
    const trigger = clinical.getByRole("button", { name: "Record clearance" });
    fireEvent.click(trigger);
    const dialog = within(screen.getByRole("dialog", { name: "Record treating-team medical clearance" }));
    const save = dialog.getByRole("button", { name: "Save clearance outcome" });
    expect(save).not.toBeDisabled();
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveAccessibleDescription("Choose the outcome to save");
    fireEvent.click(save);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Two choices, neither chosen (approved pop-up, 31 Oct 2026).
    const outcome = within(dialog.getByRole("group", { name: "Treating-team clearance outcome" }));
    expect(outcome.getAllByRole("radio")).toHaveLength(2);
    for (const radio of outcome.getAllByRole("radio")) expect(radio).not.toBeChecked();
    fireEvent.click(outcome.getByRole("radio", { name: "Medical clearance provided" }));
    expect(save).not.toBeDisabled();
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveAccessibleDescription("Tick the statement to save");
    fireEvent.click(save);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("checkbox"));
    // The kit button drops its reason wrapper once Save is available, so read it again.
    const ready = dialog.getByRole("button", { name: "Save clearance outcome" });
    expect(ready).not.toHaveAttribute("aria-disabled");
    fireEvent.click(ready);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(clinical.getByText(/^Cleared \d{2}:\d{2}$/)).toBeVisible();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveTextContent("Update clearance");
  });
  it("closes the clearance dialog on Escape and returns focus to its trigger", () => {
    setup();
    const trigger = within(screen.getByTestId("ward-patient-gate-clearance")).getByRole("button", {
      name: "Record clearance",
    });
    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("shows no preview cards for fields the record cannot hold (unfinished features cleanup, 23 Oct 2026)", () => {
    setup("PT-005");
    const details = tab("Details");
    expect(details.queryByRole("heading", { name: "Not in the record yet" })).toBeNull();
    expect(details.queryAllByText("Needs a record field")).toHaveLength(0);
    // No Community tab without engagement noted, and no Family and carers preview anywhere.
    expect(screen.queryByRole("tab", { name: /^Community/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Family and carers" })).toBeNull();
  });
  it("lists a CTO recorded on the Community tab in the forms register, with no lapse column (D5, D-38)", () => {
    setup("PT-005");
    fireEvent.click(within(screen.getByTestId("ward-patient-gate-legal")).getByRole("button", { name: "Record CTO" }));
    // A CTO is community engagement, so the Community tab now appears and states it.
    const community = tab("Community");
    expect(community.getByText(/Form 5A in force/)).toBeVisible();
    const documents = tab("Documents");
    const register = documents.getByRole("table", { name: "Document register" });
    expect(within(register).getByText("5A")).toBeVisible();
    const headers = within(register)
      .getAllByRole("columnheader")
      .map((h) => h.textContent ?? "");
    expect(headers.filter((h) => /lapse|expir|remaining/i.test(h))).toEqual([]);
  });
  it("lists an ended CTO as Closed beside a second one, never erasing it (D-40)", () => {
    setup("PT-005");
    fireEvent.click(within(screen.getByTestId("ward-patient-gate-legal")).getByRole("button", { name: "Record CTO" }));
    const community = tab("Community");
    fireEvent.click(community.getByRole("button", { name: "Record ended" }));
    fireEvent.click(community.getByRole("button", { name: "Record CTO" }));
    const register = tab("Documents").getByRole("table", { name: "Document register" });
    const rows = within(register)
      .getAllByRole("row")
      .map((row) => row.textContent ?? "")
      .filter((row) => row.includes("Community treatment order"));
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.includes("In force"))).toHaveLength(1);
    expect(rows.filter((row) => row.includes("Ended"))).toHaveLength(1);
  });
});
