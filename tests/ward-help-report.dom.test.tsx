import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { HelpReport } from "@/components/ward-management/help/ward-help-report-view";
import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
const makePicture = vi.hoisted(() => vi.fn<() => Promise<Blob>>());
vi.mock("@/components/ward-management/help/ward-help-report-picture", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/help/ward-help-report-picture")>()),
  makeReportPicture: makePicture,
}));
vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow", deskHome: "/ward-flow" }),
}));

const SAFE = "The board froze after I pressed Accept.";
const PATIENT = "Mr Smith would not move to bed 4.";

function report(props: Partial<Parameters<typeof HelpReport>[0]> = {}) {
  const onBack = vi.fn();
  render(
    <HelpReport
      screen="Home"
      path="/ward-flow"
      desk="Bed manager"
      version={{ id: "2026-11-08-help-report-a-problem", date: "2026-11-08" }}
      email="pilot@example.invalid"
      onBack={onBack}
      {...props}
    />,
  );
  return { onBack, box: screen.getByRole("textbox", { name: "What happened?" }) };
}

let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  window.localStorage.clear();
  window.sessionStorage.clear();
});
const originalExecCommand = Object.getOwnPropertyDescriptor(document, "execCommand");
afterEach(() => {
  vi.restoreAllMocks();
  if (originalExecCommand) Object.defineProperty(document, "execCommand", originalExecCommand);
  else delete (document as { execCommand?: unknown }).execCommand;
});

describe("Report a problem", () => {
  it("opens from Help's foot as a view of its own", () => {
    const onView = vi.fn();
    render(
      <WardHelpSheet view="tasks" onView={onView} onClose={vi.fn()} onTour={vi.fn()} onShowMe={vi.fn()} showMeOn />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
    expect(onView).toHaveBeenLastCalledWith("report");
  });

  it("clears a Help search so the report form shows", () => {
    function Harness() {
      const [view, setView] = useState<Parameters<typeof WardHelpSheet>[0]["view"]>("tasks");
      return (
        <WardHelpSheet view={view} onView={setView} onClose={vi.fn()} onTour={vi.fn()} onShowMe={vi.fn()} showMeOn />
      );
    }
    render(<Harness />);
    const search = screen.getByRole("combobox", { name: "Search Help" }) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "zzzz no match" } });
    fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
    expect(search.value).toBe("");
    expect(screen.getByRole("textbox", { name: "What happened?" })).toBeTruthy();
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
    const pairs = Object.fromEntries(
      Array.from(screen.getByTestId("ward-help-report-added").querySelectorAll("dt")).map((term) => [
        term.textContent,
        term.nextElementSibling?.textContent,
      ]),
    );
    expect(pairs).toEqual({
      Screen: "Home (/ward-flow)",
      Desk: "Bed manager",
      Version: "latest change 8 Nov 2026",
      Browser: "This browser and window size",
      Time: "When you copy it",
      "Picture attached": "no",
    });
  });

  it("puts Copy report straight under the box, before what is added, and never composes an email", () => {
    report();
    const box = screen.getByRole("textbox", { name: "What happened?" });
    const copy = screen.getByRole("button", { name: "Copy report" });
    const added = screen.getByTestId("ward-help-report-added");
    expect(box.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(copy.compareDocumentPosition(added) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Never-build rule (19 Oct 2026): the app composes no email; the reporter pastes into their own.
    expect(screen.queryByRole("button", { name: /email/iu })).toBeNull();
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it("asks for words first, and puts focus back in the box", async () => {
    const { box } = report();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy report" }));
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Say what happened first.");
    expect(document.activeElement).toBe(box);
  });

  it("refuses patient details without repeating them", async () => {
    const { box } = report();
    fireEvent.change(box, { target: { value: PATIENT } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy report" }));
    });
    expect(writeText).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert").textContent ?? "";
    expect(alert).toContain("Remove patient details first.");
    expect(alert).toContain("a name with a title");
    expect(alert).not.toContain("Smith would");
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(box);
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
    expect(copied.split("\n")[0]).toBe("Synthetic prototype.");
    expect(copied).toContain("Screen: Home (/ward-flow)");
    expect(copied).toContain("Desk: Bed manager");
    expect(screen.getByRole("status").textContent).toContain("Report copied.");
    expect(screen.getByTestId("ward-help-report-destination").textContent).toBe(
      "Then paste it into an email to pilot@example.invalid.",
    );
  });

  it("points to the pilot lead when no address is set", () => {
    report({ email: null });
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

  it("offers a picture of the screen, off by default, that says the page is blurred", () => {
    report();
    const toggle = screen.getByRole("checkbox", { name: "Include a picture of this screen" }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(screen.getByTestId("ward-help-report-picture-note").textContent).toContain(
      "Page content is blurred so no patient details are included.",
    );
    expect(screen.queryByTestId("ward-help-report-picture-preview")).toBeNull();
  });

  it("says when the picture cannot be made, and still copies the report saying no picture", async () => {
    makePicture.mockRejectedValueOnce(new Error("no canvas"));
    const { box } = report();
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Include a picture of this screen" }));
    });
    expect(screen.getByTestId("ward-help-report-picture-status").textContent).toContain("Could not make the picture.");
    fireEvent.change(box, { target: { value: SAFE } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy report" }));
    });
    expect(writeText.mock.calls[0]?.[0] as string).toContain("Picture attached: no");
  });

  it("previews the blurred picture, saves it on request and says it is attached", async () => {
    makePicture.mockResolvedValueOnce(new Blob(["png"], { type: "image/png" }));
    const createObjectURL = vi.fn(() => "blob:preview");
    const revokeObjectURL = vi.fn();
    const original = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    onTestFinished(() => {
      Object.assign(URL, original);
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const { box } = report();
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Include a picture of this screen" }));
    });
    const preview = screen.getByRole("img", { name: /page content blurred/iu }) as HTMLImageElement;
    expect(preview.getAttribute("src")).toBe("blob:preview");
    fireEvent.click(screen.getByRole("button", { name: "Save picture" }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("ward-help-report-picture-status").textContent).toContain("Picture saved.");
    fireEvent.change(box, { target: { value: SAFE } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy report" }));
    });
    expect(writeText.mock.calls[0]?.[0] as string).toContain("Picture attached: yes");
    expect(screen.getByRole("status").textContent).toContain("then add the picture");
    // Unticking drops the picture and frees its preview address.
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Include a picture of this screen" }));
    });
    expect(screen.queryByTestId("ward-help-report-picture-preview")).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("says so when the browser refuses to save the picture", async () => {
    makePicture.mockResolvedValueOnce(new Blob(["png"], { type: "image/png" }));
    const original = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() });
    onTestFinished(() => {
      Object.assign(URL, original);
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("blocked");
    });
    report();
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Include a picture of this screen" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Save picture" }));
    expect(screen.getByTestId("ward-help-report-picture-status").textContent).toContain("Could not save the picture.");
  });

  it("holds Copy report while the picture is being made, so the report never says no picture by mistake", async () => {
    let finish: (blob: Blob) => void = () => undefined;
    makePicture.mockImplementationOnce(() => new Promise<Blob>((resolve) => (finish = resolve)));
    const createObjectURL = vi.fn(() => "blob:preview");
    const original = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    onTestFinished(() => {
      Object.assign(URL, original);
    });
    const { box } = report();
    fireEvent.change(box, { target: { value: SAFE } });
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Include a picture of this screen" }));
    });
    const copyButton = screen.getByRole("button", { name: "Copy report" });
    expect(copyButton).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Wait for the picture to finish.")).toBeTruthy();
    await act(async () => {
      fireEvent.click(copyButton);
    });
    expect(writeText).not.toHaveBeenCalled();
    await act(async () => {
      finish(new Blob(["png"], { type: "image/png" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy report" }));
    });
    expect(writeText.mock.calls[0]?.[0] as string).toContain("Picture attached: yes");
  });

  it("makes no preview address for a picture that finishes after Help closed", async () => {
    let finish: (blob: Blob) => void = () => undefined;
    makePicture.mockImplementationOnce(() => new Promise<Blob>((resolve) => (finish = resolve)));
    const createObjectURL = vi.fn(() => "blob:late");
    const original = { createObjectURL: URL.createObjectURL };
    Object.assign(URL, { createObjectURL });
    onTestFinished(() => {
      Object.assign(URL, original);
    });
    report();
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Include a picture of this screen" }));
    });
    cleanup();
    await act(async () => {
      finish(new Blob(["png"], { type: "image/png" }));
    });
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
