import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/new",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { AddPatientForm } from "@/components/ward-management/patients/add-patient";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Patient } from "@/components/ward-management/ward-patients";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { patientHref } from "@/components/ward-management/shell/ward-facade";

const ADDED: Patient = {
  id: "PT-A999999",
  umrn: "UM999999",
  givenName: "Testable",
  familyName: "Newcomer",
  dateOfBirth: "1990-01-01",
};
const UNCERTAIN = "Save is not confirmed. Press Retry when you are back online. It will not be saved twice.";

function deferred() {
  let resolve!: (answer: WardCommandOutcome) => void;
  const promise = new Promise<WardCommandOutcome>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

type ScopeProps = { dispatch: WardCommandDispatch; added?: Patient[]; world?: number };
function Scope({ dispatch, added = [], world = 0 }: ScopeProps) {
  const value = useWardFlow();
  return (
    <WardFlowOverride value={{ ...value, dispatch, patients: [...value.patients, ...added], worldGeneration: world }}>
      <AddPatientForm />
    </WardFlowOverride>
  );
}
function tree(props: ScopeProps) {
  return (
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Scope {...props} />
      </WardFlowProvider>
    </ToastProvider>
  );
}
function open(dispatch: WardCommandDispatch) {
  const view = render(tree({ dispatch }));
  fireEvent.change(screen.getByLabelText(/UMRN/i), { target: { value: ADDED.umrn } });
  fireEvent.change(screen.getByLabelText("Given name"), { target: { value: ADDED.givenName } });
  fireEvent.change(screen.getByLabelText("Family name"), { target: { value: ADDED.familyName } });
  fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "01/01/1990" } });
  fireEvent.click(screen.getByTestId("ward-add-patient-submit"));
  return view;
}
function expectDraft() {
  expect(screen.getByLabelText(/UMRN/i)).toHaveValue(ADDED.umrn);
  expect(screen.getByLabelText("Given name")).toHaveValue(ADDED.givenName);
  expect(screen.getByLabelText("Family name")).toHaveValue(ADDED.familyName);
  expect(screen.getByLabelText("Date of birth")).toHaveValue("01/01/1990");
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  router.push.mockClear();
});

describe("Add patient uncertain shared save", () => {
  it("keeps the original attempt and typed values until its own Retry confirmation accepts", async () => {
    const retry = deferred();
    const dispatch = vi.fn(() =>
      Promise.resolve({
        commandId: "original",
        status: "failed" as const,
        message: UNCERTAIN,
        confirmation: retry.promise,
      }),
    );
    const view = open(dispatch);
    expect(await screen.findByTestId("ward-add-patient-rejection")).toHaveTextContent(UNCERTAIN);
    expectDraft();
    expect(screen.getByTestId("ward-add-patient-submit")).toHaveAttribute("aria-disabled", "true");
    fireEvent.submit(screen.getByTestId("ward-add-patient-form"));
    expect(dispatch).toHaveBeenCalledTimes(1);

    await act(() => retry.resolve({ commandId: "original", status: "accepted" }));
    view.rerender(tree({ dispatch, added: [ADDED] }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(patientHref(ADDED.id)));
    expect(screen.queryByTestId("ward-add-patient-rejection")).toBeNull();
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("preserves the draft and permits correction after Retry definitely refuses the original command", async () => {
    const retry = deferred();
    const dispatch = vi.fn(() =>
      Promise.resolve({
        commandId: "original",
        status: "failed" as const,
        message: UNCERTAIN,
        confirmation: retry.promise,
      }),
    );
    open(dispatch);
    await screen.findByTestId("ward-add-patient-rejection");
    await act(() =>
      retry.resolve({ commandId: "original", status: "refused", message: "Check the identity details." }),
    );
    expectDraft();
    expect(screen.getByTestId("ward-add-patient-submit")).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("ward-add-patient-rejection")).toHaveTextContent("Check the identity details.");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("unlocks the form with its answers kept when the Retry confirmation itself fails", async () => {
    let lose!: (reason: unknown) => void;
    const confirmation = new Promise<WardCommandOutcome>((_, no) => {
      lose = no;
    });
    const dispatch = vi.fn(() =>
      Promise.resolve({
        commandId: "original",
        status: "failed" as const,
        message: UNCERTAIN,
        confirmation,
      }),
    );
    open(dispatch);
    await screen.findByTestId("ward-add-patient-rejection");
    expect(screen.getByTestId("ward-add-patient-reset")).toBeDisabled();
    await act(async () => {
      lose(new Error("confirmation lost"));
      await confirmation.catch(() => undefined);
    });
    expectDraft();
    expect(screen.getByTestId("ward-add-patient-reset")).not.toBeDisabled();
    expect(screen.getByTestId("ward-add-patient-submit")).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("ward-add-patient-rejection")).toHaveTextContent(
      "This patient could not be confirmed as added. Check the patient list.",
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it("does not let Reset discard ownership of the command still awaiting Retry", async () => {
    const retry = deferred();
    const dispatch = vi.fn(() =>
      Promise.resolve({
        commandId: "original",
        status: "failed" as const,
        message: UNCERTAIN,
        confirmation: retry.promise,
      }),
    );
    open(dispatch);
    await screen.findByTestId("ward-add-patient-rejection");
    const reset = screen.getByTestId("ward-add-patient-reset");
    expect(reset).toBeDisabled();
    fireEvent.click(reset);
    expectDraft();
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("never confirms the add from a different command's private answer or a visible record alone", async () => {
    const retry = deferred();
    const dispatch = vi.fn(() =>
      Promise.resolve({
        commandId: "original",
        status: "failed" as const,
        message: UNCERTAIN,
        confirmation: retry.promise,
      }),
    );
    const view = open(dispatch);
    await screen.findByTestId("ward-add-patient-rejection");
    view.rerender(tree({ dispatch, added: [ADDED] }));
    await act(() => retry.resolve({ commandId: "another-command", status: "accepted" }));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByTestId("ward-add-patient-submit")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("ward-add-patient-rejection")).toHaveTextContent(UNCERTAIN);
  });

  it("keeps edits made after the submitted draft when Retry succeeds and its record arrives", async () => {
    const retry = deferred();
    const dispatch = vi.fn(() =>
      Promise.resolve({
        commandId: "original",
        status: "failed" as const,
        message: UNCERTAIN,
        confirmation: retry.promise,
      }),
    );
    const view = open(dispatch);
    await screen.findByTestId("ward-add-patient-rejection");
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Revised synthetic draft" } });
    await act(() => retry.resolve({ commandId: "original", status: "accepted" }));
    view.rerender(tree({ dispatch, added: [ADDED] }));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Given name")).toHaveValue("Revised synthetic draft");
    expect(screen.getByTestId("ward-add-patient-saved-outside-view")).toHaveTextContent("It is now in Recent records.");
    expect(screen.getByTestId("ward-add-patient-submit")).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByTestId("ward-add-patient-rejection")).toBeNull();
  });

  it("protects the unchanged submitted form while its command is still pending", () => {
    const reply = deferred();
    open(() => reply.promise);
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    expectDraft();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("warns before leaving when new typing is outside the command still awaiting an answer", () => {
    const reply = deferred();
    open(() => reply.promise);
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Revised synthetic draft" } });
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it("warns before reload when only an unfinished date of birth has been typed", () => {
    render(tree({ dispatch: vi.fn() }));
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "12/" } });
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    expect(screen.getByLabelText("Date of birth")).toHaveValue("12/");
  });

  it("keeps an unfinished date when internal navigation is cancelled", async () => {
    const dispatch = vi.fn();
    render(tree({ dispatch }));
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "12/" } });
    const link = screen.getByRole("link", { name: "Cancel and go back to patient search" });
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    const navigate = vi.fn();
    link.addEventListener(
      "click",
      (event) => {
        if (!event.defaultPrevented) navigate();
        event.preventDefault();
      },
      { once: true },
    );
    act(() => link.dispatchEvent(click));
    const leave = await screen.findByRole("alertdialog", { name: "Leave this page?" });
    fireEvent.click(within(leave).getByRole("button", { name: "Keep editing" }));
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Date of birth")).toHaveValue("12/");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("resets and restores an unfinished date through the existing Reset and Undo controls", () => {
    render(tree({ dispatch: vi.fn() }));
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "12/" } });
    fireEvent.click(screen.getByTestId("ward-add-patient-reset"));
    expect(screen.getByTestId("ward-add-patient-reset-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-add-patient-reset-confirm"));
    expect(screen.getByLabelText("Date of birth")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByLabelText("Date of birth")).toHaveValue("12/");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it("preserves edited date text even when it represents the submitted date", async () => {
    const reply = deferred();
    const dispatch = vi.fn(() => reply.promise);
    const view = open(dispatch);
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "1/1/1990" } });
    await act(() => reply.resolve({ commandId: "original", status: "accepted" }));
    view.rerender(tree({ dispatch, added: [ADDED] }));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Date of birth")).toHaveValue("1/1/1990");
    expect(screen.getByTestId("ward-add-patient-saved-outside-view")).toHaveTextContent("It is now in Recent records.");
  });

  it("keeps an unchanged uncertain submission when internal navigation is cancelled", async () => {
    const retry = deferred();
    const dispatch = vi.fn(() =>
      Promise.resolve({
        commandId: "original",
        status: "failed" as const,
        message: UNCERTAIN,
        confirmation: retry.promise,
      }),
    );
    open(dispatch);
    await screen.findByTestId("ward-add-patient-rejection");
    // The leave guard attaches its click listener in an effect after this render.
    await act(async () => {});
    const link = screen.getByRole("link", { name: "Cancel and go back to patient search" });
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link.addEventListener("click", (event) => event.preventDefault(), { once: true });
    act(() => link.dispatchEvent(click));
    const leave = await screen.findByRole("alertdialog", { name: "Leave this page?" });
    fireEvent.click(within(leave).getByRole("button", { name: "Keep editing" }));
    expectDraft();
    await act(() =>
      retry.resolve({ commandId: "original", status: "refused", message: "Check the identity details." }),
    );
    expectDraft();
    expect(screen.getByTestId("ward-add-patient-submit")).not.toHaveAttribute("aria-disabled");
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("cancels Back before an unchanged uncertain registration can unmount and lose its draft", async () => {
    vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    const retry = deferred();
    const dispatch = vi.fn(() =>
      Promise.resolve({
        commandId: "original",
        status: "failed" as const,
        message: UNCERTAIN,
        confirmation: retry.promise,
      }),
    );
    const view = open(dispatch);
    await screen.findByTestId("ward-add-patient-rejection");
    // The leave guard learns the form is dirty in an effect after this render; Back must wait for it.
    await act(async () => {});
    const navigate = vi.fn(() => view.unmount());
    window.addEventListener("popstate", navigate);
    try {
      const index = window.history.state.__wfHistoryIndex as number;
      act(() =>
        window.dispatchEvent(new PopStateEvent("popstate", { state: { __NA: true, __wfHistoryIndex: index - 1 } })),
      );
      const leave = await screen.findByRole("alertdialog", { name: "Leave this page?" });
      fireEvent.click(within(leave).getByRole("button", { name: "Keep editing" }));
      expect(navigate).not.toHaveBeenCalled();
      expectDraft();
      act(() =>
        window.dispatchEvent(new PopStateEvent("popstate", { state: { __NA: true, __wfHistoryIndex: index } })),
      );
      await act(() =>
        retry.resolve({ commandId: "original", status: "refused", message: "Check the identity details." }),
      );
      expectDraft();
    } finally {
      window.removeEventListener("popstate", navigate);
    }
  });

  it("retires the uncertain attempt on world replacement and ignores its late acceptance", async () => {
    const retry = deferred();
    const dispatch = vi.fn(() =>
      Promise.resolve({
        commandId: "original",
        status: "failed" as const,
        message: UNCERTAIN,
        confirmation: retry.promise,
      }),
    );
    const view = open(dispatch);
    await screen.findByTestId("ward-add-patient-rejection");
    view.rerender(tree({ dispatch, world: 1 }));
    expect(screen.getByTestId("ward-add-patient-submit")).not.toHaveAttribute("aria-disabled");
    await act(() => retry.resolve({ commandId: "original", status: "accepted" }));
    view.rerender(tree({ dispatch, world: 1, added: [ADDED] }));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByTestId("ward-add-patient-rejection")).toHaveTextContent("The workspace changed");
    expectDraft();
  });

  it("does not apply a late acceptance from an ended command lifetime", async () => {
    const retry = deferred();
    let current = true;
    const dispatch = vi.fn(() =>
      Promise.resolve({
        commandId: "original",
        status: "failed" as const,
        message: UNCERTAIN,
        confirmation: retry.promise,
        isCurrent: () => current,
      }),
    );
    const view = open(dispatch);
    await screen.findByTestId("ward-add-patient-rejection");
    current = false;
    await act(() => retry.resolve({ commandId: "original", status: "accepted" }));
    view.rerender(tree({ dispatch, added: [ADDED] }));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByTestId("ward-add-patient-submit")).not.toHaveAttribute("aria-disabled");
    expectDraft();
  });
});
