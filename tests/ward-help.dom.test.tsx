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

function Harness({ initial }: { initial: HelpView }) {
  return <WardHelpSheet view={initial} onView={vi.fn()} onClose={vi.fn()} />;
}

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

describe("help sheet", () => {
  it("shows the current screen's purpose and actions", () => {
    render(<Harness initial="screen" />);
    expect(screen.getByTestId("ward-help-screen").textContent).toContain(SCREEN_HELP.movements.purpose);
  });

  it("answers the screen's own questions one at a time and offers the keyboard shortcuts at the foot", () => {
    route.pathname = "/ward-flow/handover";
    const onShortcuts = vi.fn();
    render(<WardHelpSheet view="screen" onView={vi.fn()} onClose={vi.fn()} onShortcuts={onShortcuts} />);
    const questions = screen.getByTestId("ward-help-questions");
    const question = within(questions).getByRole("button", { name: "How do I hand over to the next shift?" });
    // Redesign (#1118): each answer is folded until asked for.
    expect(question.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(question);
    expect(question.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByTestId("ward-help-shortcuts"));
    expect(onShortcuts).toHaveBeenCalledTimes(1);
  });

  it("offers the desk guide on a screen with no help page, instead of Home's help", () => {
    route.pathname = "/ward-flow/constellation";
    const onView = vi.fn();
    render(<WardHelpSheet view="screen" onView={onView} onClose={vi.fn()} />);
    expect(screen.queryByTestId("ward-help-screen")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open your desk guide" }));
    expect(onView).toHaveBeenCalledWith("desk");
  });

  it("filters the glossary as you type, without saving the words", () => {
    render(<Harness initial="glossary" />);
    fireEvent.change(screen.getByTestId("ward-help-glossary-filter"), { target: { value: "St John" } });
    expect(screen.getByText("CAD number")).toBeTruthy();
    expect(screen.queryByText("ECT")).toBeNull();
    expect(JSON.stringify({ ...window.localStorage })).not.toContain("St John");
  });

  it("shows the signed-in desk's guide: where it starts, its jobs and how to tell it saved", () => {
    render(<Harness initial="desk" />);
    const desk = screen.getByTestId("ward-help-desk");
    expect(desk.textContent).toContain(DESK_GUIDES.coordinator.summary);
    for (const item of DESK_GUIDES.coordinator.jobs) expect(desk.textContent).toContain(item.how);
    expect(desk.textContent).toContain(SAVED_OR_NOT[0]);
  });

  it("links each job to the screen where it is done, and closes Help on the way", () => {
    const onClose = vi.fn();
    render(<WardHelpSheet view="desk" onView={vi.fn()} onClose={onClose} />);
    const links = screen.getAllByTestId("ward-help-go");
    expect(links).toHaveLength(DESK_GUIDES.coordinator.jobs.length);
    const decide = screen.getByRole("link", { name: "Decide a referral: go to Referrals" });
    expect(decide.getAttribute("href")).toBe("/ward-flow/referrals");
    fireEvent.click(decide);
    expect(onClose).toHaveBeenCalledTimes(1);
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
    render(<Harness initial="desk" />);
    expect(screen.getByTestId("ward-help-downtime").textContent).toContain(WHEN_IT_IS_DOWN[0]);
  });

  it("shows the colour code under Reference in the Glossary tab, one glyph and meaning per tone", () => {
    render(<Harness initial="glossary" />);
    const legend = screen.getByTestId("ward-help-legend");
    expect(legend.querySelectorAll("dt")).toHaveLength(COLOUR_LEGEND.length);
    expect(legend.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(COLOUR_LEGEND.length);
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
      render(<WardHelpSheet view="screen" onView={vi.fn()} onClose={vi.fn()} />);
      expect(screen.getByTestId("ward-help-screen").textContent).toContain("Tap a referral to open it");
      expect(screen.getByTestId("ward-help-screen").textContent).not.toMatch(/keyboard|J and K/);
      expect(screen.queryByTestId("ward-help-shortcuts")).toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });

  it("starts the tour from its own button", () => {
    const onView = vi.fn();
    render(<WardHelpSheet view="screen" onView={onView} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    expect(onView).toHaveBeenCalledWith("tour");
  });

  it("lists recent changes, newest first, under What's new", () => {
    render(<WardHelpSheet view="new" onView={vi.fn()} onClose={vi.fn()} />);
    const items = within(screen.getByTestId("ward-help-new")).getAllByRole("listitem");
    expect(items).toHaveLength(WHATS_NEW.length);
    expect(items[0]?.textContent).toContain((WHATS_NEW.at(-1) as { line: string }).line);
  });
});

describe("rail Help row", () => {
  it("says New and opens the tour until the tour is seen, then opens How do I… (D-90)", async () => {
    const opened: string[] = [];
    const listener = (event: Event) => opened.push((event as CustomEvent<{ view: string }>).detail.view);
    window.addEventListener("ward-flow-open-help", listener);
    render(<WardHelpLink classes={classes} showTitle={false} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Help, new: take the tour" })).toBeTruthy());
    fireEvent.click(screen.getByTestId("ward-rail-help"));
    act(() => markTourSeen("coordinator"));
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(opened).toEqual(["tour", "tasks"]);
    window.removeEventListener("ward-flow-open-help", listener);
  });
});
