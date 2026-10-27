import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { WardAskForAccess, WardRolePicker } from "@/components/ward-management/ward-shared-role-gate";
import { WardAccountActions } from "@/components/ward-management/shell/ward-account-actions";
import { SharedSessionContext } from "@/components/ward-management/shell/ward-shared-session-context";

// #791: a person with more than one account can see which one this tab is signed in to.
const email = "synthetic.nurse@example.test";

it("names the signed-in account on the rail's Sign out", () => {
  render(
    <SharedSessionContext.Provider value={{ signOut: () => {}, logRecordView: () => {}, accountEmail: email }}>
      <WardAccountActions className="link" />
    </SharedSessionContext.Provider>,
  );
  expect(screen.getByRole("button", { name: `Sign out ${email}` })).toHaveAttribute(
    "title",
    `Signed in as ${email}. Sign out`,
  );
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
