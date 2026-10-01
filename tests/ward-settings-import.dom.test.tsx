import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

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
    <WardFlowProvider>
      <SettingsScreen />
      <ConfigurationProbe />
    </WardFlowProvider>,
  );
  const before = screen.getByTestId("import-saved-configuration").textContent;
  const configuration = { ...defaultWardConfiguration(), edAccessTargetMinutes: 720 };
  importPayload(kind === "backup" ? { configuration, exportedAt: "synthetic backup" } : configuration, container);
  expect((document.getElementById("setting-ed-threshold") as HTMLInputElement).value).toBe("720");
  expect(screen.getByTestId("import-saved-configuration").textContent).toBe(before);
  fireEvent.click(screen.getByRole("button", { name: "Save coordination rules" }));
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
    <WardFlowProvider>
      <SettingsScreen />
      <ConfigurationProbe />
    </WardFlowProvider>,
  );
  const before = screen.getByTestId("import-saved-configuration").textContent;
  const slider = document.getElementById("setting-ed-threshold") as HTMLInputElement;
  fireEvent.change(slider, { target: { value: "720" } });
  importPayload(payload, container);
  expect(slider.value).toBe("720");
  expect(screen.getByTestId("import-saved-configuration").textContent).toBe(before);
  expect(screen.getByText("Invalid configuration file format.")).toBeVisible();
});
