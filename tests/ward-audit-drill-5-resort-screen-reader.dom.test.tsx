// Compound drill 5 (master audit list, 10 Nov 2026): a re-sorting list, plus screen-reader
// navigation, plus an urgent action. Re-sort under the pointer is in
// tests/ward-live-resort-target.dom.test.tsx; this adds the keyboard and screen-reader half. A
// screen reader follows document focus, so the check is that focus stays on the same control, that
// control still names the same patient, and the action taken from it acts on that patient, while
// another desk's update re-sorts the list and puts a more urgent record ahead.
//
// A real screen reader (NVDA, VoiceOver) still needs a person: see
// docs/ward-flow/evidence/2026-11-10-compound-drills.md, drill 5. Synthetic seed data only.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/referrals",
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import {
  WardFlowOverride,
  WardFlowProvider,
  useWardFlow,
  type WardFlowContextValue,
} from "@/components/ward-management/ward-flow-provider";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => cleanup());

type Adjust = (value: WardFlowContextValue) => WardFlowContextValue;

function Live({ adjust, sent, children }: { adjust: Adjust; sent: WardFlowEvent[]; children: ReactNode }) {
  const value = adjust(useWardFlow());
  const dispatch: WardFlowContextValue["dispatch"] = (event) => {
    sent.push(event);
    return value.dispatch(event);
  };
  return <WardFlowOverride value={{ ...value, dispatch }}>{children}</WardFlowOverride>;
}

function renderLive(ui: ReactNode) {
  const sent: WardFlowEvent[] = [];
  const tree = (adjust: Adjust) => (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Live adjust={adjust} sent={sent}>
        {ui}
      </Live>
    </WardFlowProvider>
  );
  const view = render(tree((value) => value));
  const update = (adjust: Adjust) => act(() => view.rerender(tree(adjust)));
  return { sent, update };
}

/** What a screen reader would read for the focused control: its accessible name, roughly. */
function spoken(node: Element) {
  return (node.getAttribute("aria-label") ?? node.textContent ?? "").trim();
}

/** Keyboard activation of a button: Enter, which a browser turns into a click on a button. */
function pressEnter(node: HTMLElement) {
  fireEvent.keyDown(node, { key: "Enter", code: "Enter" });
  fireEvent.click(node);
  fireEvent.keyUp(node, { key: "Enter", code: "Enter" });
}

describe("compound drill 5: referrals queue re-sorts with an urgent referral while a keyboard user is on a row", () => {
  const TARGET = "RF-005";
  const INSERTED = "RF-SYN-DRILL-5" as const;
  const queue = () =>
    [...document.querySelectorAll("tr[data-referral-id]")].map((row) => row.getAttribute("data-referral-id")!);
  /** Another desk raises a more urgent, older referral, and the rest arrive in reverse. */
  const urgentResort: Adjust = (value) => {
    const template = value.referrals.find((referral) => referral.id === "RF-015")!;
    const earliest = Math.min(...value.referrals.map((referral) => referral.raisedAt));
    const inserted = { ...template, id: INSERTED, urgency: 1 as const, raisedAt: earliest - 30 };
    return { ...value, referrals: [inserted, ...[...value.referrals].reverse()] };
  };

  it("keeps focus on the same row control, still naming the same referral, through the re-sort", () => {
    const { update } = renderLive(<ReferralBoard />);
    const control = screen.getByTestId(`ward-referral-board-select-${TARGET}`);
    act(() => control.focus());
    expect(document.activeElement).toBe(control);
    const before = spoken(control);
    const positionBefore = queue().indexOf(TARGET);

    update(urgentResort);

    expect(queue()[0]).toBe(INSERTED);
    expect(queue().indexOf(TARGET)).not.toBe(positionBefore);
    // Focus was not dropped to the page or moved to whoever now sits in the old position.
    expect(document.activeElement).toBe(control);
    expect(control).toBeInTheDocument();
    expect(control.closest("tr")?.getAttribute("data-referral-id")).toBe(TARGET);
    expect(spoken(control)).toBe(before);
  });

  it("Enter on the focused row, pressed after the re-sort, opens the referral the person was on", () => {
    const { update } = renderLive(<ReferralBoard />);
    const control = screen.getByTestId(`ward-referral-board-select-${TARGET}`);
    const name = control.textContent!;
    act(() => control.focus());

    update(urgentResort);
    pressEnter(document.activeElement as HTMLElement);

    const title = screen.getByTestId("ward-referral-detail").querySelector("h2")!.textContent;
    expect(title).toContain(name);
    expect(screen.getByTestId(`ward-referral-inspector-priority-${TARGET}`)).toBeInTheDocument();
  });
});

describe("compound drill 5: ED list re-sorts while a keyboard user is in a row's action menu", () => {
  const TARGET = "WF-029";
  const INSERTED = "WF-SYN-DRILL-5" as const;
  const rows = () =>
    [...document.querySelectorAll("tr[data-testid^='ward-ed-patient-']")].map((row) =>
      row.getAttribute("data-testid")!,
    );
  const resort: Adjust = (value) => {
    const template = value.movements.find((movement) => movement.id === "WF-306")!;
    const earliest = Math.min(...value.movements.map((movement) => movement.openedAt));
    const inserted = { ...template, id: INSERTED, openedAt: earliest - 30 };
    return { ...value, movements: [inserted, ...[...value.movements].reverse()] };
  };

  it("the focused menu action keeps focus and acts on the patient whose menu it is", () => {
    const { sent, update } = renderLive(<EdScreen edId="fsh-ed" />);
    fireEvent.click(screen.getByTestId(`ward-ed-unfold-${TARGET}`));
    const item = screen.getByTestId(`ward-ed-no-transport-needed-${TARGET}`);
    act(() => item.focus());
    expect(document.activeElement).toBe(item);
    const before = spoken(item);

    update(resort);

    expect(rows()[0]).toBe(`ward-ed-patient-${INSERTED}`);
    expect(document.activeElement).toBe(item);
    expect(spoken(item)).toBe(before);
    pressEnter(document.activeElement as HTMLElement);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: "RECORD_TRANSPORT_NEED", movementId: TARGET, needed: false });
  });
});
