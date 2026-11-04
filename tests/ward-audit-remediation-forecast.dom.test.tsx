import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => <a {...props}>{children}</a>,
}));
vi.mock("@/components/ward-management/forecast/use-forecast-model", () => ({
  useForecastModel: () => ({
    tomorrow: { kinds: [] },
    levers: [],
    risk: { byEd: [], alreadyOver: 0, targetMinutes: 240 },
  }),
  useForecastHistory: () => ({
    record: { days: [{ day: 0, forecastAt: -1440, actualAt: 0, forecast: { likely: 1 }, actual: 2 }] },
  }),
  forecastEdName: () => "Synthetic ED",
}));

import { ForecastMissReasonControl } from "@/components/ward-management/forecast/forecast-miss-reason-control";
import { sharedForecastReply } from "@/components/ward-management/forecast/forecast-shared-history";
import { ForecastBriefPanel } from "@/components/ward-management/forecast/forecast-brief-panel";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("audit remediation: reason-specific forecast saves", () => {
  it("labels an older forecast comparison by its recorded time instead of claiming it is current", () => {
    render(<ForecastBriefPanel now={3000} />);
    const brief = screen.getByTestId("forecast-brief");
    expect(brief).not.toHaveTextContent(/Yesterday's forecast for today|it is now/);
    expect(brief).toHaveTextContent(formatInstantWithDay(0, 3000));
  });

  it("keeps a refused choice open and reports the conflict instead of implying it was recorded", async () => {
    const record = vi.fn(async () => ({
      status: "conflict" as const,
      message: "A colleague changed this reason. Review it before recording again.",
    }));
    render(<ForecastMissReasonControl day={1} entry={undefined} candidates={[]} now={NOW_ANCHOR} onRecord={record} />);
    fireEvent.change(screen.getByLabelText("Reason for the difference"), { target: { value: "other" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Record reason" })));
    expect(screen.getByRole("status")).toHaveTextContent("A colleague changed this reason");
    expect(screen.getByLabelText("Reason for the difference")).toHaveValue("other");
  });

  it("preserves the server's exact version without accepting it as locally persisted reason data", () => {
    const reply = sharedForecastReply(
      {
        shared: true,
        generation: 0,
        reasonWriteVersion: 1,
        snapshots: [],
        reasons: [{ day: 1, reason: "other", by: "coordinator", at: 10, version: "2026-11-03 01:02:03.123456+00" }],
      },
      0,
    );
    expect(reply).toMatchObject({
      status: "shared",
      reasonWriteVersion: 1,
      reasonVersions: { "1": "2026-11-03 01:02:03.123456+00" },
      reasons: [{ day: 1, reason: "other", by: "coordinator", at: 10 }],
    });
  });
});
