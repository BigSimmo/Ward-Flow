import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/handover",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { HandoverPage, handoverScopeValue } from "@/components/ward-management/handover/handover-page";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **THE HANDOVER SHEET OPENS PRE-SCOPED TO A WARD, AND THAT IS THE WHOLE OF A3's PRINT HALF.**
 *
 * Owner ruling on Q-12, both halves:
 *   - **contents** — that ward's bed census, the movements pointed at it, today's confirmed figures,
 *     any discharge flag, and nothing identifying beyond what that ward's screen already shows
 *   - **route** — 🔴 **RE-USE this page, pre-scoped. NOT a second sheet.**
 *
 * ⚠️ **His REASON is the part that had to reach the code, because it is the argument against the
 * thing somebody will propose later:** *a second sheet is a second thing to keep truthful as the app
 * changes, and the two will drift.* **"Just draw a small one on the ward screen" is the tempting
 * version, and it is what this ruling forbids.**
 *
 * ✅ **The scope model is UNCHANGED by this.** `handoverScopeValue` / `parseHandoverScope` already
 * existed as a round-tripping pair for the `<select>`; the URL now seeds the same wire value. **No
 * new concept, no second source of truth for what a scope is.**
 *
 * 🔴 **AND THE FALLBACK IS DELIBERATE — DO NOT "TIGHTEN" IT.** An unrecognised scope shows the WHOLE
 * NETWORK rather than a 404 or an empty sheet. `parseHandoverScope`'s own words: it is *"never
 * produced by this page's own `<select>`, but never trusted either"*, and the network fallback
 * *"shows MORE than a broken filter would hide, never less."* ⚠️ **On a handover sheet, hiding
 * movements because a URL was malformed is the dangerous direction: a coordinator would read a short
 * list as a quiet shift.** The last case below pins that.
 *
 * ⚠️ **POPULATION.** The handover page in jsdom at one viewport, over the seeded state. It says
 * nothing about what prints — `@media print` is unreachable here — and nothing about the ward
 * screen's own control, which is pinned in its own file.
 */

const WARD = allUnits()[0];

function renderAt(search: string) {
  window.history.replaceState({}, "", `/mockups/ward-flow/handover${search}`);
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <HandoverPage />
    </WardFlowProvider>,
  );
}

function scopeSummary(): string {
  return screen.getByTestId("ward-handover-scope-summary").textContent ?? "";
}

describe("the handover sheet takes its scope from the URL", () => {
  it("🔴 ANTI-VACUITY — the ward under test has a name distinct from the network fallback", () => {
    expect(WARD.name.length, "no ward name to scope to").toBeGreaterThan(0);
    expect(
      WARD.name,
      "the ward is literally called 'Whole network', so a scoped sheet and an unscoped one would " +
        "read identically and every case below would pass on either",
    ).not.toBe("Whole network");
  });

  it("opens on the whole network when no scope is given, exactly as before", () => {
    renderAt("");
    expect(scopeSummary(), "the default changed — an unscoped visit must still be the whole network").toContain(
      "Whole network",
    );
  });

  it("opens scoped to the ward the link names", () => {
    const value = handoverScopeValue({ kind: "ward", id: WARD.id });
    renderAt(`?scope=${encodeURIComponent(value)}`);

    expect(
      scopeSummary(),
      `the sheet did not open scoped to ${WARD.name} — the link named it and the page ignored the URL`,
    ).toContain(WARD.name);
    expect(scopeSummary(), "the sheet is still showing the whole network despite a ward scope").not.toContain(
      "Whole network",
    );
  });

  it("round-trips through the page's own select value, not a second format", () => {
    // 🔴 The URL carries `handoverScopeValue`'s output and nothing else. A second encoding would be
    // a second source of truth for what a scope is, and the two would drift.
    const value = handoverScopeValue({ kind: "ward", id: WARD.id });
    renderAt(`?scope=${encodeURIComponent(value)}`);
    expect(
      (screen.getByTestId("ward-handover-scope-select") as HTMLSelectElement).value,
      "the control and the URL disagree about the scope — they are not the same wire value",
    ).toBe(value);
  });

  it("🔴 falls back to the WHOLE NETWORK on a malformed scope, never to an empty sheet", () => {
    for (const bad of ["ward:no-such-ward-anywhere", "not-a-scope", "ward:", "", "🙂"]) {
      renderAt(`?scope=${encodeURIComponent(bad)}`);
      const summary = scopeSummary();
      expect(
        summary.length,
        `a malformed scope (${JSON.stringify(bad)}) produced no scope summary at all — the page has ` +
          "started hiding its own heading rather than naming what it is showing",
      ).toBeGreaterThan(0);
      expect(
        summary,
        `a malformed scope (${JSON.stringify(bad)}) narrowed the sheet. On a handover, hiding movements ` +
          "because a URL was malformed reads to a coordinator as a quiet shift. It must show MORE, not less.",
      ).toContain("Whole network");
      cleanup();
    }
  });
});
