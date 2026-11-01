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
import { CLINICAL_REPLY } from "@/components/ward-management/help/ward-help-search-index";
import { WardHelpAsk } from "@/components/ward-management/help/ward-help-ask";

/** The Ask box on its own, empty, as a question handed over with no words opens it. */
function renderAsk() {
  return render(<WardHelpAsk role="coordinator" home="/ward-flow" initialQuery="" onClose={vi.fn()} />);
}

function renderSheet(ask: string | undefined, onShowMe = vi.fn()) {
  return render(
    <WardHelpSheet
      view="screen"
      ask={ask}
      showMeOn
      onView={vi.fn()}
      onClose={vi.fn()}
      onTour={vi.fn()}
      onShowMe={onShowMe}
    />,
  );
}

function helpField() {
  return screen.getByRole("searchbox", { name: "Search Help" });
}

describe("Ask help in the Help sheet", () => {
  it("uses an explicitly supplied public glossary for a report-only host", () => {
    render(
      <WardHelpAsk
        role="executive"
        home={undefined}
        initialQuery="signal"
        onClose={vi.fn()}
        termsSource={[{ term: "Signal", meaning: "Synthetic public glossary definition." }]}
      />,
    );
    expect(screen.getByText("Synthetic public glossary definition.")).toBeTruthy();
  });

  it.each([
    "what dose should I give",
    "should I discharge transport",
    "medication dark mode",
    "Is this patient safe to transfer?",
  ])("shows only the approved reply for a clinical question: %s", (query) => {
    renderSheet(query);
    const reply = screen.getByRole("status");
    expect(reply.textContent).toBe(CLINICAL_REPLY);
    expect(reply.closest('[aria-live="polite"]')).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Best answer" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Words" })).toBeNull();
    expect(screen.queryByText(/These are the closest/)).toBeNull();
  });

  it("offers the closest topics in the live region when nothing matches every word", () => {
    renderSheet("bed giraffe elephant");
    const note = screen.getByText("Nothing matches every word. These are the closest.");
    expect(note.closest('[aria-live="polite"]')).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Best answer" })).toBeNull();
    fireEvent.change(helpField(), { target: { value: "dark mode" } });
    expect(screen.queryByText(/These are the closest/)).toBeNull();
    expect(screen.getByRole("region", { name: "Best answer" }).textContent).toMatch(/Theme|dark/i);
  });

  it("keeps another desk's closest topics readable without offering its actions", () => {
    render(
      <WardHelpAsk
        role="executive"
        home="/ward-flow/statistics"
        initialQuery="bed giraffe elephant"
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Done by another desk")).toBeTruthy();
    const answers = screen.getAllByTestId(/^ward-help-ask-answer-/);
    for (const answer of answers) {
      fireEvent.click(within(answer).getByRole("button"));
      expect(within(answer).queryByTestId("ward-help-ask-show-me")).toBeNull();
      expect(within(answer).queryByRole("link")).toBeNull();
    }
  });

  it("returns to ordinary results after a clinical question is replaced", () => {
    renderSheet("what dose should I give");
    fireEvent.change(helpField(), { target: { value: "pull a bed" } });
    expect(screen.queryByText(CLINICAL_REPLY)).toBeNull();
    expect(screen.getByRole("region", { name: "Best answer" }).textContent).toContain("Pull the bed for a patient");
  });

  it("opens on the tabs with an empty box when nothing is handed over", () => {
    renderSheet(undefined);
    expect((helpField() as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("tablist", { name: "Help sections" })).toBeTruthy();
  });

  it("answers a handed-over question with its steps, Show me and a way into How do I…", () => {
    const onShowMe = vi.fn();
    renderSheet("how do I pull a bed", onShowMe);
    const best = screen.getByRole("region", { name: "Best answer" });
    expect(within(best).getAllByText(/press Pull the bed/).length).toBeGreaterThan(0);
    expect(within(best).getByRole("list", { name: "Steps" })).toBeTruthy();
    fireEvent.click(within(best).getByRole("button", { name: "Show me on screen" }));
    expect(onShowMe).toHaveBeenCalledWith("pull-bed");
    fireEvent.click(within(best).getByRole("button", { name: /Open in How to/ }));
    expect(screen.getByTestId("ward-help-task-answer-pull-bed")).toBeTruthy();
  });

  it("never writes words typed in Help's search to storage or URL history", () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    renderSheet(undefined);
    fireEvent.change(helpField(), { target: { value: "bed qzxvwk qzxvwl" } });
    fireEvent.keyDown(helpField(), { key: "Enter" });
    expect(JSON.stringify([...write.mock.calls, ...push.mock.calls, ...replace.mock.calls])).not.toMatch(
      /qzxvwk|qzxvwl/,
    );
  });

  it("finds settings and says plainly when nothing matches", () => {
    renderAsk();
    const input = screen.getByTestId("ward-help-ask-input");
    fireEvent.change(input, { target: { value: "dark mode" } });
    expect(screen.getByTestId("ward-help-ask-answer-theme")).toBeTruthy();
    fireEvent.change(input, { target: { value: "xyzzy plover" } });
    expect(screen.getByTestId("ward-help-ask-none")).toBeTruthy();
  });

  it("never writes the typed question to storage or URL history, including after opening a suggestion", () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    const before = window.location.href;
    renderAsk();
    fireEvent.change(screen.getByTestId("ward-help-ask-input"), { target: { value: "bed qzxvwk qzxvwl" } });
    fireEvent.click(within(screen.getAllByTestId(/^ward-help-ask-answer-/)[0]).getByRole("button"));
    const stored = [window.localStorage, window.sessionStorage]
      .flatMap((store) => Object.keys(store).map((key) => store.getItem(key) ?? ""))
      .join(" ");
    expect(stored).not.toMatch(/qzxvwk|qzxvwl/);
    expect(JSON.stringify([...write.mock.calls, ...push.mock.calls, ...replace.mock.calls])).not.toMatch(
      /qzxvwk|qzxvwl/,
    );
    expect(window.location.href).toBe(before);
  });

  it("counts an answer as used when someone opens it, as its id only", () => {
    window.localStorage.removeItem(HELP_USED_STORAGE_KEY);
    renderAsk();
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
