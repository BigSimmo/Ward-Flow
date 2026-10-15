"use client";

import { openWardDrawer } from "../shell/ward-drawer-bus";
import type { ToolsSheetToolId } from "./ward-tools-sheet";

const TOOLS_TOOL_EVENT = "ward-flow-tools-open-tool";

/** Opens the Tools sheet at one tool: the Board time pills use it to reach the one Demo panel. */
export function requestToolsTool(tool: ToolsSheetToolId, returnFocus?: HTMLElement) {
  openWardDrawer("tools");
  window.dispatchEvent(new CustomEvent(TOOLS_TOOL_EVENT, { detail: { tool, returnFocus } }));
}

export function subscribeToolsTool(onTool: (tool: ToolsSheetToolId, returnFocus?: HTMLElement) => void) {
  function handler(event: Event) {
    const detail = (event as CustomEvent<{ tool?: ToolsSheetToolId; returnFocus?: HTMLElement }>).detail;
    if (detail?.tool) onTool(detail.tool, detail.returnFocus);
  }
  window.addEventListener(TOOLS_TOOL_EVENT, handler);
  return () => window.removeEventListener(TOOLS_TOOL_EVENT, handler);
}
