// Referrals desk views (Josh, 31 Oct 2026): the site bed manager's branches on the one real board.
// It is headed with its site, shows no recipient-type highlights or Beds ready, stays read only
// (D-80) with the read-only note in the bottom bar, and leaves out what an empty queue has nothing
// to act on. The coordinator's board is unchanged. Synthetic seed data only.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/referrals",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";

const SEED = seedWardFlowState();
const QUEUED_IDS = new Set(referralQueueOrder(SEED.referrals).map(({ id }) => id));
const bedManagerAt = (siteCode: string): WardAccess => ({ role: "bed_manager", scope: { kind: "site", siteCode } });
const linesAt = (siteCode: string) =>
  scopeWardFlowState(SEED, bedManagerAt(siteCode), {
    now: NOW_ANCHOR,
    places: wardPlaceLookup(SEED.units),
  }).state.referrals;
const queuedAt = (siteCode: string) => linesAt(siteCode).filter(({ id }) => QUEUED_IDS.has(id)).length;
const SITES = [...new Set(SEED.units.map((unit) => unit.siteCode))];
// A site with a referral still queued, and one whose own lines are all decided.
const QUEUED_SITE = SITES.find((siteCode) => queuedAt(siteCode) > 0)!;
const EMPTY_SITE = SITES.find((siteCode) => queuedAt(siteCode) === 0 && linesAt(siteCode).length > 0)!;
const RECIPIENT_HIGHLIGHTS = ["ward", "ed", "both", "community", "refused"];
const ACTION = /accept|decline|decide|assign|take this|log a call|place|pull/i;

/** Desk layout: the detail sits beside the queue. Phone: the 48rem phone layout. */
function layout(kind: "desk" | "phone") {
  const query = kind === "desk" ? "(min-width: 64rem)" : "(max-width: 48rem)";
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (media: string) => ({
      matches: media === query,
      media,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }),
  });
}

function renderAs(access: WardAccess | null) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", access === null ? null : true);
    if (access) setWardAccess(access);
  });
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <ReferralBoard />
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

/** The scoped workspace loads after the first draw; wait for the desk's own rows. */
async function settled(kind: "queued" | "decided") {
  if (kind === "queued") await screen.findAllByTestId(/^ward-referral-board-select-(?!decided)/);
  else await screen.findByRole("tab", { name: /^History\D*[1-9]/ });
}

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("the site bed manager's Referrals desk", () => {
  it("heads the board with its site and drops the recipient highlights and Beds ready", async () => {
    expect(QUEUED_SITE).toBeDefined();
    layout("desk");
    renderAs(bedManagerAt(QUEUED_SITE));
    await settled("queued");
    const hero = screen.getByTestId("ward-referral-kpis");
    expect(hero).toHaveTextContent(`Referrals · ${siteByCode(QUEUED_SITE)!.name} wards`);
    for (const key of RECIPIENT_HIGHLIGHTS) {
      expect(screen.queryByTestId(`ward-referral-highlight-${key}`)).not.toBeInTheDocument();
    }
    expect(screen.queryByTestId("ward-referral-beds-ready")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-board-order-note")).toBeInTheDocument();
  });

  it("says read only once, in the bottom bar, and offers no decision", async () => {
    layout("desk");
    renderAs(bedManagerAt(QUEUED_SITE));
    const rows = await screen.findAllByTestId(/^ward-referral-board-select-(?!decided)/);
    fireEvent.click(rows[0]!);
    const detail = screen.getByRole("region", { name: "Selected referral detail" });
    const notes = within(detail).getAllByTestId("ward-referral-read-only");
    expect(notes).toHaveLength(1);
    expect(notes[0]).toHaveTextContent("Read only. The coordinator and the receiving ward answer this referral.");
    expect(within(detail).queryByTestId("ward-referral-read-only-foot")).not.toBeInTheDocument();
    expect(within(detail).queryByTestId("ward-referral-foot-decide")).not.toBeInTheDocument();
    const names = within(detail)
      .queryAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent ?? "");
    expect(names.filter((name) => ACTION.test(name))).toEqual([]);
  });

  it("with nothing queued, leaves out the highlights, band and sort note and says who answers", async () => {
    expect(EMPTY_SITE).toBeDefined();
    layout("desk");
    renderAs(bedManagerAt(EMPTY_SITE));
    await settled("decided");
    const hero = screen.getByTestId("ward-referral-kpis");
    expect(hero).toHaveTextContent("Nothing awaiting a decision");
    expect(hero).not.toHaveTextContent(/Oldest/);
    expect(within(hero).queryByRole("group", { name: "Highlight referrals" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-board-order-note")).not.toBeInTheDocument();
    const detail = screen.getByRole("region", { name: "Selected referral detail" });
    expect(detail).toHaveTextContent("Read only");
    expect(detail).toHaveTextContent("The coordinator and the receiving ward answer each referral.");
    expect(detail).not.toHaveTextContent(/Select a queued referral/);
  });

  it("on the phone, names its site code and read only, with no Beds ready figure", async () => {
    layout("phone");
    renderAs(bedManagerAt(QUEUED_SITE));
    await settled("queued");
    const hero = screen.getByTestId("ward-referral-phone-hero");
    expect(hero).toHaveTextContent(`Referrals · ${QUEUED_SITE} wards · read only`);
    expect(within(hero).queryByTestId("ward-referral-phone-beds")).not.toBeInTheDocument();
    expect(within(hero).getByRole("group", { name: "Highlight referrals" })).toBeInTheDocument();
  });

  it("on the phone with nothing queued, shows no zero figures", async () => {
    layout("phone");
    renderAs(bedManagerAt(EMPTY_SITE));
    await settled("decided");
    const hero = screen.getByTestId("ward-referral-phone-hero");
    expect(hero).toHaveTextContent("Nothing awaiting a decision");
    expect(within(hero).queryByRole("group", { name: "Highlight referrals" })).not.toBeInTheDocument();
    // The second line stays only for the median of decided referrals; nothing is "Oldest".
    expect(hero).not.toHaveTextContent(/Oldest/);
  });
});

describe("the coordinator's Referrals board beside it", () => {
  it("keeps the statewide heading, Beds ready and the recipient highlights", async () => {
    layout("desk");
    renderAs(null);
    await settled("queued");
    const hero = screen.getByTestId("ward-referral-kpis");
    expect(within(hero).getByText("Referrals", { exact: true })).toBeInTheDocument();
    expect(hero).toHaveTextContent(/\d+ awaiting decision/);
    expect(screen.getByTestId("ward-referral-beds-ready")).toBeInTheDocument();
    expect(RECIPIENT_HIGHLIGHTS.some((key) => screen.queryByTestId(`ward-referral-highlight-${key}`) !== null)).toBe(
      true,
    );
  });

  it("keeps the statewide phone eyebrow and the Beds ready figure", async () => {
    layout("phone");
    renderAs(null);
    await settled("queued");
    const hero = screen.getByTestId("ward-referral-phone-hero");
    expect(hero).toHaveTextContent("Referrals · statewide");
    expect(within(hero).getByTestId("ward-referral-phone-beds")).toBeInTheDocument();
  });
});
