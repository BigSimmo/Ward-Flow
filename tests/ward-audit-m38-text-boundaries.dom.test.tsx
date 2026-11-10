// tests/ward-audit-m38-text-boundaries.dom.test.tsx
//
// Audit item M38: text and boundary content. Long text at the limit, Unicode from several scripts,
// line breaks and empty values go through save (the backend engine and the reducer), reload
// (stored JSON validation), display (written history and corrections), and copy or print (the
// ISBAR summary) without changing meaning. The boundary figures (a ward of 0 beds, a ward with
// more people than beds, a ward full of closed beds) keep the Bed board's four boxes adding up,
// never negative, never NaN. Synthetic text only.

import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applyCommand, seedWorld } from "../backend/ward-flow/engine";
import { isbarText } from "@/components/ward-management/referrals/referral-board-sheets";
import { ReferralHistoryAndCorrections } from "@/components/ward-management/referrals/referral-history-corrections";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import {
  REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS,
  REFERRAL_HISTORY_LIMITS,
} from "@/components/ward-management/ward-model-referral-parts";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { RECEIVE_REFERRAL_CANDIDATE } from "./helpers/ward-legal-figure-sweep";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/ward-flow/coordinator",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
afterEach(cleanup);

const at = new Date("2026-10-19T10:00:00Z");
/** Several scripts, combining marks, emoji with joiners and skin tones, right-to-left text. */
const UNICODE = "Café naïve — 東京 · Ελληνικά · עברית · العربية · हिन्दी · 👩🏽\u200D⚕️🛏️ · é · Ngaanyatjarra";
const MULTILINE = `First line.\n\nSecond paragraph after a blank line.\n${UNICODE}\nLast line.`;
/** Built so the cut never splits an emoji's surrogate pair: Unicode first, then plain padding. */
const AT_LIMIT = `${UNICODE}\n`.padEnd(REFERRAL_HISTORY_LIMITS.history, "x");

function save(history: string) {
  const result = applyCommand(
    seedWorld(at),
    { ...RECEIVE_REFERRAL_CANDIDATE, type: "RECEIVE_REFERRAL", role: "community", now: 642, history },
    at,
  );
  if (result.outcome !== "accepted") throw new Error(`refused: ${JSON.stringify(result).slice(0, 400)}`);
  const state = JSON.parse(JSON.stringify(result.world.state)) as WardFlowState;
  expect(isValidStoredWardFlowState(state), "reloads as a valid stored state").toBe(true);
  return { state, referral: state.referrals.at(-1)! };
}

describe("M38 text round trip", () => {
  it.each([
    ["Unicode", UNICODE],
    ["line breaks", MULTILINE],
    ["exactly at the limit", AT_LIMIT],
  ])("keeps %s exactly through save, reload, display and copy", (_label, text) => {
    const { referral } = save(text);
    expect(referral.history).toBe(text);
    expect(referral.history.length).toBe(text.length);
    const { getByTestId } = render(<ReferralHistoryAndCorrections referral={referral} now={NOW_ANCHOR} readOnly />);
    expect(getByTestId("ward-referral-history-text").textContent).toBe(text);
    // The copied and printed summary says the same words, whatever spacing it uses.
    const words = (value: string) => value.split(/\s+/).filter(Boolean);
    const summary = isbarText(referral, "Synthetic Person", "UM000000", "Adult", NOW_ANCHOR);
    for (const word of words(text).slice(0, 40)) expect(summary).toContain(word);
  });

  it("refuses one character past the limit instead of cutting it short", () => {
    const over = "x".repeat(REFERRAL_HISTORY_LIMITS.history + 1);
    expect(
      applyCommand(
        seedWorld(at),
        { ...RECEIVE_REFERRAL_CANDIDATE, type: "RECEIVE_REFERRAL", role: "community", now: 642, history: over },
        at,
      ).outcome,
    ).not.toBe("accepted");
  });

  it("says an empty history is not written, rather than showing a blank", () => {
    const { referral } = save("");
    expect(referral.history).toBe("");
    const { getByTestId } = render(<ReferralHistoryAndCorrections referral={referral} now={NOW_ANCHOR} readOnly />);
    expect(getByTestId("ward-referral-history-text")).toHaveTextContent("Not written yet.");
  });

  it("keeps a correction note at its limit, in Unicode with line breaks, and refuses a blank one", () => {
    const { state, referral } = save("Synthetic history");
    const note = `${MULTILINE}\n`.padEnd(REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS, "y");
    const add = (value: string, from: WardFlowState) =>
      wardFlowReducer(from, {
        type: "ADD_REFERRAL_CORRECTION",
        role: "coordinator",
        now: NOW_ANCHOR + 1,
        referralId: referral.id,
        note: value,
      });
    const saved = add(note, state);
    expect(saved.rejections).toHaveLength(state.rejections.length);
    const reloaded = JSON.parse(JSON.stringify(saved)) as WardFlowState;
    expect(isValidStoredWardFlowState(reloaded)).toBe(true);
    const stored = reloaded.referrals.find((candidate) => candidate.id === referral.id)!;
    expect(stored.corrections?.at(-1)?.note).toBe(note);
    expect(add("   \n  ", state).rejections).toHaveLength(state.rejections.length + 1);
    expect(add(note + "x", state).rejections).toHaveLength(state.rejections.length + 1);
  });
});

describe("M38 boundary figures on the Bed board", () => {
  // The Bed board reads the ward's own stated figures (beds, empty, allocatable), not a head count.
  const base = () => seedWardFlowState().units[0]!;
  const ward = (beds: number, empty: number, allocatable: number) => {
    const unit = base();
    return {
      ...unit,
      beds,
      closedBeds: [],
      empty: { ...unit.empty, value: empty },
      allocatable: { ...unit.allocatable, value: allocatable },
      allocatableLocked: allocatable,
      held: 0,
      blocked: 0,
    };
  };
  const sane = (counts: ReturnType<typeof bedStates>, beds: number) => {
    for (const [key, value] of Object.entries(counts)) {
      expect(Number.isFinite(value), key).toBe(true);
      expect(value, key).toBeGreaterThanOrEqual(0);
    }
    expect(counts.ready + counts.pulled + counts.closed + counts.occupied, "the four boxes add up").toBe(beds);
  };

  it("a ward of 0 beds shows four zeros", () => {
    const counts = bedStates(ward(0, 0, 0), [], [], []);
    sane(counts, 0);
    expect(counts).toMatchObject({ ready: 0, pulled: 0, closed: 0, occupied: 0 });
  });

  it("a full ward of 60 beds shows 60 occupied and no Ready bed", () => {
    const counts = bedStates(ward(60, 0, 0), [], [], []);
    sane(counts, 60);
    expect(counts.occupied).toBe(60);
    expect(counts.ready).toBe(0);
  });

  it("an impossible statement (more empty beds than beds) never reaches the board: reload refuses it", () => {
    // bedStates itself does not clamp this case (its four boxes would sum past the beds), so the
    // guard that matters is the stored-state check, which refuses the ward before any screen reads it.
    const state = seedWardFlowState();
    const first = state.units[0]!;
    const overstated = { ...first, empty: { ...first.empty, value: first.beds + 1 } };
    const impossible = { ...state, units: [overstated, ...state.units.slice(1)] };
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(impossible)))).toBe(false);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
  });

  it("a ward with every empty bed closed shows no Ready bed and still adds up", () => {
    const unit = {
      ...ward(6, 6, 6),
      closedBeds: Array.from({ length: 6 }, (_, i) => ({ bedNumber: i + 1, at: NOW_ANCHOR, by: "ward" })),
    };
    const counts = bedStates(unit, [], [], []);
    sane(counts, 6);
    expect(counts.ready).toBe(0);
  });
});
