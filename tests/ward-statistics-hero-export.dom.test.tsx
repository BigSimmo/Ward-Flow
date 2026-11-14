import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsHero } from "@/components/ward-management/statistics/statistics-hero";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { formatSheetMoment } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import type { Movement } from "@/components/ward-management/ward-model";
import { installMatchMediaStub } from "./setup/jsdom.setup";

/**
 * v10 pass 3: the header's one primary on Statistics is New referral, so "Export the figures"
 * lives in the statistics hero. It is open to every role and writes the figures the band shows.
 */

function inProvider(node: ReactNode) {
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>);
}

async function exportedCsv(button: HTMLElement): Promise<{ csv: string; name: string }> {
  let exported: Blob | undefined;
  let name = "";
  vi.stubGlobal("URL", {
    createObjectURL: (blob: Blob) => {
      exported = blob;
      return "blob:figures";
    },
    revokeObjectURL: vi.fn(),
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    name = this.download;
  });
  try {
    fireEvent.click(button);
    const csv = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(exported!);
    });
    return { csv, name };
  } finally {
    click.mockRestore();
    vi.unstubAllGlobals();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  installMatchMediaStub(false);
});

describe("Statistics hero: Export the figures", () => {
  it.each([false, true])(
    "counts open ED movements through transit on the summary and CSV (phone=%s)",
    async (phone) => {
      installMatchMediaStub(phone);
      const base = seedWardFlowStateAt(0).movements.find(isWaitingInEd)!;
      const movements: Movement[] = [
        { ...base, id: "WF-SYN-WAIT" },
        { ...base, id: "WF-SYN-MOVING", stage: "moving" },
        { ...base, id: "WF-SYN-DEPARTED", leftDepartmentAt: NOW_ANCHOR - 1 },
        { ...base, id: "WF-SYN-TRANSFER", sourceAdmissionId: "ADM-SYN-TRANSFER" },
      ];
      inProvider(<StatisticsScreen movements={movements} />);
      const hero = screen.getByRole("heading", { level: 1 }).closest("section")!;
      // Page-top redesign (9 Nov 2026): a figure; the phone shows a short label and keeps the full words.
      const label = within(hero).getByText("ED journeys open", { exact: true });
      const figure = label.closest<HTMLElement>("[data-wf-hero-figure]");
      expect(figure?.querySelector("b")?.textContent).toBe("3");
      expect(figure?.textContent).toMatch(phone ? /^3 journeys openED journeys open$/ : /^3 ED journeys open$/);
      if (!phone) {
        const { csv } = await exportedCsv(screen.getByTestId("ward-statistics-export"));
        expect(csv).toContain('"ED journeys open","3"');
      }
    },
  );

  it("sits in the Summary hero and exports the band's ready count, labelled synthetic", async () => {
    inProvider(<StatisticsScreen />);
    const button = screen.getByTestId("ward-statistics-export");
    // Page-top redesign (9 Nov 2026): the Export chip; beds ready is the second figure.
    expect(button).toHaveTextContent("Export");
    expect(button).not.toHaveAttribute("aria-disabled");
    const figures = screen.getByRole("group", { name: "Network at a glance" });
    const ready = Number(
      within(figures)
        .getByText(/^beds? ready$/u)
        .closest<HTMLElement>("[data-wf-hero-figure]")
        ?.querySelector("b")?.textContent,
    );
    expect(Number.isInteger(ready) && ready > 0, "the ready figure must be read, not defaulted").toBe(true);

    const { csv, name } = await exportedCsv(button);
    expect(name).toBe("ward-flow-synthetic-network-figures.csv");
    expect(csv).toContain('"Data","Synthetic, not clinical records"');
    expect(csv).toContain(`"Beds ready now","${ready}"`);
  });

  it("sits in a ward's hero and names that ward", async () => {
    const unit = allUnits()[0]!;
    inProvider(<StatisticsWardScreen unitId={unit.id} />);
    const { csv, name } = await exportedCsv(screen.getByTestId("ward-statistics-export"));
    expect(name).toBe(`ward-flow-synthetic-${unit.id}-figures.csv`);
    expect(csv).toContain(`"Ward Flow statistics","${unit.name}"`);
    expect(csv).toContain(`"Beds","${unit.beds}"`);
  });

  it("exports the held calendar day and year in Perth time after midnight", async () => {
    render(
      <WardFlowProvider initialNow={0} initialDayZero={new Date("2026-10-18T16:00:00Z").getTime()}>
        <StatisticsHero
          section="overview"
          eyebrow="Network"
          title="Held figures"
          now={1440 + 61}
          paused
          onTogglePause={() => {}}
          exportFigures={{ stem: "held", scope: "Network", figures: () => [["Ready", 2]] }}
        />
      </WardFlowProvider>,
    );
    const { csv } = await exportedCsv(screen.getByTestId("ward-statistics-export"));
    // The sheet moment every export uses (time audit D13): "Tue 20 Oct 2026, 01:01" and its zone.
    expect(csv).toContain(
      `"As at","${formatSheetMoment(1440 + 61, new Date("2026-10-18T16:00:00Z"), { includeYearAndZone: true })}"`,
    );
    expect(csv).toContain("Tue 20 Oct 2026, 01:01");
  });
});
