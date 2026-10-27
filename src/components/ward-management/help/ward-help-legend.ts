/**
 * THE COLOUR CODE IN HELP: what each status colour means, read from one place so the legend in the
 * help sheet and its test cannot drift from the shapes in `src/components/wf/status-glyph.tsx`
 * (v6 rule 7: each tone has one shape everywhere). The colour comes from the tone's token in
 * `src/app/ward-flow-v9-tokens.css` through the glyph itself; nothing here picks a colour. The word
 * always carries the meaning, so the code still reads without colour.
 */
import type { WfTone } from "@/components/wf";

export type ColourLegendEntry = {
  readonly tone: WfTone;
  /** What the colour means, as the screens use it. */
  readonly meaning: string;
  /** The glyph's shape, for anyone who cannot tell the colours apart. */
  readonly shape: string;
};

/** Every tone, in the order a shift meets them: most urgent first. */
export const COLOUR_LEGEND: readonly ColourLegendEntry[] = [
  { tone: "danger", meaning: "Act now", shape: "Triangle" },
  { tone: "warning", meaning: "At risk", shape: "Filled amber circle" },
  { tone: "success", meaning: "Done", shape: "Tick" },
  { tone: "info", meaning: "Moving", shape: "Capsule" },
  { tone: "neutral", meaning: "Waiting", shape: "Ring" },
  { tone: "closed", meaning: "Declined or closed", shape: "Cross" },
];

export const COLOUR_LEGEND_NOTE = "Each colour also has its own shape, and the word beside it says what it means.";
