import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StatisticsTeamsIndexScreen } from "@/components/ward-management/statistics/statistics-teams-index";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { communityStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";

afterEach(() => vi.unstubAllGlobals());

it("explains the active team filter and searches all teams in one action without clearing the name", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === WF_PHONE_QUERY,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsTeamsIndexScreen />
      </WardFlowProvider>
    </ToastProvider>,
  );
  const phone = screen.getByTestId("ward-statistics-teams-phone");
  const search = within(phone).getByRole("searchbox", { name: "Find a team" });
  fireEvent.click(within(phone).getByRole("radio", { name: /^All teams/u }));
  const allLinks = within(phone).getAllByRole("link");
  fireEvent.click(within(phone).getByRole("radio", { name: /^With patients/u }));
  const activeIds = new Set(
    within(phone)
      .queryAllByRole("link")
      .map((link) => link.getAttribute("href")),
  );
  const inactive = allLinks.find((link) => !activeIds.has(link.getAttribute("href")));
  expect(inactive, "fixture needs a team excluded by the active filter").toBeDefined();
  const href = inactive!.getAttribute("href")!;
  const query = COMMUNITY_TEAM_PAGES.find((team) => communityStatisticsHref(team.id) === href)!.name;
  fireEvent.click(within(phone).getByRole("radio", { name: /^With patients/u }));
  fireEvent.change(search, { target: { value: query } });
  expect(within(phone).getByText("No team with patients in a bed matches this name.")).toBeInTheDocument();
  fireEvent.click(within(phone).getByRole("button", { name: "Show all teams" }));
  expect(search).toHaveValue(query);
  expect(within(phone).getByRole("link")).toHaveAttribute("href", href);
});
