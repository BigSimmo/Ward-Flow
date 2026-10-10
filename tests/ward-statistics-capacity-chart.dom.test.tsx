import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { StatisticsCapacityChart } from "@/components/ward-management/statistics/statistics-capacity-chart";
import { allUnits } from "@/components/ward-management/ward-sites";
import type { Unit } from "@/components/ward-management/ward-model";
import type { Admission } from "@/components/ward-management/ward-admissions";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

function unit(id: string, siteCode: string, beds: number, empty: number, ready: number): Unit {
  const base = allUnits()[0];
  return {
    ...base,
    id,
    name: id,
    siteCode,
    beds,
    empty: { ...base.empty, value: empty },
    allocatable: { ...base.allocatable, value: ready },
  };
}
const units = [unit("Alpha", "RPH", 10, 4, 3), unit("Beta", "RPH", 10, 2, 1), unit("Gamma", "FSH", 5, 0, 0)];

function chart() {
  render(<StatisticsCapacityChart units={units} bedReleases={[]} />);
}

describe("current-capacity explorer", () => {
  it("aggregates hospitals, exposes ward-level evidence, and clears a selected bar", () => {
    chart();
    const bar = screen.getByRole("button", {
      name: /Royal Perth Hospital: 4 ready, 0 pulled, 2 closed, 14 occupied of 20 beds/,
    });
    fireEvent.click(bar);
    const details = within(screen.getByTestId("capacity-details"));
    expect(details.getByRole("link", { name: /Alpha/ })).toHaveAttribute(
      "href",
      "/mockups/ward-flow/statistics/ward/Alpha",
    );
    expect(details.getByRole("link", { name: /Beta/ })).toBeInTheDocument();
    fireEvent.click(bar);
    expect(screen.queryByTestId("capacity-details")).not.toBeInTheDocument();
  });

  it("uses the ruled boxes: a pulled patient is Pulled, not Occupied, and the empty unoffered bed is Closed", () => {
    // A seeded pulled admission (`movementId: null`) sits inside the occupied count until
    // `bedStates` takes it out — see `ward-bed-states.ts`.
    const pulled = { id: "AD-PULLED-1", unitId: "Alpha", state: "pulled", movementId: null } as unknown as Admission;
    render(<StatisticsCapacityChart units={units} bedReleases={[]} admissions={[pulled]} />);
    const bar = screen.getByRole("button", {
      name: /Royal Perth Hospital: 4 ready, 1 pulled, 2 closed, 13 occupied of 20 beds/,
    });
    fireEvent.click(bar);
    const details = within(screen.getByTestId("capacity-details"));
    expect(details.getByText("Pulled")).toBeInTheDocument();
    expect(details.getByText("Closed")).toBeInTheDocument();
    // "Held" now means only a bed kept for a patient on leave; it never labels the empty unoffered box.
    expect(details.queryByText("Held")).not.toBeInTheDocument();
    const legend = within(screen.getByLabelText("Bed status legend"));
    for (const word of ["Ready", "Pulled", "Closed", "Occupied"]) expect(legend.getByText(word)).toBeInTheDocument();
    expect(legend.queryByText("Held")).not.toBeInTheDocument();
  });

  it("highlights a service and dims the rest by colour, never hiding a row (v10)", () => {
    chart();
    fireEvent.click(screen.getByRole("button", { name: /Royal Perth Hospital: 4 ready/ }));
    // v6: the service filter is a segmented control ("South" for South Metro), and the summary
    // reads "ready of N beds" with the foot saying how many rows are shown.
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Health service filter" })).getByRole("radio", { name: "South" }),
    );
    // The other service's row stays, dimmed by colour; the summary counts the highlighted rows.
    expect(screen.getByRole("button", { name: /Royal Perth Hospital: 4 ready/ })).toHaveAttribute("data-dim", "true");
    expect(screen.queryByTestId("capacity-details")).not.toBeInTheDocument();
    expect(screen.getByText(/ready of 5 (synthetic )?beds/)).toBeInTheDocument();
    expect(screen.getByTestId("ward-statistics-capacity-showing")).toHaveTextContent(
      "1 of 2 hospitals highlighted, all rows stay",
    );
    const fiona = screen.getByRole("button", {
      name: /Fiona Stanley Hospital: 0 ready, 0 pulled, 0 closed, 5 occupied/,
    });
    expect(fiona).not.toHaveAttribute("data-dim");
  });

  it("switches to wards and searches within a hospital rather than including unmatched wards", () => {
    chart();
    fireEvent.click(screen.getByRole("radio", { name: "Wards" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Beta" } });
    expect(
      screen.getByRole("button", { name: /Beta: 1 ready, 0 pulled, 1 closed, 8 occupied of 10 beds/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ready of 10 (synthetic )?beds/)).toBeInTheDocument();
    expect(screen.getByTestId("ward-statistics-capacity-showing")).toHaveTextContent("Showing 1 of 3 wards matched");
    expect(screen.queryByRole("button", { name: /Alpha: 3 ready/ })).not.toBeInTheDocument();
  });

  it("normalises each bar to its own denominator in percentage mode", () => {
    chart();
    // v6 opens on the percentage scale; switch to beds first to see the shared denominator.
    fireEvent.click(screen.getByRole("radio", { name: "Beds" }));
    const smallBar = screen
      .getByRole("button", { name: /Fiona Stanley Hospital: 0 ready/ })
      .querySelector('[style*="width"]');
    expect(smallBar).toHaveStyle({ width: "25%" });
    fireEvent.click(screen.getByRole("radio", { name: "%" }));
    expect(smallBar).toHaveStyle({ width: "100%" });
    // Fiona Stanley is 100% occupied, the only row at or over the 85% alert line.
    const overChip = screen.getByRole("button", { name: /At or over the alert line/ });
    expect(overChip).toHaveTextContent("1");
    // The chip highlights that row and dims the rest; every row stays.
    fireEvent.click(overChip);
    expect(overChip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Fiona Stanley Hospital: 0 ready/ })).not.toHaveAttribute("data-dim");
    expect(screen.getByRole("button", { name: /Royal Perth Hospital: 4 ready/ })).toHaveAttribute("data-dim", "true");
  });

  it("can aggregate hospitals from a service ward view and reset to that view", () => {
    render(
      <StatisticsCapacityChart
        units={units.slice(0, 2)}
        bedReleases={[]}
        initialGroup="ward"
        scopeLabel="in this service"
      />,
    );
    expect(screen.queryByRole("button", { name: "Reset view" })).toBeNull();
    expect(screen.getByRole("button", { name: /Alpha: 3 ready/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Hospitals" }));
    expect(screen.getByRole("button", { name: /Royal Perth Hospital: 4 ready/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(screen.getByRole("radio", { name: "Wards" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/ready of 20 (synthetic )?beds/)).toBeInTheDocument();
    expect(screen.getByTestId("ward-statistics-capacity-showing")).toHaveTextContent(
      "Showing 2 of 2 wards in this service",
    );
  });

  it("moves keyboard focus between capacity rows and returns it when details close", () => {
    chart();
    const perth = screen.getByRole("button", { name: /Royal Perth Hospital: 4 ready/ });
    const fiona = screen.getByRole("button", { name: /Fiona Stanley Hospital: 0 ready/ });
    perth.focus();
    fireEvent.keyDown(perth, { key: "ArrowDown" });
    expect(fiona).toHaveFocus();
    fireEvent.click(fiona);
    const close = screen.getByRole("button", { name: "Close capacity details" });
    close.focus();
    fireEvent.keyDown(close, { key: "Escape" });
    expect(screen.queryByTestId("capacity-details")).toBeNull();
    expect(fiona).toHaveFocus();
  });

  it("recovers from an empty result and resets every view control", () => {
    chart();
    fireEvent.click(screen.getByRole("radio", { name: "Beds" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "missing hospital" } });
    expect(screen.getByText("No matching wards")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chart CSV/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    // v6: every view control returns to its default, which is now the percentage scale.
    expect(screen.getByRole("radio", { name: "%" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /Royal Perth Hospital: 4 ready/ })).toBeInTheDocument();
  });
});

// Verify operational readouts with asymmetric records, rather than accepting seeded coincidences.
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { REFERRAL_DECLINE_REASONS, type Movement, type Referral } from "@/components/ward-management/ward-model";
import type { Instant } from "@/components/ward-management/ward-clock";

it("derives the network ED median from individual waits, including an even population", () => {
  const base = seedWardFlowState().movements[0];
  const ed = allEmergencyDepartments()[0];
  const movements: Movement[] = [120, 600].map((wait, index) => ({
    ...base,
    id: `WF-stat-wait-${index}`,
    originEdId: ed.id,
    openedAt: (NOW_ANCHOR - wait) as Instant,
    stage: "placement_requested",
  }));
  const { container } = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsScreen movements={movements} />
    </WardFlowProvider>,
  );
  const table = container.querySelector<HTMLTableElement>("#edPressureTable")!;
  const row = [...table.tBodies[0].rows].find((row) => row.textContent?.includes(ed.siteCode))!;
  const medianColumn = [...table.tHead!.rows[0].cells].findIndex((cell) =>
    cell.textContent?.trim().startsWith("Median"),
  );
  expect(medianColumn).toBeGreaterThan(-1);
  expect(row.cells[medianColumn].textContent).toBe("6h");
  expect(table.tFoot!.rows[0].cells[medianColumn].textContent).toBe("6h");
});

it("counts today's bed referrals once across parallel bed criteria, with recorded outcomes", () => {
  const base = seedWardFlowState().referrals[0];
  const ward = (state: "accepted" | "declined" | "queued", sex: "Female" | "Male", reason = true) => ({
    destination: {
      kind: "psychiatric_ward" as const,
      sex,
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
      highAcuityNursingNeeded: false,
    },
    state,
    ...(state === "declined" && reason ? { declineReason: REFERRAL_DECLINE_REASONS[0] } : {}),
  });
  const referrals: Referral[] = [
    {
      ...base,
      id: "stat-accepted",
      raisedAt: NOW_ANCHOR,
      destinations: [ward("accepted", "Female"), ward("declined", "Male")],
    },
    {
      ...base,
      id: "stat-open",
      raisedAt: NOW_ANCHOR,
      destinations: [ward("queued", "Female"), ward("queued", "Male")],
    },
    { ...base, id: "stat-declined", raisedAt: NOW_ANCHOR, destinations: [ward("declined", "Female")] },
    { ...base, id: "stat-declined-no-reason", raisedAt: NOW_ANCHOR, destinations: [ward("declined", "Male", false)] },
    { ...base, id: "stat-old", raisedAt: (NOW_ANCHOR - 1440) as Instant, destinations: [ward("queued", "Female")] },
  ];
  const { container } = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsScreen referrals={referrals} />
    </WardFlowProvider>,
  );
  const counts = [...container.querySelectorAll("#refBand dd")].map((node) => node.firstChild?.textContent);
  expect(counts).toEqual(["4", "1", "1", "1"]);
});

it("exports a formula-like ward name neutralised", async () => {
  let exported: Blob | undefined;
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn((blob: Blob) => ((exported = blob), "blob:x")),
    revokeObjectURL: vi.fn(),
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    const risky = { ...unit("Alpha", "RPH", 10, 4, 3), name: "=cmd|x" };
    const { container } = render(<StatisticsCapacityChart units={[risky]} bedReleases={[]} initialGroup="ward" />);
    fireEvent.click(within(container).getByRole("button", { name: /chart csv/i }));
    const csv = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(exported!);
    });
    expect(csv).toContain(`"'=cmd|x"`);
    expect(csv).not.toMatch(/^"=cmd/mu);
  } finally {
    click.mockRestore();
    vi.unstubAllGlobals();
  }
});
