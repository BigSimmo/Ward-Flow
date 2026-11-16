// 16 Nov 2026 live demo walk, print polish (lane C). Synthetic data only.
//
// 1. Handover pack: Print printed the patient page, because the print-width relayout remounted the
//    entry and its own state closed the dialog; with print styles alone the page was blank, because
//    the pack's ancestors were not forced shown. The carer page's pattern fixes both.
// 2. Patients list: the Time column reads on one line on paper.
// 3. Ward list: no Open ward link lines on paper.
// 4. Alerts: a print-only time at the top (the DOM check is in ward-alerts-screen.dom.test.tsx).
// The stylesheet checks for 2 to 4 are in ward-audit-m103-print-fidelity.test.ts.

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import postcss from "postcss";
import { afterEach, describe, expect, it } from "vitest";

import type { HandoverPackInput } from "@/components/ward-management/patients/patient-handover-pack";
import { PatientHandoverPackButton } from "@/components/ward-management/patients/patient-handover-pack-button";

afterEach(cleanup);

/** Synthetic only: an invented name and a synthetic UMRN. Instants are demo-clock minutes. */
const input: HandoverPackInput = {
  movement: {
    id: "WF-SYNTH-PRINT",
    urgency: 2,
    legalStatus: "Involuntary inpatient",
    legalForm: { code: "1A" },
    acceptedUnitId: "U-SYNTH",
    acceptedAt: 600,
    closure: undefined,
    allocatedBed: 4,
    medicationChartDone: undefined,
  } as HandoverPackInput["movement"],
  patient: { name: "Testperson, Alex", umrn: "UM100001", ageSex: "41, female" },
  fromName: "Synthetic ED",
  wardName: "Synthetic Ward",
  riskFlags: [],
  clearance: { cleared: true, at: 540 },
  paperExpiryAt: 900,
  edContacts: [],
  careContacts: [],
  checklist: [],
  now: 700,
};
const dayZero = new Date("2026-11-16T00:00:00+08:00");

/** Declarations of `@media print` rules whose selector matches, from a stylesheet's text. */
function printDecls(css: string, selector: RegExp): Record<string, string> {
  const found: Record<string, string> = {};
  postcss.parse(css).walkAtRules("media", (media) => {
    if (!/print/.test(media.params)) return;
    media.walkRules((rule) => {
      if (!selector.test(rule.selector)) return;
      rule.walkDecls((decl) => {
        found[decl.prop] = decl.important ? `${decl.value} !important` : decl.value;
      });
    });
  });
  return found;
}

describe("handover pack prints the pack, not the patient page", () => {
  it("stays open when the page lays itself out again for print (the entry remounts)", async () => {
    const first = render(<PatientHandoverPackButton input={input} dayZero={dayZero} />);
    await userEvent.click(screen.getByTestId("pn-handover-pack-open"));
    expect(screen.getByRole("article", { name: "Handover pack" })).toBeInTheDocument();
    first.unmount();
    render(<PatientHandoverPackButton input={input} dayZero={dayZero} />);
    expect(screen.getByRole("article", { name: "Handover pack" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }).closest("button")!);
    expect(screen.queryByRole("article", { name: "Handover pack" })).not.toBeInTheDocument();
  });

  it("closes once no entry is left on the page", async () => {
    const view = render(<PatientHandoverPackButton input={input} dayZero={dayZero} />);
    await userEvent.click(screen.getByTestId("pn-handover-pack-open"));
    view.unmount();
    await act(() => new Promise((resolve) => setTimeout(resolve, 1100)));
    render(<PatientHandoverPackButton input={input} dayZero={dayZero} />);
    expect(screen.queryByRole("article", { name: "Handover pack" })).not.toBeInTheDocument();
  });

  it("isolates the paper and forces its ancestors shown, as the carer page does", async () => {
    render(<PatientHandoverPackButton input={input} dayZero={dayZero} />);
    await userEvent.click(screen.getByTestId("pn-handover-pack-open"));
    const css = screen.getByRole("article", { name: "Handover pack" }).querySelector("style")?.textContent ?? "";
    expect(css).toContain("size: A4 portrait");
    const ancestors = printDecls(css, /^body \*:has\(\[data-wf-print-handover\]\)$/);
    expect(ancestors.display).toBe("block !important");
    expect(ancestors.visibility).toBe("visible !important");
    const rest = printDecls(css, /:not\(:has\(\[data-wf-print-handover\]\)\)/);
    expect(rest.display).toBe("none !important");
  });
});
