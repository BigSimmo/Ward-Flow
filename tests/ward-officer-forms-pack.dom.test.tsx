import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { packCount, packForm } from "@/components/ward-management/officer/officer-forms-pack";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(cleanup);

const form = (formName: string, fileName: string, uploadedAt: number) => ({
  id: `${formName}-${uploadedAt}`,
  formName,
  fileName,
  sizeBytes: 1024,
  uploadedAt,
  uploadedBy: "officer",
});

describe("transport forms pack", () => {
  it("fills each slot from recorded uploads and keeps the latest replacement", () => {
    const movement = {
      uploadedForms: [
        form("Form 1B referral", "old-1b.pdf", 10),
        form("Form 1A referral", "new-1a.pdf", 20),
        form("Risk assessment", "risk.pdf", 15),
      ],
    } as unknown as Movement;
    expect(packCount(movement)).toBe(2);
    expect(packForm(movement, "legal")?.fileName).toBe("new-1a.pdf");
    expect(packForm(movement, "order")).toBeUndefined();
    expect(packForm(movement, "risk")?.fileName).toBe("risk.pdf");
  });

  it("records a Form 4A upload on the selected job and counts it", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-officer-select-WF-005"));
    const pack = screen.getByTestId("ward-officer-forms-pack-WF-005");
    const before = Number(
      within(pack)
        .getByText(/of 3 uploaded/)
        .querySelector("b")?.textContent,
    );

    fireEvent.click(within(pack).getByRole("button", { name: /^Upload transport order/ }));
    const dialog = screen.getByRole("dialog", { name: /Upload Form 4A/ });
    const file = new File(["x"], "form-4a.pdf", { type: "application/pdf" });
    fireEvent.change(within(dialog).getByLabelText("Form file"), { target: { files: [file] } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to pack" }));

    expect(screen.queryByRole("dialog", { name: /Upload Form 4A/ })).toBeNull();
    const after = screen.getByTestId("ward-officer-forms-pack-WF-005");
    expect(within(after).getByText(/form-4a\.pdf/)).toBeTruthy();
    expect(
      Number(
        within(after)
          .getByText(/of 3 uploaded/)
          .querySelector("b")?.textContent,
      ),
    ).toBe(before + 1);
  });

  it("needs a legal form choice before a referral upload is recorded", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-officer-select-WF-005"));
    const pack = screen.getByTestId("ward-officer-forms-pack-WF-005");
    const legal = within(pack).getByRole("button", { name: /^Upload referral or order/ });
    fireEvent.click(legal);
    const dialog = screen.getByRole("dialog", { name: /Upload referral or order/ });
    const radios = within(dialog).getAllByRole("radio");
    expect(radios.map((radio) => radio.textContent)).toEqual(["Form 1A", "Form 1B", "Form 3D"]);
    fireEvent.keyDown(within(dialog).getByRole("radiogroup"), { key: "ArrowRight" });
    expect(radios.filter((radio) => radio.getAttribute("aria-checked") === "true")).toHaveLength(1);
  });
});
