// tests/ward-community-suburb-lookup.dom.test.tsx
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

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/community",
  useRouter: () => ({ push: vi.fn() }),
}));

import { CommunityIndex } from "@/components/ward-management/community/community-index";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Community page, core pages review (approved by Josh, 31 Oct 2026). The suburb lookup is a
 * full-width bar above the A to Z. For a suburb whose catchment row names more than one team, the
 * warning comes first, then every team with its own Open and Show in list. It opens empty, with
 * nothing chosen (Josh, 31 Oct 2026). The heading counts the teams live. Synthetic catchment data
 * only; the typed words stay in the box.
 */
function renderIndex(teams?: Parameters<typeof CommunityIndex>[0]["teams"]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CommunityIndex teams={teams} />
    </WardFlowProvider>,
  );
}

function lookupCard(): HTMLElement {
  return screen.getByTestId("suburb-lookup-card");
}

function suburbField(): HTMLInputElement {
  return within(lookupCard()).getByRole("searchbox", { name: "Suburb or postcode" }) as HTMLInputElement;
}

/** Chooses a suburb from the quick picks, the way a reader would. */
function pickSuburb(name: string) {
  const picks = within(lookupCard()).getByRole("group", { name: "Suburbs whose row names more than one team" });
  fireEvent.click(within(picks).getByRole("button", { name }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Community heading — a live count of community teams", () => {
  it('reads "N community teams" from the list it is given, with the source line under it', () => {
    renderIndex();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent?.replace(/\s+/gu, " ").trim()).toBe(
      `Community: ${COMMUNITY_TEAM_PAGES.length} community teams`,
    );
    expect(screen.getByText("Names from referral catchment documents, not verified services")).toBeInTheDocument();
  });

  it("follows the list, not a fixed number", () => {
    renderIndex(COMMUNITY_TEAM_PAGES.slice(0, 5));
    expect(screen.getByRole("heading", { level: 1 }).textContent?.replace(/\s+/gu, " ").trim()).toBe(
      "Community: 5 community teams",
    );
  });
});

describe("Community suburb lookup — a shared suburb warns first, then every team it names", () => {
  it("opens empty: no suburb typed, no quick pick pressed, no warning and no team", () => {
    renderIndex();
    expect(suburbField().value).toBe("");
    const picks = within(lookupCard()).getByRole("group", { name: "Suburbs whose row names more than one team" });
    const buttons = within(picks).getAllByRole("button");
    expect(buttons.length, "no quick picks to check").toBeGreaterThan(0);
    for (const button of buttons) expect(button).toHaveAttribute("aria-pressed", "false");
    expect(within(lookupCard()).queryByTestId("suburb-lookup-shared-warning")).toBeNull();
    expect(within(lookupCard()).queryByRole("link", { name: /^Open / })).toBeNull();
  });

  it("choosing Barragup shows the warning before the teams, each with Open and Show in list", () => {
    renderIndex();
    pickSuburb("Barragup");
    expect(suburbField().value).toBe("Barragup");

    const answer = within(lookupCard()).getByRole("region", { name: "Barragup" });
    const warning = within(answer).getByTestId("suburb-lookup-shared-warning");
    expect(warning).toHaveTextContent("2 teams name Barragup. Check the right one.");

    const teams = within(answer).getAllByRole("listitem");
    expect(teams).toHaveLength(2);
    // The warning comes first: it sits before the first team in document order.
    expect(warning.compareDocumentPosition(teams[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    for (const team of teams) {
      const open = within(team).getByRole("link", { name: /^Open / });
      expect(open.getAttribute("href")).toMatch(/^\/ward-flow\/community\/[a-z0-9-]+$/u);
      expect(within(team).getByRole("button", { name: "Show in list" })).toBeInTheDocument();
    }
    const openNames = teams.map((team) =>
      within(team)
        .getByRole("link", { name: /^Open / })
        .getAttribute("href"),
    );
    expect(new Set(openNames).size, "both teams open the same page").toBe(2);
  });

  it("Show in list focuses that team's row in the A to Z", () => {
    vi.useFakeTimers();
    renderIndex();
    fireEvent.change(suburbField(), { target: { value: "Barragup" } });
    const answer = within(lookupCard()).getByRole("region", { name: "Barragup" });
    const first = within(answer).getAllByRole("listitem")[0]!;
    const href = within(first)
      .getByRole("link", { name: /^Open / })
      .getAttribute("href");

    fireEvent.click(within(first).getByRole("button", { name: "Show in list" }));
    act(() => {
      vi.runAllTimers();
    });

    const focused = document.activeElement;
    expect(focused?.tagName).toBe("A");
    expect(focused?.getAttribute("href")).toBe(href);
    expect(screen.getByTestId("community-index-teams").contains(focused)).toBe(true);
  });

  it("names one team with no warning for a suburb its row gives to one team", () => {
    renderIndex();
    fireEvent.change(suburbField(), { target: { value: "Armadale" } });
    const answer = within(lookupCard()).getByRole("region", { name: "Armadale" });
    expect(within(answer).queryByTestId("suburb-lookup-shared-warning")).toBeNull();
    expect(within(answer).getAllByRole("listitem")).toHaveLength(1);
  });

  it("keeps the typed words in the box: not in the address and not in browser storage", () => {
    renderIndex();
    const before = window.location.href;
    fireEvent.change(suburbField(), { target: { value: "Coodanup" } });
    expect(suburbField().value).toBe("Coodanup");
    expect(window.location.href).toBe(before);
    for (const store of [window.localStorage, window.sessionStorage]) {
      for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index) ?? "";
        expect(`${key}=${store.getItem(key) ?? ""}`).not.toContain("Coodanup");
      }
    }
  });
});
