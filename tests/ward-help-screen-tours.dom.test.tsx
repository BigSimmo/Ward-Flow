import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Show me around (Josh, 2 Nov 2026: "more interactive tutorials where things are highlighted",
 * with no help marks added to the screens themselves). Each main screen has a short walk round that
 * Show me plays from Help's "On this screen" card. Steps marked for one device are skipped on the
 * other, walk-rounds stay out of the desk's job list, and new jobs cover screens that had none.
 * That each step's test id still exists in the source is checked in `ward-help-howto.test.ts`.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow", deskHome: "/ward-flow" }),
}));

const phone = vi.hoisted(() => ({ on: false }));
vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => phone.on,
}));

import { SCREEN_HELP } from "@/components/ward-management/help/ward-help-content";
import { askHelp, closestHowTos, HOW_TOS, showMeSteps } from "@/components/ward-management/help/ward-help-howto";
import { HelpAroundRow } from "@/components/ward-management/help/ward-help-jobs";
import { SCREEN_TOURS } from "@/components/ward-management/help/ward-help-screen-tours";
import { tasksForDesk } from "@/components/ward-management/help/ward-help-task-list";

afterEach(() => {
  phone.on = false;
  window.localStorage.clear();
});

const CAPACITY = { ...SCREEN_HELP.capacity, id: "capacity" };
/**
 * Page walk rounds: Help matches these pages by address, not by rail entry (2 Nov 2026), each with
 * an address it plays on. Detail and stand-alone pages joined them on 5 Nov 2026.
 */
const PAGE_WALK_PATHS: Readonly<Record<string, string>> = {
  ward: "/ward-flow/ward/fsh-adult-secure",
  "ed-board": "/ward-flow/ed/fsh-ed",
  patient: "/ward-flow/movements/m1",
  "add-patient": "/ward-flow/people/new",
  board: "/ward-flow/board/fsh-adult-secure",
  "ward-answer": "/ward-flow/ward/fsh-adult-secure/answer",
  catchments: "/ward-flow/hub/catchments",
  "community-team": "/ward-flow/community/armadale",
  settings: "/ward-flow/settings",
  downtime: "/ward-flow/reports/downtime",
  "bed-meeting-agenda": "/ward-flow/bed-meeting/agenda",
  chronology: "/ward-flow/reports/chronology",
  "statistics-compare": "/ward-flow/statistics/compare",
  "statistics-services": "/ward-flow/statistics/services",
  "statistics-wards": "/ward-flow/statistics/wards",
  "statistics-eds": "/ward-flow/statistics/eds",
  "statistics-teams": "/ward-flow/statistics/teams",
  "statistics-weekly": "/ward-flow/statistics/weekly",
  night: "/ward-flow/night",
};
const PAGE_WALKS = Object.keys(PAGE_WALK_PATHS);

function renderCapacity(onShowMe = vi.fn(), showMeOn = true) {
  render(
    <HelpAroundRow
      role="coordinator"
      home="/ward-flow"
      pathname="/ward-flow/capacity"
      screen={CAPACITY}
      onShowMe={onShowMe}
      showMeOn={showMeOn}
    />,
  );
  return onShowMe;
}

describe("Show me around: the walk-rounds", () => {
  it("has one walk round per known screen, each walkable on a computer and a phone", () => {
    const screens = SCREEN_TOURS.map((tour) => tour.around);
    expect(new Set(screens).size).toBe(screens.length);
    for (const tour of SCREEN_TOURS) {
      // A rail screen opens first; a page walk round (one ward, one ED board) plays where it is opened.
      if (PAGE_WALKS.includes(tour.around!)) expect(tour.go, tour.id).toBeUndefined();
      else {
        expect(SCREEN_HELP[tour.around!], tour.id).toBeDefined();
        expect(tour.go, tour.id).toBe(tour.around);
      }
      expect(showMeSteps(tour, "desk").length, `${tour.id} desk`).toBeGreaterThanOrEqual(2);
      expect(showMeSteps(tour, "phone").length, `${tour.id} phone`).toBeGreaterThanOrEqual(2);
      expect(HOW_TOS).toContain(tour);
    }
  });

  it("walks every rail screen with help, except a redirect and a sheet", () => {
    const walked = new Set(SCREEN_TOURS.map((tour) => tour.around));
    const unwalked = Object.keys(SCREEN_HELP).filter((screen) => !walked.has(screen));
    expect(unwalked.sort()).toEqual(["bed-finder", "community"]);
  });

  it("keeps each walk round between two and seven steps on each device", () => {
    for (const tour of SCREEN_TOURS) {
      for (const device of ["desk", "phone"] as const) {
        const steps = showMeSteps(tour, device).length;
        expect(steps, `${tour.id} ${device}`).toBeLessThanOrEqual(7);
      }
    }
  });

  it("offers each page walk round on its own page, under the page's own help", async () => {
    const { screenHelpFor } = await import("@/components/ward-management/help/ward-help-content");
    const { walkPlaysHere } = await import("@/components/ward-management/help/ward-help-screen-tours");
    for (const [screen, path] of Object.entries(PAGE_WALK_PATHS)) {
      const tour = SCREEN_TOURS.find((each) => each.around === screen);
      expect(tour, screen).toBeDefined();
      expect(screenHelpFor(path, [])?.id, path).toBe(screen);
      expect(walkPlaysHere(tour!, path), path).toBe(true);
      expect(walkPlaysHere(tour!, "/ward-flow/alerts"), screen).toBe(false);
    }
    // The patient record's walk round never plays on Add patient, which shares its address shape.
    const patient = SCREEN_TOURS.find((each) => each.around === "patient")!;
    expect(walkPlaysHere(patient, "/ward-flow/people/new")).toBe(false);
    expect(walkPlaysHere(patient, "/ward-flow/people/p1")).toBe(true);
  });

  it("skips a step marked for the other device", () => {
    const capacity = SCREEN_TOURS.find((tour) => tour.id === "around-capacity")!;
    const desk = showMeSteps(capacity, "desk").map((step) => step.title);
    const onPhone = showMeSteps(capacity, "phone").map((step) => step.title);
    expect(desk).toContain("Bed meeting and TV");
    expect(onPhone).not.toContain("Bed meeting and TV");
    expect(onPhone).toContain("Mismatch");
  });

  it("stays out of the desk's job list and the closest suggestions", () => {
    for (const role of ["coordinator", "ward", "ed", "executive"] as const) {
      expect(tasksForDesk(role).some((task) => task.around)).toBe(false);
    }
    expect(closestHowTos("beds giraffe", "coordinator").some(({ howTo }) => howTo.around)).toBe(false);
  });

  it("is found when asked for by name", () => {
    expect(askHelp("show me around capacity", "coordinator")[0]?.howTo.id).toBe("around-capacity");
    expect(askHelp("explain the legal forms screen", "ward")[0]?.howTo.id).toBe("around-legal-forms");
  });

  it("never describes ranking, placing or working out a legal time", () => {
    const words = JSON.stringify(SCREEN_TOURS);
    expect(words).not.toMatch(/best (match|ward)|recommended|risk score|auto(-| )?(place|release)|due in|countdown/i);
  });
});

describe("Show me around: in Help's slate top", () => {
  it("offers the screen's walk round first and plays it with Show me", () => {
    const onShowMe = renderCapacity();
    const tile = screen.getByTestId("ward-help-show-me-around");
    expect(tile.textContent).toMatch(/Show me around this screen/);
    // Josh's fifth notes (8 Nov 2026): Nearest ready beds is a phone-only step now.
    expect(tile.textContent).toMatch(/5 steps/);
    fireEvent.click(within(tile).getByRole("button", { name: /^Start/ }));
    expect(onShowMe).toHaveBeenCalledWith("around-capacity");
  });

  it("counts only the phone's own steps on a phone", () => {
    phone.on = true;
    renderCapacity();
    expect(screen.getByTestId("ward-help-show-me-around").textContent).toMatch(/3 steps/);
  });

  it("is not offered when Show me is switched off", () => {
    renderCapacity(vi.fn(), false);
    expect(screen.queryByTestId("ward-help-show-me-around")).toBeNull();
  });
});

describe("New highlighted jobs", () => {
  it("answer the way staff ask, for the desks that do them", () => {
    expect(askHelp("find the on-call registrar", "ed")[0]?.howTo.id).toBe("find-on-call");
    expect(askHelp("record a new legal form", "ward")[0]?.howTo.id).toBe("record-legal-form");
    expect(askHelp("record seclusion", "ward")[0]?.howTo.id).toBe("record-seclusion");
    expect(askHelp("repatriation back home", "coordinator")[0]?.howTo.id).toBe("plan-return-home");
    expect(askHelp("discharge held up", "ward")[0]?.howTo.id).toBe("clear-held-up-discharge");
  });

  it("are listed only for desks that may record them", () => {
    const ids = (role: Parameters<typeof tasksForDesk>[0]) => tasksForDesk(role).map((task) => task.id);
    expect(ids("coordinator")).toEqual(expect.arrayContaining(["plan-return-home", "record-seclusion"]));
    expect(ids("ward")).not.toContain("plan-return-home");
    expect(ids("executive")).not.toContain("record-legal-form");
  });
});

describe("Show me around a page", () => {
  it("walks one ward and one ED board where they are open, with a printed guide each", () => {
    for (const id of ["around-ward", "around-ed-board"]) {
      const tour = SCREEN_TOURS.find((each) => each.id === id)!;
      expect(tour.go, id).toBeUndefined();
      expect(tour.title, id).toMatch(/^Show me around this /);
    }
    expect(askHelp("show me around this ward", "ward")[0]?.howTo.id).toBe("around-ward");
  });
});

describe("Show me around a page: where it is offered", () => {
  it("plays only on its own page, and only for desks that open that page", async () => {
    const { walkPlaysHere } = await import("@/components/ward-management/help/ward-help-screen-tours");
    const { howToFor } = await import("@/components/ward-management/help/ward-help-access");
    const ward = SCREEN_TOURS.find((each) => each.id === "around-ward")!;
    const ed = SCREEN_TOURS.find((each) => each.id === "around-ed-board")!;
    expect(walkPlaysHere(ward, "/ward-flow/ward/fsh-adult-secure")).toBe(true);
    expect(walkPlaysHere(ward, "/ward-flow/alerts")).toBe(false);
    expect(walkPlaysHere(ed, "/ward-flow/ed/fsh-ed")).toBe(true);
    expect(walkPlaysHere(ed, "/ward-flow/ed")).toBe(false);
    expect(
      walkPlaysHere(
        SCREEN_TOURS.find((each) => each.id === "around-capacity")!,
        "/anywhere",
      ),
    ).toBe(true);
    expect(howToFor(ed, "ed")).toBe(true);
    expect(howToFor(ed, "officer")).toBe(false);
  });
});
