import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const DRAFT_KEY = "wf-draft:alerts-broadcast-directive";

function mount() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AlertsScreen />
    </WardFlowProvider>,
  );
}

function openComposer() {
  fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));
}

function selectCustomTemplate() {
  fireEvent.change(screen.getByLabelText(/^Start from$/i), { target: { value: "custom" } });
}

function unloadWasPrevented() {
  const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("alerts broadcast composer keeps one draft of the whole form", () => {
  it("does not guard an untouched composer", () => {
    mount();
    openComposer();
    expect(unloadWasPrevented()).toBe(false);
    selectCustomTemplate();
    expect(unloadWasPrevented()).toBe(false);
  });

  it("guards a title-only edit on the custom template (the message is still empty)", () => {
    mount();
    openComposer();
    selectCustomTemplate();
    fireEvent.change(screen.getByLabelText(/^Title$/i), { target: { value: "Only a title" } });
    expect(unloadWasPrevented()).toBe(true);
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("guards a severity, scope or duration edit on its own", () => {
    for (const [id, value] of [
      ["alerts-broadcast-severity", "advisory"],
      ["alerts-broadcast-target", "forensic"],
      ["alerts-broadcast-duration", "60"],
    ] as const) {
      sessionStorage.clear();
      const { unmount } = mount();
      openComposer();
      selectCustomTemplate();
      expect(unloadWasPrevented()).toBe(false);
      fireEvent.change(document.getElementById(id)!, { target: { value } });
      expect(unloadWasPrevented(), id).toBe(true);
      unmount();
    }
  });

  it("keeps edits only in memory and starts a fresh composer after reload", () => {
    const first = mount();
    openComposer();
    selectCustomTemplate();
    fireEvent.change(screen.getByLabelText(/^Title$/i), { target: { value: "Reload headline" } });
    fireEvent.change(document.getElementById("alerts-broadcast-severity")!, { target: { value: "warning" } });
    fireEvent.change(document.getElementById("alerts-broadcast-target")!, { target: { value: "adolescent" } });
    fireEvent.change(document.getElementById("alerts-broadcast-duration")!, { target: { value: "480" } });
    fireEvent.change(screen.getByLabelText(/^Directive$/i), {
      target: { value: "Reload body" },
    });
    first.unmount();

    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
    mount();
    expect(screen.queryByRole("dialog", { name: /Broadcast network alert/i })).toBeNull();
    expect(unloadWasPrevented()).toBe(false);
    openComposer();
    selectCustomTemplate();
    expect(screen.getByLabelText(/^Title$/i)).toHaveValue("");
    expect(screen.getByLabelText(/^Directive$/i)).toHaveValue("");
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("ignores a malformed stored draft rather than restoring part of it", () => {
    sessionStorage.setItem(DRAFT_KEY, "plain old message text");
    mount();
    expect(screen.queryByRole("dialog", { name: /Broadcast network alert/i })).toBeNull();
  });
});
