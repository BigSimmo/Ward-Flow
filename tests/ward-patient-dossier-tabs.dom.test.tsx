import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/people/WF-009",
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
          fileName: "synthetic-handover.pdf",
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
  it("opens documents from the Legal now card and clinical checks from the Now view, with focus handoff", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /^Documents/ }));
    await waitFor(() => expect(screen.getByRole("tab", { name: /^Documents/ })).toHaveFocus());
    expect(screen.getByRole("region", { name: "Documents and legal authority" })).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: /^Now/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clinical overview" }));
    expect(screen.getByRole("region", { name: "Clinical handover overview" })).toBeVisible();
  });
  it("keeps a record with nothing open on the quiet Gate board, without placement controls", async () => {
    setup("PT-005");
    expect(screen.getByTestId("ward-patient-status-card")).toHaveAttribute("data-mode", "inactive");
    expect(screen.queryByRole("button", { name: "Clinical overview" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /^Details/ }));
    expect(screen.getByRole("region", { name: "Patient details" })).toBeVisible();
  });
  it("searches history and makes unmatched filters explicit without losing the episode", () => {
    setup();
    const pane = tab("History");
    fireEvent.change(pane.getByRole("textbox", { name: "Search presentation history" }), {
      target: { value: "no-matching-place" },
    });
    expect(pane.getByText("No matching presentations")).toBeVisible();
    fireEvent.change(pane.getByRole("textbox", { name: "Search presentation history" }), { target: { value: "" } });
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
  it("copies recorded identifiers without adding missing facts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    setup();
    const pane = tab("Details");
    fireEvent.click(pane.getByRole("button", { name: "Copy patient identifiers" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("UMRN: UM100023"));
    expect(await pane.findByText("Copied to clipboard")).toBeVisible();
  });
  it("shows transport metadata from shared state and distinguishes it from a file preview", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Record synthetic metadata" }));
    const pane = tab("Documents");
    fireEvent.click(pane.getByRole("button", { name: "Transfer documents" }));
    expect(pane.getByText("Synthetic transport handover")).toBeVisible();
    fireEvent.click(pane.getByText("Synthetic transport handover"));
    expect(pane.getByText("synthetic-handover.pdf")).toBeVisible();
    expect(pane.getByText(/Document metadata only/)).toBeVisible();
    fireEvent.change(pane.getByRole("textbox", { name: "Search patient documents" }), {
      target: { value: "no-match" },
    });
    expect(pane.getByText("No matching document records")).toBeVisible();
  });
  it("records medical clearance only after an explicit outcome and attestation", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Clinical overview" }));
    const clinical = within(screen.getByRole("region", { name: "Clinical handover overview" }));
    const trigger = clinical.getByRole("button", { name: "Record treating-team clearance" });
    fireEvent.click(trigger);
    const dialog = within(screen.getByRole("dialog", { name: "Record treating-team medical clearance" }));
    const save = dialog.getByRole("button", { name: "Save clearance outcome" });
    expect(save).toBeDisabled();
    fireEvent.change(dialog.getByLabelText("Treating-team clearance outcome"), { target: { value: "cleared" } });
    expect(save).toBeDisabled();
    fireEvent.click(dialog.getByRole("checkbox"));
    fireEvent.click(save);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(clinical.getByText("Clearance recorded")).toBeVisible();
    expect(trigger).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Gate board" }));
    const status = screen.getByTestId("ward-patient-status-card");
    expect(within(status.querySelector('[data-cell="clearance"]') as HTMLElement).getByText("Cleared")).toBeVisible();
  });
  it("closes the clearance dialog on Escape and returns focus to its trigger", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Clinical overview" }));
    const trigger = screen.getByRole("button", { name: "Record treating-team clearance" });
    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
