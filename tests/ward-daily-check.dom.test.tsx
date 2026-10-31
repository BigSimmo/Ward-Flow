import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  DailyCheckHeroTile,
  DailyCheckLine,
  DailyCheckList,
  markAllLabel,
} from "@/components/ward-management/delays/daily-check-line";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Overall review (20 Oct 2026): the daily check's tick on screen. P027 (Josh, 27 Oct 2026): the
 * button names the count ("Mark all 5 checked") and the done line names who ticked it and when.
 * Waiting redesign (Josh, 30 and 31 Oct 2026): on a phone the check is one line; on a laptop it is
 * a tile in the header strip whose list opens under the header. Either way the list is opened
 * before it can be marked checked (UX audit, 21 Oct 2026).
 */
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const MARK_ALL = /^Mark all (?:\d+ )?checked$/u;

function Laptop() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DailyCheckHeroTile open={open} onToggle={() => setOpen((current) => !current)} listId="check-list" />
      <DailyCheckList open={open} listId="check-list" onClose={() => setOpen(false)} />
    </>
  );
}

const inProvider = (node: ReactNode) => <WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>;

describe("Daily check: Mark all checked", () => {
  it("names the count on the button from 2, and reads Mark all checked for 0 or 1", () => {
    expect(markAllLabel(0)).toBe("Mark all checked");
    expect(markAllLabel(1)).toBe("Mark all checked");
    expect(markAllLabel(2)).toBe("Mark all 2 checked");
    expect(markAllLabel(5)).toBe("Mark all 5 checked");
  });

  it("phone line: says how many bed requests to check, and the opened list's button names the same count", () => {
    render(inProvider(<DailyCheckLine />));
    const line = screen.getByTestId("ward-missed-check");
    const meta = /(\d+) bed requests? to check, missed or sent twice/u.exec(line.textContent ?? "");
    expect(meta, "the line names the count of bed requests to check").not.toBeNull();
    fireEvent.click(within(line).getByRole("button", { name: "Show list" }));
    expect(screen.getByRole("button", { name: markAllLabel(Number(meta![1])) })).toBeInTheDocument();
  });

  it("phone line: offers no tick until the list is open, then records who ticked it and when", () => {
    render(inProvider(<DailyCheckLine />));
    expect(screen.queryByRole("button", { name: MARK_ALL })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show list" }));
    expect(screen.getByRole("button", { name: "Hide list" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: MARK_ALL }));

    const line = screen.getByTestId("ward-missed-check");
    expect(line).toHaveTextContent(`all checked by Bed coordinator at ${formatInstantWithDay(NOW_ANCHOR, NOW_ANCHOR)}`);
    expect(line).toHaveTextContent("Daily check");
    expect(screen.queryByRole("button", { name: MARK_ALL })).toBeNull();
  });

  it("laptop tile: shows the count in the header, and the list with its tick only once opened", () => {
    render(inProvider(<Laptop />));
    const tile = screen.getByTestId("ward-missed-check");
    expect(tile).toHaveTextContent(/Daily check\s*\d+ to check/u);
    expect(screen.queryByRole("button", { name: MARK_ALL })).toBeNull();

    fireEvent.click(within(tile).getByRole("button", { name: "Show list" }));
    const list = screen.getByRole("region", { name: "Daily check" });
    fireEvent.click(within(list).getByRole("button", { name: MARK_ALL }));

    expect(list).toHaveTextContent(`Checked by Bed coordinator at ${formatInstantWithDay(NOW_ANCHOR, NOW_ANCHOR)}`);
    expect(tile).toHaveTextContent("all checked by Bed coordinator");
    // The tap closes nothing and hides nothing: the people stay listed.
    expect(within(list).getAllByRole("link").length).toBeGreaterThan(0);
  });

  it("laptop tile: Hide closes the list under the header", () => {
    render(inProvider(<Laptop />));
    fireEvent.click(screen.getByRole("button", { name: "Show list" }));
    const list = screen.getByRole("region", { name: "Daily check" });
    fireEvent.click(within(list).getByRole("button", { name: "Hide" }));
    expect(screen.queryByRole("region", { name: "Daily check" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show list" })).toHaveAttribute("aria-expanded", "false");
  });
});
