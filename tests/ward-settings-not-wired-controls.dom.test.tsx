import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling settings dom suite: this screen renders next/link anchors and
// jsdom cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { SETTINGS_SEARCH_ENTRIES } from "@/components/ward-management/settings/settings-search-index";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

/**
 * Nine Settings controls in the "Third-edition configuration parameters" section held
 * local-only React state that nothing outside settings-screen.tsx read, while their copy claimed
 * a real clinical or operational effect: dispatching a breach alert, escalating to a consultant,
 * enforcing a statutory window, requiring an escort, or preventing a placement.
 *
 * Per owner decision D4 (docs/ward-flow/plans/2026-09-16-drawings-new-look-with-rules.md), a
 * control the engine cannot back is kept visible but says exactly
 * "Not wired in this prototype." — not deleted, not left claiming a false effect. Per D5, MHA
 * section numbers and time-limit figures do not appear in prototype copy as claims, and neither
 * does the word "statutory" nor an invented form code (Form 3A / Form 5A are not registered —
 * see ward-legal-forms.ts's SELECTABLE_LEGAL_FORMS).
 *
 * The first three (Form 4A Expiry Warning Window, Require a Form 1A before an involuntary admission, Form 4A Mandatory
 * Escort Classification) were fixed in commit 1cb1547bb5. The owner then authorised four more in
 * the same pass — Automated Multi-Service Escalation Broadcast (`autoEscalationAlerts`), Breach
 * Audit Log for Chief Psychiatrist (`audioBreachChimes`), Authorised Hospital Involuntary Bed
 * Validation (`multiCatchmentSearch`), and Gender Designation & Bay Integrity Enforcement
 * (`genderMixProtection` — gender/bed matching is an open owner question).
 *
 * Task 9 of the audit-wiring plan (2026-09-16) resolved the remaining five: three
 * (edThresholdHours, parallelCap, holdDurationMinutes) now have a real engine counterpart —
 * `state.configuration.edAccessTargetMinutes`/`parallelReferralCap`/`pullHoldMinutes`, read by
 * the ED screen, REFER_TO_UNITS/RECEIVE_REFERRAL, and PULL_PATIENT respectively — and are wired
 * for real: a slider edits a local draft, "Save coordination rules" dispatches SET_CONFIGURATION, and
 * the change is recorded in the audit trail (see tests/ward-settings-configuration.dom.test.tsx).
 * The last two (medicalReleaseMinutes, acuityCeiling) have no engine counterpart at all — a
 * medical-clearance buffer and a network-wide acuity ceiling are not concepts this model holds
 * (acuity capacity is `Unit.highAcuityCapacity`, per-unit authored capacity, never a single
 * ceiling this control could plausibly write) — and join the not-wired enumeration below instead.
 *
 * Each row's description is checked against the forbidden pattern, not its title: a control's
 * own name (e.g. "Require a Form 1A before an involuntary admission", "Gender Designation & Bay Integrity
 * Enforcement") may keep a word like "Enforcement" as its label — that is what the control is
 * called, not a claim that it currently does anything. The false claim lived in the
 * description sentence, and that sentence is what D4 replaced.
 *
 * Each control is `aria-disabled` (not natively `disabled`) so it stays keyboard-reachable —
 * matching `ignoreUnavailableActivation`'s rationale in
 * src/components/primitive-recipes/recipes.ts: a `disabled` control drops out of the tab
 * order and a screen-reader user moving by Tab never reaches the reason.
 */

const NOT_WIRED = "Not wired in this prototype.";

// dispatch/escalate/enforce/block/statutory claims, MHA section references, and hour/minute
// figures presented as an enforced limit — the shape of every false operational claim these
// controls carried before D4/D5.
const FORBIDDEN_CLAIM = /dispatch|escalat|enforc|block|statutory|section \d|\d+\s?h(ours?)?\b/i;

interface UnwiredControl {
  readonly rowTestId: string;
  readonly descTestId: string;
  readonly title: string;
  readonly role: "slider" | "checkbox" | "combobox";
}

// The nine rows retired as not-wired: the original seven (commits 1cb1547bb5 and this pass's
// owner-authorised four) plus the two Task 9 could not give a real engine counterpart.
// edThresholdHours, parallelCap and holdDurationMinutes are now genuinely wired — see
// tests/ward-settings-configuration.dom.test.tsx — and are deliberately excluded from this list.
const UNWIRED_CONTROLS: readonly UnwiredControl[] = [
  // Domain 1 · Clinical Escalation & Breach Thresholds
  {
    rowTestId: "setting-form4a-warn-row",
    descTestId: "setting-form4a-warn-desc",
    title: "Form 4A expiry warning",
    role: "slider",
  },
  {
    rowTestId: "setting-auto-escalate-row",
    descTestId: "setting-auto-escalate-desc",
    title: "Text all services",
    role: "checkbox",
  },
  {
    rowTestId: "setting-medical-release-row",
    descTestId: "setting-medical-release-desc",
    title: "Clearance bed buffer",
    role: "combobox",
  },
  // Domain 2 · Capacity, Bed Reservation & Surge Rules
  {
    rowTestId: "setting-gender-mix-row",
    descTestId: "setting-gender-mix-desc",
    title: "Bay and gender rules",
    role: "checkbox",
  },
  {
    rowTestId: "setting-acuity-ceiling-row",
    descTestId: "setting-acuity-ceiling-desc",
    title: "Specialling limit",
    role: "combobox",
  },
  // Domain 3 · Mental Health Act 2014 Parameters
  {
    rowTestId: "setting-form1a-strict-row",
    descTestId: "setting-form1a-strict-desc",
    title: "Form 1A before involuntary",
    role: "checkbox",
  },
  {
    rowTestId: "setting-form4a-escort-row",
    descTestId: "setting-form4a-escort-desc",
    title: "Escort before transport",
    role: "checkbox",
  },
  {
    rowTestId: "setting-auth-hospital-row",
    descTestId: "setting-auth-hospital-desc",
    title: "Authorised bed check",
    role: "checkbox",
  },
  {
    rowTestId: "setting-cp-audit-row",
    descTestId: "setting-cp-audit-desc",
    title: "Chief Psychiatrist audit",
    role: "checkbox",
  },
];

function renderSettings() {
  render(
    <WardFlowProvider>
      <SettingsScreen />
    </WardFlowProvider>,
  );
}

describe("settings screen — the nine controls retired as not-wired in this prototype pass", () => {
  it.each(UNWIRED_CONTROLS)(
    "shows 'Not wired in this prototype.' on $title, with no forbidden claim in its description, and is aria-disabled without being natively disabled",
    ({ rowTestId, descTestId, role }) => {
      renderSettings();
      const row = screen.getByTestId(rowTestId);
      const desc = within(row).getByTestId(descTestId);

      expect(desc.textContent).toContain(NOT_WIRED);
      expect(desc.textContent).not.toMatch(FORBIDDEN_CLAIM);

      const control = within(row).getByRole(role);
      expect(control).toHaveAttribute("aria-disabled", "true");
      expect(control).not.toBeDisabled();
      expect(control.hasAttribute("disabled")).toBe(false);
    },
  );

  it("still shows the read-only illustrative title on every one of the nine fixed controls (D4: keep them visible)", () => {
    renderSettings();
    for (const { title } of UNWIRED_CONTROLS) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it("does not leave any Mental Health Act section number or hour/minute limit in settings-search-index.ts for these nine controls", () => {
    const ids = new Set(UNWIRED_CONTROLS.map((c) => c.rowTestId.replace(/-row$/, "")));
    const entries = SETTINGS_SEARCH_ENTRIES.filter((entry) => ids.has(entry.id));

    expect(entries).toHaveLength(UNWIRED_CONTROLS.length);

    for (const entry of entries) {
      expect(`${entry.label} ${entry.keywords}`).not.toMatch(/section\s*\d|s\d{2}\b/i);
      expect(`${entry.label} ${entry.keywords}`).not.toMatch(/\d+\s?(h|hour|hours|m|min|minute|minutes)\b/i);
    }
  });
});

/**
 * Task 9 of the audit-wiring plan, 2026-09-16: the mirror of the suite above. Where the nine rows
 * must say they do nothing, these three must say — and prove — that they do.
 */
describe("settings screen — the three controls Task 9 actually wired", () => {
  const WIRED_ROW_IDS = ["setting-ed-threshold", "setting-hold-duration", "setting-parallel-cap"];

  it("are not aria-disabled, unlike their nine not-wired siblings", () => {
    renderSettings();
    for (const id of WIRED_ROW_IDS) {
      const control = document.getElementById(id) as HTMLElement;
      expect(control, `#${id} did not render`).not.toBeNull();
      expect(control).not.toHaveAttribute("aria-disabled");
    }
  });

  it("moving the ED access target slider dispatches nothing until Save coordination rules is pressed", () => {
    function Probe() {
      const { configuration } = useWardFlow();
      return <span data-testid="probe-ed-target">{configuration.edAccessTargetMinutes}</span>;
    }
    render(
      <WardFlowProvider>
        <SettingsScreen />
        <Probe />
      </WardFlowProvider>,
    );

    const before = screen.getByTestId("probe-ed-target").textContent;
    fireEvent.change(document.getElementById("setting-ed-threshold") as HTMLInputElement, {
      target: { value: "720" },
    });
    expect(screen.getByTestId("probe-ed-target").textContent).toBe(before);

    fireEvent.click(screen.getByRole("button", { name: "Save coordination rules" }));
    expect(screen.getByTestId("probe-ed-target").textContent).toBe("720");
  });
});
