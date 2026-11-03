import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmHost } from "@/components/wf/confirm-dialog";
import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal";
import { dispatchPersonaSyncForRole, useShellPersonaRole } from "@/components/ward-management/settings/persona-sync";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import {
  readWardAccessSnapshot,
  resetWardAccessStoreForTests,
} from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/settings",
  useRouter: () => ({ push: navigation.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
const closed = vi.fn();

function DraftDesk() {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const persona = useShellPersonaRole();
  useDirtyStateGuard({ isDirty: draft.length > 0 });
  return (
    <>
      <ConfirmHost />
      <input aria-label="Unfinished work" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <output data-testid="persona">{persona}</output>
      <button type="button" onClick={() => setOpen(true)}>
        Change desk
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        Close desk drawer
      </button>
      <OperatorSwitcherModal
        isOpen={open}
        onClose={() => {
          closed();
          setOpen(false);
        }}
      />
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  navigation.push.mockReset();
  closed.mockReset();
  act(() => {
    resetWardAccessStoreForTests();
    setWardFeatureFlagOnDevice("role-access", true);
    dispatchPersonaSyncForRole("coordinator");
  });
});
afterEach(() =>
  act(() => {
    resetWardAccessStoreForTests();
    setWardFeatureFlagOnDevice("role-access", null);
    dispatchPersonaSyncForRole("coordinator");
  }),
);

describe("desk navigation with unfinished work", () => {
  it.each(["tile", "double-click"] as const)(
    "guards the %s before access, persona, close or route changes",
    async (kind) => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <DraftDesk />
        </WardFlowProvider>,
      );
      fireEvent.change(screen.getByRole("textbox", { name: "Unfinished work" }), {
        target: { value: "Synthetic draft" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Change desk" }));
      const original = readWardAccessSnapshot().access;
      const choose = () => {
        if (kind === "tile") fireEvent.click(screen.getByTestId("workstation-open-executive"));
        else {
          fireEvent.change(screen.getByRole("textbox", { name: "Find a desk" }), { target: { value: "ward" } });
          fireEvent.doubleClick(screen.getAllByTestId(/^workstation-desk-/)[0]);
        }
      };
      choose();
      const question = await screen.findByRole("alertdialog", { name: "Leave this page?" });
      expect(readWardAccessSnapshot().access).toEqual(original);
      expect(navigation.push).not.toHaveBeenCalled();
      expect(closed).not.toHaveBeenCalled();
      expect(screen.getByTestId("persona")).toHaveTextContent("coordinator");
      fireEvent.click(within(question).getByRole("button", { name: "Keep editing" }));
      expect(screen.getByRole("textbox", { name: "Unfinished work", hidden: true })).toHaveValue("Synthetic draft");
      expect(readWardAccessSnapshot().access).toEqual(original);
      choose();
      await act(async () =>
        fireEvent.click(
          within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Leave without saving" }),
        ),
      );
      expect(navigation.push).toHaveBeenCalledTimes(1);
      expect(closed).toHaveBeenCalledTimes(1);
      expect(readWardAccessSnapshot().access.role).toBe(kind === "tile" ? "executive" : "ward");
    },
  );

  it("drops a guarded desk change when its drawer closes before Leave", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DraftDesk />
      </WardFlowProvider>,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Unfinished work" }), {
      target: { value: "Synthetic draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change desk" }));
    const original = readWardAccessSnapshot().access;
    fireEvent.click(screen.getByTestId("workstation-open-executive"));
    const question = await screen.findByRole("alertdialog", { name: "Leave this page?" });
    fireEvent.click(screen.getByRole("button", { name: "Close desk drawer", hidden: true }));
    await act(async () => fireEvent.click(within(question).getByRole("button", { name: "Leave without saving" })));
    expect(navigation.push).not.toHaveBeenCalled();
    expect(readWardAccessSnapshot().access).toEqual(original);
  });
});
