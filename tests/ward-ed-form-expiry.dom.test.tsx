import { render, screen, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Same reason as the sibling ward dom suites (ward-ed-screen.dom.test.tsx and others):
// `ClinicalRail` renders next/link anchors and this suite never checks routing, so a plain <a>
// avoids an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/**
 * 🔴 **TASK T1 — THE ED SCREEN STOPS COMPUTING FORM LIMITS.**
 *
 * `docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md` item 1, on owner answer 1 (17
 * September 2026), quoted verbatim in `docs/ward-flow/owner-answers-2026-09-17.md`: *"the timer
 * that starts when a patient arrives is separate to forms. One records time in ED and the other
 * is a forms category."* Before this task, the emergency department board computed a 72-hour
 * Form 1A validity window and a 72-hour Form 3D detention window from `formedAt` plus a
 * statutory-looking constant, and a "Legal clock" line that fell back to `openedAt` — the
 * department's OWN arrival clock — whenever `formedAt` was absent or later. That is the ED clock
 * standing in for a form clock, which is exactly the merge the owner's note forbids.
 *
 * The target this file proves: the form column now reads only `legalForm.dueAt` — a clinician's
 * own typed expiry, or its honest absence — and never `formedAt`, never `openedAt`, and no
 * FORM_*_HOURS constant (those stay exported from `ward-model.ts` for other callers; this screen
 * no longer imports them at all). Nothing on this line ever disables a control: the app works out
 * no legal time limits of its own, so a warning here is advice, never a gate.
 *
 * Every synthetic movement below is spread from the real seeded `WF-001` so every field
 * `Movement` requires is a real value already used elsewhere in `ward-movements.ts`, and only the
 * fields this suite cares about are overridden — the same discipline
 * `ward-legal-clock-needs-written-time.dom.test.tsx` uses for its own hand-built rows.
 */
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return { ...actual, useWardFlow: () => mockContext, useWardFlowClock: () => mockContext.now };
});

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const seeded = seedWardFlowState();
const base = seeded.movements.find((movement) => movement.id === "WF-001");
if (base === undefined) {
  throw new Error("fixture precondition: WF-001 is missing from the seed, so this suite's base movement is invalid");
}

const NO_EXPIRY_ID = "WF-TEST-EXPIRY-NONE";
const PAST_DUE_ID = "WF-TEST-EXPIRY-PAST";
const CLEAR_DUE_ID = "WF-TEST-EXPIRY-CLEAR";
const CLOSE_DUE_ID = "WF-TEST-EXPIRY-CLOSE";
const OPENED_A_ID = "WF-TEST-SEP-OPENED-A";
const OPENED_B_ID = "WF-TEST-SEP-OPENED-B";
const DUE_A_ID = "WF-TEST-SEP-DUE-A";
const DUE_B_ID = "WF-TEST-SEP-DUE-B";

/** Failing test (a): a Form 1A with `formedAt` and no `dueAt`. */
const noExpiry: Movement = {
  ...base,
  id: NO_EXPIRY_ID,
  formedAt: NOW - 400,
  legalForm: { code: "1A", kind: "examination" },
  referredUnitIds: [],
};

/** Failing test (b): a past `dueAt` — the expiry has passed. */
const pastDue: Movement = {
  ...base,
  id: PAST_DUE_ID,
  formedAt: undefined,
  legalForm: { code: "1A", kind: "examination", dueAt: NOW - 130 },
  referredUnitIds: ["fre-adult-open"],
};

/** Control: a `dueAt` well in the future — no warning should render at all. Also the "never
 *  disables a control" comparison partner for `pastDue`: identical in every field a control's
 *  blocked-reason function reads, differing only in `legalForm.dueAt`. */
const clearDue: Movement = {
  ...base,
  id: CLEAR_DUE_ID,
  formedAt: undefined,
  legalForm: { code: "1A", kind: "examination", dueAt: NOW + 1000 },
  referredUnitIds: ["fre-adult-open"],
};

/** A `dueAt` inside `clockState`'s "critical"/"due" band but not yet passed — the "close" wording,
 *  never the "past" one. */
const closeDue: Movement = {
  ...base,
  id: CLOSE_DUE_ID,
  formedAt: undefined,
  legalForm: { code: "1A", kind: "examination", dueAt: NOW + 30 },
  referredUnitIds: ["fre-adult-open"],
};

/** Failing test (c), first half: identical except `openedAt` — the form line must not move. */
const separationOpenedA: Movement = {
  ...base,
  id: OPENED_A_ID,
  openedAt: NOW - 500,
  formedAt: undefined,
  legalForm: { code: "1A", kind: "examination", dueAt: NOW - 60 },
};
const separationOpenedB: Movement = {
  ...separationOpenedA,
  id: OPENED_B_ID,
  openedAt: NOW - 900,
};

/** Failing test (c), second half: identical except `dueAt` — the access-target line must not
 *  move. */
const separationDueA: Movement = {
  ...base,
  id: DUE_A_ID,
  openedAt: NOW - 200,
  formedAt: undefined,
  legalForm: { code: "1A", kind: "examination", dueAt: NOW - 60 },
};
const separationDueB: Movement = {
  ...separationDueA,
  id: DUE_B_ID,
  legalForm: { code: "1A", kind: "examination", dueAt: NOW + 5000 },
};

const mockContext = {
  ...seeded,
  movements: [
    ...seeded.movements,
    noExpiry,
    pastDue,
    clearDue,
    closeDue,
    separationOpenedA,
    separationOpenedB,
    separationDueA,
    separationDueB,
  ],
  now: NOW,
  dispatch: vi.fn(),
  focusMovementId: undefined,
  setFocusMovementId: vi.fn(),
};

/** Controls this suite checks are never disabled by the warning — each is always rendered on the
 *  ED board (its blocked-reason function decides only `aria-disabled`, never whether the button
 *  itself appears), and none of the four functions behind them (`examinationBlockedReason`,
 *  `handoverBlockedReason`, `bookTransportBlockedReason`, `withdrawReferralBlockedReason`) reads
 *  `legalForm.dueAt`. */
const CHECKED_TOGGLES = [
  "ward-ed-examine-toggle",
  "ward-ed-handover",
  "ward-ed-book-transport-toggle",
  "ward-ed-withdraw-referral-toggle",
] as const;

describe("the ED screen's form-expiry line reads only the typed expiry", () => {
  afterEach(cleanup);

  it("Form 1A, formedAt present, no dueAt: shows 'No expiry recorded from the form.', never a computed limit", () => {
    render(<EdScreen edId="arm-ed" />);
    const line = screen.getByTestId(`ward-ed-form-expiry-${NO_EXPIRY_ID}`);
    expect(line).toHaveTextContent("No expiry recorded from the form.");
    expect(
      line.textContent ?? "",
      "must never show an hour-limit or a remaining/countdown figure when nobody has typed an expiry",
    ).not.toMatch(/\b(72|24)h\b|remaining \(/);
    expect(screen.queryByTestId(`ward-ed-form-expiry-warning-${NO_EXPIRY_ID}`)).not.toBeInTheDocument();
  });

  it("a past dueAt shows the passed line and the warning, and the warning never disables a control", () => {
    render(<EdScreen edId="arm-ed" />);

    const line = screen.getByTestId(`ward-ed-form-expiry-${PAST_DUE_ID}`);
    expect(line.textContent ?? "").toMatch(/^Expiry written on the form: .+\(passed .+ ago\)$/);

    const warning = screen.getByTestId(`ward-ed-form-expiry-warning-${PAST_DUE_ID}`);
    expect(warning).toHaveTextContent("Warning: past the expiry written on the form. Check the form.");
    expect(warning).toHaveAttribute("data-level", "warning");

    // "Never disables a control": pastDue and clearDue are identical in every field any
    // blocked-reason function on this board reads (stage, transport, closure, acceptedUnitId,
    // referredUnitIds) and differ ONLY in legalForm.dueAt — one past, one clear. If the warning
    // touched a control's disabled state, this comparison would diverge.
    for (const toggle of CHECKED_TOGGLES) {
      const pastControl = screen.getByTestId(`${toggle}-${PAST_DUE_ID}`);
      const clearControl = screen.getByTestId(`${toggle}-${CLEAR_DUE_ID}`);
      expect(
        pastControl.getAttribute("aria-disabled"),
        `${toggle}: a past-due warning must not change this control's disabled state`,
      ).toBe(clearControl.getAttribute("aria-disabled"));
    }
  });

  it("a dueAt inside the warning band but not yet passed shows the close warning, not the passed one", () => {
    render(<EdScreen edId="arm-ed" />);
    const warning = screen.getByTestId(`ward-ed-form-expiry-warning-${CLOSE_DUE_ID}`);
    expect(warning).toHaveTextContent("Warning: the expiry written on the form is close.");
    expect(warning).toHaveAttribute("data-level", "warning");
  });

  it("a dueAt well clear of the warning band shows no warning at all", () => {
    render(<EdScreen edId="arm-ed" />);
    expect(screen.getByTestId(`ward-ed-form-expiry-${CLEAR_DUE_ID}`).textContent ?? "").toMatch(
      /^Expiry written on the form: .+\(\d+.*left\)$/,
    );
    expect(screen.queryByTestId(`ward-ed-form-expiry-warning-${CLEAR_DUE_ID}`)).not.toBeInTheDocument();
  });

  /**
   * 🔴 **SEPARATION — THE PROPERTY THIS TASK EXISTS TO PROVE.**
   *
   * Two movements identical except `openedAt` must render identical form lines, because the form
   * line's only inputs are `legalForm` and `now`. Two identical except `legalForm.dueAt` must
   * render identical time-in-ED lines, because the access-target line's only inputs are
   * `openedAt`, `now` and the configured target. Neither line may read the other's input.
   *
   * Mutation this test is written to catch: pointing the expiry line at `movement.openedAt`
   * instead of `legalForm.dueAt` would make the first half fail (the two `openedAt`-differing
   * rows would diverge), which is exactly the `isCommunityFormed`/`legalClockReference` merge
   * this task deletes.
   */
  it("separation: openedAt never moves the form line, and dueAt never moves the time-in-ED line", () => {
    render(<EdScreen edId="arm-ed" />);

    const formA = screen.getByTestId(`ward-ed-form-expiry-${OPENED_A_ID}`);
    const formB = screen.getByTestId(`ward-ed-form-expiry-${OPENED_B_ID}`);
    expect(
      formA.textContent,
      "two movements differing only in openedAt must render an identical form-expiry line",
    ).toBe(formB.textContent);
    const warningA = screen.getByTestId(`ward-ed-form-expiry-warning-${OPENED_A_ID}`);
    const warningB = screen.getByTestId(`ward-ed-form-expiry-warning-${OPENED_B_ID}`);
    expect(warningA.textContent).toBe(warningB.textContent);

    const accessA = screen.getByTestId(`ward-ed-access-target-${DUE_A_ID}`);
    const accessB = screen.getByTestId(`ward-ed-access-target-${DUE_B_ID}`);
    expect(
      accessA.textContent,
      "two movements differing only in legalForm.dueAt must render an identical time-in-ED line",
    ).toBe(accessB.textContent);
  });
});
