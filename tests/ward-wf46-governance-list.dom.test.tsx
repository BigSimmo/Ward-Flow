import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventTable } from "@/components/ward-management/governance-event-detail";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * WF-46 (5 Nov 2026): the access admin's Audit trail drew the column heads over an empty note, with
 * the scroll edge running half way down, so the list read as half-drawn. Its CSS sizes are pinned in
 * tests/css-mobile-ergonomics-and-v9-contract.test.ts.
 */
type Props = Parameters<typeof EventTable>[0];

function list(overrides: Partial<Props>) {
  const props = {
    label: "Captured events",
    rows: [],
    selected: null,
    now: NOW_ANCHOR,
    patientOf: (() => null) as unknown as Props["patientOf"],
    reviewState: () => "unreviewed" as const,
    onChoose: () => undefined,
    onKey: () => undefined,
    empty: <p>Nothing captured</p>,
    ...overrides,
  } as Props;
  return render(<EventTable {...props} />);
}

describe("WF-46 governance event list", () => {
  it("draws no column heads and no scroll edge when access is unavailable", () => {
    const { container, getByText } = list({ allowed: false });
    expect(getByText("Record access unavailable")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/WhenWhatRecord/);
    expect(container.firstElementChild).toHaveAttribute("data-empty", "true");
  });

  it("draws no column heads over an empty list", () => {
    const { container, getByText } = list({});
    expect(getByText("Nothing captured")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Outcome/);
    expect(container.firstElementChild).toHaveAttribute("data-empty", "true");
  });
});
