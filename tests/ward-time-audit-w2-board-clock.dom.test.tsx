import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { CommunityIndex } from "@/components/ward-management/community/community-index";
import { MIDLAND_DECISIONS_KEY } from "@/components/ward-management/community/team-2026/midland-decisions";
import { TeamHome } from "@/components/ward-management/community/team-2026/team-home";
import { noticeDraftKept } from "@/components/ward-management/referrals/referral-draft-saved-notice";
import { downloadStatisticsFigures } from "@/components/ward-management/statistics/statistics-hero";
import { calendarDateOf, formatSheetMoment, perthMidnight } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { Timer } from "@/components/wf";

/*
 * Time audit, group w2 (13 Nov 2026): demo stamps read the board clock, not the device clock (D8,
 * C5, D13), and a timer driven by the minute board clock shows no seconds it cannot know (D6).
 * Synthetic data only. The device clock is set to a different day and hour from the board on purpose.
 */

const MIN = 60_000;
/** The board: Wed 4 Nov 2026 at 10:00 Perth. */
const DAY_ZERO = perthMidnight(2026, 10, 4);
const BOARD_NOW = 10 * 60;
/** The device: Fri 13 Nov 2026 at 11:00 Perth. */
const DEVICE_NOW = new Date("2026-11-13T03:00:00Z");

function onBoard(node: ReactNode) {
  return render(
    <WardFlowProvider initialNow={BOARD_NOW} initialDayZero={DAY_ZERO.getTime()}>
      {node}
    </WardFlowProvider>,
  );
}

async function captureCsv(action: () => void): Promise<string> {
  let file: Blob | undefined;
  vi.stubGlobal("URL", {
    createObjectURL: (blob: Blob) => {
      file = blob;
      return "blob:synthetic-export";
    },
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  action();
  expect(file).toBeDefined();
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file!);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(DEVICE_NOW);
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("D8: Draft saved reads the board clock", () => {
  it("stamps the board's 10:00, not the device's 11:00", () => {
    const push = vi.fn(() => "t");
    expect(noticeDraftKept({ push }, true, BOARD_NOW, DAY_ZERO)).toBe("Draft saved at 10:00");
  });
});

describe("D8 and C5: Midland contacts are stamped and counted on the board's day", () => {
  it("records the contact at the board's moment and lists it as today's", () => {
    onBoard(<TeamHome go={vi.fn()} now="10:00" />);
    fireEvent.click(screen.getByText("Record contact").closest("button")!);
    expect(screen.getByText("Contact recorded at 10:00")).toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem(MIDLAND_DECISIONS_KEY) ?? "{}") as Record<
      string,
      { at: number }
    >;
    expect(Object.values(stored).map((decision) => decision.at)).toEqual([
      calendarDateOf(BOARD_NOW, DAY_ZERO).getTime(),
    ]);
    fireEvent.click(screen.getByRole("radio", { name: /Today's log/ }));
    expect(screen.getByText("Thornbury, Cleo · by Community")).toBeInTheDocument();
  });
});

describe("D8: the community team list CSV is stamped with the board's time", () => {
  it("writes the board's day and time, in the sheet format", async () => {
    onBoard(<CommunityIndex teams={[]} />);
    fireEvent.click(screen.getByTestId("community-action-catchment-guide"));
    const csv = await captureCsv(() => fireEvent.click(screen.getByRole("button", { name: "Export team list" })));
    const asAt = csv.split("\r\n")[1];
    expect(asAt).toContain(formatSheetMoment(BOARD_NOW, DAY_ZERO, { includeYearAndZone: true }));
    expect(asAt).not.toContain("13 Nov");
  });
});

describe("D13: the statistics figures CSV says As at like every other export", () => {
  it("uses the sheet moment format", async () => {
    const csv = await captureCsv(() =>
      downloadStatisticsFigures(
        { stem: "held", scope: "Network", figures: () => [["Ready", 2]] },
        1440 + 61,
        perthMidnight(2026, 9, 19),
      ),
    );
    expect(csv).toContain(
      `"As at","${formatSheetMoment(1440 + 61, perthMidnight(2026, 9, 19), { includeYearAndZone: true })}"`,
    );
    expect(csv).toContain("Tue 20 Oct 2026, 01:01");
  });
});

describe("D6: a Timer on the minute board clock shows whole minutes", () => {
  it("shows no seconds the minute clock cannot know", () => {
    const now = BOARD_NOW * MIN;
    render(
      <>
        <Timer at={now - 5 * MIN} now={now} direction="waiting" wholeMinutes />
        <Timer at={now} now={now} direction="waiting" wholeMinutes />
        <Timer at={now + 3 * MIN} now={now} direction="in" wholeMinutes />
        <Timer at={now - 125 * MIN} now={now} direction="waiting" wholeMinutes />
      </>,
    );
    const timers = screen.getAllByRole("timer");
    expect(timers[0]).toHaveTextContent(/^5mwaiting$/);
    expect(timers[1]).toHaveTextContent(/^0mwaiting$/);
    expect(timers[2]).toHaveTextContent(/^in3m$/);
    expect(timers[3]).toHaveTextContent(/^2h 05mwaiting$/);
  });
});
