import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
vi.mock("next/navigation", () => ({ usePathname: () => "/ward-flow", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
import { WardGlobalSearch, clearGlobalSearchRecents } from "@/components/ward-management/ward-global-search";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { installMatchMediaStub } from "./setup/jsdom.setup";
const seed = seedWardFlowState();
afterEach(() => {
  clearGlobalSearchRecents();
  installMatchMediaStub(false);
});
function search(extra: Partial<Parameters<typeof WardGlobalSearch>[0]> = {}) {
  const navigate = vi.fn();
  render(
    <WardGlobalSearch
      movements={[]}
      referrals={[]}
      patients={seed.patients}
      units={seed.units}
      now={4000}
      onNavigate={navigate}
      {...extra}
    />,
  );
  const input = screen.getByTestId("ward-global-search-input");
  fireEvent.focus(input);
  return { input, navigate };
}
describe("consolidated header search", () => {
  it("retains automatic Go to across incremental typing with the same result identity", () => {
    const { input, navigate } = search();
    fireEvent.change(input, { target: { value: "bunbu" } });
    fireEvent.change(input, { target: { value: "bunbur" } });
    fireEvent.change(input, { target: { value: "bunbury" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(navigate).toHaveBeenCalledTimes(1);
  });
  it("promotes an exact community team to Go to", () => {
    const team = COMMUNITY_TEAM_PAGES[0]!;
    const { input, navigate } = search({ canOpenHref: (href) => href === `/ward-flow/community/${team.id}` });
    fireEvent.change(input, { target: { value: team.name } });
    expect(screen.getByTestId("ward-global-search-group-goto")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(navigate).toHaveBeenCalledWith(`/ward-flow/community/${team.id}`);
  });
  it("finds the only permitted community team beyond the engine's former first 40", () => {
    const team = COMMUNITY_TEAM_PAGES[45]!;
    expect(team).toBeDefined();
    const { input } = search({ canOpenHref: (href) => href === `/ward-flow/community/${team.id}` });
    fireEvent.change(input, { target: { value: "community" } });
    expect(screen.getAllByRole("option").some((option) => option.textContent?.includes(team.name))).toBe(true);
  });
  it("retains an open phone preview through a routine refreshed result object", () => {
    installMatchMediaStub(true);
    const patient = seed.patients[0]!;
    const props = {
      movements: [],
      referrals: [],
      patients: [patient],
      units: seed.units,
      now: 4000,
      onNavigate: vi.fn(),
    };
    const view = render(<WardGlobalSearch {...props} />);
    const input = screen.getByTestId("ward-global-search-input");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: patient.umrn } });
    fireEvent.click(screen.getAllByTestId(/^ward-global-search-result-person-/)[0]!);
    expect(screen.getByTestId("ward-global-search-sheet")).toBeInTheDocument();
    view.rerender(<WardGlobalSearch {...props} patients={[{ ...patient }]} now={4001} />);
    expect(within(screen.getByTestId("ward-global-search-sheet")).getByRole("dialog")).toBeInTheDocument();
  });
  it("treats a literal matching family name as a person rather than a risk request", () => {
    const patient = { ...seed.patients[0]!, familyName: "Risk" };
    const { input } = search({ patients: [patient] });
    fireEvent.change(input, { target: { value: "Risk" } });
    expect(screen.queryByTestId("ward-global-search-refusal")).not.toBeInTheDocument();
    expect(screen.getAllByRole("option").some((option) => option.textContent?.includes("Risk"))).toBe(true);
  });
});
