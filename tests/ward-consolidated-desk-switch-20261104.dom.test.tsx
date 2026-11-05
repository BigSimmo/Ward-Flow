import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SharedSessionContext } from "@/components/ward-management/shell/ward-shared-session-context";
import { useDeskRoleSwitch } from "@/components/ward-management/ward-role-gate";
vi.mock("next/navigation", () => ({ usePathname: () => "/ward-flow/officer" }));
function Probe() {
  const action = useDeskRoleSwitch();
  return action.canSwitch ? (
    <button onClick={() => action.switchDesk("ward", "/ward-flow/officer")}>
      {action.shared ? "Choose a desk" : "Switch to Ward desk"}
    </button>
  ) : (
    <p>No other desk</p>
  );
}
describe("shared desk prompts", () => {
  it("opens the account's authenticated role picker", () => {
    const switchRole = vi.fn();
    render(
      <SharedSessionContext.Provider value={{ signOut: vi.fn(), logRecordView: vi.fn(), switchRole }}>
        <Probe />
      </SharedSessionContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Choose a desk" }));
    expect(switchRole).toHaveBeenCalledOnce();
  });
  it("offers no preview switch for a shared account with one desk", () => {
    render(
      <SharedSessionContext.Provider value={{ signOut: vi.fn(), logRecordView: vi.fn() }}>
        <Probe />
      </SharedSessionContext.Provider>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("No other desk")).toBeInTheDocument();
  });
});
