import type { PortraitRailMode, PortraitRowShape } from "@/components/wf";

/**
 * Owner mockup rounds (house rule: three options per redesign topic, A, B and C). A live screen
 * takes one of these only from a preview route under `/mockups/ward-flow/preview/`; without it the
 * screen renders exactly as it does today.
 */
export type MockupOption = "A" | "B" | "C";

export const MOCKUP_OPTIONS: readonly MockupOption[] = ["A", "B", "C"];

export function parseMockupOption(value: string | string[] | undefined | null): MockupOption {
  const raw = Array.isArray(value) ? value[0] : value;
  const upper = (raw ?? "").trim().toUpperCase();
  return upper === "B" || upper === "C" ? upper : "A";
}

/**
 * iPad portrait pattern mockups (device audit 11 Oct 2026): each option pairs a row shape with a
 * rail mode. Only a preview route passes a pattern; the live routes render as before.
 */
export const PORTRAIT_PATTERNS: Record<MockupOption, { shape: PortraitRowShape; rail: PortraitRailMode }> = {
  A: { shape: "line", rail: "slide" },
  B: { shape: "stack", rail: "tab" },
  C: { shape: "grouped", rail: "drawer" },
};
