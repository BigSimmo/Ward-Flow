import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/settings",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { WardFlowSignInScreen } from "@/components/ward-flow-sign-in/ward-flow-sign-in-screen";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { OnCallScreen } from "@/components/ward-management/on-call/on-call-screen";
import { isGlobalSearchShortcut } from "@/components/ward-management/search/search-shortcut";
import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import {
  areCharacterShortcutsEnabled,
  setCharacterShortcutsEnabled,
  useCharacterShortcutsPreference,
} from "@/components/ward-management/shell/ward-character-shortcuts";
import { openDrawerForShortcut } from "@/components/ward-management/shell/ward-rail-preferences";
import { closeWardDrawer, subscribeWardDrawer } from "@/components/ward-management/shell/ward-drawer-bus";
import { useStatisticsView } from "@/components/ward-management/statistics/statistics-view-bar";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

afterEach(() => {
  vi.restoreAllMocks();
  act(() => setCharacterShortcutsEnabled(true));
  closeWardDrawer();
  window.history.replaceState(null, "", window.location.pathname);
});

function Preference() {
  const [enabled] = useCharacterShortcutsPreference();
  return <output data-testid="character-preference">{enabled ? "on" : "off"}</output>;
}

describe("the browser's single-key shortcut preference", () => {
  it("uses the Settings switch immediately and retains Ctrl/Cmd+K", () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <SettingsScreen />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const toggle = screen.getByRole("switch", { name: "Single-key shortcuts" });
    expect(toggle).toBeChecked();
    expect(isGlobalSearchShortcut(new KeyboardEvent("keydown", { key: "/" }))).toBe(true);
    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(areCharacterShortcutsEnabled()).toBe(false);
    expect(isGlobalSearchShortcut(new KeyboardEvent("keydown", { key: "/" }))).toBe(false);
    for (const modifier of ["ctrlKey", "metaKey"]) {
      expect(isGlobalSearchShortcut(new KeyboardEvent("keydown", { key: "k", [modifier]: true }))).toBe(true);
    }
    fireEvent.click(toggle);
    expect(isGlobalSearchShortcut(new KeyboardEvent("keydown", { key: "/" }))).toBe(true);
  });

  it("stops and restores a mounted page's slash shortcut while leaving typing alone", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OnCallScreen />
      </WardFlowProvider>,
    );
    const search = screen.getByRole("searchbox", { name: "Search by role, hospital, ward, team or number" });
    act(() => setCharacterShortcutsEnabled(false));
    fireEvent.keyDown(document.body, { key: "/" });
    expect(search).not.toHaveFocus();
    act(() => setCharacterShortcutsEnabled(true));
    fireEvent.keyDown(document.body, { key: "/" });
    expect(search).toHaveFocus();
    const other = document.createElement("input");
    document.body.append(other);
    other.focus();
    fireEvent.keyDown(other, { key: "/" });
    expect(other).toHaveFocus();
    other.remove();
  });

  it("shares the Handover checkbox with the whole app and keeps Escape available", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <HandoverPage />
        <Preference />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Enable single-key shortcuts" }));
    expect(screen.getByTestId("character-preference")).toHaveTextContent("off");
    fireEvent.keyDown(document.body, { key: "Escape" });
    const row = within(screen.getByTestId("ward-handover-sheet"))
      .getAllByRole("row")
      .find((item) => item.hasAttribute("data-row-id"))!;
    row.focus();
    for (const key of ["j", "k", "p", "s", "m", "?"]) fireEvent.keyDown(window, { key });
    expect(screen.queryByTestId("ward-handover-flow-panel")).not.toBeInTheDocument();
    act(() => setCharacterShortcutsEnabled(true));
    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByTestId("ward-handover-flow-panel")).toBeInTheDocument();
    act(() => setCharacterShortcutsEnabled(false));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("ward-handover-flow-panel")).not.toBeInTheDocument();
  });

  it("also controls number shortcuts in statistics", () => {
    function StatisticsProbe() {
      const { view } = useStatisticsView();
      return <output data-testid="statistics-view">{view}</output>;
    }
    render(<StatisticsProbe />);
    act(() => setCharacterShortcutsEnabled(false));
    fireEvent.keyDown(document.body, { key: "2" });
    expect(screen.getByTestId("statistics-view")).toHaveTextContent("board");
    act(() => setCharacterShortcutsEnabled(true));
    fireEvent.keyDown(document.body, { key: "2" });
    expect(screen.getByTestId("statistics-view")).toHaveTextContent("journey");
  });

  it("scopes the standalone role chooser's number keys to its focused picker", () => {
    render(<WardFlowSignInScreen />);
    const roles = within(screen.getByRole("group", { name: /^Your role/ })).getAllByRole("button");
    fireEvent.keyDown(document.body, { key: "2" });
    expect(roles[0]).toHaveAttribute("aria-pressed", "true");
    roles[0]!.focus();
    fireEvent.keyDown(roles[0]!, { key: "2" });
    expect(roles[1]).toHaveAttribute("aria-pressed", "true");
  });

  it("controls Shift+letter drawer shortcuts", () => {
    const opened = vi.fn();
    const unsubscribe = subscribeWardDrawer(opened);
    try {
      setCharacterShortcutsEnabled(false);
      expect(openDrawerForShortcut(new KeyboardEvent("keydown", { key: "T", shiftKey: true }))).toBe(false);
      expect(opened).not.toHaveBeenCalled();
      setCharacterShortcutsEnabled(true);
      expect(openDrawerForShortcut(new KeyboardEvent("keydown", { key: "T", shiftKey: true }))).toBe(true);
      expect(opened).toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it("keeps the choice when storage is blocked, then persists only its boolean choice", () => {
    render(<Preference />);
    const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    act(() => setCharacterShortcutsEnabled(false));
    expect(areCharacterShortcutsEnabled()).toBe(false);
    expect(screen.getByTestId("character-preference")).toHaveTextContent("off");
    blocked.mockRestore();
    act(() => setCharacterShortcutsEnabled(false));
    expect(window.localStorage.getItem("ward-flow-character-shortcuts")).toBe("off");
    act(() => setCharacterShortcutsEnabled(true));
    expect(window.localStorage.getItem("ward-flow-character-shortcuts")).toBeNull();
    expect(screen.getByTestId("character-preference")).toHaveTextContent("on");
  });
});
