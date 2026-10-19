import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/handover",
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
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "clipboard");
});

function renderAt(search: string) {
  window.history.replaceState({}, "", `/ward-flow/handover${search}`);
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

describe("handover output evidence boundaries", () => {
  it.each([
    ["ed:scgh-ed", "Sir Charles Gairdner Hospital Emergency Department"],
    [`team:${COMMUNITY_TEAM_PAGES[0]!.id}`, COMMUNITY_TEAM_PAGES[0]!.name],
  ])("keeps the wider ward population explicit when the selected scope is %s", (scope, label) => {
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderAt(`?scope=${encodeURIComponent(scope)}`);

    expect(scopeSummary()).toContain(label);
    const changes = within(screen.getByTestId("ward-handover-since"));
    expect(changes.getByText("admitted across accessible wards")).toBeInTheDocument();
    expect(changes.getByText("discharged across accessible wards")).toBeInTheDocument();
    // The copy action belongs to the phone digest sheet; desktop only displays the digest.
    cleanup();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 48rem)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    renderAt(`?scope=${encodeURIComponent(scope)}`);
    fireEvent.click(screen.getByTestId("ward-handover-phone-since"));
    fireEvent.click(
      within(screen.getByTestId("ward-handover-phone-since-sheet")).getByRole("button", {
        name: "Copy as handover text",
      }),
    );
    expect(writeText).toHaveBeenCalledOnce();
    const copied = writeText.mock.calls[0]![0];
    expect(copied).toContain(label);
    expect(copied).toContain("admitted across accessible wards");
    expect(copied).toContain("discharged across accessible wards");
    expect(copied).toContain("Synthetic demonstration · Not approved for clinical use");
  });

  it("records preparation, never successful printing, when the native dialog returns without confirmation", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderAt("");
    fireEvent.click(screen.getByTestId("ward-handover-more"));
    fireEvent.click(screen.getByRole("menuitem", { name: /Print handover/ }));
    fireEvent.click(screen.getByRole("button", { name: "Print or save PDF" }));
    expect(print).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Back to handover" }));

    expect(screen.getByTestId("ward-handover-sign-off-checks")).toHaveTextContent("Copy prepared for printing");
    expect(screen.getByTestId("ward-handover-sign-off-checks")).not.toHaveTextContent("Printed copy taken");
    fireEvent.click(screen.getByRole("tab", { name: /History/ }));
    expect(screen.getByTestId("ward-handover-history")).toHaveTextContent("printing not confirmed");
    expect(screen.getByTestId("ward-handover-history")).not.toHaveTextContent("Printed copy taken");
  });
});
