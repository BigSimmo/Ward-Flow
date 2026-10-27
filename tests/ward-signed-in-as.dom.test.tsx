import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { WardAskForAccess, WardRolePicker } from "@/components/ward-management/ward-shared-role-gate";
import { WardSharedSaveStatus } from "@/components/ward-management/ward-shared-save-status";
import type { WardSharedConnection } from "@/components/ward-management/ward-shared-access";

// #791: a person with more than one account can see which one this tab is signed in to.
const email = "synthetic.nurse@example.test";

it("names the signed-in account beside Sign out on the shared status line", () => {
  render(
    <WardSharedSaveStatus
      deskLabel="Coordinator"
      connection={
        { status: "ready", accountEmail: email, retry: () => {}, signOut: () => {} } as unknown as WardSharedConnection
      }
    />,
  );
  expect(screen.getByTestId("ward-signed-in-as")).toHaveTextContent(`Signed in as ${email}.`);
  expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
});

it("names the account on the no-role and role picker screens, and says nothing without one", () => {
  const { unmount } = render(
    <WardAskForAccess canRequest={false} api={null} accountEmail={email} onRetry={vi.fn()} onSignOut={vi.fn()} />,
  );
  expect(screen.getByTestId("ward-signed-in-as")).toHaveTextContent(`Signed in as ${email}.`);
  unmount();
  const picker = render(<WardRolePicker choices={[]} accountEmail={email} onChoose={vi.fn()} onSignOut={vi.fn()} />);
  expect(screen.getByTestId("ward-signed-in-as")).toHaveTextContent(`Signed in as ${email}.`);
  picker.unmount();
  render(<WardRolePicker choices={[]} onChoose={vi.fn()} onSignOut={vi.fn()} />);
  expect(screen.queryByTestId("ward-signed-in-as")).toBeNull();
});
