import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { DailyCheckHeroTile, DailyCheckList } from "@/components/ward-management/delays/daily-check-line";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Diagnosed issues, Waiting (Josh, 3 Nov 2026). W2: each whose-move tile names who has waited
 * longest. W3: Today's follow-up says what each tab holds and keeps the Q-12 panel in view. W4: the
 * daily check explains itself and lists its people under each reason, with what to do.
 */
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const inProvider = (node: ReactNode) => render(<WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>);

function Laptop() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DailyCheckHeroTile open={open} onToggle={() => setOpen((current) => !current)} listId="check-list" />
      <DailyCheckList open={open} listId="check-list" onClose={() => setOpen(false)} />
    </>
  );
}

describe("W2: whose-move tiles", () => {
  it("names the longest-waiting person on every tile that has anyone", () => {
    inProvider(<DelaysScreen />);
    const tiles = within(screen.getByRole("region", { name: "Whose move" })).getAllByRole("button");
    const withPeople = tiles.filter((tile) => !/^0/u.test(tile.textContent ?? ""));
    expect(withPeople.length).toBeGreaterThan(0);
    for (const tile of withPeople) expect(tile).toHaveTextContent(/Longest [A-Z][\w'-]+, [A-Z]/u);
  });
});

describe("W3: Today's follow-up", () => {
  it("titles the rail, explains the open tab and shows the no-named-person note without a tap", () => {
    inProvider(<DelaysScreen />);
    const rail = screen.getByRole("region", { name: "Escalations and resolved" });
    expect(within(rail).getByRole("heading", { name: "Today's follow-up" })).toBeInTheDocument();
    fireEvent.click(within(rail).getByRole("tab", { name: /Escalated$/u }));
    expect(rail).toHaveTextContent("Raised to another desk today.");
    expect(within(rail).getByRole("region", { name: "Delays with no named person" })).toBeInTheDocument();
  });
});

describe("W4: the daily check by reason", () => {
  it("says what the check is and heads each reason with what to do", () => {
    inProvider(<Laptop />);
    fireEvent.click(screen.getByRole("button", { name: "Show list" }));
    const list = screen.getByRole("region", { name: "Daily check" });
    expect(list).toHaveTextContent("may have been missed or sent twice");
    const reasons = within(list).getAllByRole("heading", { level: 3 });
    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) {
      const group = reason.closest("section");
      expect(group).not.toBeNull();
      expect(group).toHaveTextContent(/Open (each one|it|both)/u);
      expect(within(group as HTMLElement).getAllByRole("link").length).toBeGreaterThan(0);
    }
  });
});
