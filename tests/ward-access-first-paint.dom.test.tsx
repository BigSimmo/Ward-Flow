import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { WardDeskHold, WardDeskPendingClear } from "@/components/ward-management/shell/ward-access-hold";
import {
  WARD_DESK_EARLY_SCRIPT,
  WARD_DESK_HELD_COOKIE,
  WARD_DESK_PENDING_ATTRIBUTE,
} from "@/components/ward-management/shell/ward-desk-early";
import {
  parseStoredAccess,
  resetWardAccessStoreForTests,
  setWardAccess,
} from "@/components/ward-management/shell/ward-access-store";

/**
 * H-0111 (Josh, 27 Oct 2026): a first load hides the page area only when the stored desk is not
 * the coordinator's, whose page the server draws, and shows it once the app has drawn that desk.
 * A fresh device and the coordinator keep the server's page straight away.
 */
const KEY = "wardflow:access-desk-v1";
const bedManager = { role: "bed_manager", scope: { kind: "site", siteCode: "FSH" } };
const runEarly = () => new Function(WARD_DESK_EARLY_SCRIPT)();
const pending = () => document.documentElement.hasAttribute(WARD_DESK_PENDING_ATTRIBUTE);
const held = () => document.cookie.split("; ").includes(`${WARD_DESK_HELD_COOKIE}=1`);
const clearHeld = () => {
  document.cookie = `${WARD_DESK_HELD_COOKIE}=;path=/ward-flow;max-age=0`;
  document.cookie = `${WARD_DESK_HELD_COOKIE}=;max-age=0`;
};

afterEach(() => {
  window.sessionStorage.clear();
  document.documentElement.removeAttribute(WARD_DESK_PENDING_ATTRIBUTE);
  document.body.innerHTML = "";
  clearHeld();
  resetWardAccessStoreForTests();
});

describe("H-0111 first load for a stored desk", () => {
  it("marks a stored desk other than the coordinator's", () => {
    const desk = parseStoredAccess(JSON.stringify(bedManager));
    expect(desk, "the test desk is one the access store keeps").not.toBeNull();
    window.sessionStorage.setItem(KEY, JSON.stringify(desk));
    runEarly();
    expect(pending()).toBe(true);
  });

  it("leaves a fresh device, the coordinator and unreadable storage alone", () => {
    runEarly();
    expect(pending()).toBe(false);
    window.sessionStorage.setItem(KEY, JSON.stringify({ role: "coordinator", scope: { kind: "statewide" } }));
    runEarly();
    expect(pending()).toBe(false);
    window.sessionStorage.setItem(KEY, "{not json");
    runEarly();
    expect(pending()).toBe(false);
  });

  it("clears the mark once the app has drawn, never in the server's page", async () => {
    document.documentElement.setAttribute(WARD_DESK_PENDING_ATTRIBUTE, "");
    const container = document.createElement("div");
    container.innerHTML = renderToString(<WardDeskPendingClear />);
    document.body.appendChild(container);
    expect(pending()).toBe(true);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <WardDeskPendingClear />);
    });
    expect(pending()).toBe(false);
    act(() => root?.unmount());
  });
});

/**
 * Desk walk follow-up (9 Nov 2026): the coordinator's figures were in the server's page for every
 * desk. A desk other than the whole-network coordinator's now sets a bare cookie, and the server
 * sends a neutral loading page in place of the page until the browser knows the desk.
 */
describe("server page held for a desk other than the coordinator's", () => {
  it("sets the held cookie for another desk and clears it only for the coordinator's", () => {
    window.history.replaceState(null, "", "/ward-flow/capacity");
    window.sessionStorage.setItem(KEY, JSON.stringify(bedManager));
    runEarly();
    expect(held()).toBe(true);
    window.sessionStorage.clear();
    runEarly();
    expect(held(), "a fresh tab leaves another tab's desk held").toBe(true);
    window.sessionStorage.setItem(KEY, JSON.stringify({ role: "coordinator", scope: { kind: "statewide" } }));
    runEarly();
    expect(held()).toBe(false);
  });

  it("keeps the held cookie in step with the desk the app stores", () => {
    window.history.replaceState(null, "", "/ward-flow");
    setWardAccess({ role: "ed", scope: { kind: "ed", edId: "any-ed" } });
    expect(held()).toBe(true);
    // A service coordinator is not the whole network either.
    setWardAccess({ role: "coordinator", scope: { kind: "service", service: "North Metro" } });
    expect(held()).toBe(true);
    setWardAccess({ role: "coordinator", scope: { kind: "statewide" } });
    expect(held()).toBe(false);
  });

  it("sends the placeholder, never the page, when held, and draws the page once the desk is known", async () => {
    const page = <p data-testid="page">Network beds ready of 304</p>;
    const placeholder = <p data-testid="placeholder">Loading page</p>;
    const tree = (
      <WardDeskHold held placeholder={placeholder}>
        {page}
      </WardDeskHold>
    );
    const serverHtml = renderToString(tree);
    expect(serverHtml).toContain("Loading page");
    expect(serverHtml).not.toContain("304");
    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);
    const errors: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (error) => errors.push(error) });
    });
    expect(errors, "no hydration mismatch").toEqual([]);
    expect(container.querySelector('[data-testid="page"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="placeholder"]')).toBeNull();
    act(() => root?.unmount());
  });

  it("keeps the server's page for a fresh device and the coordinator", () => {
    const html = renderToString(
      <WardDeskHold held={false} placeholder={<p>Loading page</p>}>
        <p>Home</p>
      </WardDeskHold>,
    );
    expect(html).toContain("Home");
    expect(html).not.toContain("Loading page");
  });
});
