import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import { DESK_GUIDES, SAVED_OR_NOT } from "@/components/ward-management/help/ward-help-guide";
import { WardHelpLink } from "@/components/ward-management/help/ward-help-link";
import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";
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
  it("finds the screen by the longest matching rail address", () => {
    const entries = railEntries();
    expect(screenHelpFor("/ward-flow/movements", entries)?.title).toBe("Movements");
    expect(screenHelpFor("/ward-flow", entries)?.title).toBe("Home");
    expect(screenHelpFor("/ward-flow/capacity/anything", entries)?.title).toBe("Capacity");
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

  it("offers the desk guide on a screen with no help page, instead of Home's help", () => {
    route.pathname = "/ward-flow/settings";
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

  it("starts the tour from its own button", () => {
    const onView = vi.fn();
    render(<WardHelpSheet view="screen" onView={onView} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    expect(onView).toHaveBeenCalledWith("tour");
  });
});

describe("rail Help row", () => {
  it("says New and opens the tour until the tour is seen, then opens screen help", async () => {
    const opened: string[] = [];
    const listener = (event: Event) => opened.push((event as CustomEvent<{ view: string }>).detail.view);
    window.addEventListener("ward-flow-open-help", listener);
    render(<WardHelpLink classes={classes} showTitle={false} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Help, new: take the tour" })).toBeTruthy());
    fireEvent.click(screen.getByTestId("ward-rail-help"));
    act(() => markTourSeen("coordinator"));
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(opened).toEqual(["tour", "screen"]);
    window.removeEventListener("ward-flow-open-help", listener);
  });
});
