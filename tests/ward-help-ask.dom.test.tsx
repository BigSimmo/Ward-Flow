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

function renderSheet(ask: string | undefined) {
  return render(<WardHelpSheet view="screen" ask={ask} onView={vi.fn()} onClose={vi.fn()} />);
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

  it.each(["what dose should I give", "should I discharge transport", "medication dark mode"])(
    "shows only the approved reply for a clinical question: %s",
    (query) => {
      renderSheet(query);
      const reply = screen.getByTestId("ward-help-ask-clinical");
      expect(reply.textContent).toBe(CLINICAL_REPLY);
      expect(reply.closest('[aria-live="polite"]')).toBeTruthy();
      const ask = within(screen.getByTestId("ward-help-ask"));
      expect(ask.queryAllByTestId(/^ward-help-ask-answer-/)).toHaveLength(0);
      expect(ask.queryByTestId("ward-help-ask-setting")).toBeNull();
      expect(ask.queryByText("Words")).toBeNull();
      expect(ask.queryByTestId("ward-help-ask-closest")).toBeNull();
      expect(ask.queryByTestId("ward-help-ask-stuck")).toBeNull();
    },
  );

  it("offers at most three closest topics in the live region and opens their answers", () => {
    renderSheet("bed giraffe elephant");
    expect(screen.getByTestId("ward-help-ask-closest").textContent).toContain(
      "Check the spelling, or try one of these closest topics.",
    );
    const answers = screen.getAllByTestId(/^ward-help-ask-answer-/);
    expect(answers.length).toBeGreaterThan(0);
    expect(answers.length).toBeLessThanOrEqual(3);
    expect(answers[0].closest('[aria-live="polite"]')).toBeTruthy();
    const title = within(answers[0]).getByRole("button");
    fireEvent.click(title);
    expect(title.getAttribute("aria-expanded")).toBe("true");
    fireEvent.change(screen.getByTestId("ward-help-ask-input"), { target: { value: "dark mode" } });
    expect(screen.queryByTestId("ward-help-ask-closest")).toBeNull();
    expect(screen.getByTestId("ward-help-ask-answer-theme")).toBeTruthy();
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
    fireEvent.change(screen.getByTestId("ward-help-ask-input"), { target: { value: "pull a bed" } });
    expect(screen.queryByTestId("ward-help-ask-clinical")).toBeNull();
    expect(screen.getByTestId("ward-help-ask-answer-pull-bed")).toBeTruthy();
  });

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

  it("never writes the typed question to storage or URL history, including after opening a suggestion", () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    const before = window.location.href;
    renderSheet("");
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
