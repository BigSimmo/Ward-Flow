import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PhoneFilterFold } from "@/components/wf";
import { SinceYouLookedFold } from "@/components/wf/since-you-looked-fold";

import { installMatchMediaStub } from "./setup/jsdom.setup";

/** R-STRUCT-36: turning a tablet or narrowing a window must not close an open dialog. */

type Listener = () => void;
const listeners = new Set<Listener>();
let phone = true;

function installLiveMatchMedia() {
  window.matchMedia = ((query: string) => ({
    get matches() {
      return phone && query === "(max-width: 46.4375rem)";
    },
    media: query,
    addEventListener: (_type: string, fn: Listener) => listeners.add(fn),
    removeEventListener: (_type: string, fn: Listener) => listeners.delete(fn),
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function resizeTo(isPhone: boolean) {
  phone = isPhone;
  window.innerWidth = isPhone ? 390 : 900;
  act(() => {
    window.dispatchEvent(new Event("resize"));
    listeners.forEach((fn) => fn());
  });
}

afterEach(() => {
  listeners.clear();
  phone = true;
  installMatchMediaStub(false);
});

describe("dialogs keep their open state across the phone and desktop layouts", () => {
  it("PhoneFilterFold sheet stays open when the window widens past the phone range", () => {
    installLiveMatchMedia();
    render(
      <PhoneFilterFold count={1} title="Filter the list" data-testid="fold">
        <button type="button">Locked bed</button>
      </PhoneFilterFold>,
    );
    fireEvent.click(screen.getByTestId("fold"));
    expect(screen.getByRole("dialog", { name: "Filter the list" })).toBeTruthy();
    resizeTo(false);
    expect(screen.getByRole("dialog", { name: "Filter the list" })).toBeTruthy();
    resizeTo(true);
    expect(screen.getByRole("dialog", { name: "Filter the list" })).toBeTruthy();
  });

  it("the since-you-looked sheet stays open across the same change", () => {
    installLiveMatchMedia();
    render(
      <SinceYouLookedFold summary="2 changes" title="Since you looked" label="Since you looked">
        <p>Detail</p>
      </SinceYouLookedFold>,
    );
    fireEvent.click(screen.getByTestId("wf-since-summary"));
    expect(screen.getByTestId("wf-since-sheet")).toBeTruthy();
    resizeTo(false);
    expect(screen.getByTestId("wf-since-sheet")).toBeTruthy();
    resizeTo(true);
    expect(screen.getByTestId("wf-since-sheet")).toBeTruthy();
  });
});
