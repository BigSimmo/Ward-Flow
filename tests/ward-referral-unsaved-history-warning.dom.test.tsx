// tests/ward-referral-unsaved-history-warning.dom.test.tsx
//
// D-11 (`docs/ward-flow/owner-decisions-2026-09-1x.md`) — the half-written referral history warns
// before it is lost, and is never persisted anywhere to avoid that loss. Three catchers, matched to
// the brief this suite implements:
//   (a) the warning fires once the history has content;
//   (b) it does not fire on an untouched form;
//   (c) the text is never written to storage — the ruling's actual subject.
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite (see `ward-referral-screens.dom.test.tsx`'s own comment):
// `ClinicalRail` renders next/link anchors and this suite never checks routing, so a plain <a>
// avoids an App Router context jsdom cannot provide.
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReferralIntakeForm, UNSAVED_HISTORY_WARNING } from "@/components/ward-management/referrals/referral-intake";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const HISTORY_TESTID = "ward-referral-intake-history";
const WARNING_TESTID = "ward-referral-intake-history-unsaved-warning";

// A distinctive, unmistakable string: if any storage call ever carries it, the call is guilty
// beyond argument about coincidence — this is not text any unrelated feature (the sidebar-collapse
// preference included, see below) would ever legitimately write.
const CLINICAL_HISTORY_TEXT =
  "Seen at home this morning by the crisis team — patient named Alex Carmichael, distinctive-marker-8f3e1c";

function renderForm() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReferralIntakeForm />
    </WardFlowProvider>,
  );
}

function typeHistory(text: string) {
  fireEvent.change(screen.getByTestId(HISTORY_TESTID), { target: { value: text } });
}

describe("the referral history's unsaved-departure warning (D-11)", () => {
  it("does not warn on an untouched form", () => {
    renderForm();
    expect(screen.queryByTestId(WARNING_TESTID)).not.toBeInTheDocument();
  });

  it("warns, in the ruled wording, once the history has content", () => {
    renderForm();
    typeHistory(CLINICAL_HISTORY_TEXT);
    expect(screen.getByTestId(WARNING_TESTID)).toHaveTextContent(UNSAVED_HISTORY_WARNING);
  });

  it("clears again once the history is cleared back to empty — the warning tracks content, not a one-way flag that stays lit", () => {
    renderForm();
    typeHistory("Something written.");
    expect(screen.getByTestId(WARNING_TESTID)).toBeInTheDocument();
    typeHistory("");
    expect(screen.queryByTestId(WARNING_TESTID)).not.toBeInTheDocument();
  });

  it("whitespace-only text is not content to lose, matching writtenHistoryCount's own rule", () => {
    renderForm();
    typeHistory("   ");
    expect(screen.queryByTestId(WARNING_TESTID)).not.toBeInTheDocument();
  });

  /** The wording rule itself, spelled out as an assertion rather than left to a human reading the
   *  constant: it must say the text WILL be lost, and it must not use the hedge the ruling names by
   *  name as the phrase people learn to click through. */
  it("states the true consequence plainly, and never the vague hedge the ruling forbids by name", () => {
    expect(UNSAVED_HISTORY_WARNING).toMatch(/will\s+(be\s+)?los/i);
    expect(UNSAVED_HISTORY_WARNING.toLowerCase()).not.toContain("may not be saved");
    expect(UNSAVED_HISTORY_WARNING.toLowerCase()).not.toContain("changes may not be saved");
  });
});

describe("the native beforeunload guard (D-11 — reload and closing the tab)", () => {
  it("cancels the native departure once there is history content", () => {
    renderForm();
    typeHistory(CLINICAL_HISTORY_TEXT);
    const event = new Event("beforeunload", { cancelable: true });
    const notPrevented = window.dispatchEvent(event); // false once preventDefault() was called
    expect(notPrevented).toBe(false);
  });

  it("does not cancel the native departure on an untouched form", () => {
    renderForm();
    const event = new Event("beforeunload", { cancelable: true });
    const notPrevented = window.dispatchEvent(event);
    expect(notPrevented).toBe(true);
  });
});

describe("D-11's actual subject — the written history is never persisted anywhere", () => {
  let setItem: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // ONE spy: `localStorage` and `sessionStorage` are both `Storage` instances sharing this same
    // prototype method, so one spy on it sees every call either object makes.
    //
    // Spying rather than asserting zero calls: `ClinicalRail`'s sidebar-collapse preference
    // legitimately calls `localStorage.setItem` on its own key
    // (`use-ward-sidebar-collapsed.ts`), and a blanket "never called" assertion would be wrong
    // about that unrelated feature. What D-11 actually forbids is the HISTORY reaching storage —
    // so every call recorded here is inspected for the distinctive text, never merely counted.
    setItem = vi.spyOn(Storage.prototype, "setItem");
  });

  afterEach(() => {
    setItem.mockRestore();
  });

  it("never writes the written history to localStorage or sessionStorage, while typing, warning and attempting to leave", () => {
    renderForm();
    typeHistory(CLINICAL_HISTORY_TEXT);
    // The warning is now showing (proven by the earlier suite); attempt the departure a real
    // clinician would try next, so a storage write triggered only on "leaving" is caught too.
    window.dispatchEvent(new Event("beforeunload", { cancelable: true }));

    const everyCallArgument = setItem.mock.calls.flat().map((argument: unknown) => String(argument));
    for (const argument of everyCallArgument) {
      expect(argument).not.toContain(CLINICAL_HISTORY_TEXT);
      expect(argument.toLowerCase()).not.toContain("carmichael");
    }
  });

  it("the intake form's own source contains no reference to IndexedDB at all", () => {
    // jsdom in this suite provides no `indexedDB` global at all (`typeof window.indexedDB ===
    // "undefined"`), so there is nothing to spy on for a runtime assertion the way the two Storage
    // APIs above got one. This is the static equivalent: the ruling names IndexedDB explicitly, and
    // this proves the component makes no call into it by name, in either direction (reading a draft
    // back or writing one out).
    expect(typeof (globalThis as { indexedDB?: unknown }).indexedDB).toBe("undefined");
    const source = readFileSync(
      join(process.cwd(), "src/components/ward-management/referrals/referral-intake.tsx"),
      "utf8",
    );

    // 🔴 COMMENTS ARE STRIPPED FIRST, AND THAT IS LOAD-BEARING RATHER THAN TIDY. The component's
    // own header explains D-11 by NAMING the three storage mechanisms it must never use — "not
    // `localStorage`, not `sessionStorage`, not IndexedDB". A bare source scan therefore fails on
    // the sentence that documents the rule, so the better the file is explained the redder this
    // goes. Same repair, and the same reasoning, as the D15 boundary guard in
    // `tests/ward-referral-matching.test.ts`, which strips comments before extracting imports for
    // exactly this reason.
    //
    // The anti-vacuity risk this creates is the obvious one — a stripper that removes everything
    // would make the assertion unfailable — so the floor below proves the code survived stripping
    // before anything is concluded from its absence.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    expect(code.length, "comment stripping removed the whole file — this check would prove nothing").toBeGreaterThan(
      2000,
    );
    expect(code).toMatch(/useState/);

    expect(code).not.toMatch(/indexedDB/i);
  });
});
