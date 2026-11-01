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
  it.each([false, true])("counts open ED journeys through transit on the summary and CSV (phone=%s)", async (phone) => {
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
    const label = within(hero).getByText("Open ED journeys", { exact: true });
    const figure = phone ? label.closest("li") : label.parentElement;
    // The phone strip shows a short label and keeps the full words for a screen reader.
    expect(figure?.textContent).toMatch(phone ? /^3In ED nowOpen ED journeys$/ : /^3Open ED journeys$/);
    if (!phone) {
      const { csv } = await exportedCsv(screen.getByTestId("ward-statistics-export"));
      expect(csv).toContain('"Open ED journeys","3"');
    }
  });

  it("sits in the Summary hero and exports the band's ready count, labelled synthetic", async () => {
    inProvider(<StatisticsScreen />);
    const button = screen.getByTestId("ward-statistics-export");
    expect(button).toHaveTextContent("Export the figures");
    expect(button).not.toHaveAttribute("aria-disabled");
    const title = within(screen.getByTestId("ward-statistics-screen")).getByRole("heading", { level: 1 });
    const ready = Number.parseInt((title.textContent ?? "").replace(/^Statistics:\s*/u, ""), 10);

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
    expect(csv).toContain('"As at","20/10/2026 01:01 AWST"');
  });
});
