import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { WardDeskPendingClear } from "@/components/ward-management/shell/ward-access-hold";
import {
  WARD_DESK_EARLY_SCRIPT,
  WARD_DESK_PENDING_ATTRIBUTE,
} from "@/components/ward-management/shell/ward-desk-early";
import { parseStoredAccess } from "@/components/ward-management/shell/ward-access-store";

/**
 * H-0111 (Josh, 27 Oct 2026): a first load hides the page area only when the stored desk is not
 * the coordinator's, whose page the server draws, and shows it once the app has drawn that desk.
 * A fresh device and the coordinator keep the server's page straight away.
 */
const KEY = "wardflow:access-desk-v1";
const bedManager = { role: "bed_manager", scope: { kind: "site", siteCode: "FSH" } };
const runEarly = () => new Function(WARD_DESK_EARLY_SCRIPT)();
const pending = () => document.documentElement.hasAttribute(WARD_DESK_PENDING_ATTRIBUTE);

afterEach(() => {
  window.sessionStorage.clear();
  document.documentElement.removeAttribute(WARD_DESK_PENDING_ATTRIBUTE);
  document.body.innerHTML = "";
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
