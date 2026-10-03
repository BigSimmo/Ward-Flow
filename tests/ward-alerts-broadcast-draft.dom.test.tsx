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
  fireEvent.click(screen.getByRole("button", { name: "Broadcast Network Alert" }));
}

function selectCustomTemplate() {
  fireEvent.change(screen.getByLabelText(/WA Clinical Protocol & Flow Template/i), { target: { value: "custom" } });
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
    fireEvent.change(screen.getByLabelText(/Directive Headline \/ Title/i), { target: { value: "Only a title" } });
    expect(unloadWasPrevented()).toBe(true);
    expect(JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null")).toMatchObject({ title: "Only a title" });
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

  it("restores every field, not just the message, after a reload", () => {
    const first = mount();
    openComposer();
    selectCustomTemplate();
    fireEvent.change(screen.getByLabelText(/Directive Headline \/ Title/i), { target: { value: "Reload headline" } });
    fireEvent.change(document.getElementById("alerts-broadcast-severity")!, { target: { value: "warning" } });
    fireEvent.change(document.getElementById("alerts-broadcast-target")!, { target: { value: "adolescent" } });
    fireEvent.change(document.getElementById("alerts-broadcast-duration")!, { target: { value: "480" } });
    fireEvent.change(screen.getByLabelText(/Message Body & Clinical Instructions/i), {
      target: { value: "Reload body" },
    });
    first.unmount();

    mount();
    expect(screen.getByRole("dialog", { name: /Broadcast Statewide Network Alert/i })).toBeInTheDocument();
    expect((screen.getByLabelText(/WA Clinical Protocol & Flow Template/i) as HTMLSelectElement).value).toBe("custom");
    expect((screen.getByLabelText(/Directive Headline \/ Title/i) as HTMLInputElement).value).toBe("Reload headline");
    expect((document.getElementById("alerts-broadcast-severity") as HTMLSelectElement).value).toBe("warning");
    expect((document.getElementById("alerts-broadcast-target") as HTMLSelectElement).value).toBe("adolescent");
    expect((document.getElementById("alerts-broadcast-duration") as HTMLSelectElement).value).toBe("480");
    expect((screen.getByLabelText(/Message Body & Clinical Instructions/i) as HTMLTextAreaElement).value).toBe(
      "Reload body",
    );
    // still protected and still stored after the restore, so a second reload also keeps it
    expect(unloadWasPrevented()).toBe(true);
    expect(JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null")).toMatchObject({
      title: "Reload headline",
      severity: "warning",
      scope: "adolescent",
      durationMinutes: 480,
    });
  });

  it("ignores a malformed stored draft rather than restoring part of it", () => {
    sessionStorage.setItem(DRAFT_KEY, "plain old message text");
    mount();
    expect(screen.queryByRole("dialog", { name: /Broadcast Statewide Network Alert/i })).toBeNull();
  });
});
