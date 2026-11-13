/**
 * RC 2.5 (F-35, 13 Nov 2026): what a time since a start reads when the start is still in the
 * future, a mistyped arrival for example. It used to be clamped and read "0m", which looks like a
 * new arrival. The words are about the record, not the person. One copy here, so the kit
 * (`wf/format.ts`) and the engine (`ward-clock.ts`) share it and the backend bundle reads only
 * watched paths (backend/ward-flow/watch-paths.mjs).
 */
export const FUTURE_START_TEXT = "Start time is in the future";
