/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmHost, hasConfirmHost, requestConfirm, type ConfirmRequest } from "@/components/wf";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const REQUEST: ConfirmRequest = {
  title: "Leave this page?",
  message: "You have unsaved changes. Are you sure you want to leave?",
  confirmLabel: "Leave without saving",
};

describe("kit styled confirm", () => {
  it("falls back to the browser box when no host is mounted", async () => {
    const native = vi.spyOn(window, "confirm").mockReturnValue(true);
    expect(hasConfirmHost()).toBe(false);
    await expect(requestConfirm(REQUEST)).resolves.toBe(true);
    expect(native).toHaveBeenCalledWith(REQUEST.message);
  });

  it("asks in a styled dialog, starts on Keep editing and keeps the question word for word", async () => {
    const native = vi.spyOn(window, "confirm");
    render(<ConfirmHost />);
    expect(hasConfirmHost()).toBe(true);

    let answer: Promise<boolean> | undefined;
    act(() => {
      answer = requestConfirm(REQUEST);
    });
    const dialog = await screen.findByRole("alertdialog", { name: "Leave this page?" });
    expect(dialog).toHaveTextContent(REQUEST.message);
    expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
    // A second question while one is open is refused, never stacked.
    await expect(requestConfirm({ ...REQUEST, title: "Other" })).resolves.toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await expect(answer).resolves.toBe(false);
    expect(screen.queryByRole("alertdialog")).toBeNull();

    act(() => {
      answer = requestConfirm(REQUEST);
    });
    fireEvent.click(await screen.findByRole("button", { name: "Leave without saving" }));
    await expect(answer).resolves.toBe(true);
    expect(native).not.toHaveBeenCalled();
  });

  it("has no close cross, and Escape keeps the change", async () => {
    render(<ConfirmHost />);
    let answer: Promise<boolean> | undefined;
    act(() => {
      answer = requestConfirm(REQUEST);
    });
    const dialog = await screen.findByRole("alertdialog");
    expect(screen.queryByRole("button", { name: /^Close/ })).toBeNull();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await expect(answer).resolves.toBe(false);
  });

  it("a dirty form's link click is held, asked in the dialog, and replayed once on Leave", async () => {
    const native = vi.spyOn(window, "confirm");
    const followed = vi.fn();
    function DirtyForm() {
      useDirtyStateGuard({ isDirty: true, value: "synthetic" });
      return (
        <a
          href="/ward-flow/waiting"
          onClick={(event) => {
            // Stands in for the router: records the click when it is allowed through.
            if (!event.defaultPrevented) followed();
            event.preventDefault();
          }}
        >
          Waiting
        </a>
      );
    }
    render(
      <>
        <DirtyForm />
        <ConfirmHost />
      </>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Waiting" }));
    expect(followed).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(followed).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("link", { name: "Waiting" }));
    fireEvent.click(await screen.findByRole("button", { name: "Leave without saving" }));
    await waitFor(() => expect(followed).toHaveBeenCalledTimes(1));
    expect(native).not.toHaveBeenCalled();
  });

  it("the shell's navigation check asks in the dialog and proceeds once on Leave", async () => {
    const proceed = vi.fn();
    function DirtyForm() {
      useDirtyStateGuard({ isDirty: true, value: "synthetic" });
      return null;
    }
    render(
      <>
        <DirtyForm />
        <ConfirmHost />
      </>,
    );
    const confirmNavigation = (
      window as typeof window & {
        __wardFlowConfirmNavigation?: (proceed?: () => void) => boolean;
      }
    ).__wardFlowConfirmNavigation!;
    // The proceed step runs the same check again; it passes once instead of asking twice.
    const step = () => {
      if (confirmNavigation(step)) proceed();
    };
    step();
    expect(proceed).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Leave without saving" }));
    await waitFor(() => expect(proceed).toHaveBeenCalledTimes(1));
    // Afterwards the form is still dirty, so the next step asks again.
    expect(confirmNavigation(step)).toBe(false);
  });
});
