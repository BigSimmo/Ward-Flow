// src/components/ward-management/statistics/statistics-demonstration.ts
//
// THE ONE PLACE A NUMBER IS ALLOWED TO BE INVENTED, AND THE WALL THAT KEEPS IT FROM ESCAPING.
//
// ⚠️ **WHY THIS MODULE EXISTS AT ALL.** `WardFlowState` (`ward-flow-reducer.ts`) holds only the
// CURRENT picture — the units, the movements, the referrals as they stand right now. It keeps no
// history: nothing here remembers what yesterday's occupancy was, or how many people arrived last
// Tuesday. The owner asked for 30-day trend charts on the statistics screens anyway, and approved
// showing demonstration data for them, clearly labelled, because the trends read the page well and
// the model genuinely cannot produce the real thing yet.
//
// **The risk was never that a demonstration trend looks invented. It is that it stops looking
// invented.** A label is a sentence someone wrote once; a chart is a picture someone looks at every
// day. Every other figure this prototype shows is computed from `WardFlowState` on every render —
// that is the whole discipline `statistics-overview-screen.tsx`'s own header describes, and this
// module is the one deliberate, owner-approved hole in it. A hole like that does not stay labelled
// by good intentions. A hand-built lookalike object fails to compile with no special effort: the
// brand's key is a `unique symbol` this module does not export, so an outside literal is missing a
// required field it cannot even name.
//
// 🔴 **THIS PARAGRAPH ALSO CLAIMED THAT A FILE PULLING THE RAW `.points` INTO A REAL CHART FAILS TO
// COMPILE. THAT WAS FALSE, AND IT WAS THE MOST LOAD-BEARING SENTENCE IN THE FILE.** `points` is a
// public `readonly` field, so `series.points.map((p) => <td>{p.value}</td>)` compiles cleanly with
// no cast and no assertion. The compiler stops a FORGED series; it does nothing about a real one
// being read and drawn somewhere else.
//
// ⚠️ **And the two sibling files said so correctly all along** — the chart file says such a file
// "get[s] past the compiler", and the test header calls it route (b). **The false sentence was on
// the file a reader opens FIRST, contradicted by the two they open second**, which is the worst
// place for it: whoever adds the next chart reads this one and stops.
//
// What actually keeps that route closed today is that nobody has taken it — verified, `.points`
// appears nowhere in the six statistics screens — plus a static scan in
// `tests/ward-statistics-demonstration.test.ts` which is weaker than it looks: it flags a file that
// imports the generator WITHOUT importing the wrapper, and a screen reading `.points` would import
// both. **Recorded here rather than repaired, because strengthening that scan is somebody's next
// piece of work and not a comment fix.**
//
// A reviewer is still the thing standing between an invented number
// and a coordinator making a bed decision from it in the one case this cannot close: a deliberate
// `as DemonstrationSeries` cast defeats any TypeScript brand, this one included. That is not a hole
// in this design, it is the boundary of what a compile-time brand can promise — and it is a
// tolerable one, because writing `as DemonstrationSeries` is a decision made in the open, visible in
// the diff, not an accident that slips past unnoticed. See
// `tests/ward-statistics-demonstration.test.ts` for exactly what this module does and does not stop.
//
// So three things are load-bearing here, not decorative:
//
//   1. **`DemonstrationSeries` is a branded type**, unreachable by any plain object literal built
//      outside this file. A screen cannot ACCIDENTALLY construct a lookalike and skip the wrapper —
//      the compiler refuses to accept a hand-built object as a `DemonstrationSeries` at all, and
//      refuses to accept a real `DemonstrationSeries` wherever a plain, derived figure is expected
//      instead. It does not stop a DELIBERATE `{ ... } as DemonstrationSeries` cast — no TypeScript
//      brand survives one — but that cast has to be written down, which is a decision a reviewer can
//      see, not a mistake that compiles by accident. See
//      `tests/ward-statistics-demonstration.test.ts`'s `@ts-expect-error` fixtures for the two shapes
//      of ACCIDENTAL mistake this actually blocks.
//   2. **Every series carries `label`, `whatItWouldMeasure` and `whyItIsNotReal` as required
//      fields, checked again at runtime.** An empty string satisfies `string` — the type system
//      cannot see the difference between a real sentence and `""`, so a screen that forgot to fill
//      one in would compile cleanly and render a blank where the disclosure belongs. The three
//      guards in `generateDemonstrationSeries` below exist because the type alone cannot catch that.
//   3. **The generator is deterministic — no `Math.random()`.** This codebase already refuses it in
//      the reducer itself: `referralSequence` and `leaveBedSequence` on `WardFlowState`
//      (`ward-flow-reducer.ts`) exist so that an id is reproducible rather than rolled. The same
//      reasoning applies here for a second reason beyond reproducible tests — a demonstration series
//      reseeded from the SAME scenario and the SAME reducer clock must render the SAME trend, or a
//      coordinator who reloads the page mid-shift would watch invented history reshuffle itself,
//      which is a stranger and more suspicious thing for a demonstration figure to do than simply
//      being invented in the first place.
//
// ⚠️ **THE SEED IS THE SCENARIO, THE CLOCK, AND THE SERIES' OWN LABEL — NOT JUST THE FIRST TWO.**
// This module has to serve more than one chart eventually (an admissions trend and a wait-time
// trend on the same screen, say), and two series generated from the same scenario and the same
// instant must not draw the same wobble merely because they share those two inputs. `label` is
// already a required, per-series field naming what the chart is, so it doubles as the thing that
// keeps two simultaneous series independent without inventing a fourth parameter whose only job
// would be "tell them apart".
//
// ⚠️ **`now` IS WHAT THIS MODULE CAN SEE OF THE CLOCK, DELIBERATELY.** `ward-flow-provider.tsx` says
// outright that "the screens never see the raw reducer state or the clock's internal offsets — they
// see the three collections plus a single resolved `now`". `WardFlowState.clockOffsetMinutes` is
// that internal offset, and nothing outside the reducer reads it. A screen calling this generator
// has `useWardFlow().now` and `useWardFlow().scenario` and nothing else of the clock, so `now`
// (typed `Instant`, a plain number of minutes) is the only "clock" this module can be anchored to.

import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { WardScenario } from "@/components/ward-management/ward-scenarios";

/**
 * The nominal brand — a REAL symbol, not a `declare`d phantom. `declare const x: unique symbol`
 * describes a value that exists somewhere else and produces nothing at runtime, so a property
 * keyed by it can be asserted about at the type level but never actually SET on an object — every
 * call below would throw `ReferenceError: __demonstration is not defined` the moment it tried to
 * build one. `Symbol()` gives this a genuine runtime identity while `unique symbol` still gives it
 * the exact-identity type TypeScript needs for branding, so `DemonstrationSeries` is enforced at
 * both compile time and run time from the one declaration.
 *
 * Deliberately NOT exported: exporting it would hand every caller the one thing that lets a plain
 * object literal satisfy `DemonstrationSeries` with no cast at all, which defeats the point of
 * branding it. With it kept private, only code inside this file can produce a value of this exact
 * type WITHOUT resorting to a cast — `generateDemonstrationSeries` below is the sole path to one for
 * every caller who is not deliberately working around the type system. A caller who writes `{ ... }
 * as DemonstrationSeries` still gets one; that is true of any branded type and is not something
 * keeping this symbol private can prevent. What keeping it private prevents is the accidental,
 * cast-free route — the one a screen could reach without ever noticing it had done anything unusual.
 */
const __demonstration: unique symbol = Symbol("ward-flow-demonstration-series");

/** One point on a demonstration trend — a value some number of days before the instant the series
 *  was generated against. `daysAgo` counts down to 0 at the most recent point, so a caller drawing
 *  the series left-to-right in calendar order reads `points` in the order it already comes in. */
export type DemonstrationPoint = Readonly<{
  daysAgo: number;
  value: number;
}>;

/**
 * The three sentences a demonstration series cannot exist without. `label` names the chart,
 * `whatItWouldMeasure` says what a real derivation would compute if `WardFlowState` kept the
 * history to compute it from, and `whyItIsNotReal` says why it does not. All three are required,
 * non-optional `string` fields, and `generateDemonstrationSeries` throws if any of them is empty —
 * see the module header for why the type alone cannot enforce that.
 */
export type DemonstrationSeriesDisclosure = Readonly<{
  label: string;
  whatItWouldMeasure: string;
  whyItIsNotReal: string;
}>;

/**
 * A trend that was never measured, said so in its own required fields, and unforgeable outside
 * this file. `DemonstrationChart` (`statistics-demonstration-chart.tsx`) is the only function
 * anywhere that declares a parameter of this type — nothing else in this codebase can render one,
 * and nothing outside this module can construct one.
 */
export type DemonstrationSeries = Readonly<
  DemonstrationSeriesDisclosure & {
    points: readonly DemonstrationPoint[];
    readonly [__demonstration]: true;
  }
>;

/**
 * The shape of the walk `generateDemonstrationSeries` draws. `points` defaults to
 * `DEFAULT_TREND_LENGTH` (30) because the design brief's centrepiece charts are 30-day trends, and
 * a caller building a different span says so explicitly rather than this module guessing one.
 * Values are clamped to `[minValue, maxValue]` (default `[0, +Infinity]`, i.e. "never negative, no
 * ceiling") after every step, so a walk cannot wander into an impossible count.
 */
export type DemonstrationWalkShape = Readonly<{
  points?: number;
  baseline: number;
  volatility: number;
  minValue?: number;
  maxValue?: number;
}>;

export const DEFAULT_TREND_LENGTH = 30;

function assertNonEmpty(value: string, field: string): void {
  if (value.trim() === "") {
    throw new Error(
      `generateDemonstrationSeries: "${field}" is required and cannot be empty. A demonstration ` +
        "series that does not say what it stands in for is exactly the failure this module exists " +
        "to make impossible — see the file header.",
    );
  }
}

function assertFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`generateDemonstrationSeries: "${field}" must be a finite number, got ${String(value)}.`);
  }
}

/**
 * FNV-1a. Chosen for being a dozen lines of integer arithmetic rather than a dependency — this
 * seed only has to mix its inputs well and stay stable forever, never to resist an adversary.
 */
function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * mulberry32 — a small, deterministic PRNG. The same seed produces the same sequence forever,
 * which is the one property `Math.random()` cannot offer and the one property this module cannot
 * do without. See the file header for why `Math.random()` is refused here the same way
 * `ward-flow-reducer.ts` refuses it for `referralSequence`/`leaveBedSequence`.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * A bounded random walk, oldest point first. Each step wobbles the previous value by up to
 * `volatility` in either direction and clamps it back into range — a plain walk with no clamp
 * would eventually drift outside anything a bed count or a wait time could plausibly be.
 */
function walk(
  random: () => number,
  count: number,
  baseline: number,
  volatility: number,
  min: number,
  max: number,
): DemonstrationPoint[] {
  const points: DemonstrationPoint[] = [];
  let value = clamp(baseline, min, max);
  for (let daysAgo = count - 1; daysAgo >= 0; daysAgo -= 1) {
    const step = (random() * 2 - 1) * volatility;
    value = clamp(value + step, min, max);
    points.push({ daysAgo, value });
  }
  return points;
}

/**
 * The one generator. Seeded from `scenario`, `now` and `disclosure.label` (see the file header for
 * why the label is part of the seed), so the same three inputs always draw the same trend and a
 * different `now` always draws a different one — the second half is what
 * `tests/ward-statistics-demonstration.test.ts` uses to prove this is a live generator rather than
 * a frozen constant that happens to pass the first half by never changing at all.
 *
 * Throws rather than silently producing a blank or a flat line: an empty disclosure field, a
 * non-finite shape number, negative volatility, an inverted `[min, max]` range, or a baseline
 * outside that range are all caller mistakes, and a demonstration chart drawn wrong is exactly the
 * kind of thing nobody re-checks once it renders — the same reasoning `WardBar` (`ward-bar.tsx`)
 * already applies to a stacked bar.
 */
export function generateDemonstrationSeries(
  scenario: WardScenario,
  now: Instant,
  disclosure: DemonstrationSeriesDisclosure,
  shape: DemonstrationWalkShape,
): DemonstrationSeries {
  assertNonEmpty(disclosure.label, "label");
  assertNonEmpty(disclosure.whatItWouldMeasure, "whatItWouldMeasure");
  assertNonEmpty(disclosure.whyItIsNotReal, "whyItIsNotReal");

  const count = shape.points ?? DEFAULT_TREND_LENGTH;
  const minValue = shape.minValue ?? 0;
  const maxValue = shape.maxValue ?? Number.POSITIVE_INFINITY;

  assertFinite(shape.baseline, "baseline");
  assertFinite(shape.volatility, "volatility");
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`generateDemonstrationSeries: "points" must be a positive integer, got ${String(count)}.`);
  }
  if (shape.volatility < 0) {
    throw new Error(`generateDemonstrationSeries: "volatility" cannot be negative, got ${String(shape.volatility)}.`);
  }
  if (minValue > maxValue) {
    throw new Error(`generateDemonstrationSeries: "minValue" (${minValue}) is greater than "maxValue" (${maxValue}).`);
  }
  if (shape.baseline < minValue || shape.baseline > maxValue) {
    throw new Error(
      `generateDemonstrationSeries: "baseline" (${shape.baseline}) is outside [minValue, maxValue] ` +
        `(${minValue}, ${maxValue}) — every point would clamp to the same edge, drawing a flat line ` +
        "that misrepresents the shape asked for.",
    );
  }

  /*
   * 🔴 **THE CLOCK IS QUANTISED TO THE DAY, AND WITHOUT THAT THE INVENTED HISTORY REDREW ITSELF
   * EVERY REAL MINUTE.** `WardFlowProvider` runs `setInterval(…, 30_000)` and computes
   * `now = NOW_ANCHOR + anchorOffset + elapsedWallClockMinutes + clockOffset`, so `now` advances on
   * its own while somebody is looking at the page. The screens call this function in their render
   * body, so every minute boundary produced a different seed and **all thirty points were redrawn
   * as a different random walk** — not shifted, not extended: different.
   *
   * ⚠️ **A chart that visibly changes every minute reads as live telemetry, which is the single
   * impression these pages exist to refuse.** This module's own header already named the failure —
   * *"a coordinator who reloads the page mid-shift would watch invented history reshuffle itself,
   * which is a stranger and more suspicious thing for a demonstration figure to do than simply
   * being invented in the first place"* — and reasoned about RE-RENDER stability, which it had
   * right. It did not reason about the clock MOVING, and the clock moves by itself.
   *
   * ⚠️ **NO TEST COULD SEE IT.** `WardFlowProvider` short-circuits the wall clock whenever
   * `initialNow` is given ("pinned: never touch the wall clock"), and every DOM suite pins it. The
   * behaviour is unreachable from the suite by construction, which is why it survived.
   *
   * Quantising here rather than at the three call sites: a caller passing the live clock is the
   * ordinary, correct thing for them to do, and a rule they must remember is the kind that gets
   * forgotten by the fourth chart. `now` stays in the signature so the determinism control — two
   * materially different clocks must give different series — still means something.
   */
  const seedDay = Math.floor(now / MINUTES_PER_DAY);
  const random = mulberry32(hashSeed(`${scenario}|${seedDay}|${disclosure.label}`));
  const points = walk(random, count, shape.baseline, shape.volatility, minValue, maxValue);

  return {
    label: disclosure.label,
    whatItWouldMeasure: disclosure.whatItWouldMeasure,
    whyItIsNotReal: disclosure.whyItIsNotReal,
    points,
    [__demonstration]: true,
  };
}
