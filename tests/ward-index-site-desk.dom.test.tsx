import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
// The pre-commit hook's staged-file typecheck compiles only this file (plus .d.ts roots), so it
// never sees tests/setup/jsdom.setup.ts's global jest-dom matcher augmentation.
import "@testing-library/jest-dom/vitest";

import { WardIndex } from "@/components/ward-management/wards/ward-index";
import {
  OTHER_SITE_CARDS,
  OtherSitesMore,
  otherSitesFolded,
} from "@/components/ward-management/wards/ward-index-site-desk";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";

/**
 * All wards as a site bed manager (D-80, approved redesign, Josh 31 Oct 2026): the desk's own
 * site's wards come first and in full; every other site's wards are bed counts only, with no
 * Enter, the first six then Show all. The coordinator's statewide page is unchanged.
 */
const SITE = "RPH";

afterEach(() => {
  cleanup();
  setWardFeatureFlagOnDevice("role-access", null);
  resetWardAccessStoreForTests();
});

function renderIndex() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardIndex />
    </WardFlowProvider>,
  );
}

describe("All wards: other sites fold only when two or more would be hidden", () => {
  it("shows seven other sites in full with no Show all, and folds eight to six", () => {
    expect(otherSitesFolded(OTHER_SITE_CARDS)).toBe(OTHER_SITE_CARDS);
    expect(otherSitesFolded(OTHER_SITE_CARDS + 1)).toBe(OTHER_SITE_CARDS + 1);
    expect(otherSitesFolded(OTHER_SITE_CARDS + 2)).toBe(OTHER_SITE_CARDS);

    const seven = render(
      <OtherSitesMore shown={OTHER_SITE_CARDS + 1} total={OTHER_SITE_CARDS + 1} open={false} onToggle={() => {}} />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    seven.unmount();
    render(<OtherSitesMore shown={OTHER_SITE_CARDS} total={OTHER_SITE_CARDS + 2} open={false} onToggle={() => {}} />);
    expect(
      screen.getByRole("button", { name: `Show all ${OTHER_SITE_CARDS + 2} wards at other sites` }),
    ).toBeInTheDocument();
  });
});

describe("All wards: the site bed manager's desk", () => {
  it("leads with its own site in full, then other sites as counts behind Show all", () => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: SITE } });
    renderIndex();

    const units = seedWardFlowState().units;
    const own = units.filter((unit) => unit.siteCode === SITE);
    const other = units.filter((unit) => unit.siteCode !== SITE);
    expect(own.length).toBeGreaterThan(0);
    // Two or more hidden, so the list folds (Josh, answer 21).
    expect(other.length).toBeGreaterThan(OTHER_SITE_CARDS + 1);

    const siteName = siteByCode(SITE)!.name;
    expect(screen.getByRole("heading", { level: 2, name: new RegExp(`^${siteName}`, "u") })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /^Other sites/u })).toBeInTheDocument();

    // Own wards keep Enter; other sites' wards have no way in.
    for (const unit of own) expect(screen.getByTestId(`ward-index-link-${unit.id}`)).toBeInTheDocument();
    for (const unit of other) expect(screen.queryByTestId(`ward-index-link-${unit.id}`)).toBeNull();

    const otherGrid = screen.getByRole("region", { name: "Other sites, bed counts" });
    expect(within(otherGrid).getAllByRole("article")).toHaveLength(OTHER_SITE_CARDS);
    expect(within(otherGrid).queryByText(/ask NUM/u)).toBeNull();

    const more = screen.getByRole("button", { name: `Show all ${other.length} wards at other sites` });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    expect(within(otherGrid).getAllByRole("article")).toHaveLength(other.length);
    expect(screen.getByRole("button", { name: "Show fewer other sites" })).toHaveAttribute("aria-expanded", "true");

    // The hero chip counts wards with a ready bed; Ready now and Pulled leave the chips.
    const chips = screen.getByRole("group", { name: `${siteName} counts` });
    expect(within(chips).getByText(/Wards? with a ready bed/u)).toBeInTheDocument();
    expect(within(chips).queryByText("Ready now")).toBeNull();
    expect(within(chips).queryByText("Pulled")).toBeNull();
  });

  it("keeps the statewide page for the coordinator", () => {
    renderIndex();
    expect(screen.queryByRole("heading", { level: 2, name: /^Other sites/u })).toBeNull();
    expect(screen.queryByRole("button", { name: /wards at other sites/u })).toBeNull();
    const chips = screen.getByRole("group", { name: "Statewide counts" });
    expect(within(chips).getByText("Ready now")).toBeInTheDocument();
    expect(screen.getByTestId("ward-index-count-note")).toHaveTextContent(/^\d+ wards$/u);
  });
});
