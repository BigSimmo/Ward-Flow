import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/settings",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { ToastProvider } from "@/components/wf";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  readWardAccessSnapshot,
  resetWardAccessStoreForTests,
  setWardAccess,
} from "@/components/ward-management/shell/ward-access-store";
import { resetLocalAccessAdminForTests } from "@/components/ward-management/shell/ward-access-admin-store";
import { forgetStepUp } from "@/components/ward-management/shell/ward-step-up";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";

/**
 * The Settings Access tab (role access plan, later pass): an Access admin desk gives, approves and
 * removes roles, a nurse in charge gives cover, and each change asks to confirm it is you first.
 * Made-up demonstration staff only.
 */
afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
    resetLocalAccessAdminForTests();
  });
  forgetStepUp();
});

function settings() {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SettingsScreen />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

function confirmStepUp() {
  const dialog = screen.getByTestId("ward-step-up");
  fireEvent.click(within(dialog).getByRole("button", { name: "Confirm and carry on" }));
}

describe("the Access tab", () => {
  it("is not offered with the role-access flag off", () => {
    settings();
    expect(screen.queryByRole("radio", { name: /^Access/ })).not.toBeInTheDocument();
  });

  it("opens an Access admin desk on the roles list, and gives a role after a fresh confirm", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "admin", scope: { kind: "statewide" } });
    });
    settings();
    expect(screen.getByRole("radio", { name: /^Access/ })).toBeChecked();
    expect(screen.getByTestId("ward-access-requests")).toHaveTextContent("2 open requests");
    expect(screen.getByTestId("ward-access-waiting")).toHaveTextContent("Demo staff D");

    fireEvent.click(screen.getByTestId("ward-access-grant-submit"));
    await act(async () => confirmStepUp());
    expect(await screen.findByTestId("ward-access-result")).toHaveTextContent("Given: Demo access admin 2");

    // One confirm lasts the step-up window, so approving straight after asks nothing.
    const waiting = screen.getByTestId("ward-access-waiting");
    await act(async () => fireEvent.click(within(waiting).getByRole("button", { name: "Approve" })));
    expect(screen.queryByTestId("ward-step-up")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-access-result")).toHaveTextContent("Approved: Flow coordinator, South Metro.");
    expect(screen.queryByTestId("ward-access-waiting")).not.toBeInTheDocument();
  });

  it("changes nothing when the confirm is cancelled", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "admin", scope: { kind: "statewide" } });
    });
    settings();
    const rows = screen.getAllByTestId("ward-access-role-row").length;
    fireEvent.click(screen.getByTestId("ward-access-grant-submit"));
    await act(async () =>
      fireEvent.click(within(screen.getByTestId("ward-step-up")).getByRole("button", { name: "Cancel" })),
    );
    expect(screen.getByTestId("ward-access-result")).toHaveTextContent("Cancelled. Nothing was changed.");
    expect(screen.getAllByTestId("ward-access-role-row")).toHaveLength(rows);
  });

  it("lets a nurse in charge give cover of their own ward, and end it", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["fsh-adult-secure"] } });
    });
    settings();
    fireEvent.click(screen.getByRole("radio", { name: /^Access/ }));
    fireEvent.click(screen.getByTestId("ward-access-cover-submit"));
    await act(async () => confirmStepUp());
    expect(screen.getByTestId("ward-access-result")).toHaveTextContent("Cover given");
    expect(readWardAccessSnapshot().covers).toHaveLength(1);
    const list = screen.getByTestId("ward-access-cover-list");
    fireEvent.click(within(list).getByRole("button", { name: "End cover" }));
    expect(readWardAccessSnapshot().covers).toHaveLength(0);
  });
});
