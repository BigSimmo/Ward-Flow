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
import { WardHelpHost } from "@/components/ward-management/help/ward-help-host";
import { HOW_TOS, showMeSteps } from "@/components/ward-management/help/ward-help-howto";
import { tasksForDesk } from "@/components/ward-management/help/ward-help-task-list";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { askWardHelp } from "@/components/ward-management/help/ward-help-events";
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
