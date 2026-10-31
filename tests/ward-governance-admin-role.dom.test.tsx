import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GovernanceWorkbench } from "@/components/ward-management/governance-registers";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Governance as the access admin (redesign build, Josh, 31 Oct 2026): this desk sees no patients and
 * no clinical content, so it has Review and the Audit trail only, and with nothing to review the page
 * is the tabs and one empty state that points to the Access log in Settings.
 */

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

function asDesk(role: "admin" | "coordinator") {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role, scope: { kind: "statewide" } });
  });
}

function renderEmpty() {
  const seed = seedWardFlowState();
  return render(<GovernanceWorkbench movements={seed.movements} units={seed.units} now={NOW_ANCHOR} />);
}

function withPhone(run: () => void) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query === "(max-width: 48rem)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  try {
    run();
  } finally {
    window.matchMedia = original;
  }
}

describe("Governance as the access admin", () => {
  it("offers only Review and Audit trail, with no chronology link", () => {
    asDesk("admin");
    renderEmpty();
    const tabs = screen.getAllByRole("radio").map((tab) => tab.textContent ?? "");
    expect(tabs.some((label) => label.startsWith("Review"))).toBe(true);
    expect(tabs.some((label) => label.startsWith("Audit trail"))).toBe(true);
    expect(tabs.some((label) => /gaps|Registers|Reports/i.test(label))).toBe(false);
    expect(screen.queryByRole("link", { name: /PIR chronology/ })).not.toBeInTheDocument();
  });

  it("shows one empty state with the Access log link when nothing waits", () => {
    asDesk("admin");
    renderEmpty();
    expect(screen.getByRole("heading", { name: "Nothing waiting for review" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the Access log" })).toHaveAttribute(
      "href",
      "/ward-flow/settings#access",
    );
    expect(screen.queryByRole("button", { name: "Record review" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Show in the review list" })).not.toBeInTheDocument();
  });

  it("keeps the review list and its controls when events wait", () => {
    asDesk("admin");
    function Harness() {
      const flow = useWardFlow();
      return <GovernanceWorkbench movements={flow.movements} units={flow.units} now={NOW_ANCHOR} api={flow} />;
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("button", { name: "Record review" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open the Access log" })).not.toBeInTheDocument();
  });

  it("drops Gaps, Registers and Reports on a phone", () => {
    withPhone(() => {
      asDesk("admin");
      renderEmpty();
      const phone = screen.getByTestId("ward-governance-phone");
      expect(phone).not.toHaveTextContent("Form gaps");
      expect(screen.queryByRole("button", { name: /Registers/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Reports/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Review next/ })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Open the Access log" })).toBeInTheDocument();
    });
  });
});

describe("Governance as the coordinator", () => {
  it("keeps every view, the chronology link and no Access log link", () => {
    asDesk("coordinator");
    renderEmpty();
    fireEvent.click(screen.getByRole("radio", { name: /^Review/ }));
    expect(screen.getByRole("radio", { name: /^Form gaps by site/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Registers/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PIR chronology/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open the Access log" })).not.toBeInTheDocument();
  });
});
