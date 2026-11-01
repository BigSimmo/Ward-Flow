import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Help (fix plan item 12, 21 Oct 2026): what each screen is for, a glossary and the way into each
 * desk's tour (`ward-tour.dom.test.tsx`). The rail's Help row says "New" until the tour is seen or
 * closed, and Settings can replay it.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/ward-flow/movements" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow", deskHome: "/ward-flow" }),
}));

import {
  GLOSSARY,
  SCREEN_HELP,
  filterGlossary,
  screenHelpFor,
} from "@/components/ward-management/help/ward-help-content";
import { COLOUR_LEGEND } from "@/components/ward-management/help/ward-help-legend";
import { DESK_GUIDES, SAVED_OR_NOT, WHEN_IT_IS_DOWN } from "@/components/ward-management/help/ward-help-guide";
import { WF_PHONE_QUERY } from "@/components/wf/use-is-phone";
import { WardHelpLink } from "@/components/ward-management/help/ward-help-link";
import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";
import { WHATS_NEW } from "@/components/ward-management/help/ward-whats-new";
import {
  TOUR_SEEN_STORAGE_KEY,
  TOUR_STEP_STORAGE_KEY,
  markTourSeen,
  parseTourSeen,
  parseTourSteps,
  readTourStep,
  resetTourSeenForTests,
  saveTourStep,
} from "@/components/ward-management/help/ward-help-store";
import type { HelpView } from "@/components/ward-management/help/ward-help-events";
import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";
import { endWardFlowBrowserSession } from "@/components/ward-management/ward-browser-data";
import { siteDirectory } from "@/components/ward-management/ward-sites";

const classes = { button: "b", glyph: "g", text: "t", line: "l", label: "x" };

beforeEach(() => {
  route.pathname = "/ward-flow/movements";
  resetTourSeenForTests();
  if (typeof window.requestAnimationFrame !== "function") {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
  }
});

afterEach(() => resetTourSeenForTests());

describe("help content", () => {
  it("finds the screen by its own rail address, so Home never stands in for another page", () => {
    const entries = railEntries();
    expect(screenHelpFor("/ward-flow/movements", entries)?.title).toBe("Movements");
    expect(screenHelpFor("/ward-flow", entries)?.title).toBe("Home");
    expect(screenHelpFor("/ward-flow/capacity/anything", entries)).toBeUndefined();
  });

  it("keeps every screen to at most three main actions", () => {
    for (const help of Object.values(SCREEN_HELP)) expect(help.actions.length).toBeLessThanOrEqual(3);
  });

  it("sorts the glossary, includes site codes and filters by word or meaning", () => {
    const terms = GLOSSARY.map((entry) => entry.term);
    expect(terms).toEqual(terms.toSorted((left, right) => left.localeCompare(right, "en-AU")));
    expect(new Set(terms).size).toBe(terms.length);
    for (const site of siteDirectory) expect(terms).toContain(site.code);
    expect(filterGlossary("nurse unit").map((entry) => entry.term)).toEqual(["NUM"]);
    expect(filterGlossary("  ")).toBe(GLOSSARY);
  });
});

describe("tour seen store", () => {
  it("keeps known desk ids only, the access admin among them", () => {
    expect(parseTourSeen("ward,Jane,ed,admin,")).toEqual(["ward", "ed", "admin"]);
  });

  it("remembers where each desk's tour was left as role ids and step numbers only", () => {
    expect([...parseTourSteps("ward:3,Jane:2,ed:x,officer:-1,admin:1")]).toEqual([
      ["ward", 3],
      ["admin", 1],
    ]);
    saveTourStep("ward", 4);
    saveTourStep("ed", 2);
    expect(readTourStep("ward")).toBe(4);
    saveTourStep("ward", 0);
    expect(readTourStep("ward")).toBe(0);
    expect(window.localStorage.getItem(TOUR_STEP_STORAGE_KEY)).toBe("ed:2");
  });

  it("survives sign-out, because it holds nothing about a person", () => {
    markTourSeen("ward");
    endWardFlowBrowserSession();
    expect(window.localStorage.getItem(TOUR_SEEN_STORAGE_KEY)).toBe("ward");
  });
});

function sheet(view: HelpView, extra: { onView?: (view: HelpView) => void; onTour?: () => void } = {}) {
  return render(
    <WardHelpSheet
      view={view}
      onView={extra.onView ?? vi.fn()}
      onClose={vi.fn()}
      onTour={extra.onTour ?? vi.fn()}
      onShowMe={vi.fn()}
    />,
  );
}

describe("help sheet", () => {
  it("shows the current screen's purpose, with its main actions folded under How this screen works", () => {
    sheet("screen");
    const here = screen.getByTestId("ward-help-tasks-here");
    expect(here.textContent).toContain(SCREEN_HELP.movements.purpose);
    const works = within(here).getByRole("button", { name: "How this screen works" });
    expect(works.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(works);
    for (const action of SCREEN_HELP.movements.actions) expect(here.textContent).toContain(action);
  });

  it("answers the screen's own questions one at a time and offers the keyboard shortcuts at the foot", () => {
    route.pathname = "/ward-flow/handover";
    const onView = vi.fn();
    sheet("questions", { onView });
    const questions = screen.getByRole("region", { name: "On Handover" });
    const question = within(questions).getByRole("button", { name: /How do I hand over to the next shift\?/ });
    // Each answer is folded until asked for.
    expect(question.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(question);
    expect(question.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByTestId("ward-help-shortcuts"));
    expect(onView).toHaveBeenCalledWith("keys");
  });

  it("draws no screen card on a screen with no help page, instead of Home's help", () => {
    route.pathname = "/ward-flow/constellation";
    sheet("screen");
    expect(screen.queryByTestId("ward-help-tasks-here")).toBeNull();
    expect(screen.getByTestId("ward-help-tasks")).toBeTruthy();
  });

  it("lists the glossary in Reference, with Help's one search box only (Josh, 31 Oct 2026)", () => {
    sheet("glossary");
    expect(screen.queryByTestId("ward-help-glossary-filter")).toBeNull();
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Glossary/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("CAD number")).toBeTruthy();
    // Short forms are under Codes.
    fireEvent.click(screen.getByRole("button", { name: /Codes/ }));
    const short = screen.getByRole("region", { name: "Services and short forms" });
    const more = within(short).queryByRole("button", { name: /^Show \d+ more/ });
    if (more) fireEvent.click(more);
    expect(within(short).getByText("ECT")).toBeTruthy();
  });

  it("shows the signed-in desk's guide as Your desk: where it starts and how to tell it saved", () => {
    sheet("desk");
    const desk = screen.getByRole("region", { name: "Where you start" }).parentElement as HTMLElement;
    expect(desk.textContent).toContain(DESK_GUIDES.coordinator.summary);
    expect(desk.textContent).toContain(DESK_GUIDES.coordinator.startsAt);
    expect(screen.getByRole("region", { name: "Is it saved?" }).textContent).toContain(SAVED_OR_NOT[0]);
    expect(screen.getByRole("button", { name: "Back to Help" })).toBeTruthy();
  });

  it("carries one synthetic line, in the footer only", () => {
    sheet("tasks");
    expect(screen.getAllByText(/synthetic/i)).toHaveLength(1);
    expect(screen.getByTestId("ward-help-synthetic").textContent).toMatch(/Synthetic prototype/);
  });

  it("gives every desk a plain guide that never ranks, scores or calls an incoming bed held", () => {
    for (const [role, guide] of Object.entries(DESK_GUIDES)) {
      expect(guide.jobs.length, role).toBeGreaterThanOrEqual(3);
      expect(guide.jobs.length, role).toBeLessThanOrEqual(6);
      const words = JSON.stringify(guide).toLowerCase();
      expect(words, role).not.toMatch(/best match|risk score|acuity|recommended ward|hold the bed|bed hold/);
    }
  });

  it("says what to do when Ward Flow is down, on every desk's guide (PR-20)", () => {
    sheet("desk");
    expect(screen.getByRole("region", { name: "If Ward Flow is down" }).textContent).toContain(WHEN_IT_IS_DOWN[0]);
  });

  it("shows the colour code in Reference, one glyph and meaning per tone", () => {
    sheet("reference");
    fireEvent.click(screen.getByRole("button", { name: /Colours/ }));
    const legend = screen.getByRole("region", { name: "Colours and marks" });
    expect(legend.querySelectorAll("svg")).toHaveLength(COLOUR_LEGEND.length);
    for (const entry of COLOUR_LEGEND) expect(legend.textContent).toContain(entry.meaning);
  });

  it("reads a phone no keyboard hints (HF-14)", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === WF_PHONE_QUERY,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      route.pathname = "/ward-flow/referrals";
      sheet("screen");
      const here = screen.getByTestId("ward-help-tasks-here");
      expect(here.textContent).toContain("Tap a referral to open it");
      expect(here.textContent).not.toMatch(/keyboard|J and K/);
      expect(screen.queryByTestId("ward-help-shortcuts")).toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });

  it("starts the tour only from its own row in How do I…", () => {
    const onTour = vi.fn();
    sheet("screen", { onTour });
    expect(onTour).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("ward-help-view-tour"));
    expect(onTour).toHaveBeenCalledTimes(1);
  });

  it("lists recent changes, newest first, under What's new", () => {
    sheet("new");
    const list = screen.getByTestId("ward-help-new");
    const shown = Math.min(WHATS_NEW.length, 10);
    expect(list.querySelectorAll("p")).toHaveLength(shown);
    expect(list.querySelector("p")?.textContent).toContain(
      ((WHATS_NEW.at(-1) as { line: string }).line.split(": ").at(-1) ?? "").slice(1),
    );
  });
});

describe("rail Help row", () => {
  it("says New until the tour is seen, and always opens How do I…, never the tour (Josh, 31 Oct 2026)", async () => {
    const opened: string[] = [];
    const listener = (event: Event) => opened.push((event as CustomEvent<{ view: string }>).detail.view);
    window.addEventListener("ward-flow-open-help", listener);
    render(<WardHelpLink classes={classes} showTitle={false} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Help, new" })).toBeTruthy());
    fireEvent.click(screen.getByTestId("ward-rail-help"));
    act(() => markTourSeen("coordinator"));
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(opened).toEqual(["tasks", "tasks"]);
    window.removeEventListener("ward-flow-open-help", listener);
  });
});
