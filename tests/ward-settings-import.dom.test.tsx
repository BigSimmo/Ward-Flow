import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { ToastProvider } from "@/components/wf";

afterEach(() => vi.unstubAllGlobals());

function ConfigurationProbe() {
  const { configuration } = useWardFlow();
  return <output data-testid="import-saved-configuration">{JSON.stringify(configuration)}</output>;
}

function importPayload(payload: unknown, container: HTMLElement) {
  vi.stubGlobal(
    "FileReader",
    class {
      onload: ((event: { target: { result: string } }) => void) | null = null;
      readAsText() {
        this.onload?.({ target: { result: JSON.stringify(payload) } });
      }
    },
  );
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, {
    target: { files: [new File(["synthetic configuration"], "rules.json", { type: "application/json" })] },
  });
}

it.each(["raw", "backup"])("loads a valid %s configuration into draft and applies it only after Save", (kind) => {
  const { container } = render(
    <ToastProvider>
      <WardFlowProvider>
        <SettingsScreen />
        <ConfigurationProbe />
      </WardFlowProvider>
    </ToastProvider>,
  );
  const before = screen.getByTestId("import-saved-configuration").textContent;
  const configuration = { ...defaultWardConfiguration(), edAccessTargetMinutes: 720 };
  importPayload(kind === "backup" ? { configuration, exportedAt: "synthetic backup" } : configuration, container);
  expect(screen.getByRole("spinbutton", { name: "ED access target" })).toHaveAttribute("aria-valuenow", "720");
  expect(screen.getByTestId("import-saved-configuration").textContent).toBe(before);
  fireEvent.click(screen.getByRole("button", { name: /^Save \d+ changes?$/ }));
  // Save opens a review first (Settings round 3); its Save change button saves.
  fireEvent.click(screen.getByRole("button", { name: /^Save changes?$/ }));
  expect(JSON.parse(screen.getByTestId("import-saved-configuration").textContent!)).toEqual(configuration);
});

it.each([
  { payload: null },
  { payload: [] },
  { payload: { ...defaultWardConfiguration(), dueSoonUrgentMinutes: 120, dueSoonMinutes: 60 } },
  { payload: { ...defaultWardConfiguration(), edAccessTargetMinutes: -1 } },
  { payload: { ...defaultWardConfiguration(), unexpected: 1 } },
])("refuses invalid imported configuration without replacing the edited draft ($payload)", ({ payload }) => {
  const { container } = render(
    <ToastProvider>
      <WardFlowProvider>
        <SettingsScreen />
        <ConfigurationProbe />
      </WardFlowProvider>
    </ToastProvider>,
  );
  const before = screen.getByTestId("import-saved-configuration").textContent;
  // v10: the ED target is one stepper; Home sets its range minimum, 12h (720 minutes).
  const stepper = screen.getByRole("spinbutton", { name: "ED access target" });
  fireEvent.keyDown(stepper, { key: "Home" });
  expect(stepper).toHaveAttribute("aria-valuenow", "720");
  importPayload(payload, container);
  // Inspect the same live edited control; avoid rediscovering every hidden settings pane.
  expect(stepper).toBeInTheDocument();
  expect(within(stepper.parentElement!).getByRole("spinbutton", { name: "ED access target" })).toHaveAttribute(
    "aria-valuenow",
    "720",
  );
  expect(screen.getByTestId("import-saved-configuration").textContent).toBe(before);
  expect(screen.getByText("Invalid configuration file format.")).toBeVisible();
});

it("says when the rules file cannot be read and clears the picker (H-0351)", () => {
  const { container } = render(
    <ToastProvider>
      <WardFlowProvider>
        <SettingsScreen />
      </WardFlowProvider>
    </ToastProvider>,
  );
  vi.stubGlobal(
    "FileReader",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText() {
        this.onerror?.();
      }
    },
  );
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  const cleared = vi.fn();
  Object.defineProperty(input, "value", {
    configurable: true,
    get: () => "",
    set: (value: string) => {
      if (value === "") cleared();
    },
  });
  fireEvent.change(input, {
    target: { files: [new File(["synthetic configuration"], "rules.json", { type: "application/json" })] },
  });
  expect(screen.getByText("This rules file could not be read. Select it again.")).toBeVisible();
  expect(cleared).toHaveBeenCalled();
});
