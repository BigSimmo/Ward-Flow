import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/discharges",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow", deskHome: "/ward-flow" }),
}));
import { HelpFindResults, type HelpFound } from "@/components/ward-management/help/ward-help-find";
import { setWardAccess, resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import type { WardAccessScope } from "@/components/ward-management/ward-role-access";
import { WardHelpHost } from "@/components/ward-management/help/ward-help-host";
import { HOW_TOS, showMeSteps } from "@/components/ward-management/help/ward-help-howto";
import { tasksForDesk } from "@/components/ward-management/help/ward-help-task-list";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { askWardHelp, showWardHowTo } from "@/components/ward-management/help/ward-help-events";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";
import {
  headerHelpRows,
  helpPreviewAnswer,
  openHelpResult,
} from "@/components/ward-management/ward-global-search-help";
afterEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});
describe("Help request identity and eligibility", () => {
  it("preserves a header answer query when Show me is off", async () => {
    act(() => setWardFeatureFlagOnDevice("help-ask", false));
    render(<WardHelpHost />);
    act(() => askWardHelp("Print the handover sheet"));
    expect(await screen.findByTestId("ward-help-search")).toHaveValue("Print the handover sheet");
  });
  it("opens a second Help link at its own answer while Help remains mounted", async () => {
    window.history.replaceState(null, "", "/ward-flow/discharges#help=clear-held-up-discharge");
    render(<WardHelpHost />);
    const first = await screen.findByTestId("ward-help-task-answer-clear-held-up-discharge");
    expect(within(first).getByRole("button", { expanded: true })).toBeTruthy();
    act(() => {
      window.history.replaceState(null, "", "/ward-flow/discharges#help=print-handover");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() =>
      expect(
        within(screen.getByTestId("ward-help-task-answer-print-handover")).getByRole("button", { expanded: true }),
      ).toBeTruthy(),
    );
  });
  it("keeps a home-based supported header walkthrough available", () => {
    const row = headerHelpRows("release a pulled bed", "coordinator").items.find(
      (item) => item.id === "howto:release-pulled-bed",
    )!;
    expect(helpPreviewAnswer(row.id, "coordinator", true, false, "/ward-flow")?.showMe).toBe(true);
  });
  it("retains an internally chosen answer after an external task link", async () => {
    window.history.replaceState(null, "", "/ward-flow/discharges#help=clear-held-up-discharge");
    render(<WardHelpHost />);
    const field = await screen.findByTestId("ward-help-search");
    fireEvent.change(field, { target: { value: "Print the handover sheet" } });
    const result = await screen.findByRole("button", { name: "Open in How to" });
    fireEvent.click(result);
    await waitFor(() =>
      expect(
        within(screen.getByTestId("ward-help-task-answer-print-handover")).getByRole("button", { expanded: true }),
      ).toBeTruthy(),
    );
  });
  it("offers Rules only to statewide coordinators", () => {
    expect(tasksForDesk("coordinator", { kind: "site", siteCode: "RPH" }).some((task) => task.id === "rules")).toBe(
      false,
    );
    expect(tasksForDesk("coordinator", { kind: "statewide" }).some((task) => task.id === "rules")).toBe(true);
    const row = headerHelpRows("change pull time limit", "coordinator", { kind: "site", siteCode: "RPH" }).items.find(
      (item) => item.id === "howto:rules",
    )!;
    expect(row.href).toBe("");
    expect(
      helpPreviewAnswer(row.id, "coordinator", true, false, "/ward-flow", { kind: "site", siteCode: "RPH" })?.showMe,
    ).toBe(false);
  });
  it("omits the ward-only arrival control from a bed-manager Capacity walk", () => {
    const walk = HOW_TOS.find((task) => task.id === "around-capacity")!;
    expect(showMeSteps(walk, "desk", "bed_manager").some((step) => step.title === "Planned admissions")).toBe(false);
    expect(showMeSteps(walk, "desk", "coordinator").some((step) => step.title === "Planned admissions")).toBe(true);
  });
  it("keeps account Help memory mounted through flag-off answers and task fallback", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("help-ask", false);
      setWardFeatureFlagOnDevice("role-access", false);
    });
    const preferences = vi.fn(async (_body?: unknown) => ({
      shared: true,
      tours: [],
      tips: [],
      whatsNew: [],
      tipsOff: null,
    }));
    const reads = () => preferences.mock.calls.filter(([body]) => body === undefined).length;
    render(
      <SharedAccessContext.Provider value={{ api: { preferences } as SharedAccessApi, actorId: "synthetic-actor" }}>
        <WardHelpHost />
      </SharedAccessContext.Provider>,
    );
    await waitFor(() => expect(reads()).toBe(1));
    act(() => askWardHelp("Print the handover sheet"));
    expect(await screen.findByTestId("ward-help-search")).toHaveValue("Print the handover sheet");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("ward-help-search")).toBeNull());
    act(() => showWardHowTo("print-handover"));
    const answer = await screen.findByTestId("ward-help-task-answer-print-handover");
    expect(within(answer).getByRole("button", { expanded: true })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("ward-help-task-answer-print-handover")).toBeNull());
    expect(reads()).toBe(1);
  });
  it("does not play a computer-only task through phone header activation", () => {
    const row = headerHelpRows("Print the handover sheet", "coordinator").items.find(
      (item) => item.id === "howto:print-handover",
    )!;
    expect(row).toBeDefined();
    const heard = vi.fn();
    window.addEventListener("ward-flow-open-help", heard);
    try {
      expect(helpPreviewAnswer(row.id, "coordinator", true, true)?.showMe).toBe(false);
      openHelpResult(row.id, "coordinator", true, true);
      expect(heard.mock.calls.some(([event]) => (event as CustomEvent).detail.showMe)).toBe(false);
    } finally {
      window.removeEventListener("ward-flow-open-help", heard);
    }
  });
});

describe("visible Help BestAnswer eligibility", () => {
  function answer(id: string, role: "coordinator" | "bed_manager", scope: WardAccessScope) {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role, scope });
    });
    const task = HOW_TOS.find((item) => item.id === id)!;
    const found: HelpFound = {
      kind: "results",
      closest: false,
      groups: [],
      best: { key: `howto:${id}`, group: "Guides", title: task.title, detail: task.answer, howToId: id },
    };
    render(
      <HelpFindResults
        found={found}
        query={task.title}
        role={role}
        active={0}
        canShow={() => true}
        onShowMe={vi.fn()}
        onChoose={vi.fn()}
        onUseTyped={vi.fn()}
      />,
    );
    return within(screen.getByRole("region", { name: "Best answer" }));
  }
  afterEach(() => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", false);
      resetWardAccessStoreForTests();
    });
  });
  it.each([false, true])("Rules BestAnswer actions require statewide scope: %s", (statewide) => {
    const view = answer(
      "rules",
      "coordinator",
      statewide ? { kind: "statewide" } : { kind: "service", service: "North Metro" },
    );
    expect(Boolean(view.queryByRole("list", { name: "Steps" }))).toBe(statewide);
    expect(Boolean(view.queryByRole("button", { name: "Show me on screen" }))).toBe(statewide);
    expect(Boolean(view.queryByRole("button", { name: "Open in How to" }))).toBe(statewide);
  });
  it.each(["bed_manager", "coordinator"] as const)("Capacity BestAnswer steps match %s controls", (role) => {
    const view = answer(
      "around-capacity",
      role,
      role === "coordinator" ? { kind: "statewide" } : { kind: "site", siteCode: "RPH" },
    );
    expect(Boolean(view.queryByText("Planned admissions"))).toBe(role === "coordinator");
    expect(view.getByText("How full the beds are")).toBeTruthy();
  });
});
