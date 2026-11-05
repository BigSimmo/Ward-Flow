import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardGlobalSearch, clearGlobalSearchRecents } from "@/components/ward-management/ward-global-search";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { installMatchMediaStub } from "./setup/jsdom.setup";

/** Josh, 3 Nov 2026: Try asking, the Go to row, highlights and the phone preview sheet. */
function ProvidedSearch({ onNavigate }: { onNavigate: (href: string) => void }) {
  const flow = useWardFlow();
  return (
    <WardGlobalSearch
      movements={flow.movements}
      patients={flow.patients}
      referrals={flow.referrals}
      units={flow.units}
      plannedAdmissions={flow.plannedAdmissions}
      now={flow.now}
      onNavigate={onNavigate}
    />
  );
}

function renderSearch() {
  clearGlobalSearchRecents();
  const onNavigate = vi.fn();
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ProvidedSearch onNavigate={onNavigate} />
    </WardFlowProvider>,
  );
  const input = screen.getByTestId("ward-global-search-input");
  fireEvent.focus(input);
  return { input, onNavigate };
}

afterEach(() => installMatchMediaStub(false));

describe("smart global search", () => {
  it("offers Try asking chips with counts, and a chip asks its question", () => {
    const { input } = renderSearch();
    const chip = screen.getByRole("button", { name: /^Waiting over 24 hours, \d+$/ });
    fireEvent.click(chip);
    expect(input).toHaveValue("waiting over 24 hours");
    expect(screen.getByTestId("ward-global-search-group-answers")).toBeInTheDocument();
  });

  it("puts a place that starts with the words first, active, so Enter opens it", () => {
    const { input, onNavigate } = renderSearch();
    fireEvent.change(input, { target: { value: "bunbury" } });
    const goTo = screen.getByTestId("ward-global-search-group-goto");
    expect(goTo).toHaveTextContent(/Go to/);
    expect(input).toHaveAttribute("aria-activedescendant");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("never puts a person first from part of a name", () => {
    const { input, onNavigate } = renderSearch();
    fireEvent.change(input, { target: { value: "ridge" } });
    expect(screen.queryByTestId("ward-global-search-group-goto")).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-activedescendant");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("highlights the typed letters in each row", () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: "ridge" } });
    const popup = screen.getByTestId("ward-global-search-popup");
    const marks = popup.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].textContent?.toLowerCase()).toBe("ridge");
  });

  it("on a phone, a tap on a person shows the preview sheet before leaving the page", () => {
    installMatchMediaStub(true);
    const { input, onNavigate } = renderSearch();
    fireEvent.change(input, { target: { value: "ridge" } });
    const row = screen.getAllByTestId(/^ward-global-search-result-person-/)[0];
    fireEvent.click(row);
    expect(onNavigate).not.toHaveBeenCalled();
    const sheet = screen.getByTestId("ward-global-search-sheet");
    expect(within(sheet).getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Back to results" }));
    expect(screen.queryByTestId("ward-global-search-sheet")).not.toBeInTheDocument();
  });
});

describe("smart global search, friction", () => {
  it("offers somewhere to go when nothing matches, without guessing at names", () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: "zzqxv" } });
    const tryRow = screen.getByTestId("ward-global-search-empty-try");
    expect(within(tryRow).getAllByRole("link").length).toBeGreaterThan(0);
    expect(screen.getByTestId("ward-global-search-empty")).toHaveTextContent("Nothing found for “zzqxv”");
  });

  it("offers the patient straight from a movement row being looked at", () => {
    const { input, onNavigate } = renderSearch();
    fireEvent.change(input, { target: { value: "accepted" } });
    const row = screen.getAllByTestId(/^ward-global-search-result-movement-/)[0];
    fireEvent.mouseEnter(row);
    const quick = screen.getByTestId("ward-global-search-quick-patient");
    expect(quick.getAttribute("href")).toMatch(/\/people\//);
    fireEvent.click(quick);
    expect(onNavigate).toHaveBeenCalledWith(quick.getAttribute("href"));
  });
});
