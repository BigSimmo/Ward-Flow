"use client";

import { useEffect, useSyncExternalStore } from "react";

import { openWardDrawer } from "../shell/ward-drawer-bus";
import type { ToolsSheetToolId } from "./ward-tools-sheet";

const PREVIEW_KEY = "ward-flow:tools-preview";

/**
 * Preview switch for the rebuilt Tools sheet (Tools review mockup, 15 Oct 2026). `?tools=new` turns
 * it on for this tab and `?tools=old` turns it off, so the new sheet can be compared with the current
 * one in the running app. Off by default, so every existing screen and test is unchanged until the
 * design is approved. Stores one on or off flag, never typed text. Remove with the old sheet.
 */
export function useToolsPreview(): boolean {
  const on = useSyncExternalStore(subscribeNever, readPreview, () => false);
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("tools");
    try {
      if (asked === "new") window.sessionStorage.setItem(PREVIEW_KEY, "1");
      else if (asked === "old") window.sessionStorage.removeItem(PREVIEW_KEY);
    } catch {
      // Without storage the switch lasts as long as the query string does.
    }
  }, []);
  return on;
}

function subscribeNever() {
  return () => {};
}

function readPreview(): boolean {
  const asked = new URLSearchParams(window.location.search).get("tools");
  if (asked === "new") return true;
  if (asked === "old") return false;
  try {
    return window.sessionStorage.getItem(PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

const TOOLS_TOOL_EVENT = "ward-flow-tools-open-tool";

/** Opens the Tools sheet at one tool: the demo clock pills use it to reach the one Demo panel. */
export function requestToolsTool(tool: ToolsSheetToolId) {
  openWardDrawer("tools");
  window.dispatchEvent(new CustomEvent(TOOLS_TOOL_EVENT, { detail: { tool } }));
}

export function subscribeToolsTool(onTool: (tool: ToolsSheetToolId) => void) {
  function handler(event: Event) {
    const tool = (event as CustomEvent<{ tool?: ToolsSheetToolId }>).detail?.tool;
    if (tool) onTool(tool);
  }
  window.addEventListener(TOOLS_TOOL_EVENT, handler);
  return () => window.removeEventListener(TOOLS_TOOL_EVENT, handler);
}
