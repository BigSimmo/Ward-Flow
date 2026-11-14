import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// #801 (multi-account test, 26 Oct 2026): a ward desk read the coordinator's alerts as "Yours".
const NOW = NOW_ANCHOR;

function CoordinatorTakes({ inboxItemId }: { inboxItemId: string }) {
  const { dispatch } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "TAKE_INBOX_ITEM_OWNERSHIP", role: "coordinator", now: NOW, inboxItemId })}
    >
      Coordinator takes
    </button>
  );
}

function renderAs(role: "coordinator" | "ward") {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(
      role === "ward"
        ? { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } }
        : { role: "coordinator", scope: { kind: "statewide" } },
    );
  });
  const first = render(
    <WardFlowProvider initialNow={NOW}>
      <AlertsScreen />
    </WardFlowProvider>,
  );
  // The coordinator's own row: on the coordinator desk it names no owner, on another desk it names
  // the Bed coordinator alone. D-221's Late arrival row, owned by the coordinator, the accepting ward
  // and the sending team together, sorts first and is not the coordinator's alone.
  const row = [...first.container.querySelectorAll<HTMLElement>("li[data-alert-id]")].find((candidate) =>
    role === "ward"
      ? /With Bed coordinator(?!,)/u.test(candidate.textContent ?? "")
      : !/With /u.test(candidate.textContent ?? ""),
  )!;
  expect(row).toBeDefined();
  const id = row.dataset.alertId!;
  first.unmount();
  render(
    <WardFlowProvider initialNow={NOW}>
      <CoordinatorTakes inboxItemId={id} />
      <AlertsScreen />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Coordinator takes" }));
  return document.querySelector<HTMLElement>(`li[data-alert-id="${id}"]`)!;
}

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("the Yours lane belongs to the coordinator desk", () => {
  it("shows a ward desk the coordinator's row under the coordinator's name, never as its own", () => {
    const row = renderAs("ward");
    expect(within(row).getAllByText("Bed coordinator").length).toBeGreaterThan(0);
    expect(within(row).queryByText("You")).toBeNull();
    expect(within(row).queryByText("Yours")).toBeNull();
  });

  // Alerts redesign (1 Nov 2026): as on Home, the coordinator's own row names no owner at all.
  it("shows the coordinator its own row with no owner named", () => {
    const row = renderAs("coordinator");
    expect(within(row).queryByText("Bed coordinator")).toBeNull();
    expect(row.textContent).not.toMatch(/With /u);
  });
});
