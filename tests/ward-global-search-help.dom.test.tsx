import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const router = { push: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => router,
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CLINICAL_REPLY } from "@/components/ward-management/help/ward-help-search-index";
import { WardGlobalSearch } from "@/components/ward-management/ward-global-search";
import { headerHelpRows, helpPreviewAnswer } from "@/components/ward-management/ward-global-search-help";
import type { HelpPreviewSource, SearchResultItem } from "@/components/ward-management/ward-global-search-groups";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import { allUnits } from "@/components/ward-management/ward-sites";

const units = allUnits();

const answer: SearchResultItem = {
  kind: "help",
  kindLabel: "Help",
  id: "howto:pull",
  title: "Pull a bed",
  meta: "Hold a ready bed for someone coming.",
  href: "",
};

function renderSearch(
  findHelp: (query: string) => { items: SearchResultItem[]; note?: string },
  onHelpResult = vi.fn(() => true),
  helpPreview?: HelpPreviewSource,
) {
  const onNavigate = vi.fn();
  render(
    <WardGlobalSearch
      movements={wardMovements}
      patients={wardPatients}
      units={units}
      onNavigate={onNavigate}
      findHelp={findHelp}
      onHelpResult={onHelpResult}
      helpPreview={helpPreview}
    />,
  );
  const input = screen.getByTestId("ward-global-search-input");
  fireEvent.focus(input);
  return { input, onHelpResult, onNavigate };
}

describe("Help in the header search (search and forms review, 31 Oct 2026)", () => {
  it("lists Help's answers in a Help group, first for a how-to question, with a Help chip", () => {
    const { input } = renderSearch(() => ({ items: [answer] }));
    fireEvent.change(input, { target: { value: "how do I pull a bed" } });
    const popup = screen.getByTestId("ward-global-search-popup");
    const row = within(popup).getByTestId("ward-global-search-result-help-howto:pull");
    expect(row).toHaveTextContent("Pull a bed");
    const firstRow = within(popup).getAllByRole("option")[0];
    expect(firstRow).toBe(row);
    expect(within(popup).getByRole("button", { name: /^Help/ })).toBeInTheDocument();
  });

  it("runs the Help action on Enter instead of navigating, and clears the box", () => {
    const { input, onHelpResult, onNavigate } = renderSearch(() => ({ items: [answer] }));
    fireEvent.change(input, { target: { value: "how do I pull a bed" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onHelpResult).toHaveBeenCalledWith("howto:pull");
    expect(onNavigate).not.toHaveBeenCalled();
    expect(input).toHaveValue("");
  });

  it("shows an answer with nowhere to go as a button, not a link, and opens it in Help on a click", () => {
    const { input, onHelpResult, onNavigate } = renderSearch(() => ({ items: [answer] }));
    fireEvent.change(input, { target: { value: "how do I pull a bed" } });
    const row = within(screen.getByTestId("ward-global-search-popup")).getByTestId(
      "ward-global-search-result-help-howto:pull",
    );
    expect(row.tagName).toBe("BUTTON");
    expect(row).not.toHaveAttribute("href");
    fireEvent.click(row);
    expect(onHelpResult).toHaveBeenCalledWith("howto:pull");
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("follows the row's own link when the Help action declines it", () => {
    const go = { ...answer, href: "/ward-flow/capacity" };
    const { input, onNavigate } = renderSearch(
      () => ({ items: [go] }),
      vi.fn(() => false),
    );
    fireEvent.change(input, { target: { value: "how do I pull a bed" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onNavigate).toHaveBeenCalledWith("/ward-flow/capacity");
  });

  it("shows Help's fixed reply to a clinical question", () => {
    const { input } = renderSearch(() => ({ items: [], note: CLINICAL_REPLY }));
    fireEvent.change(input, { target: { value: "what dose of olanzapine" } });
    expect(screen.getByTestId("ward-global-search-help-note")).toHaveTextContent(CLINICAL_REPLY);
  });

  it("previews a Help answer with its steps, Show me and Open in Help, closing the search first (1 Nov 2026)", () => {
    const helpPreview = {
      answerFor: vi.fn(() => ({ steps: [{ title: "Open the movement", body: "From Movements." }], showMe: true })),
      showMe: vi.fn(),
      openInHelp: vi.fn(),
    };
    const { input } = renderSearch(
      () => ({ items: [answer] }),
      vi.fn(() => true),
      helpPreview,
    );
    fireEvent.change(input, { target: { value: "how do I pull a bed" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const pane = screen.getByTestId("ward-global-search-preview-help-answer");
    expect(pane).toHaveTextContent("Hold a ready bed for someone coming.");
    expect(within(pane).getByRole("list", { name: "Steps" })).toHaveTextContent("Open the movement");
    fireEvent.click(within(pane).getByTestId("ward-global-search-preview-show-me"));
    expect(helpPreview.showMe).toHaveBeenCalledWith("howto:pull");
    expect(input).toHaveValue("");
  });

  it("never asks Help about a refused query", () => {
    const findHelp = vi.fn(() => ({ items: [answer] }));
    const { input } = renderSearch(findHelp);
    fireEvent.change(input, { target: { value: "best match" } });
    expect(screen.getByTestId("ward-global-search-refusal")).toBeInTheDocument();
    expect(findHelp).not.toHaveBeenCalledWith("best match");
  });
});

describe("helpPreviewAnswer", () => {
  it("gives a listed answer's Show me steps, and Show me only for this desk with the switch on", () => {
    const [row] = headerHelpRows("how do I pull a bed", "coordinator").items;
    expect(row).toBeDefined();
    const id = row?.id ?? "";
    expect(helpPreviewAnswer(id, "coordinator", true)?.steps.length).toBeGreaterThan(0);
    expect(helpPreviewAnswer(id, "coordinator", true)?.showMe).toBe(true);
    expect(helpPreviewAnswer(id, "coordinator", false)?.showMe).toBe(false);
    expect(helpPreviewAnswer("not-listed", "coordinator", true)).toBeUndefined();
  });
});

describe("headerHelpRows", () => {
  it("returns the clinical reply and no rows for a clinical question", () => {
    expect(headerHelpRows("what dose should I give", "coordinator")).toEqual({ items: [], note: CLINICAL_REPLY });
  });

  it("returns at most three Help rows for an app question, each a help row", () => {
    const rows = headerHelpRows("how do I book transport", "coordinator").items;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(3);
    expect(rows.every((row) => row.kind === "help")).toBe(true);
  });

  it("asks nothing of Help for one or two letters", () => {
    expect(headerHelpRows("be", "coordinator").items).toEqual([]);
  });
});
