import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * **THE REFERRAL DRAWER SHOWS ONLY WHAT THE RECORD HOLDS.**
 *
 * Its ward list was typed in: eleven wards, five of which do not exist in the network, with bed
 * counts that were never read from anything. Its four sample patients carried made-up names,
 * Medicare numbers, diagnoses and risk flags on real movement ids. WF-009 read "Tobias Wren" where
 * the record says someone else, and the drawer's medical-clearance switch writes to that movement
 * (25 September 2026 audit, A6). Josh chose "Real details" on 25 September 2026.
 */

const seed = seedWardFlowState();

function renderDrawer() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDrawer onClose={() => {}} />
    </WardFlowProvider>,
  );
}

describe("the referral drawer shows only what the record holds", () => {
  it("lists only wards that exist in the network, under their own names", () => {
    const { container } = renderDrawer();
    const rows = [...container.querySelectorAll('[role="listitem"]')].filter((row) =>
      row.textContent?.includes("Select"),
    );
    expect(rows.length).toBeGreaterThan(0);
    const units = new Map(allUnits().map((unit) => [unit.id, unit.name]));
    for (const row of rows) {
      const matched = [...units.entries()].find(([id]) => row.textContent?.includes(id));
      expect(matched, row.textContent ?? "").toBeDefined();
      expect(row.textContent).toContain(matched![1]);
    }
    expect(container.textContent).not.toMatch(/Ward 4W Adult Secure|Selby Older Adult Secure Unit|Ward 2J Adult Open/);
  });

  it("names the sample movement's patient from the record, not a made-up profile", () => {
    renderDrawer();
    const movement = seed.movements.find((candidate) => candidate.id === "WF-009")!;
    const recorded = resolveSubjectPatient(movement, seed);
    // WF-009 is raised from RF-013, which names PT-023 (seed-link task T2, 25 Sept 2026). PT-023 is
    // a recorded seed patient who happens to be called Tobias Wren, the same name the old made-up
    // profile used, so the name alone cannot tell the two apart. The name is checked against the
    // record instead, and the made-up profile's other details stay forbidden below.
    expect(recorded.patient?.id).toBe("PT-023");

    // The identity banner carries the recorded name.
    expect(screen.getByText(new RegExp(`^${recorded.displayName} \\(`))).toBeInTheDocument();
    expect(document.body.textContent).toContain(`UMRN: ${recorded.umrn}`);
    expect(document.body.textContent).toContain("Medicare: Not recorded");
    expect(document.body.textContent).not.toMatch(/Dr\. L\. Patel|persecutory delusions|2940 19283 1/);
  });

  it("starts the free-text fields empty and says the search covers sample patients only", () => {
    renderDrawer();
    expect(screen.getByText("Search sample patients")).toBeInTheDocument();
    expect(screen.queryByText("Live Database Search")).not.toBeInTheDocument();
    expect(document.body.textContent).toMatch(/Diag:\s*Not recorded/);
    expect(screen.queryByText("Code Black")).not.toBeInTheDocument();
  });

  // 26 Sept 2026: the urgency picker offered typed hour windows ("< 2 hours · Active Breach", and a
  // fourth tier the model does not have). It now shows only the recorded tiers and no deadline.
  it("offers only the recorded urgency tiers, with no invented hour window or breach", () => {
    renderDrawer();
    const picker = document.getElementById("refUrgencySelect") as HTMLSelectElement;
    const tiers = [...picker.options]
      .map((option) => option.textContent ?? "")
      .filter((text) => text !== "Not recorded");
    expect(tiers).toEqual(["Tier 1 · most urgent", "Tier 2 · urgent", "Tier 3 · least urgent"]);
    expect(document.body.textContent).not.toMatch(/Active Breach|< ?2 hours|Operational Acuity Target|Target Window/i);
  });

  // The summary pillar beside the picker had its own copy ("< 2h (Immediate)" and so on), missed the
  // first time. Choosing each tier must show that tier's label and no hour window.
  it("shows the chosen tier in the summary, never a typed hour window", () => {
    renderDrawer();
    const picker = document.getElementById("refUrgencySelect") as HTMLSelectElement;
    for (const [value, label] of [
      ["1", "Tier 1 · most urgent"],
      ["2", "Tier 2 · urgent"],
      ["3", "Tier 3 · least urgent"],
    ] as const) {
      fireEvent.change(picker, { target: { value } });
      expect(document.body.textContent).toContain(label);
      expect(document.body.textContent).not.toMatch(/< ?\d+h \(/);
    }
  });
});
