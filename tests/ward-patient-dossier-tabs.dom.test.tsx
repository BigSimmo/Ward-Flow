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
    fireEvent.click(screen.getByRole("button", { name: /^View patient details/ }));
    await waitFor(() => expect(screen.getByRole("tab", { name: /^Details/ })).toHaveFocus());
    expect(screen.getByRole("region", { name: "Patient details" })).toBeVisible();
    // Nothing is open, so there is no fit to travel gate to offer.
    expect(screen.queryByTestId("ward-patient-gate-clearance")).not.toBeInTheDocument();
  });
  it("filters history by kind, with no free-text box over the short list, and keeps the episode", () => {
    setup();
    const pane = tab("History");
    // Removed in the search and forms review (Josh, 30 Oct 2026): a person's few episodes need no search.
    expect(pane.queryByRole("textbox", { name: "Search presentation history" })).not.toBeInTheDocument();
    expect(pane.getByText("Current Presentation")).toBeVisible();
    fireEvent.click(pane.getByRole("button", { name: "Inpatient" }));
    expect(pane.getByText("No matching presentations")).toBeVisible();
    fireEvent.click(pane.getByRole("button", { name: /All \(/ }));
    expect(pane.getByText("Current Presentation")).toBeVisible();
  });
  it("keeps care catchment separate from confirmed follow-up", () => {
    setup();
    const pane = tab("Community");
    expect(pane.getByText(/A recorded catchment does not confirm/)).toBeVisible();
    expect(pane.getByText("Community follow-up is not established by this movement record.")).toBeVisible();
    expect(pane.queryByText(/Sarah Jenkins/)).not.toBeInTheDocument();
  });
  it("isolates missing patient fields without inventing movement ownership", () => {
    setup("PT-005");
    const pane = tab("Details");
    expect(pane.getByText("Name", { selector: "dt" })).toBeVisible();
    fireEvent.click(pane.getByRole("button", { name: "Missing information" }));
    expect(pane.queryByText("Name", { selector: "dt" })).not.toBeInTheDocument();
    expect(pane.getByText("Owner", { selector: "dt" }).nextElementSibling).toHaveTextContent("Not recorded");
    expect(pane.getByRole("button", { name: /Missing information/ })).toHaveAttribute("aria-pressed", "true");
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
    fireEvent.click(pane.getByRole("button", { name: "Transfer documents" }));
    expect(pane.getByText("Synthetic transport handover")).toBeVisible();
    fireEvent.click(pane.getByText("Synthetic transport handover"));
    expect(pane.getByText("PDF · 1 KB")).toBeVisible();
    expect(pane.getByText(/Document metadata only/)).toBeVisible();
    expect(pane.queryByRole("textbox", { name: "Search patient documents" })).not.toBeInTheDocument();
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
    fireEvent.change(dialog.getByLabelText("Treating-team clearance outcome"), { target: { value: "cleared" } });
    expect(save).not.toBeDisabled();
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveAccessibleDescription("Tick the statement to save");
    fireEvent.click(save);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("checkbox"));
    expect(save).not.toHaveAttribute("aria-disabled");
    fireEvent.click(save);
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
    const community = tab("Community");
    expect(community.queryByRole("heading", { name: "Family and carers" })).toBeNull();
    expect(community.getByRole("heading", { name: "Community plan" })).toBeVisible();
  });
  it("lists a CTO recorded on the Community tab in the forms register, with no lapse column (D5, D-38)", () => {
    setup("PT-005");
    const community = tab("Community");
    fireEvent.click(community.getByRole("button", { name: "Record CTO" }));
    expect(community.getByText(/Form 5A in force/)).toBeVisible();
    const documents = tab("Documents");
    const register = documents.getByRole("table");
    expect(within(register).getByText("Form 5A")).toBeVisible();
    const headers = within(register)
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual(["Form", "Status", "Recorded", "By"]);
  });
  it("lists an ended CTO as Closed beside a second one, never erasing it (D-40)", () => {
    setup("PT-005");
    const community = tab("Community");
    fireEvent.click(community.getByRole("button", { name: "Record CTO" }));
    fireEvent.click(community.getByRole("button", { name: "Record ended" }));
    fireEvent.click(community.getByRole("button", { name: "Record CTO" }));
    const register = tab("Documents").getByRole("table");
    const rows = within(register)
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.textContent ?? "");
    expect(rows.filter((row) => row.includes("Form 5A"))).toHaveLength(2);
    expect(rows.filter((row) => row.includes("Form 5A") && row.includes("Current"))).toHaveLength(1);
    expect(rows.filter((row) => row.includes("Form 5A") && row.includes("Closed"))).toHaveLength(1);
  });
});
