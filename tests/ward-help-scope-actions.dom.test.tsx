import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const viewer = vi.hoisted(() => ({ statewide: false }));
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => ({
    role: "coordinator",
    scope: viewer.statewide ? { kind: "statewide" } : { kind: "service", service: "East Metro" },
  }),
}));
vi.mock("@/components/ward-management/help/ward-help-store", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/help/ward-help-store")>()),
  useTourRole: () => "coordinator",
}));
vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow", deskHome: "/ward-flow" }),
}));
import { WardShowMe } from "@/components/ward-management/help/ward-show-me";
import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";
import { HelpFindResults } from "@/components/ward-management/help/ward-help-find";
import { HelpTasks } from "@/components/ward-management/help/ward-help-jobs";

beforeEach(() => {
  viewer.statewide = false;
  push.mockReset();
});

describe("Help action entry points honour current statewide scope", () => {
  it.each([false, true])("secondary search rows advertise walkthroughs only for actual scope (%s)", (statewide) => {
    viewer.statewide = statewide;
    render(
      <HelpFindResults
        found={{
          kind: "results",
          closest: false,
          groups: [
            {
              name: "Jobs",
              rows: [
                {
                  key: "howto:rules",
                  group: "Settings",
                  title: "Global rules",
                  detail: "Only the statewide coordinator may change global settings.",
                  desks: ["coordinator"],
                  howToId: "rules",
                },
              ],
            },
          ],
        }}
        query="rules"
        role="coordinator"
        active={0}
        onChoose={vi.fn()}
        onShowMe={vi.fn()}
        canShow={() => statewide}
        onUseTyped={vi.fn()}
      />,
    );
    expect(Boolean(screen.queryByLabelText("Has Show me"))).toBe(statewide);
    expect(Boolean(screen.queryByText("Another desk’s job"))).toBe(!statewide);
  });

  it("blocks a directly requested global-rule walk before routing and explains the boundary", () => {
    const back = vi.fn();
    render(<WardShowMe id="rules" onClose={vi.fn()} onBack={back} />);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText("Only the statewide coordinator may change global settings.")).toBeTruthy();
    expect(screen.queryByTestId("ward-show-me-spot")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to Help" }));
    expect(back).toHaveBeenCalledOnce();
  });

  it("moves focus into the restricted notice and traps Tab inside it", async () => {
    const outside = document.createElement("button");
    outside.textContent = "Outside";
    document.body.append(outside);
    outside.focus();
    try {
      render(<WardShowMe id="rules" onClose={vi.fn()} onBack={vi.fn()} />);
      const dialog = screen.getByRole("dialog", { name: "Change the pull time limit or ED target" });
      const back = within(dialog).getByRole("button", { name: "Back to Help" });
      const close = within(dialog).getByRole("button", { name: "Close" });
      // jsdom has no layout; the Tab trap only counts controls that have a box.
      for (const button of [back, close])
        button.getClientRects = () => [new DOMRect(0, 0, 80, 32)] as unknown as DOMRectList;
      await waitFor(() => expect(document.activeElement).toBe(back));
      close.focus();
      fireEvent.keyDown(close, { key: "Tab" });
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toBe(back);
      fireEvent.keyDown(back, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(close);
    } finally {
      outside.remove();
    }
  });

  it("retains routing and the walkthrough for the statewide coordinator", () => {
    viewer.statewide = true;
    render(<WardShowMe id="rules" onClose={vi.fn()} onBack={vi.fn()} />);
    expect(push).toHaveBeenCalledWith("/ward-flow/settings#rules");
    expect(screen.getByRole("dialog", { name: "Pull time limit" })).toBeTruthy();
    expect(screen.queryByTestId("ward-show-me-restricted")).toBeNull();
  });

  it.each([false, true])("lists global-rule editing only with statewide scope (%s)", (statewide) => {
    viewer.statewide = statewide;
    render(
      <HelpTasks
        role="coordinator"
        home="/ward-flow"
        pathname="/ward-flow"
        screen={undefined}
        onSearch={vi.fn()}
        screenName={() => "Settings"}
        onClose={vi.fn()}
        onTour={vi.fn()}
        onShowMe={vi.fn()}
        showMeOn
      />,
    );
    const more = screen.queryByRole("button", { name: /^Show \d+ more/ });
    if (more) fireEvent.click(more);
    expect(Boolean(screen.queryByTestId("ward-help-task-answer-rules"))).toBe(statewide);
  });

  it.each([false, true])(
    "search explains rules but offers editing steps/actions only with statewide scope (%s)",
    (statewide) => {
      viewer.statewide = statewide;
      render(
        <WardHelpSheet view="tasks" onView={vi.fn()} onClose={vi.fn()} onTour={vi.fn()} onShowMe={vi.fn()} showMeOn />,
      );
      fireEvent.change(screen.getByRole("combobox", { name: "Search Help" }), { target: { value: "ED target rules" } });
      const best = within(screen.getByRole("region", { name: "Best answer" }));
      expect(best.getByRole("heading").textContent).toContain("Change the pull time limit or ED target");
      expect(screen.getByRole("region", { name: "Best answer" }).textContent).toContain(
        "Only the statewide coordinator",
      );
      expect(Boolean(best.queryByRole("button", { name: "Show me on screen" }))).toBe(statewide);
      expect(Boolean(best.queryByRole("list", { name: "Steps" }))).toBe(statewide);
      if (!statewide) expect(best.queryByRole("button", { name: "Open in How to" })).toBeNull();
    },
  );
});
