import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { ED_ACCESS_TARGET_RANGE_MINUTES } from "@/components/ward-management/ward-model";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";
import { CLINICAL_VALUE_LIST, clinicalValueStatusText } from "@/components/ward-management/ward-clinical-values";

/**
 * Settings v10 pass 3: the phone is its own design (a compact profile hero, Find a setting, the
 * four settings changed on a phone, then the five areas as rows that open tall sheets), and a
 * rule save answers in the shared wf toast with Undo.
 */

function Probe() {
  const { configuration } = useWardFlow();
  return <span data-testid="probe-ed-target">{configuration.edAccessTargetMinutes}</span>;
}

function renderSettings() {
  return render(
    <ToastProvider>
      <WardFlowProvider>
        <SettingsScreen />
        <Probe />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

function asPhone() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === WF_PHONE_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("Settings: rule save answers with Undo in the wf toast", () => {
  it("saves, offers Undo, and Undo puts the rules back with a recorded save", () => {
    renderSettings();
    const before = screen.getByTestId("probe-ed-target").textContent;
    fireEvent.keyDown(screen.getByRole("spinbutton", { name: "ED access target" }), { key: "Home" });
    fireEvent.click(screen.getByRole("button", { name: "Save 1 change" }));
    expect(screen.getByTestId("probe-ed-target")).toHaveTextContent(String(ED_ACCESS_TARGET_RANGE_MINUTES.min));

    const region = screen.getByTestId("toast-region");
    expect(region).toHaveTextContent(/ED target 24h to \d+h, saved and recorded\./);
    act(() => {
      fireEvent.click(within(region).getByRole("button", { name: "Undo" }));
    });
    expect(screen.getByTestId("probe-ed-target")).toHaveTextContent(before ?? "");
    expect(screen.queryByRole("region", { name: "Unsaved rule changes" })).not.toBeInTheDocument();
    expect(region).toHaveTextContent("Rules back as they were. Recorded in the audit.");
  });

  it("Discard offers Undo that brings the draft back", () => {
    renderSettings();
    fireEvent.keyDown(screen.getByRole("spinbutton", { name: "ED access target" }), { key: "Home" });
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("region", { name: "Unsaved rule changes" })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("toast-region")).getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("region", { name: "Unsaved rule changes" })).toBeInTheDocument();
  });
});

describe("Settings on a phone", () => {
  it("opens on the compact hero, Find a setting, the four phone settings and the five areas", () => {
    asPhone();
    renderSettings();
    const page = screen.getByTestId("ward-settings-screen");
    expect(page).toHaveAttribute("data-ward-design", "v10-phone");
    expect(within(page).getByRole("heading", { level: 1 })).toHaveTextContent("Dr S. Chen");
    expect(within(page).getByRole("button", { name: /Go to a desk/ })).toBeInTheDocument();
    expect(within(page).getByRole("combobox", { name: "Find a setting" })).toBeInTheDocument();

    const quick = within(page).getByRole("region", { name: /On this phone/ });
    expect(within(quick).getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
    expect(within(quick).getByRole("radio", { name: "Glare" })).toBeInTheDocument();
    expect(within(quick).getByRole("radiogroup", { name: "Row density" })).toBeInTheDocument();
    expect(within(quick).getByRole("switch", { name: "Buzz sound" })).toBeInTheDocument();

    for (const area of ["rules", "alerts", "display", "profile", "data"]) {
      expect(screen.getByTestId(`ward-settings-phone-area-${area}`)).toBeInTheDocument();
    }
    // The desktop band's tab track is not on the phone.
    expect(within(page).queryByRole("tablist", { name: "Settings areas" })).toBeNull();
  });

  it("opens Rules in a tall sheet whose foot holds Save, and pins a save bar once the sheet closes", () => {
    asPhone();
    renderSettings();
    fireEvent.click(within(screen.getByTestId("ward-settings-phone-area-rules")).getByRole("button"));
    const sheet = screen.getByRole("dialog", { name: "Rules" });
    expect(within(sheet).getByRole("button", { name: "Done" })).toBeInTheDocument();

    fireEvent.keyDown(within(sheet).getByRole("spinbutton", { name: "ED access target" }), { key: "Home" });
    expect(within(sheet).getByRole("button", { name: "Save 1 change" })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));

    const bar = screen.getByRole("region", { name: "Unsaved rule changes" });
    fireEvent.click(within(bar).getByRole("button", { name: "Save 1 change" }));
    expect(screen.getByTestId("probe-ed-target")).toHaveTextContent(String(ED_ACCESS_TARGET_RANGE_MINUTES.min));
    expect(screen.getByTestId("toast-region")).toHaveTextContent(/ED target 24h to \d+h, saved and recorded\./);
  });

  // Audit settings-24: the five-column thresholds table is a desk job; the phone says so.
  it("shows Fixed defaults in the Data sheet and points to a computer for the thresholds table", () => {
    asPhone();
    renderSettings();
    fireEvent.click(within(screen.getByTestId("ward-settings-phone-area-data")).getByRole("button"));
    expect(screen.getByTestId("ward-settings-thresholds-phone")).toHaveTextContent("tablet or computer");
    expect(screen.queryByRole("region", { name: "Published thresholds" })).toBeNull();
    const defaults = document.querySelector('[data-setting="fixed-defaults"]');
    expect(defaults).not.toBeNull();
    expect(defaults!.closest("[hidden]"), "Fixed defaults are hidden on the phone").toBeNull();
  });

  // Josh, 15 Oct 2026 (phone mockup B): a two-way switch swaps Fixed defaults for the clinical values.
  it("switches the Reference card between Fixed defaults and the clinical values on a phone", () => {
    asPhone();
    renderSettings();
    fireEvent.click(within(screen.getByTestId("ward-settings-phone-area-data")).getByRole("button"));
    const list = screen.getByRole("radiogroup", { name: "Reference list" });
    expect(within(list).getByRole("radio", { name: /Fixed defaults/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByTestId("ward-settings-clinical-values-phone")).toBeNull();

    fireEvent.click(within(list).getByRole("radio", { name: /Clinical values/ }));
    const values = screen.getByTestId("ward-settings-clinical-values-phone");
    expect(values).toHaveTextContent(`All ${CLINICAL_VALUE_LIST.length} values are signed for the prototype only.`);
    for (const entry of CLINICAL_VALUE_LIST) {
      const row = within(values).getByTestId(`ward-settings-clinical-value-phone-${entry.id}`);
      expect(row).toHaveTextContent(entry.name);
      expect(row).toHaveTextContent(clinicalValueStatusText(entry));
    }
    expect(document.querySelector('[data-setting="fixed-defaults"]')!.closest("[hidden]")).not.toBeNull();
  });

  it("adds no phone switch or phone list on desktop", () => {
    renderSettings();
    expect(screen.queryByRole("radiogroup", { name: "Reference list" })).toBeNull();
    expect(screen.queryByTestId("ward-settings-clinical-values-phone")).toBeNull();
  });
});
