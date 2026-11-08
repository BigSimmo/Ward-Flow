import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HelpReport } from "@/components/ward-management/help/ward-help-report-view";
import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow", deskHome: "/ward-flow" }),
}));

const SAFE = "The board froze after I pressed Accept.";
const PATIENT = "Mr Smith would not move to bed 4.";

function report(props: Partial<Parameters<typeof HelpReport>[0]> = {}) {
  const openMail = vi.fn();
  const onBack = vi.fn();
  render(
    <HelpReport
      screen="Home"
      path="/ward-flow"
      desk="Bed manager"
      version={{ id: "2026-11-08-help-report-a-problem", date: "2026-11-08" }}
      email="pilot@example.invalid"
      openMail={openMail}
      onBack={onBack}
      {...props}
    />,
  );
  return { openMail, onBack, box: screen.getByRole("textbox", { name: "What happened?" }) };
}

let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("Report a problem", () => {
  it("opens from Help's foot as a view of its own", () => {
    const onView = vi.fn();
    render(
      <WardHelpSheet view="tasks" onView={onView} onClose={vi.fn()} onTour={vi.fn()} onShowMe={vi.fn()} showMeOn />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
    expect(onView).toHaveBeenLastCalledWith("report");
  });

  it("shows the view inside Help with the reminder, a labelled box and focus on its heading", () => {
    render(
      <WardHelpSheet view="report" onView={vi.fn()} onClose={vi.fn()} onTour={vi.fn()} onShowMe={vi.fn()} showMeOn />,
    );
    const title = screen.getByRole("heading", { name: "Report a problem" });
    expect(document.activeElement).toBe(title);
    expect(screen.getByTestId("ward-help-report-reminder").textContent).toBe(
      "Do not include patient names or details.",
    );
    expect(screen.getByRole("textbox", { name: "What happened?" })).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByTestId("ward-help-report-open").getAttribute("aria-current")).toBe("true");
  });

  it("lists what is added for the reporter", () => {
    report();
    const added = screen.getByTestId("ward-help-report-added").textContent ?? "";
    expect(added).toContain("Screen: Home (/ward-flow)");
    expect(added).toContain("Desk: Bed manager");
    expect(added).toContain("Version: latest change 2026-11-08");
    expect(added).toContain("Browser:");
    expect(added).toContain("Time:");
  });

  it("asks for words first, and puts focus back in the box", () => {
    const { openMail, box } = report();
    fireEvent.click(screen.getByRole("button", { name: "Email report" }));
    expect(openMail).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Say what happened first.");
    expect(document.activeElement).toBe(box);
  });

  it("refuses patient details for email and copy alike, without repeating them", async () => {
    const { openMail, box } = report();
    fireEvent.change(box, { target: { value: PATIENT } });
    fireEvent.click(screen.getByRole("button", { name: "Email report" }));
    expect(openMail).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert").textContent ?? "";
    expect(alert).toContain("Remove patient details first.");
    expect(alert).toContain("a name with a title");
    expect(alert).not.toContain("Smith would");
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(box);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy report" }));
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("emails a clean report through a mailto with subject and body", () => {
    const { openMail, box } = report();
    fireEvent.change(box, { target: { value: SAFE } });
    fireEvent.click(screen.getByRole("button", { name: "Email report" }));
    expect(openMail).toHaveBeenCalledTimes(1);
    const href = openMail.mock.calls[0]?.[0] as string;
    expect(href.startsWith("mailto:pilot@example.invalid?subject=")).toBe(true);
    const body = decodeURIComponent(href.split("&body=")[1] ?? "");
    expect(body.split("\n")[0]).toBe("Synthetic prototype.");
    expect(body).toContain(SAFE);
    expect(body).toContain("Screen: Home (/ward-flow)");
    expect(screen.getByRole("status").textContent).toContain("Press Send there.");
    expect(screen.getByTestId("ward-help-report-destination").textContent).toBe("Email goes to pilot@example.invalid.");
  });

  it("copies the same report, and says so", async () => {
    const { box } = report();
    fireEvent.change(box, { target: { value: SAFE } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy report" }));
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0]?.[0] as string;
    expect(copied).toContain(SAFE);
    expect(copied).toContain("Desk: Bed manager");
    expect(screen.getByRole("status").textContent).toContain("Report copied.");
  });

  it("offers Copy report only, pointing to the pilot lead, when no address is set", () => {
    report({ email: null });
    expect(screen.queryByRole("button", { name: "Email report" })).toBeNull();
    expect(screen.getByRole("button", { name: "Copy report" })).toBeTruthy();
    expect(screen.getByTestId("ward-help-report-destination").textContent).toContain("your pilot lead");
  });

  it("shows the report to copy by hand when the clipboard fails", async () => {
    writeText.mockRejectedValue(new Error("blocked"));
    Object.defineProperty(document, "execCommand", { value: () => false, configurable: true });
    const { box } = report({ email: null });
    fireEvent.change(box, { target: { value: SAFE } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy report" }));
    });
    expect(screen.getByRole("status").textContent).toContain("Could not copy.");
    expect((screen.getByTestId("ward-help-report-fallback") as HTMLTextAreaElement).value).toContain(SAFE);
  });

  it("keeps the words out of browser storage and the console", async () => {
    const log = vi.spyOn(console, "log");
    const info = vi.spyOn(console, "info");
    const warn = vi.spyOn(console, "warn");
    const { box } = report();
    fireEvent.change(box, { target: { value: SAFE } });
    fireEvent.click(screen.getByRole("button", { name: "Email report" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy report" }));
    });
    const stored = [window.localStorage, window.sessionStorage].flatMap((store) =>
      Object.keys(store).map((key) => store.getItem(key) ?? ""),
    );
    expect(stored.some((value) => value.includes("froze"))).toBe(false);
    for (const spy of [log, info, warn])
      expect(spy.mock.calls.flat().some((arg) => String(arg).includes("froze"))).toBe(false);
  });

  it("goes back to Help", () => {
    const { onBack } = report();
    fireEvent.click(screen.getByRole("button", { name: "Back to Help" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
