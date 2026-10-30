"use client";

import { WardAnswerRedesign } from "./ward-answer-view";

/** The example ward the app's own address names (`/ward-flow/ward/rph-adult-secure/answer`). */
const EXAMPLE_WARD_ID = "rph-adult-secure";

/** Redesigned ward-answer mock-up: one-line "All answered", Census squares coloured by state. */
export function WardAnswerPage() {
  return <WardAnswerRedesign unitId={EXAMPLE_WARD_ID} />;
}
