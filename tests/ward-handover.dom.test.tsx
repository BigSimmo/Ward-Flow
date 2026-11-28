import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/bedchart/handover",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  defaultHandoverShift,
  handoverAt,
  handoverCutoff,
  handoverHasPassed,
  handoverSignedAt,
} from "@/components/ward-management/handover/handover-model";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";

// Refined Handover A (Josh, 9 Oct 2026): a grouped table in meeting order is the core, held to a
// set height; the right panel is the sign-off sheet until a patient is picked; Beds and History
// are tabs; Print handover opens the sheet builder.
const seed = seedWardFlowState();
const openCount = seed.movements.filter(isOpen).length;

function renderHandover() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <HandoverPage />
      <WardLiveRegion />
    </WardFlowProvider>,
  );
}

function firstPatientRow() {
  const sheet = screen.getByTestId("ward-handover-sheet");
  return within(sheet)
    .getAllByRole("row")
    .find((row) => row.hasAttribute("data-row-id"))!;
}

describe("Handover page", () => {
  beforeEach(() => resetWardLiveRegionForTests());

  it("opens on the next handover with the counts, the tabs and the table", () => {
    renderHandover();
    expect(screen.getByTestId("ward-handover-page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /to hand over/ })).toBeInTheDocument();
    // 1 Nov 2026 redesign: the handover is chosen from one menu that names it.
    expect(screen.getByTestId("ward-handover-shift")).toHaveTextContent(/^3:00 pm/);
    // Page tops (9 Nov 2026): the top's figures replace the count strip.
    expect(screen.getByTestId("ward-handover-figure-act")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Patients/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Beds/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /History/ })).toBeInTheDocument();
    // Audit three #28 / audit four item 6: the outputs sit under one Share menu; Open on TV is its own button.
    fireEvent.click(screen.getByTestId("ward-handover-share"));
    expect(screen.getByTestId("ward-handover-print")).toHaveTextContent("Print handover");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(screen.getByTestId("ward-handover-open-tv")).toHaveTextContent("Open on TV");
    expect(screen.getByTestId("ward-handover-hero-sign-off")).toBeInTheDocument();
  });

  it("keeps Sign off in the hero on every tab, carrying the same check count as the checklist", () => {
    renderHandover();
    // 3 Nov 2026: sign-off has one fixed place, the hero; nothing floats over or trails the rows.
    expect(screen.queryByTestId("ward-handover-sign-bar")).toBeNull();
    for (const tab of [/Patients/, /Beds/, /History/]) {
      fireEvent.click(screen.getByRole("tab", { name: tab }));
      // Audit four item 20: the chip says how many checks are open ("Sign off · 4 open"), never "1/5".
      expect(screen.getByRole("button", { name: /^Sign off, \d+ checks? open$/ })).toBeInTheDocument();
    }
    const hero = screen.getByTestId("ward-handover-hero-sign-off");
    const [, openChecks] = /^Sign off, (\d+) checks? open$/.exec(hero.getAttribute("aria-label") ?? "")!;
    expect(hero).toHaveTextContent(`${openChecks} open`);
    fireEvent.click(hero);
    expect(screen.getByRole("tab", { name: /Patients/ })).toHaveAttribute("aria-selected", "true");
    // Audit four item 37: Sign off opens a small kit dialog; its checks carry the same count as the chip.
    const signOff = screen.getByTestId("ward-handover-sign-off");
    const [, done, total] = /(\d+) of (\d+) clear/.exec(signOff.textContent ?? "")!;
    expect(Number(total) - Number(done)).toBe(Number(openChecks));
    expect(screen.getAllByTestId("ward-handover-sign-off-checks")[0]!.querySelectorAll("li")).toHaveLength(
      Number(total),
    );
    expect(screen.getByRole("button", { name: /^Sign off as .+ at / })).toBeInTheDocument();
  });

  it("groups every open patient in meeting order", () => {
    renderHandover();
    // Approved redesign (31 Oct 2026): Due by shows its first 4 rows, the rest behind Show more.
    fireEvent.click(screen.getByRole("button", { name: /^Show \d+ more/ }));
    const ids = ["act", "due", "bed", "acc", "mov"].map((id) => screen.getByTestId(`ward-handover-group-${id}`));
    for (let index = 1; index < ids.length; index += 1) {
      expect(ids[index - 1]!.compareDocumentPosition(ids[index]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    const rows = within(screen.getByTestId("ward-handover-sheet"))
      .getAllByRole("row")
      .filter((row) => row.hasAttribute("data-row-id"));
    expect(rows).toHaveLength(openCount);
  });

  // Josh, 3 Nov 2026: one scroll for the page, replacing the 9 Oct set-height box.
  it("lets the table grow with the page and scroll only sideways", () => {
    renderHandover();
    expect(screen.getByRole("region", { name: "Handover patients" })).toBeInTheDocument();
    const css = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/handover/handover-refined.module.css"),
      "utf8",
    );
    const block = css.slice(css.indexOf(".tableScroll {"), css.indexOf("}", css.indexOf(".tableScroll {")));
    expect(block).not.toMatch(/max-height:/);
    expect(block).toMatch(/overflow-x: auto/);
    expect(block).not.toMatch(/overflow(-y)?: (auto|scroll)/);
  });

  it("names patients by name and UMRN and never shows a journey number", () => {
    renderHandover();
    fireEvent.click(screen.getByRole("button", { name: /^Show \d+ more/ }));
    const page = screen.getByTestId("ward-handover-page").textContent ?? "";
    expect(page).not.toMatch(/WF-\d/);
    const identity = resolveSubjectPatient(
      seed.movements.find((movement) => movement.id === "WF-016")!,
      seed,
    );
    expect(page).toContain(identity.formalName);
  });

  it("shows the sign-off sheet until a patient is picked, then that patient's flow", async () => {
    const user = userEvent.setup();
    renderHandover();
    // 3 Nov 2026: sign-off is the hero's Sign off; its checklist is a drawer.
    expect(screen.getByTestId("ward-handover-hero-sign-off")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-handover-flow-panel")).not.toBeInTheDocument();

    await user.click(firstPatientRow());
    const panel = screen.getByTestId("ward-handover-flow-panel");
    expect(panel).toHaveTextContent("Next step");
    expect(panel).toHaveTextContent("ISBAR");
    expect(within(panel).getByRole("list", { name: /Movement/ })).toBeInTheDocument();
    expect(screen.queryByTestId("ward-handover-sign-off")).not.toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Close patient" }));
    expect(screen.queryByTestId("ward-handover-flow-panel")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("ward-handover-hero-sign-off"));
    expect(screen.getByTestId("ward-handover-sign-off")).toBeInTheDocument();
  });

  it("steps through patients with J and K while focus is in the handover and closes with Escape", () => {
    renderHandover();
    firstPatientRow().focus();
    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByTestId("ward-handover-flow-panel")).toBeInTheDocument();
    expect(firstPatientRow()).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(window, { key: "j" });
    expect(firstPatientRow()).toHaveAttribute("aria-selected", "false");
    fireEvent.keyDown(window, { key: "k" });
    expect(firstPatientRow()).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("ward-handover-flow-panel")).not.toBeInTheDocument();
  });

  it("keeps the J shortcut working when nothing is focused, as after a fresh load", () => {
    renderHandover();
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByTestId("ward-handover-flow-panel")).toBeInTheDocument();
  });

  it.each(["j", "p", "m"])("ignores the %s shortcut when focus is outside the handover", async (key) => {
    const user = userEvent.setup();
    renderHandover();
    render(<button type="button">Elsewhere in the shell</button>);
    await user.click(screen.getByRole("button", { name: "Elsewhere in the shell" }));
    await user.keyboard(key);

    expect(screen.queryByTestId("ward-handover-flow-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-handover-print-sheet")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Meeting timer" })).toHaveAttribute("aria-pressed", "false");
  });

  it("can disable single-key shortcuts by keyboard, keep Escape, and enable navigation again", async () => {
    const user = userEvent.setup();
    renderHandover();
    const help = screen.getByRole("button", { name: "Keyboard shortcuts" });
    help.focus();
    await user.keyboard("{Enter}");
    const enabled = screen.getByRole("checkbox", { name: "Enable single-key shortcuts" });
    expect(enabled).toBeChecked();
    expect(enabled).toHaveFocus();
    await user.keyboard(" ");
    expect(enabled).not.toBeChecked();
    await user.keyboard("{Escape}");

    firstPatientRow().focus();
    for (const key of ["j", "p", "m", "k", "s"]) {
      await user.keyboard(key);
      expect(screen.queryByTestId("ward-handover-flow-panel")).not.toBeInTheDocument();
      expect(screen.queryByTestId("ward-handover-print-sheet")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Meeting timer" })).toHaveAttribute("aria-pressed", "false");
    }
    await user.click(firstPatientRow());
    expect(screen.getByTestId("ward-handover-flow-panel")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("ward-handover-flow-panel")).not.toBeInTheDocument();

    help.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("checkbox", { name: "Enable single-key shortcuts" })).not.toBeChecked();
    await user.keyboard(" ");
    await user.keyboard("{Escape}");
    firstPatientRow().focus();
    await user.keyboard("j");
    expect(firstPatientRow()).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("ward-handover-flow-panel")).toBeInTheDocument();
  });

  it("keeps letter shortcuts inactive while choosing a handover filter", () => {
    renderHandover();
    // 3 Nov 2026: the filter is the Show menu; a letter typed in it jumps to a choice, never a shortcut.
    fireEvent.click(screen.getByRole("button", { name: /^Show:/ }));
    const choice = within(screen.getByRole("menu", { name: "Show" })).getAllByRole("menuitemradio")[0]!;
    fireEvent.keyDown(choice, { key: "j" });
    fireEvent.keyDown(choice, { key: "p" });
    expect(screen.queryByTestId("ward-handover-flow-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-handover-print-sheet")).not.toBeInTheDocument();
  });

  it("opens the patient drawer in presentation mode without revealing the background table row", () => {
    renderHandover();
    // Audit four item 6: Open on TV is its own button in the folder tabs' tools.
    fireEvent.click(screen.getByTestId("ward-handover-open-tv"));
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    scroll.mockClear();
    firstPatientRow().focus();
    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("ward-handover-flow-panel")).toBeInTheDocument();
    expect(firstPatientRow()).toHaveAttribute("aria-selected", "true");
    expect(scroll).not.toHaveBeenCalled();
    scroll.mockRestore();
  });

  it("records the sign-off with role and time and lists it in History", async () => {
    const user = userEvent.setup();
    renderHandover();
    // D-179 Question 6 (untested-537 INV-SEQUENCE-005): History records the checks still open.
    const counted = /Sign off, (\d+) checks? open/.exec(
      screen.getByTestId("ward-handover-hero-sign-off").getAttribute("aria-label") ?? "",
    );
    const open = Number(counted?.[1]);
    expect(open).toBeGreaterThan(0);
    await user.click(screen.getByTestId("ward-handover-hero-sign-off"));
    await user.click(screen.getByRole("button", { name: /^Sign off as .+ at / }));
    expect(screen.getByTestId("ward-handover-sign-off-visible-status")).toHaveTextContent(
      "Signed off at 10:42 am as bed coordinator",
    );
    // 3 Nov 2026: the hero's Sign off reads the signed time.
    expect(screen.getByTestId("ward-handover-hero-sign-off")).toHaveTextContent("Signed 10:42");
    // A4-27 (audit round 2): once signed there is no second sign-off primary, only Undo.
    expect(screen.queryByRole("button", { name: /^Sign off as / })).toBeNull();
    expect(screen.getByRole("button", { name: "Undo sign-off" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /History/ }));
    expect(screen.getByTestId("ward-handover-history")).toHaveTextContent("Handover signed off as bed coordinator");
    expect(screen.getByTestId("ward-handover-history")).toHaveTextContent(`${open} check${open === 1 ? "" : "s"} open`);
  });

  it("offers no Handing to choice, because the engine records role and time only (D-72)", () => {
    renderHandover();
    fireEvent.click(screen.getByTestId("ward-handover-hero-sign-off"));
    const signOff = screen.getByTestId("ward-handover-sign-off");
    // Audit three #29: who signs is named in the filled button ("Sign off as … at …"), so the record shows it.
    expect(screen.getByRole("button", { name: /^Sign off as .+ at / })).toBeInTheDocument();
    expect(signOff).not.toHaveTextContent("Handing to");
    expect(signOff).not.toHaveTextContent("Not wired in this prototype.");
  });

  it("highlights rows and never hides them", async () => {
    const user = userEvent.setup();
    renderHandover();
    const before = within(screen.getByTestId("ward-handover-sheet"))
      .getAllByRole("row")
      .filter((row) => row.hasAttribute("data-row-id")).length;
    // Page tops (9 Nov 2026): a top figure highlights its rows.
    await user.click(within(screen.getByTestId("ward-handover-hero")).getByRole("button", { name: /^\d+ act now/ }));
    const after = within(screen.getByTestId("ward-handover-sheet"))
      .getAllByRole("row")
      .filter((row) => row.hasAttribute("data-row-id")).length;
    expect(after).toBe(before);
    expect(screen.getByTestId("ward-handover-scope-line")).toHaveTextContent(/\d+ highlighted/);
  });

  it("says a past handover has passed and offers the next one", async () => {
    const user = userEvent.setup();
    renderHandover();
    await user.click(screen.getByTestId("ward-handover-shift"));
    await user.click(screen.getByRole("menuitemradio", { name: /7:00 am/ }));
    expect(screen.getByRole("heading", { level: 1, name: /to hand over/ })).toBeInTheDocument();
    expect(screen.getByTestId("ward-handover-shift")).toHaveTextContent(/^7:00 am/);
    expect(screen.getByText(/The 7:00 am handover has passed/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to 3:00 pm handover" }));
    expect(screen.getByRole("heading", { level: 1, name: /to hand over/ })).toBeInTheDocument();
    expect(screen.getByTestId("ward-handover-shift")).toHaveTextContent(/^3:00 pm/);
  });

  it("opens the print sheet builder from Print handover and comes back", async () => {
    const user = userEvent.setup();
    renderHandover();
    await user.click(screen.getByTestId("ward-handover-share"));
    await user.click(screen.getByTestId("ward-handover-print"));
    const sheet = screen.getByTestId("ward-handover-print-sheet");
    expect(sheet).toBeInTheDocument();
    expect(sheet.textContent ?? "").not.toMatch(/Government of Western Australia|NSQHS/);
    expect(sheet.textContent ?? "").not.toMatch(/WF-\d/);
    await user.click(within(sheet).getByRole("button", { name: /Back to handover/ }));
    expect(screen.queryByTestId("ward-handover-print-sheet")).not.toBeInTheDocument();
  });

  it("shows beds by ward on the Beds tab", async () => {
    const user = userEvent.setup();
    renderHandover();
    await user.click(screen.getByRole("tab", { name: /Beds/ }));
    expect(screen.getByTestId("ward-handover-beds")).toBeInTheDocument();
  });

  it("links the Beds tab to Capacity's beds by ward, with a real address (DR-08)", async () => {
    // Batch 3 (r10): the per-ward table and its Open ward panel left this tab; "Beds by ward" is Capacity's.
    const user = userEvent.setup();
    renderHandover();
    await user.click(screen.getByRole("tab", { name: /Beds/ }));
    const beds = screen.getByTestId("ward-handover-beds");
    const link = within(beds).getByRole("link", { name: /Beds by ward/ });
    expect(link.getAttribute("href")).toBe("/bedchart/capacity");
  });
});

describe("Handover shift after the last handover of the day", () => {
  // 23:30: all three of today's handovers have started, so the next one is tomorrow's 07:00.
  const lateEvening = NOW_ANCHOR - (NOW_ANCHOR % (24 * 60)) + 23 * 60 + 30;

  it("defaults to tomorrow morning's handover, which has not passed and can be signed", () => {
    expect(defaultHandoverShift(lateEvening)).toBe("am");
    expect(handoverAt("am", lateEvening)).toBe(lateEvening + 7 * 60 + 30);
    expect(handoverHasPassed("am", lateEvening)).toBe(false);
    expect(handoverCutoff("am", lateEvening)).toBe(handoverAt("am", lateEvening));
  });

  it("keeps the morning handover as today's before 23:00", () => {
    expect(handoverHasPassed("am", NOW_ANCHOR)).toBe(true);
    expect(handoverAt("am", NOW_ANCHOR)).toBe(NOW_ANCHOR - (NOW_ANCHOR % (24 * 60)) + 7 * 60);
  });
});

describe("Handover sign-off belongs to one handover", () => {
  const midnight = NOW_ANCHOR - (NOW_ANCHOR % (24 * 60));
  const at2000 = midnight + 20 * 60;

  it("counts a sign-off only for the handover whose window holds it", () => {
    const signOffs = [{ at: midnight + 20 * 60 }];
    expect(handoverSignedAt(signOffs, "ev", at2000)).toBe(midnight + 20 * 60);
    expect(handoverSignedAt(signOffs, "pm", at2000)).toBeNull();
  });

  it("finds an earlier handover's sign-off after a later one is recorded", () => {
    const signOffs = [{ at: midnight + 14 * 60 }, { at: midnight + 20 * 60 }];
    expect(handoverSignedAt(signOffs, "pm", at2000)).toBe(midnight + 14 * 60);
  });

  it("prints the patient cell and sheet header despite the global print rule", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/handover/handover-print-sheet.module.css"),
      "utf8",
    );
    const print = css.slice(css.lastIndexOf("@media print"));
    expect(print).toMatch(/\.ph \{\s*display: flex !important;/);
    expect(print).toMatch(/\.rowButton \{\s*display: block !important;/);
  });
});

describe("Handover counts agree (device audit 11 Oct 2026)", () => {
  it("counts the top's figures the way the meeting groups do", () => {
    renderHandover();
    // Page tops (9 Nov 2026): the top's act now, urgent and due by figures replace the count strip.
    for (const id of ["act", "urg", "due"] as const) {
      const figure = screen.getByTestId(`ward-handover-figure-${id}`).querySelector("b")?.textContent;
      const group = screen.queryByTestId(`ward-handover-group-${id}`);
      const groupCount = group?.querySelector("[class*=groupCount]")?.textContent ?? "0";
      expect(figure, id).toBe(groupCount);
    }
  });
});
