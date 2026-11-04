import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef, type ReactNode } from "react";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { useWardReferralDrawerState } from "@/components/ward-management/referrals/use-ward-referral-drawer-state";
import {
  ReferralCloseGuard,
  ReferralDrawerFoot,
} from "@/components/ward-management/referrals/ward-referral-drawer-rail";
import { clearReferralDraftSession } from "@/components/ward-management/referrals/referral-draft-store";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ConfirmHost } from "@/components/wf";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ed/rph-ed",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  clearReferralDraftSession();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

function selectSection(name: string) {
  fireEvent.click(within(screen.getByRole("group", { name: "Referral sections" })).getByRole("button", { name }));
}

function choosePatient(index = 0, keyboard = false) {
  const search = screen.getByLabelText("Find a patient");
  fireEvent.change(search, { target: { value: " " } });
  if (keyboard) {
    for (let position = 0; position <= index; position += 1) fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
  } else {
    fireEvent.click(within(screen.getByRole("listbox", { name: "Matching patients" })).getAllByRole("option")[index]!);
  }
}

function enterUnregisteredIdentity() {
  fireEvent.click(screen.getByTestId("ward-referral-new-patient-toggle"));
  fireEvent.change(within(screen.getByTestId("ward-referral-new-patient")).getByLabelText(/Family name/), {
    target: { value: "Unregistered Synthetic" },
  });
}

describe("referral work survives patient selection and interrupted registration", () => {
  it.each([false, true])("preserves the current patient's entered story when reselected (keyboard=%s)", (keyboard) => {
    const onSelect = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} onSelectPatient={onSelect} />
      </WardFlowProvider>,
    );
    choosePatient();
    selectSection("Referral");
    fireEvent.change(screen.getByLabelText(/Patient story/), {
      target: { value: "Synthetic referral work to retain" },
    });
    selectSection("Patient");
    fireEvent.click(screen.getByRole("button", { name: "Change patient" }));
    choosePatient(0, keyboard);
    selectSection("Referral");
    expect(screen.getByLabelText(/Patient story/)).toHaveValue("Synthetic referral work to retain");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("keeps the original referral until discarding its work for a different patient is confirmed", async () => {
    const onSelect = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} onSelectPatient={onSelect} />
        <ConfirmHost />
      </WardFlowProvider>,
    );
    choosePatient();
    selectSection("Referral");
    fireEvent.change(screen.getByLabelText(/Patient story/), {
      target: { value: "Synthetic referral work to retain" },
    });
    selectSection("Patient");
    fireEvent.click(screen.getByRole("button", { name: "Change patient" }));
    choosePatient(1);
    const question = await screen.findByRole("alertdialog", { name: "Change patient?" });
    expect(onSelect).toHaveBeenCalledTimes(1);
    fireEvent.click(within(question).getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    selectSection("Referral");
    expect(screen.getByLabelText(/Patient story/)).toHaveValue("Synthetic referral work to retain");

    selectSection("Patient");
    fireEvent.click(screen.getByRole("button", { name: "Change patient" }));
    choosePatient(1, true);
    fireEvent.click(await screen.findByRole("button", { name: "Discard and change patient" }));
    await waitFor(() => expect(onSelect).toHaveBeenLastCalledWith("WF-004"));
    selectSection("Referral");
    expect(screen.getByLabelText(/Patient story/)).toHaveValue("");
  });

  it.each(["close button", "Escape", "enclosing sheet"])(
    "warns before %s loses an inline patient registration",
    (method) => {
      const onClose = vi.fn();
      const closeRequestRef = createRef<(() => void) | null>();
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardReferralDrawer onClose={onClose} closeRequestRef={closeRequestRef} withBackdrop />
        </WardFlowProvider>,
      );
      enterUnregisteredIdentity();
      if (method === "close button")
        fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
      else if (method === "Escape") fireEvent.keyDown(window, { key: "Escape" });
      else act(() => closeRequestRef.current?.());
      const guard = screen.getByRole("alertdialog", { name: "Keep this referral as a draft?" });
      expect(onClose).not.toHaveBeenCalled();
      expect(guard).toHaveTextContent("Unregistered patient details are not kept in a referral draft.");
      fireEvent.click(within(guard).getByRole("button", { name: "Keep editing" }));
      expect(within(screen.getByTestId("ward-referral-new-patient")).getByLabelText(/Family name/)).toHaveValue(
        "Unregistered Synthetic",
      );
    },
  );

  it("Back to search on Add patient discards its typed details, so closing asks nothing", () => {
    const onClose = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={onClose} />
      </WardFlowProvider>,
    );
    enterUnregisteredIdentity();
    fireEvent.click(
      within(screen.getByTestId("ward-referral-new-patient")).getByRole("button", { name: "Back to search" }),
    );
    fireEvent.click(screen.getByTestId("ward-referral-new-patient-toggle"));
    expect(within(screen.getByTestId("ward-referral-new-patient")).getByLabelText(/Family name/)).toHaveValue("");
    fireEvent.click(screen.getByTestId("ward-referral-new-patient-toggle"));
    fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
    expect(screen.queryByRole("alertdialog", { name: "Keep this referral as a draft?" })).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("warns on reload and internal navigation with only inline registration work", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const followed = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <a
          href="/ward-flow/waiting"
          onClick={(event) => {
            if (!event.defaultPrevented) followed();
            event.preventDefault();
          }}
        >
          Waiting
        </a>
        <WardReferralDrawer onClose={vi.fn()} />
      </WardFlowProvider>,
    );
    enterUnregisteredIdentity();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("link", { name: "Waiting" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(followed).not.toHaveBeenCalled();
  });

  it("keeps unregistered identity in the form instead of silently omitting it from Save draft", () => {
    const onClose = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={onClose} />
      </WardFlowProvider>,
    );
    selectSection("Referral");
    fireEvent.change(screen.getByLabelText(/Patient story/), { target: { value: "Synthetic referral draft" } });
    selectSection("Patient");
    enterUnregisteredIdentity();
    fireEvent.click(screen.getByTestId("ward-referral-save-draft"));
    expect(onClose).not.toHaveBeenCalled();
    const guard = screen.getByRole("alertdialog", { name: "Keep this referral as a draft?" });
    expect(within(guard).getByRole("button", { name: "Keep draft and close" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    fireEvent.click(within(guard).getByRole("button", { name: "Keep draft and close" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(Object.values(window.sessionStorage).join(" ")).not.toContain("Unregistered Synthetic");
    fireEvent.click(within(guard).getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each(["12/", "31/02/1990"])(
    "protects raw inline birth-date text %s when closing or hiding the form",
    (dateText) => {
      const onClose = vi.fn();
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardReferralDrawer onClose={onClose} />
        </WardFlowProvider>,
      );
      fireEvent.click(screen.getByTestId("ward-referral-new-patient-toggle"));
      fireEvent.change(within(screen.getByTestId("ward-referral-new-patient")).getByLabelText(/Date of birth/), {
        target: { value: dateText },
      });
      fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
      expect(onClose).not.toHaveBeenCalled();
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Keep editing" }));
      // Hiding the form with its toggle keeps the typed text; Back to search discards it (tested below).
      fireEvent.click(screen.getByTestId("ward-referral-new-patient-toggle"));
      fireEvent.click(screen.getByTestId("ward-referral-new-patient-toggle"));
      expect(within(screen.getByTestId("ward-referral-new-patient")).getByLabelText(/Date of birth/)).toHaveValue(
        dateText,
      );
      const unload = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(unload);
      expect(unload.defaultPrevented).toBe(true);
      expect(Object.values(window.sessionStorage).join(" ")).not.toContain(dateText);
    },
  );

  it("does not claim an accepted referral is unsent when guarding other unregistered identity work", () => {
    const onClose = vi.fn();
    function AcceptedReferral() {
      const state = useWardReferralDrawerState({ onClose, onRestart: vi.fn(), onViewChange: vi.fn(), view: "new" });
      return (
        <>
          <button
            onClick={() => {
              state.setNewPatientDateText("12/");
              state.setSentReferralId("RF-SYNTHETIC");
            }}
          >
            Accepted referral with unfinished registration
          </button>
          <ReferralDrawerFoot s={state} />
          {state.guardOpen ? <ReferralCloseGuard s={state} /> : null}
        </>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AcceptedReferral />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Accepted referral with unfinished registration" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).not.toHaveBeenCalled();
    const guard = screen.getByRole("alertdialog", { name: "Discard unregistered patient details?" });
    expect(guard).toHaveTextContent("The referral has been sent.");
    expect(guard).not.toHaveTextContent("This referral is not sent.");
  });
});
