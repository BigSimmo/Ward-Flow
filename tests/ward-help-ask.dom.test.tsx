import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * Ask help (26 Oct 2026): the Ask box answers from the app's own help, offers Show me only for the
 * desk's own jobs, and keeps the typed question out of browser storage.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow", deskHome: "/ward-flow" }),
}));

import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";
import { HELP_USED_STORAGE_KEY } from "@/components/ward-management/help/ward-help-usage";

function renderSheet(ask: string | undefined) {
  return render(<WardHelpSheet view="screen" ask={ask} onView={vi.fn()} onClose={vi.fn()} />);
}

describe("Ask help in the Help sheet", () => {
  it("is absent while the preview flag is off", () => {
    renderSheet(undefined);
    expect(screen.queryByTestId("ward-help-ask")).toBeNull();
  });

  it("answers a handed-over question with Show me and a link for the coordinator", () => {
    renderSheet("how do I pull a bed");
    const answer = screen.getByTestId("ward-help-ask-answer-pull-bed");
    expect(within(answer).getByText(/press Pull the bed/)).toBeTruthy();
    expect(within(answer).getByTestId("ward-help-ask-show-me")).toBeTruthy();
    expect(within(answer).getByTestId("ward-help-ask-go").getAttribute("href")).toBe("/ward-flow/movements");
    expect(screen.getByTestId("ward-help-ask-stuck")).toBeTruthy();
  });

  it("finds settings and says plainly when nothing matches", () => {
    renderSheet("");
    const input = screen.getByTestId("ward-help-ask-input");
    fireEvent.change(input, { target: { value: "dark mode" } });
    expect(screen.getByTestId("ward-help-ask-answer-theme")).toBeTruthy();
    fireEvent.change(input, { target: { value: "xyzzy plover" } });
    expect(screen.getByTestId("ward-help-ask-none")).toBeTruthy();
  });

  it("never writes the typed question to browser storage", () => {
    renderSheet("");
    fireEvent.change(screen.getByTestId("ward-help-ask-input"), { target: { value: "Wren Tobias transport" } });
    const stored = [window.localStorage, window.sessionStorage]
      .flatMap((store) => Object.keys(store).map((key) => store.getItem(key) ?? ""))
      .join(" ");
    expect(stored).not.toMatch(/Wren|Tobias/);
  });

  it("counts an answer as used when someone opens it, as its id only", () => {
    window.localStorage.removeItem(HELP_USED_STORAGE_KEY);
    renderSheet("");
    fireEvent.change(screen.getByTestId("ward-help-ask-input"), { target: { value: "how do I cancel transport" } });
    // The first answer shows by itself, which is not a use.
    expect(window.localStorage.getItem(HELP_USED_STORAGE_KEY)).toBeNull();
    const second = screen.getAllByTestId(/^ward-help-ask-answer-/)[1] as HTMLElement;
    const id = second.dataset.testid?.replace("ward-help-ask-answer-", "");
    const title = within(second).getAllByRole("button")[0] as HTMLElement;
    fireEvent.click(title);
    fireEvent.click(title);
    fireEvent.click(title);
    expect(window.localStorage.getItem(HELP_USED_STORAGE_KEY)).toBe(`${id}:2`);
    window.localStorage.removeItem(HELP_USED_STORAGE_KEY);
  });
});
