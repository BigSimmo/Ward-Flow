import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WardBedsMatrix, type BedItem } from "@/components/ward-management/ward/ward-beds-matrix";
import { WardDischargesMatrix } from "@/components/ward-management/ward/ward-discharges-matrix";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

const unit = unitById("rph-adult-secure")!;
const beds: BedItem[] = Array.from({ length: 8 }, (_, index) => ({
  bedNumber: index + 1,
  bedLabel: String(index + 1),
  status: "ready",
  statusText: "Ready",
  podId: index < 4 ? "a" : "b",
}));

describe("ward matrices only state recorded clinical facts", () => {
  it("does not infer a male or female bay from display position, including after filtering", () => {
    const props = {
      unit,
      bedsList: beds,
      selectedBed: null,
      setSelectedBed: vi.fn(),
      setSelectedPod: vi.fn(),
      isMixed: true,
    };
    const view = render(<WardBedsMatrix {...props} selectedPod="all" />);
    expect(view.container.textContent).not.toMatch(/Male Acute|Female Acute|Seclusion Suites/);
    view.rerender(<WardBedsMatrix {...props} selectedPod="b" />);
    expect(view.container.textContent).not.toMatch(/Male Acute|Female Acute|Seclusion Suites/);
    expect(screen.getByText("Bed group 1 (Beds 5 – 8)")).toBeVisible();
  });
  it("does not represent a ready count as proof of completed cleaning", () => {
    render(
      <WardBedsMatrix
        unit={unit}
        bedsList={beds.slice(0, 1)}
        selectedBed={null}
        setSelectedBed={vi.fn()}
        selectedPod="all"
        setSelectedPod={vi.fn()}
        isMixed={true}
      />,
    );
    expect(screen.queryByText("Terminal Sanitize Complete")).not.toBeInTheDocument();
    expect(screen.getByText("Ready; cleaning completion not recorded")).toBeVisible();
  });
  it("does not invent a blocked patient's escalation for an empty ward discharge list", () => {
    const view = render(
      <WardDischargesMatrix
        unit={unit}
        releasesCountedToday={[]}
        unitLeaveBeds={[]}
        blockedReleases={[]}
        now={NOW_ANCHOR}
        confirmBedRelease={vi.fn()}
        clearBedReleaseBlock={vi.fn()}
        endLeaveBed={vi.fn()}
      />,
    );
    expect(view.container.textContent).not.toMatch(/Rowan Ross|14 Days Overdue|UM100032/);
    expect(screen.queryByRole("button", { name: "Escalate to State NDIS Lead" })).not.toBeInTheDocument();
  });
});
