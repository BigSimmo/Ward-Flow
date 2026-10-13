import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider, useToast } from "@/components/ui/toast";
import { LiveChip, WfServerPhoneProvider, guessPhoneFromRequest, useIsPhone } from "@/components/wf";
import { WARD_OFFLINE_LINK_NOTICE, WardOfflineLinks } from "@/components/ward-management/shell/ward-offline-links";
import { WARD_OFFLINE_SAVED_NOTE } from "@/components/ward-management/ward-offline-copy";

/*
 * Live use on poor signal (audit 13 Oct 2026, Josh): A1-17 the first paint matches the phone
 * layout; A1-18 offline in-app links stay in the app and the live chip turns grey Offline;
 * A2-21 / A3-22 actions recorded offline say they were saved on this device only.
 */

function setOnline(value: boolean) {
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(value);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("A1-17: the server draws the phone layout for a phone", () => {
  it("guesses a phone from the client hint, else the user agent, and never a tablet", () => {
    expect(guessPhoneFromRequest("anything", "?1")).toBe(true);
    expect(guessPhoneFromRequest("iPhone", "?0")).toBe(false);
    expect(
      guessPhoneFromRequest("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari", null),
    ).toBe(true);
    expect(guessPhoneFromRequest("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36", null)).toBe(true);
    expect(guessPhoneFromRequest("Mozilla/5.0 (Linux; Android 14; SM-X710) Safari/537.36", null)).toBe(false);
    expect(guessPhoneFromRequest("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)", null)).toBe(false);
    expect(guessPhoneFromRequest(null, null)).toBe(false);
  });

  function Probe() {
    return <span>{useIsPhone() ? "phone" : "desktop"}</span>;
  }

  it("uses the guess as the server render of the phone query, and desktop without one", () => {
    expect(
      renderToString(
        <WfServerPhoneProvider phone>
          <Probe />
        </WfServerPhoneProvider>,
      ),
    ).toContain("phone");
    expect(renderToString(<Probe />)).toContain("desktop");
  });
});

describe("A1-18: the live chip says Offline while the browser has no connection", () => {
  it("reads Demo online and Offline offline", () => {
    setOnline(true);
    const { unmount } = render(<LiveChip state="live" />);
    expect(document.body.textContent).toContain("Demo");
    unmount();
    setOnline(false);
    render(<LiveChip state="live" />);
    expect(document.body.textContent).toContain("Offline");
    expect(document.body.textContent).not.toContain("Demo");
  });
});

function Pusher({ skip }: { skip?: boolean }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.push({ tone: "success", title: "Accepted", skipOfflineNote: skip })}>
      push
    </button>
  );
}

describe("A2-21 / A3-22: a toast pushed offline says it was saved on this device", () => {
  it("adds the note offline only", () => {
    setOnline(false);
    render(
      <ToastProvider offlineNote={WARD_OFFLINE_SAVED_NOTE}>
        <Pusher />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "push" }));
    expect(screen.getByTestId("toast")).toHaveTextContent(WARD_OFFLINE_SAVED_NOTE);
  });

  it("leaves an online toast alone", () => {
    setOnline(true);
    render(
      <ToastProvider offlineNote={WARD_OFFLINE_SAVED_NOTE}>
        <Pusher />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "push" }));
    expect(screen.getByTestId("toast")).not.toHaveTextContent(WARD_OFFLINE_SAVED_NOTE);
  });
});

describe("A1-18: offline, an in-app link stays on this page and says why", () => {
  function renderLinks() {
    return render(
      <ToastProvider offlineNote={WARD_OFFLINE_SAVED_NOTE}>
        <WardOfflineLinks />
        <a href="/mockups/ward-flow/elsewhere">Elsewhere</a>
      </ToastProvider>,
    );
  }

  it("blocks the page change offline and shows the notice", () => {
    setOnline(false);
    renderLinks();
    const link = screen.getByRole("link", { name: "Elsewhere" });
    let event!: MouseEvent;
    act(() => {
      event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
      link.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByTestId("toast")).toHaveTextContent(WARD_OFFLINE_LINK_NOTICE);
    expect(screen.getByTestId("toast")).not.toHaveTextContent(WARD_OFFLINE_SAVED_NOTE);
  });

  it("lets the link through online", () => {
    setOnline(true);
    renderLinks();
    const link = screen.getByRole("link", { name: "Elsewhere" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    // jsdom does not navigate; the guard simply must not cancel the click.
    link.addEventListener("click", (e) => e.preventDefault());
    link.dispatchEvent(event);
    expect(screen.queryByTestId("toast")).toBeNull();
  });
});
