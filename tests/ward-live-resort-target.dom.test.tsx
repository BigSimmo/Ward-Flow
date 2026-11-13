// Audit 2 (#1565): a live re-sort under the finger. When another desk's update reorders or inserts
// rows while someone is mid-tap, or has a row's menu or drawer open, the tap, menu item or drawer
// action must still act on the patient they aimed at, never on whoever now sits in that position.
// Each test holds the DOM node the person pressed, delivers the live update between pointer down
// and click (or between opening the menu or drawer and choosing), then checks who was acted on.
// Synthetic seed data only.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { tileDomId } from "@/components/ward-management/board/ward-board-model";
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
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

/** Stands in for the shared connection: the screen reads the adjusted world, and every command it
 *  sends is recorded before it reaches the real reducer. */
function Live({ adjust, sent, children }: { adjust: Adjust; sent: WardFlowEvent[]; children: ReactNode }) {
  const value = adjust(useWardFlow());
  const dispatch: WardFlowContextValue["dispatch"] = (event) => {
    sent.push(event);
    return value.dispatch(event);
  };
  return <WardFlowOverride value={{ ...value, dispatch }}>{children}</WardFlowOverride>;
}

/** Renders a screen and returns a way to deliver a live update (another desk's change) mid-gesture. */
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

function attributes(selector: string, attribute: string) {
  return [...document.querySelectorAll(selector)].map((node) => node.getAttribute(attribute)!);
}

/** A press that a live update interrupts: pointer down, the update lands, then pointer up and click
 *  on the very node that was pressed. The node must still be on the page, or the press was lost. */
function pressThrough(node: HTMLElement, duringPress: () => void) {
  fireEvent.pointerDown(node);
  duringPress();
  expect(node).toBeInTheDocument();
  fireEvent.pointerUp(node);
  fireEvent.click(node);
}

describe("ED board: a live re-sort under the finger", () => {
  const TARGET = "WF-029";
  const INSERTED = "WF-SYN-LIVE-ED" as const;
  const rows = () => attributes("tr[data-testid^='ward-ed-patient-']", "data-testid");
  /** Another desk adds a patient who sorts ahead of everyone, and the rest arrive in reverse. */
  const resort: Adjust = (value) => {
    const template = value.movements.find((movement) => movement.id === "WF-306")!;
    const earliest = Math.min(...value.movements.map((movement) => movement.openedAt));
    const inserted = { ...template, id: INSERTED, openedAt: earliest - 30 };
    return { ...value, movements: [inserted, ...[...value.movements].reverse()] };
  };

  it("opens the tapped patient's sheet when rows move between pointer down and up", () => {
    const { update } = renderLive(<EdScreen edId="fsh-ed" />);
    const before = rows();
    const name = screen.getByTestId(`ward-ed-row-name-${TARGET}`);

    pressThrough(name, () => {
      update(resort);
      expect(rows()).not.toEqual(before);
      expect(rows().indexOf(`ward-ed-patient-${INSERTED}`)).toBeLessThan(rows().indexOf(`ward-ed-patient-${TARGET}`));
    });

    expect(attributes("tr[data-selected='true']", "data-testid")).toEqual([`ward-ed-patient-${TARGET}`]);
  });

  it("acts on the patient whose row menu was open when the list re-sorted", () => {
    const { sent, update } = renderLive(<EdScreen edId="fsh-ed" />);
    fireEvent.click(screen.getByTestId(`ward-ed-unfold-${TARGET}`));
    const item = screen.getByTestId(`ward-ed-no-transport-needed-${TARGET}`);

    update(resort);
    expect(rows().indexOf(`ward-ed-patient-${INSERTED}`)).toBe(0);
    expect(screen.getByTestId(`ward-ed-actions-menu-${TARGET}`)).toContainElement(item);
    fireEvent.click(item);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: "RECORD_TRANSPORT_NEED", movementId: TARGET, needed: false });
  });
});

describe("Referrals board: a live re-sort under the finger", () => {
  const TARGET = "RF-005";
  const INSERTED = "RF-SYN-LIVE" as const;
  const queue = () => attributes("tr[data-referral-id]", "data-referral-id");
  /** Another desk raises a more urgent, older referral, and the rest arrive in reverse. */
  const resort: Adjust = (value) => {
    const template = value.referrals.find((referral) => referral.id === "RF-015")!;
    const earliest = Math.min(...value.referrals.map((referral) => referral.raisedAt));
    const inserted = { ...template, id: INSERTED, urgency: 1 as const, raisedAt: earliest - 30 };
    return { ...value, referrals: [inserted, ...[...value.referrals].reverse()] };
  };
  const drawerTitle = () => screen.getByTestId("ward-referral-detail").querySelector("h2")!.textContent;

  it("opens the tapped referral when rows move between pointer down and up", () => {
    const { update } = renderLive(<ReferralBoard />);
    const select = screen.getByTestId(`ward-referral-board-select-${TARGET}`);
    const name = select.textContent!;
    expect(name.length).toBeGreaterThan(0);
    const before = queue();

    pressThrough(select, () => {
      update(resort);
      expect(queue()).not.toEqual(before);
      expect(queue().indexOf(INSERTED)).toBeLessThan(queue().indexOf(TARGET));
    });

    expect(drawerTitle()).toContain(name);
    expect(screen.getByTestId(`ward-referral-inspector-priority-${TARGET}`)).toBeInTheDocument();
  });

  it("keeps the open drawer on the same referral when the queue re-sorts", () => {
    const { update } = renderLive(<ReferralBoard />);
    const select = screen.getByTestId(`ward-referral-board-select-${TARGET}`);
    const name = select.textContent!;
    fireEvent.click(select);
    expect(drawerTitle()).toContain(name);

    update(resort);

    expect(queue()[0]).toBe(INSERTED);
    expect(drawerTitle()).toContain(name);
    expect(screen.getByTestId(`ward-referral-inspector-priority-${TARGET}`)).toBeInTheDocument();
  });
});

describe("Ward board: a live re-sort under the finger", () => {
  const UNIT = "rph-adult-secure";
  const TARGET = "AD-RPHS-11";
  const INSERTED = "AD-SYN-LIVE" as const;
  const tiles = () => attributes("[data-testid='ward-board-beds'] button[id]", "id");
  /** A new arrival with the longest stay lands on the ward, and the rest arrive in reverse. */
  const resort: Adjust = (value) => {
    const template = value.admissions.find((admission) => admission.id === "AD-RPHS-15")!;
    // A16-12 (13 Nov 2026): each ward's stays are rearranged, so the longest is read from the ward.
    const longest = Math.min(
      ...value.admissions
        .filter((admission) => admission.unitId === UNIT)
        .map((admission) => admission.arrivedAt ?? Infinity),
    );
    const inserted = { ...template, id: INSERTED, arrivedAt: longest - 60 * 24 * 30 };
    return { ...value, admissions: [inserted, ...[...value.admissions].reverse()] };
  };
  const tileOf = (key: string) => document.getElementById(tileDomId(key))!;

  it("opens the tapped person's record when tiles move between pointer down and up", () => {
    const { update } = renderLive(<WardBoard unitId={UNIT} />);
    const tile = tileOf(TARGET);
    const name = tile.querySelector("span")!.textContent!;
    const before = tiles();

    pressThrough(tile, () => {
      update(resort);
      expect(tiles()).not.toEqual(before);
      expect(tiles().indexOf(tileDomId(INSERTED))).toBeLessThan(tiles().indexOf(tileDomId(TARGET)));
    });

    expect(tile).toHaveAttribute("aria-pressed", "true");
    expect(attributes("[data-testid='ward-board-beds'] button[aria-pressed='true']", "id")).toEqual([
      tileDomId(TARGET),
    ]);
    expect(screen.getByTestId("ward-board-detail")).toHaveTextContent(name);
  });

  it("acts on the person whose record was open when the board re-sorted", () => {
    const { sent, update } = renderLive(<WardBoard unitId={UNIT} />);
    const tile = tileOf(TARGET);
    const name = tile.querySelector("span")!.textContent!;
    fireEvent.click(tile);

    update(resort);
    expect(tiles()[0]).toBe(tileDomId(INSERTED));
    expect(screen.getByTestId("ward-board-detail")).toHaveTextContent(name);
    fireEvent.click(screen.getByTestId("ward-board-stepdown-toggle"));

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: "SET_STEP_DOWN_CANDIDATE", admissionId: TARGET });
  });
});

describe("Discharges board: a live re-sort under the finger", () => {
  const INSERTED = "derived-expected-SYN-LIVE" as const;
  const group = () => screen.getByTestId("ward-discharge-group-expected");
  const rows = () =>
    [...group().querySelectorAll("tr[data-release-id]")].map((row) => row.getAttribute("data-release-id")!);
  const rowOf = (id: string) => group().querySelector<HTMLElement>(`tr[data-release-id="${id}"]`)!;
  /** Another desk records a release due before everyone else's, which pushes every row down one. */
  const resort: Adjust = (value) => {
    const expected = value.bedReleases.filter((release) => release.state === "expected");
    const earliest = Math.min(...expected.map((release) => release.expectedAt));
    const inserted = { ...expected[0]!, id: INSERTED, expectedAt: earliest - 60 };
    return { ...value, bedReleases: [inserted, ...value.bedReleases] };
  };
  /** The second row, so the insertion moves it without pushing it past the folded list's end. */
  const target = () => rows()[1]!;
  const selected = () => attributes("tr[data-release-id][data-selected='true']", "data-release-id");

  it("opens the tapped person's release when rows move between pointer down and up", () => {
    const { update } = renderLive(<DischargeBoard />);
    const id = target();
    const name = within(rowOf(id)).getAllByRole("button")[0]!;
    const before = rows();

    pressThrough(name, () => {
      update(resort);
      expect(rows()).not.toEqual(before);
      expect(rows().indexOf(INSERTED)).toBeLessThan(rows().indexOf(id));
    });

    expect(selected()).toEqual([id]);
  });

  it("opens the right release from a row's own action pressed through a re-sort", () => {
    const { update } = renderLive(<DischargeBoard />);
    const id = target();
    const action = within(rowOf(id)).getByRole("button", { name: "Confirm date" });

    pressThrough(action, () => {
      update(resort);
      expect(rows()[0]).toBe(INSERTED);
    });

    expect(selected()).toEqual([id]);
  });
});
