/**
 * Places as the site bed manager (role view `as-bed-manager-places`, Josh approved 31 Oct 2026):
 * the one real hub screen branches on the desk (D-80). The site's own wards are listed once, under
 * "Your site"; the network's wards read "Other wards"; a place this desk cannot open shows Open
 * greyed with the closed page's own sentence; the site's own wards offer Confirm beds, not Ask to
 * confirm. The statewide coordinator's Places is unchanged (tests/ward-hub-screen.dom.test.tsx).
 */
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/hub",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { HubScreen } from "@/components/ward-management/hub/hub-screen";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

const SITE = "RPH";
const BED_MANAGER: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: SITE } };
const OWN_WARDS = allUnits().filter((unit) => unit.siteCode === SITE);
const OTHER_WARD = allUnits().find((unit) => unit.siteCode !== SITE)!;

function renderAs(access: WardAccess | null) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", access === null ? null : true);
    if (access) setWardAccess(access);
  });
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <HubScreen />
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

const results = () => within(document.getElementById("hub-results")!);
function expandAll() {
  for (let round = 0; round < 50; round += 1) {
    const list = document.getElementById("hub-results")!;
    const next =
      list.querySelector<HTMLButtonElement>('button[aria-expanded="false"]') ??
      results().queryAllByRole("button", { name: /^show more/i })[0];
    if (!next) return;
    fireEvent.click(next);
  }
}
const preview = () => within(screen.getByRole("region", { name: /^preview,/iu }));

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("Places as the site bed manager (D-80)", () => {
  it("lists the site's own wards once, under Your site, and the rest as Other wards", async () => {
    expect(OWN_WARDS.length).toBeGreaterThan(0);
    renderAs(BED_MANAGER);

    const title = await screen.findByRole("heading", { level: 1 });
    expect(title).toHaveTextContent(`${OWN_WARDS.length} wards at your site`);
    const own = screen.getByRole("region", { name: /^Your site, /u });
    expect(within(own).getAllByRole("listitem")).toHaveLength(OWN_WARDS.length);
    for (const unit of OWN_WARDS) expect(within(own).getByText(unit.name)).toBeInTheDocument();

    const others = screen.getByRole("region", { name: "Other wards" });
    expect(within(others).getByRole("heading", { level: 2 })).toHaveTextContent(/^Other wards\s*\d+$/u);
    expandAll();
    // Listed once: no own ward repeats under Other wards.
    for (const unit of OWN_WARDS) expect(within(others).queryByText(unit.name)).not.toBeInTheDocument();
    // The preview opens on the site's first ward.
    expect(preview().getByRole("heading", { level: 2 })).toHaveTextContent(OWN_WARDS[0]!.name);
  });

  it("offers Confirm beds on its own ward, never Ask to confirm", async () => {
    renderAs(BED_MANAGER);
    await screen.findByRole("region", { name: /^Your site, /u });
    fireEvent.click(within(screen.getByRole("region", { name: /^Your site, /u })).getByText(OWN_WARDS[0]!.name));
    expect(preview().queryByRole("button", { name: /^ask to confirm$/iu })).not.toBeInTheDocument();
    // This desk confirms its own ward's beds itself, on the ward's page.
    const confirm = preview().getByRole("link", { name: "Confirm beds" });
    expect(confirm.getAttribute("href")).toMatch(new RegExp(`/ward/${OWN_WARDS[0]!.id}$`, "u"));
    const open = preview()
      .getAllByRole("link")
      .filter((link) => /^Open /u.test(link.textContent ?? ""));
    expect(open).toHaveLength(1);
  });

  it("greys Open on a place this desk cannot open, with the closed page's own sentence", async () => {
    renderAs(BED_MANAGER);
    await screen.findByRole("region", { name: /^Your site, /u });
    expandAll();
    fireEvent.click(results().getByText(OTHER_WARD.name));

    expect(preview().queryByRole("link", { name: /^open /iu })).not.toBeInTheDocument();
    expect(preview().queryByRole("link", { name: /confirm beds/iu })).not.toBeInTheDocument();
    expect(preview().queryByRole("button", { name: /^ask to confirm$/iu })).not.toBeInTheDocument();
    const greyed = preview().getByRole("button", { name: new RegExp(`^Open ${OTHER_WARD.name}`, "u") });
    expect(greyed).toHaveAttribute("aria-disabled", "true");
    // Shown in full as its own line (QA 31 Oct), and read out with the greyed button.
    const sentence = "This screen is not part of the Site bed manager desk.";
    const shown = preview()
      .getAllByText(sentence)
      .filter((node) => node.getAttribute("aria-hidden") === "true");
    expect(shown).toHaveLength(1);
    const describedBy = greyed.getAttribute("aria-describedby") ?? "";
    expect(describedBy.split(" ").some((id) => document.getElementById(id)?.textContent === sentence)).toBe(true);
  });

  it("leaves the statewide coordinator's Places without a Your site group", () => {
    renderAs(null);
    expect(screen.queryByRole("region", { name: /^Your site, /u })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/\d+ places/u);
  });
});
