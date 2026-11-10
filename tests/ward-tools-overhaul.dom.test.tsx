import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  WardFlowOverride,
  WardFlowProvider,
  useDueSoonThresholds,
  useWardFlow,
  useWardNetwork,
} from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { LeaveBed } from "@/components/ward-management/ward-model";
import { unitHref } from "@/components/ward-management/shell/ward-facade";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { LEGAL_LIMITS_NOT_CHECKED_NOTICE } from "@/components/ward-management/ward-legal-clock";
import { copiedText } from "@/components/ward-management/ward-clipboard";
import { bedSummaryText } from "@/components/ward-management/tools/ward-bed-summary";
import { ToolRemindMe, useReminderCount } from "@/components/ward-management/tools/ward-tool-remind-me";
import { ToolLeaveDue } from "@/components/ward-management/tools/ward-tool-leave-due";
import { ToolMessages } from "@/components/ward-management/tools/ward-tool-messages";
import { ToolFindBed } from "@/components/ward-management/tools/ward-tool-find-bed";
import { ToolFigures } from "@/components/ward-management/tools/ward-tool-figures";
import { ToolFormTimes } from "@/components/ward-management/tools/ward-tool-form-times";
import { ToolOnCall } from "@/components/ward-management/tools/ward-tool-on-call";
import { WardToolsSheet } from "@/components/ward-management/tools/ward-tools-sheet";
import { typeDate } from "./helpers/type-date-time";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  window.localStorage.clear();
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});

afterEach(() => {
  act(() => setWardFeatureFlagOnDevice("role-access", null));
  resetWardAccessStoreForTests();
});

function withFlow(children: ReactNode) {
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{children}</WardFlowProvider>);
}

describe("Remind me (Q323)", () => {
  it("sets a reminder from lists only, lists it, removes it, and the count follows", () => {
    let count = -1;
    function CountProbe() {
      count = useReminderCount();
      return null;
    }
    withFlow(
      <>
        <CountProbe />
        <ToolRemindMe onNavigate={vi.fn()} />
      </>,
    );
    // Nothing typed is ever stored, so there is nowhere to type.
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("searchbox")).toHaveLength(0);
    const yours = screen.getByRole("region", { name: "Your reminders" });
    expect(within(yours).getByText("None set.")).toBeTruthy();
    expect(count).toBe(0);

    const ward = within(screen.getByRole("group", { name: "Which ward" })).getAllByRole("button")[0]!;
    const wardName = ward.textContent ?? "";
    fireEvent.click(ward);
    fireEvent.click(within(screen.getByRole("group", { name: "Reason" })).getByRole("button", { name: "Call back" }));
    fireEvent.click(screen.getByRole("button", { name: "Set reminder" }));

    const items = within(yours).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(wardName);
    expect(items[0]).toHaveTextContent("Call back");
    expect(count).toBe(1);

    fireEvent.click(within(yours).getByRole("button", { name: /^Remove reminder for/u }));
    expect(within(yours).queryAllByRole("listitem")).toHaveLength(0);
    expect(within(yours).getByText("None set.")).toBeTruthy();
    expect(count).toBe(0);
  });

  it("stores a movement reminder with a place label only (go/no-go C3)", () => {
    withFlow(<ToolRemindMe onNavigate={vi.fn()} />);
    const movementKind =
      screen.queryByRole("radio", { name: "Movement" }) ?? screen.getByRole("button", { name: "Movement" });
    fireEvent.click(movementKind);
    const moves = within(screen.getByRole("list", { name: "Which movement" })).getAllByRole("button");
    fireEvent.click(moves[0]!);
    fireEvent.click(within(screen.getByRole("group", { name: "Reason" })).getByRole("button", { name: "Call back" }));
    fireEvent.click(screen.getByRole("button", { name: "Set reminder" }));

    const stored = JSON.parse(window.localStorage.getItem("wf-mock-tools-reminders") ?? "[]") as Record<
      string,
      unknown
    >[];
    expect(stored).toHaveLength(1);
    // Only list-picked fields are kept: no free text and no patient detail.
    expect(Object.keys(stored[0]!).sort()).toEqual(["dueAt", "id", "kind", "reason", "targetId", "targetLabel"]);
    expect(stored[0]!.kind).toBe("movement");
    // The label names where the movement starts, never the person (D-39).
    expect(stored[0]!.targetLabel).toMatch(/^Movement from [^\d,]+$/u);
  });
});

describe("Due back (Q326)", () => {
  function WithLeave({ make }: { make: (unitIds: [string, string], now: number) => LeaveBed[] }) {
    const flow = useWardFlow();
    const ids: [string, string] = [flow.units[0]!.id, flow.units[1]!.id];
    return (
      <WardFlowOverride value={{ ...flow, leaveBeds: make(ids, flow.now) }}>
        <ToolLeaveDue onNavigate={vi.fn()} />
      </WardFlowOverride>
    );
  }
  const leave = (id: string, unitId: string, expectedReturn: number, extra: Partial<LeaveBed> = {}): LeaveBed => ({
    id,
    unitId,
    admissionId: `adm-${id}`,
    expectedReturn,
    confirmedAt: 0,
    confirmedBy: "Ward nurse",
    ...extra,
  });

  it("lists leave beds due today by ward, leaving out tomorrow and absences without leave", () => {
    withFlow(
      <WithLeave
        make={([a, b], now) => [
          leave("l1", a, now + 60),
          leave("l2", a, now - 30),
          leave("l3", b, now + 30),
          leave("l4", b, now + 1440),
          leave("l5", b, now + 10, { absentWithoutLeave: { since: now - 60, steps: [] } }),
        ]}
      />,
    );
    const wards = screen.getAllByRole("region");
    expect(wards).toHaveLength(2);
    const first = within(wards[0]!).getAllByRole("listitem");
    expect(first).toHaveLength(2);
    // Earliest first: the overdue bed leads its ward.
    expect(first[0]).toHaveTextContent("Overdue");
    expect(first[1]).toHaveTextContent("Back");
    expect(within(wards[1]!).getAllByRole("listitem")).toHaveLength(1);
  });

  it("says so when no one is due back", () => {
    withFlow(<WithLeave make={() => []} />);
    expect(screen.getByText("Nobody due back today.")).toBeTruthy();
    expect(screen.queryAllByRole("region")).toHaveLength(0);
  });
});

describe("Messages (Q318, Q324)", () => {
  it("keeps the Summary word for word, names no patient, and says when it copied", async () => {
    let expected = "";
    let names: string[] = [];
    function Probe() {
      const flow = useWardFlow();
      const thresholds = useDueSoonThresholds();
      const network = useWardNetwork();
      expected = bedSummaryText({ ...flow, now: flow.now, thresholds, network });
      names = flow.patients.flatMap((patient) => [patient.givenName, patient.familyName]).filter(Boolean);
      return null;
    }
    withFlow(
      <>
        <Probe />
        <ToolMessages onNavigate={vi.fn()} />
      </>,
    );
    const preview = () => screen.getByTestId("ward-tools-messages-preview");
    // The preview shows every summary line, in order; a label that repeats its heading is drawn once.
    const shown = [preview().querySelector("h3"), ...preview().querySelectorAll("p")].map((node) => node?.textContent);
    const lines = expected.split("\n");
    expect(shown).toHaveLength(lines.length);
    shown.forEach((text, index) => expect(lines[index]!.endsWith(text ?? "?")).toBe(true));

    expect(names.length).toBeGreaterThan(0);
    for (const message of ["Escalation", "Meeting", "ED"]) {
      fireEvent.click(screen.getByRole("radio", { name: message }));
      expect(preview().textContent?.length).toBeGreaterThan(20);
      for (const name of names) expect(preview().textContent).not.toMatch(new RegExp(`\\b${name}\\b`, "u"));
    }

    fireEvent.click(screen.getByRole("radio", { name: "Summary" }));
    await act(async () => fireEvent.click(screen.getByTestId("ward-tools-messages-copy")));
    expect(writeText).toHaveBeenCalledTimes(1);
    // The copy is today's words exactly, behind the clipboard's own synthetic line.
    expect(writeText).toHaveBeenCalledWith(copiedText(expected));
    expect(within(screen.getByTestId("ward-tools-messages")).getByRole("status")).toHaveTextContent(
      "Copied. Paste it into the email or Teams message.",
    );
  });
});

describe("Find a bed (Q317)", () => {
  it("asks for a legal status before listing, then links each ward", () => {
    let wardHrefs: string[] = [];
    function Probe() {
      wardHrefs = useWardFlow().units.map((unit) => unitHref(unit.id));
      return null;
    }
    withFlow(
      <>
        <Probe />
        <ToolFindBed onNavigate={vi.fn()} />
      </>,
    );
    const tool = screen.getByTestId("ward-tools-bed-finder");
    const summary = screen.getByTestId("ward-bed-finder-summary");
    expect(summary).toHaveTextContent("Adult · Any bed · Any ward · Legal status?");
    const legal = within(tool).getByRole("radiogroup", { name: "Legal status" });
    for (const radio of within(legal).getAllByRole("radio")) expect(radio).toHaveAttribute("aria-checked", "false");
    expect(within(tool).getByRole("status")).toHaveTextContent("Choose a legal status to list wards.");
    expect(within(tool).queryByRole("list", { name: "Ready beds by ward" })).toBeNull();

    fireEvent.click(within(legal).getByRole("radio", { name: "Voluntary" }));
    expect(summary).toHaveTextContent("Adult · Any bed · Any ward · Voluntary");
    expect(within(tool).getByRole("status")).toHaveTextContent(/\d+ ready synthetic beds in \d+ wards?/u);
    const links = within(within(tool).getByRole("list", { name: "Ready beds by ward" })).getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(wardHrefs).toContain(link.getAttribute("href"));
  });
});

describe("Key figures (Q321)", () => {
  it("shows four figures and one link to Statistics", () => {
    withFlow(<ToolFigures onNavigate={vi.fn()} />);
    const body = screen.getByTestId("ward-stats-drawer-content");
    expect(body.querySelectorAll("dt")).toHaveLength(4);
    expect(within(body).getByRole("link", { name: /See all on Statistics/u })).toHaveAttribute(
      "href",
      "/ward-flow/statistics",
    );
  });
});

describe("Form times (Q319, D-93)", () => {
  const countdown = /\bleft\b|overdue|due in/iu;

  it.each([
    ["a time already passed", "09:15"],
    ["a time inside the warning window", "11:00"],
    ["a later time", "23:30"],
  ])("shows %s as typed, never as a countdown", (_case, time) => {
    withFlow(<ToolFormTimes onNavigate={vi.fn()} />);
    const tool = screen.getByTestId("ward-form-times");
    fireEvent.click(screen.getByTestId("ward-form-times-form"));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /^Form 1A/u }));
    typeDate(screen.getByLabelText("Date on form"), "2026-09-26");
    fireEvent.change(screen.getByLabelText("Time on form"), { target: { value: time } });
    const result = screen.getByTestId("ward-form-times-result");
    expect(result).toHaveTextContent("as typed");
    expect(result).toHaveTextContent(time);
    expect(tool.textContent).not.toMatch(countdown);
    expect(within(tool).getByText(LEGAL_LIMITS_NOT_CHECKED_NOTICE)).toBeTruthy();
  });
});

describe("On-call (Q322)", () => {
  it("never dials or mails, and Call copies the number", async () => {
    const { container } = withFlow(<ToolOnCall onNavigate={vi.fn()} />);
    expect(container.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]')).toHaveLength(0);
    const call = screen.getAllByRole("button", { name: /^Call /u })[0]!;
    await act(async () => fireEvent.click(call));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("ward-tools-contacts").querySelector('[role="status"]')).toHaveTextContent(
      /^Copied .+\. Calling is not wired in this prototype\.$/u,
    );
  });
});

describe("Each desk's own Tools order (2 Nov 2026)", () => {
  function atDesk(access: WardAccess) {
    act(() => setWardFeatureFlagOnDevice("role-access", true));
    act(() => setWardAccess(access));
  }
  function renderSheet() {
    withFlow(<WardToolsSheet isPhone={false} roleLabel="Desk" onNavigate={vi.fn()} onNewReferral={vi.fn()} />);
  }

  it.each([
    ["transport officer", { role: "officer", scope: { kind: "jobs" } }],
    ["access admin", { role: "admin", scope: { kind: "statewide" } }],
  ] as const)("offers the %s no Find a bed, Key figures or Messages", (_name, access) => {
    atDesk(access as WardAccess);
    renderSheet();
    for (const id of ["bed-finder", "figures", "messages"]) {
      expect(screen.queryByTestId(`ward-tools-toggle-${id}`)).toBeNull();
    }
    for (const name of [/Find a bed/u, /Key figures/u, /^Messages/u]) expect(screen.queryByText(name)).toBeNull();
  });

  it("leads a ward desk's Look up with Due back", () => {
    atDesk({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } });
    renderSheet();
    const lookUp = screen.getByRole("region", { name: "Look up" });
    expect(within(lookUp).getAllByRole("button")[0]).toBe(screen.getByTestId("ward-tools-toggle-leave-due"));
  });
});
