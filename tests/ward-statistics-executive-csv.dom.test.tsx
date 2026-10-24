import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { StatisticsCompareScreen } from "@/components/ward-management/statistics/statistics-compare-screen";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Issue #618: a small count of people in an executive CSV export reads "fewer than 5", the same as
 * on the executive's screen. Beds stay exact, and every other desk exports exact counts.
 */

async function exportedCsv(button: HTMLElement): Promise<string[][]> {
  let exported: Blob | undefined;
  vi.stubGlobal("URL", {
    createObjectURL: (blob: Blob) => {
      exported = blob;
      return "blob:figures";
    },
    revokeObjectURL: vi.fn(),
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    fireEvent.click(button);
    const csv = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(exported!);
    });
    return csv.split("\r\n").map((line) => (line === "" ? [] : line.slice(1, -1).split('","')));
  } finally {
    click.mockRestore();
    vi.unstubAllGlobals();
  }
}

function asDesk(role: "executive" | "coordinator") {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role, scope: { kind: "statewide" } });
  });
}

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
  vi.unstubAllGlobals();
});

const figure = (rows: string[][], label: string) => rows.find((row) => row[0] === label)?.[1];
const isSmall = (cell: string | undefined) => cell !== undefined && /^[1-4]$/u.test(cell);

describe("the network figures export (issue #618)", () => {
  // Three people wait in an ED: under the line, so the executive's export words it.
  const base = seedWardFlowStateAt(0).movements.find(isWaitingInEd)!;
  const movements: Movement[] = [0, 1, 2].map((index) => ({ ...base, id: `WF-SYN-${index}` }));

  async function networkFigures() {
    const view = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsScreen movements={movements} />
      </WardFlowProvider>,
    );
    const rows = await exportedCsv(screen.getByTestId("ward-statistics-export"));
    view.unmount();
    return rows;
  }

  it("words a small count of people for the executive and keeps beds exact", async () => {
    asDesk("coordinator");
    const exact = await networkFigures();
    expect(figure(exact, "Waiting in ED")).toBe("3");

    asDesk("executive");
    const worded = await networkFigures();
    expect(figure(worded, "Waiting in ED")).toBe("fewer than 5");
    expect(figure(worded, "Still open")).toBe("fewer than 5");
    expect(figure(worded, "Beds")).toBe(figure(exact, "Beds"));
    expect(figure(worded, "Beds ready now")).toBe(figure(exact, "Beds ready now"));
  });
});

describe("the ward and ED comparison exports (issue #618)", () => {
  async function comparison(card: "statistics-compare-ed-chart" | "statistics-compare-ward-chart") {
    const view = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsCompareScreen />
      </WardFlowProvider>,
    );
    const rows = await exportedCsv(within(screen.getByTestId(card)).getByRole("button", { name: "CSV" }));
    view.unmount();
    // The provenance lines come first, then the header row and one row per place.
    const header = rows.findIndex((row) => row[0] === "Synthetic department" || row[0] === "Synthetic ward");
    return { header: rows[header]!, body: rows.slice(header + 1).filter((row) => row.length > 0) };
  }

  it.each([
    ["statistics-compare-ed-chart", ["On the list", "Marked urgent", "No ward yet"]],
    ["statistics-compare-ward-chart", ["Blockers", "Long stays"]],
  ] as const)("words every small count of people in %s for the executive", async (card, columns) => {
    asDesk("coordinator");
    const exact = await comparison(card);
    asDesk("executive");
    const worded = await comparison(card);
    expect(worded.body).toHaveLength(exact.body.length);

    let small = 0;
    for (const column of columns) {
      const index = exact.header.indexOf(column);
      expect(index, column).toBeGreaterThan(0);
      exact.body.forEach((row, place) => {
        const shown = worded.body[place]![index];
        if (isSmall(row[index])) {
          small += 1;
          expect(shown, `${row[0]} ${column}`).toBe("fewer than 5");
        } else {
          expect(shown, `${row[0]} ${column}`).toBe(row[index]);
        }
      });
    }
    // The seed has small counts here, so the check above is not empty.
    expect(small).toBeGreaterThan(0);
  });

  it("never states a small number of discharge dates met or missed for the executive", async () => {
    asDesk("executive");
    const { header, body } = await comparison("statistics-compare-ward-chart");
    const index = header.indexOf("Dates met");
    for (const row of body) {
      const match = /^(\d+) of (\d+) met$/u.exec(row[index]!);
      if (!match) continue;
      const [met, considered] = [Number(match[1]), Number(match[2])];
      expect(met === 0 || met >= 5, row[0]).toBe(true);
      expect(considered - met === 0 || considered - met >= 5, row[0]).toBe(true);
    }
  });
});
