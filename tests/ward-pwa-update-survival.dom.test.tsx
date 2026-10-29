import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

import { WardPwaRegistration } from "@/components/ward-management/shell/ward-pwa-registration";
import { ToastProvider } from "@/components/wf";

class InstallingWorker extends EventTarget {
  state = "installing";
  postMessage = vi.fn();

  finish() {
    this.state = "installed";
    this.dispatchEvent(new Event("statechange"));
  }
}

function existingInstallation(active: object | null = {}) {
  const worker = new InstallingWorker();
  const registration = Object.assign(new EventTarget(), { active, waiting: null, installing: worker });
  const container = Object.assign(new EventTarget(), {
    getRegistrations: async () => [],
    register: vi.fn(async () => registration),
  });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: container });
  return { worker, container, registration };
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "serviceWorker");
  vi.restoreAllMocks();
});

it("offers Reload when the update was already installing before registration resolved", async () => {
  const { worker, container } = existingInstallation();
  render(
    <ToastProvider>
      <WardPwaRegistration />
    </ToastProvider>,
  );
  await waitFor(() => expect(container.register).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("button", { name: "Reload" })).not.toBeInTheDocument();

  act(() => worker.finish());

  const reload = await screen.findByRole("button", { name: "Reload" });
  expect(worker.postMessage).not.toHaveBeenCalled();
  fireEvent.click(reload);
  expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
});

it("keeps the first installation quiet when it was already installing", async () => {
  const { worker, container } = existingInstallation(null);
  render(
    <ToastProvider>
      <WardPwaRegistration />
    </ToastProvider>,
  );
  await waitFor(() => expect(container.register).toHaveBeenCalledTimes(1));

  act(() => worker.finish());

  expect(screen.queryByRole("button", { name: "Reload" })).not.toBeInTheDocument();
  expect(worker.postMessage).not.toHaveBeenCalled();
});

it("does not offer a late update after registration has unmounted", async () => {
  const { worker, container, registration } = existingInstallation();
  const view = render(
    <ToastProvider>
      <WardPwaRegistration />
    </ToastProvider>,
  );
  await waitFor(() => expect(container.register).toHaveBeenCalledTimes(1));
  view.rerender(
    <ToastProvider>
      <span>App remains open</span>
    </ToastProvider>,
  );

  act(() => {
    worker.finish();
    registration.dispatchEvent(new Event("updatefound"));
  });

  expect(screen.queryByRole("button", { name: "Reload" })).not.toBeInTheDocument();
  expect(screen.queryByText("New version of Ward Flow ready")).not.toBeInTheDocument();
  expect(worker.postMessage).not.toHaveBeenCalled();
});
