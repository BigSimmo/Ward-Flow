import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The bed drawer's URL and history contract (PR #262 review):
 * - closing a drawer this screen opened steps back over its own entry instead of adding one;
 * - a `?bed=` naming no bed on this ward opens nothing and is dropped from the URL;
 * - a leftover Census opener marker only sends the close Back for the exact unit and bed it opened.
 */
const UNIT = allUnits()[0];
const PATH = `/mockups/ward-flow/ward/${UNIT.id}`;

function renderWard() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={UNIT.id} />
    </WardFlowProvider>,
  );
}
function openViaUrl(bed: string) {
  const state = null;
  act(() => {
    window.history.replaceState(state, "", `${PATH}?bed=${bed}`);
    window.dispatchEvent(new PopStateEvent("popstate", { state }));
  });
}
const drawer = () => document.querySelector('[role="dialog"][aria-labelledby="drawer-bed-title"]');

beforeEach(() => {
  window.history.replaceState(null, "", PATH);
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ward bed drawer history", () => {
  it("closing a drawer this screen pushed goes back over that entry rather than adding another", () => {
    renderWard();
    openViaUrl("1");
    expect(drawer()).not.toBeNull();
    // The entry this screen pushes when it opens a bed carries this marker.
    window.history.replaceState({ wardBedDrawer: true }, "", window.location.href);
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const push = vi.spyOn(window.history, "pushState");
    fireEvent.click(screen.getByRole("button", { name: "Close bed drawer" }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(drawer()).toBeNull();
  });

  it("closing a deep-linked drawer replaces the URL in place, without Back or a new entry", () => {
    renderWard();
    openViaUrl("1");
    const back = vi.spyOn(window.history, "back");
    const push = vi.spyOn(window.history, "pushState");
    fireEvent.click(screen.getByRole("button", { name: "Close bed drawer" }));
    expect(back).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
    expect(drawer()).toBeNull();
  });

  it("arriving by URL and stepping between beds replace the entry instead of pushing", () => {
    renderWard();
    openViaUrl("1");
    fireEvent.click(screen.getByRole("button", { name: "Close bed drawer" }));
    const push = vi.spyOn(window.history, "pushState");
    openViaUrl("2");
    // Arriving by URL is not an open by this screen, so nothing is pushed for it.
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Next bed" }));
    expect(push).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?bed=3");
  });

  it("never writes Next.js's own history entries back, so the router keeps syncing ?bed=", () => {
    renderWard();
    openViaUrl("1");
    act(() => {
      window.history.replaceState(
        { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: {}, keep: 1 },
        "",
        window.location.href,
      );
    });
    const replace = vi.spyOn(window.history, "replaceState");
    fireEvent.click(screen.getByRole("button", { name: "Next bed" }));
    const written = replace.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(written).toEqual({ keep: 1 });
    expect(window.location.search).toBe("?bed=2");
  });

  it("ignores a ?bed= that names no bed on this ward and drops it from the URL", () => {
    renderWard();
    openViaUrl("999");
    expect(drawer()).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("a stale Census marker for another bed does not send the close Back", () => {
    renderWard();
    window.sessionStorage.setItem("wardflow:census-bed-opener", "some-row");
    window.sessionStorage.setItem("wardflow:census-bed-opener-target", `${UNIT.id}:7`);
    openViaUrl("1");
    const back = vi.spyOn(window.history, "back");
    fireEvent.click(screen.getByRole("button", { name: "Close bed drawer" }));
    expect(back).not.toHaveBeenCalled();
    expect(drawer()).toBeNull();
    expect(window.sessionStorage.getItem("wardflow:census-bed-opener-target")).toBeNull();
    expect(window.sessionStorage.getItem("wardflow:census-bed-opener")).toBeNull();
  });

  it("a matching Census marker without a router still closes the drawer on the first press", () => {
    renderWard();
    window.sessionStorage.setItem("wardflow:census-bed-opener-target", `${UNIT.id}:1`);
    openViaUrl("1");
    fireEvent.click(screen.getByRole("button", { name: "Close bed drawer" }));
    expect(drawer()).toBeNull();
    expect(window.sessionStorage.getItem("wardflow:census-bed-opener-target")).toBeNull();
  });
});
