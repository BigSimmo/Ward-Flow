import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  defaultHandoverShift,
  handoverAt,
  handoverCutoff,
  handoverHasPassed,
  handoverSignedAt,
} from "@/components/ward-management/handover/handover-model";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";

// Refined Handover A (Josh, 9 Oct 2026): a grouped table in meeting order is the core, held to a
// set height; the right panel is the sign-off sheet until a patient is picked; Beds and History
// are tabs; Print handover opens the sheet builder.
const seed = seedWardFlowState();
const openCount = seed.movements.filter(isOpen).length;

function renderHandover() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <HandoverPage />
      <WardLiveRegion />
    </WardFlowProvider>,
  );
}

function firstPatientRow() {
  const sheet = screen.getByTestId("ward-handover-sheet");
  return within(sheet)
    .getAllByRole("row")
    .find((row) => row.hasAttribute("data-row-id"))!;
}

describe("Handover page", () => {
  beforeEach(() => resetWardLiveRegionForTests());

  it("opens on the next handover with the counts, the tabs and the table", () => {
    renderHandover();
    expect(screen.getByTestId("ward-handover-page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /to hand over/ })).toBeInTheDocument();
    expect(screen.getByText(/^Handover · 15:00/)).toBeInTheDocument();
    expect(screen.getByTestId("ward-handover-kpi-strip")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Patients/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Beds/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /History/ })).toBeInTheDocument();
    expect(screen.getByTestId("ward-handover-print")).toBeInTheDocument();
  });

  it("groups every open patient in meeting order", () => {
    renderHandover();
    const ids = ["act", "due", "bed", "acc", "mov"].map((id) => screen.getByTestId(`ward-handover-group-${id}`));
    for (let index = 1; index < ids.length; index += 1) {
      expect(ids[index - 1]!.compareDocumentPosition(ids[index]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    const rows = within(screen.getByTestId("ward-handover-sheet"))
      .getAllByRole("row")
      .filter((row) => row.hasAttribute("data-row-id"));
    expect(rows).toHaveLength(openCount);
  });

  it("holds the table to a set height so it scrolls inside its card", () => {
    renderHandover();
    expect(screen.getByRole("region", { name: "Handover patients" })).toBeInTheDocument();
    const css = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/handover/handover-refined.module.css"),
      "utf8",
    );
    const block = css.slice(css.indexOf(".tableScroll {"), css.indexOf("}", css.indexOf(".tableScroll {")));
    expect(block).toMatch(/max-height:/);
    expect(block).toMatch(/overflow: auto/);
  });

  it("names patients by name and UMRN and never shows a journey number", () => {
    renderHandover();
    const page = screen.getByTestId("ward-handover-page").textContent ?? "";
    expect(page).not.toMatch(/WF-\d/);
    const identity = resolveSubjectPatient(
      seed.movements.find((movement) => movement.id === "WF-016")!,
      seed,
    );
    expect(page).toContain(identity.displayName);
  });

  it("shows the sign-off sheet until a patient is picked, then that patient's flow", async () => {
    const user = userEvent.setup();
    renderHandover();
    expect(screen.getByTestId("ward-handover-sign-off")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-handover-flow-panel")).not.toBeInTheDocument();

    await user.click(firstPatientRow());
    const panel = screen.getByTestId("ward-handover-flow-panel");
    expect(panel).toHaveTextContent("Next step");
    expect(panel).toHaveTextContent("ISBAR");
    expect(within(panel).getByRole("list", { name: /Journey/ })).toBeInTheDocument();
    expect(screen.queryByTestId("ward-handover-sign-off")).not.toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Close patient" }));
    expect(screen.getByTestId("ward-handover-sign-off")).toBeInTheDocument();
  });

  it("steps through patients with J and K and closes with Escape", () => {
    renderHandover();
    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByTestId("ward-handover-flow-panel")).toBeInTheDocument();
    expect(firstPatientRow()).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("ward-handover-flow-panel")).not.toBeInTheDocument();
  });

  it("records the sign-off with role and time and lists it in History", async () => {
    const user = userEvent.setup();
    renderHandover();
    await user.click(screen.getByTestId("ward-handover-sign-off-button"));
    expect(screen.getByTestId("ward-handover-sign-off-visible-status")).toHaveTextContent(
      "Signed off at 10:42 as flow coordinator",
    );
    expect(screen.getByTestId("ward-handover-hero-sign-off")).toHaveTextContent("Signed 10:42");
    await user.click(screen.getByRole("tab", { name: /History/ }));
    expect(screen.getByTestId("ward-handover-history")).toHaveTextContent("Handover signed off as flow coordinator");
  });

  it("marks Handing to as Preview because the engine records role and time only", () => {
    renderHandover();
    const signOff = screen.getByTestId("ward-handover-sign-off");
    expect(signOff).toHaveTextContent("Not wired in this prototype.");
  });

  it("highlights rows and never hides them", async () => {
    const user = userEvent.setup();
    renderHandover();
    const before = within(screen.getByTestId("ward-handover-sheet"))
      .getAllByRole("row")
      .filter((row) => row.hasAttribute("data-row-id")).length;
    await user.click(
      within(screen.getByTestId("ward-handover-kpi-strip")).getByRole("button", { name: /Waiting for a bed/ }),
    );
    const after = within(screen.getByTestId("ward-handover-sheet"))
      .getAllByRole("row")
      .filter((row) => row.hasAttribute("data-row-id")).length;
    expect(after).toBe(before);
    expect(screen.getByTestId("ward-handover-scope-line")).toHaveTextContent("highlighted, all rows stay");
  });

  it("says a past handover has passed and offers the next one", async () => {
    const user = userEvent.setup();
    renderHandover();
    await user.click(screen.getByRole("radio", { name: /07:00/ }));
    expect(screen.getByRole("heading", { level: 1, name: /to hand over/ })).toBeInTheDocument();
    expect(screen.getByText(/^Handover · 07:00/)).toBeInTheDocument();
    expect(screen.getByText(/The 07:00 handover has passed/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to 15:00 handover" }));
    expect(screen.getByRole("heading", { level: 1, name: /to hand over/ })).toBeInTheDocument();
    expect(screen.getByText(/^Handover · 15:00/)).toBeInTheDocument();
  });

  it("opens the print sheet builder from Print handover and comes back", async () => {
    const user = userEvent.setup();
    renderHandover();
    await user.click(screen.getByTestId("ward-handover-print"));
    const sheet = screen.getByTestId("ward-handover-print-sheet");
    expect(sheet).toBeInTheDocument();
    expect(sheet.textContent ?? "").not.toMatch(/Government of Western Australia|NSQHS/);
    expect(sheet.textContent ?? "").not.toMatch(/WF-\d/);
    await user.click(within(sheet).getByRole("button", { name: /Back to handover/ }));
    expect(screen.queryByTestId("ward-handover-print-sheet")).not.toBeInTheDocument();
  });

  it("shows beds by ward on the Beds tab", async () => {
    const user = userEvent.setup();
    renderHandover();
    await user.click(screen.getByRole("tab", { name: /Beds/ }));
    expect(screen.getByTestId("ward-handover-beds")).toBeInTheDocument();
  });
});

describe("Handover shift after the last handover of the day", () => {
  // 23:30: all three of today's handovers have started, so the next one is tomorrow's 07:00.
  const lateEvening = NOW_ANCHOR - (NOW_ANCHOR % (24 * 60)) + 23 * 60 + 30;

  it("defaults to tomorrow morning's handover, which has not passed and can be signed", () => {
    expect(defaultHandoverShift(lateEvening)).toBe("am");
    expect(handoverAt("am", lateEvening)).toBe(lateEvening + 7 * 60 + 30);
    expect(handoverHasPassed("am", lateEvening)).toBe(false);
    expect(handoverCutoff("am", lateEvening)).toBe(handoverAt("am", lateEvening));
  });

  it("keeps the morning handover as today's before 23:00", () => {
    expect(handoverHasPassed("am", NOW_ANCHOR)).toBe(true);
    expect(handoverAt("am", NOW_ANCHOR)).toBe(NOW_ANCHOR - (NOW_ANCHOR % (24 * 60)) + 7 * 60);
  });
});

describe("Handover sign-off belongs to one handover", () => {
  const midnight = NOW_ANCHOR - (NOW_ANCHOR % (24 * 60));
  const at2000 = midnight + 20 * 60;

  it("counts a sign-off only for the handover whose window holds it", () => {
    const signOffs = [{ at: midnight + 20 * 60 }];
    expect(handoverSignedAt(signOffs, "ev", at2000)).toBe(midnight + 20 * 60);
    expect(handoverSignedAt(signOffs, "pm", at2000)).toBeNull();
  });

  it("finds an earlier handover's sign-off after a later one is recorded", () => {
    const signOffs = [{ at: midnight + 14 * 60 }, { at: midnight + 20 * 60 }];
    expect(handoverSignedAt(signOffs, "pm", at2000)).toBe(midnight + 14 * 60);
  });

  it("prints the patient cell and sheet header despite the global print rule", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/handover/handover-print-sheet.module.css"),
      "utf8",
    );
    const print = css.slice(css.lastIndexOf("@media print"));
    expect(print).toMatch(/\.ph \{\s*display: flex !important;/);
    expect(print).toMatch(/\.rowButton \{\s*display: block !important;/);
  });
});
