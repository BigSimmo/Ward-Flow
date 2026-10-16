// Role access later pass (16 Oct 2026): signed in to the shared workspace, the role comes from the
// server. The Go to a desk sheet opens a desk's screens but never changes the role, and says so.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/ward/rph-adult-secure",
  useRouter: () => ({ push: vi.fn() }),
}));

import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  readWardAccessSnapshot,
  resetWardAccessStoreForTests,
  setWardAccess,
} from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";

const ward = { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } } as const;

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

function sheet(shared: boolean, onSelectRole = vi.fn()) {
  const tree = <OperatorSwitcherModal isOpen onClose={() => {}} onSelectRole={onSelectRole} />;
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      {shared ? (
        <SharedAccessContext.Provider value={{ api: {} as SharedAccessApi, actorId: null }}>
          {tree}
        </SharedAccessContext.Provider>
      ) : (
        tree
      )}
    </WardFlowProvider>,
  );
}

describe("Go to a desk in the shared workspace", () => {
  it("opens the desk's screens without changing the role the server gave", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess(ward);
    });
    const onSelectRole = vi.fn();
    sheet(true, onSelectRole);
    expect(screen.getByTestId("workstation-shared-role-note")).toHaveTextContent("use Switch role");
    fireEvent.click(screen.getByTestId("workstation-open-coordinator"));
    expect(readWardAccessSnapshot().desk).toEqual(ward);
    // A desk the signed-in role cannot open stays shut, says why, and the rail keeps its persona.
    expect(screen.getByText(/That desk is not part of your role/u)).toBeInTheDocument();
    expect(onSelectRole).not.toHaveBeenCalled();
  });

  it("still takes the desk's access in the local demo", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess(ward);
    });
    sheet(false);
    expect(screen.queryByTestId("workstation-shared-role-note")).toBeNull();
    fireEvent.click(screen.getByTestId("workstation-open-coordinator"));
    expect(readWardAccessSnapshot().desk.role).toBe("coordinator");
  });
});
