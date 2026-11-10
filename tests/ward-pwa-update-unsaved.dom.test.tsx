// #1577 (audit M33): the "New version ready" Reload must not drop typed text or a queued change.
// It asks the same leave guards the crash reload asks (`unsavedWorkHoldsReload`) and waits.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import { WardPwaRegistration } from "@/components/ward-management/shell/ward-pwa-registration";
import { UPDATE_HELD_NOTICE } from "@/components/ward-management/shell/ward-pwa-update";
import { ToastProvider } from "@/components/wf";

class WaitingWorker extends EventTarget {
  state = "installed";
  postMessage = vi.fn();
}

function waitingUpdate() {
  const worker = new WaitingWorker();
  const registration = Object.assign(new EventTarget(), { active: {}, waiting: worker, installing: null });
  const container = Object.assign(new EventTarget(), {
    controller: {},
    getRegistrations: async () => [],
    register: vi.fn(async () => registration),
  });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: container });
  return { worker, container };
}

function NoteForm() {
  const [text, setText] = useState("");
  useDirtyStateGuard({ isDirty: text !== "", value: text });
  return <input aria-label="Note" value={text} onChange={(event) => setText(event.target.value)} />;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "serviceWorker");
  vi.restoreAllMocks();
});

it("waits instead of reloading while a form holds typed text, and keeps the text", async () => {
  const { worker } = waitingUpdate();
  const reload = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload } as Location);
  render(
    <ToastProvider>
      <NoteForm />
      <WardPwaRegistration />
    </ToastProvider>,
  );
  const note = screen.getByRole("textbox", { name: "Note" });
  fireEvent.change(note, { target: { value: "Synthetic note for Test Patient Alpha" } });

  fireEvent.click(await screen.findByRole("button", { name: "Reload" }));

  expect(worker.postMessage).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
  expect(await screen.findByText(UPDATE_HELD_NOTICE.title)).toBeInTheDocument();
  expect(note).toHaveValue("Synthetic note for Test Patient Alpha");

  // Once the note is sent (the form is clean), the same offer goes ahead.
  fireEvent.change(note, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));
  expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
});

it("holds a reload while a change is queued, even after the new worker takes over", async () => {
  const { worker, container } = waitingUpdate();
  const reload = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload } as Location);
  render(
    <ToastProvider>
      <WardPwaRegistration />
    </ToastProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Reload" }));
  expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

  // A shared change is queued (ward-shared-client.ts warns on beforeunload) before the switch-over.
  const queued = (event: Event) => event.preventDefault();
  window.addEventListener("beforeunload", queued);
  try {
    worker.state = "activated";
    Object.assign(container, { controller: worker });
    act(() => {
      container.dispatchEvent(new Event("controllerchange"));
    });
    expect(reload).not.toHaveBeenCalled();
    expect(await screen.findByText(UPDATE_HELD_NOTICE.title)).toBeInTheDocument();
  } finally {
    window.removeEventListener("beforeunload", queued);
  }

  // Sent: Reload now reloads at once, since the new version already controls the page.
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));
  await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
});
