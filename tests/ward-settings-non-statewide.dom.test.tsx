// tests/ward-settings-non-statewide.dom.test.tsx
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { commandScopeRefusal } from "@/components/ward-management/ward-access-state";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { ToastProvider } from "@/components/wf";

/**
 * P055: a service coordinator is not the statewide coordinator, and the save check refuses a
 * global settings change from anyone else. The Rules page must say so up front and grey its
 * controls out, instead of offering steppers that fail on Save. Made-up desks only.
 */
const SERVICE_COORDINATOR = { role: "coordinator", scope: { kind: "service", service: "East Metro" } } as const;
const STATEWIDE_COORDINATOR = { role: "coordinator", scope: { kind: "statewide" } } as const;

/** The sentence the save check itself gives, read from the check so the two cannot drift apart. */
function saveCheckSentence(): string {
  const refusal = commandScopeRefusal({} as WardFlowState, SERVICE_COORDINATOR, { type: "SET_CONFIGURATION" }, {
    now: 0,
    places: () => undefined,
  } as unknown as Parameters<typeof commandScopeRefusal>[3]);
  if (!refusal) throw new Error("the save check should refuse a service coordinator");
  return refusal;
}

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

function renderRules(access: typeof SERVICE_COORDINATOR | typeof STATEWIDE_COORDINATOR) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  });
  render(
    <ToastProvider>
      <WardFlowProvider>
        <SettingsScreen />
      </WardFlowProvider>
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("radio", { name: /^Rules/ }));
}

const edStepper = () => screen.getByRole("spinbutton", { name: "ED access target" });

describe("the Rules page for a coordinator who is not the statewide one", () => {
  it("greys out the steppers and the timing set, and says why in the save check's own words", () => {
    renderRules(SERVICE_COORDINATOR);
    const sentence = saveCheckSentence();
    expect(sentence).toBe("Only the statewide coordinator may change global settings.");

    expect(screen.getAllByRole("status").some((node) => node.textContent === sentence)).toBe(true);
    expect(edStepper()).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Increase ED access target" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Decrease ED access target" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("radio", { name: "Surge" })).toHaveAttribute("aria-disabled", "true");
  });

  it("does not let a press, a key or a click change a rule", () => {
    renderRules(SERVICE_COORDINATOR);
    const before = edStepper().getAttribute("aria-valuenow");
    fireEvent.click(screen.getByRole("button", { name: "Increase ED access target" }));
    fireEvent.keyDown(edStepper(), { key: "Home" });
    fireEvent.click(screen.getByRole("radio", { name: "Surge" }));
    expect(edStepper()).toHaveAttribute("aria-valuenow", before);
    expect(screen.queryByRole("region", { name: "Unsaved rule changes" })).not.toBeInTheDocument();
  });

  it("disables Save too when a draft is already open and the desk changes under it", () => {
    renderRules(STATEWIDE_COORDINATOR);
    fireEvent.keyDown(edStepper(), { key: "Home" });
    expect(screen.getByRole("button", { name: /^Save 1 change$/ })).not.toHaveAttribute("aria-disabled");

    act(() => setWardAccess(SERVICE_COORDINATOR));

    const save = screen.getByRole("button", { name: /^Save 1 change$/ });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText(saveCheckSentence()).length).toBeGreaterThan(0);
  });
});

describe("the Rules page for the statewide coordinator", () => {
  it("keeps working steppers and shows no explanation", () => {
    renderRules(STATEWIDE_COORDINATOR);
    expect(edStepper()).not.toHaveAttribute("aria-disabled");
    expect(screen.getByRole("button", { name: "Increase ED access target" })).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByText(saveCheckSentence())).not.toBeInTheDocument();
    fireEvent.keyDown(edStepper(), { key: "Home" });
    expect(screen.getByRole("button", { name: /^Save 1 change$/ })).not.toHaveAttribute("aria-disabled");
  });
});
