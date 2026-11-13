import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WardComingAndGoing, tomorrowLine } from "@/components/ward-management/ward/ward-coming-and-going";
import type { ComingRow } from "@/components/ward-management/ward/ward-coming-and-going-rows";
import { WardDeclineReasons, DECLINE_LOCK_LINE } from "@/components/ward-management/ward/ward-decline-reasons";
import { bedSquareFor, squareCounts } from "@/components/ward-management/ward/ward-every-bed-squares";
import type { BedItem } from "@/components/ward-management/ward/ward-bed-tone";
import type { WardTomorrowOutlook } from "@/components/ward-management/ward/ward-home-outlook";
import { wardHeroTopParts } from "@/components/ward-management/ward/ward-hero-top-parts";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreenReferralsTab } from "@/components/ward-management/ward/ward-screen-referrals-tab";
import { ToastProvider, buttonClass } from "@/components/wf";
import { WardPhoneFind } from "@/components/ward-management/ward/ward-phone-find";

/**
 * Wave 4 (D-191): Ward home's "Coming and going" part, the decline reasons as kit choice rows and the
 * bed squares' per-bed rule. Synthetic names only.
 */
const row = (over: Partial<ComingRow> & Pick<ComingRow, "key" | "name">): ComingRow => ({
  lines: ["Bed 08 · Held up · Awaiting accommodation"],
  tone: "danger",
  action: null,
  ...over,
});

const outlook: WardTomorrowOutlook = {
  until: 0,
  likely: -1,
  low: -1,
  high: 2,
  likelyOut: 0,
  unconfirmed: 0,
  notFlagged: 0,
  bookedIn: 1,
  flaggedTodayPlannedLater: 0,
};

function renderPart(over: Partial<Parameters<typeof WardComingAndGoing>[0]> = {}) {
  const props: Parameters<typeof WardComingAndGoing>[0] = {
    phone: false,
    updated: "Updated 10:42",
    arrivals: [
      row({ key: "m1", name: "Pellingworth, Keira", movementId: "m1", action: "pull", tone: "info" }),
      row({ key: "m2", name: "Marrowvale, Gianna", movementId: "m2", action: "confirm-arrival", hasPulledBed: true }),
    ],
    backFromLeave: [row({ key: "l1", name: "Daviecroft, Luke", bedNumber: 18, when: "15:42" })],
    referralsWaiting: 1,
    answeredToday: 3,
    referrals: <p>waiting referral</p>,
    needsALook: {
      rows: [row({ key: "h1", name: "Ferrowmoor, Alaric", bedNumber: 8, when: "14 Nov" })],
      heldUp: 1,
      pastDate: 0,
    },
    dischargesToday: [],
    lastFreed: "Bed 07 freed 07:42.",
    outlook,
    openReleases: 11,
    onPull: vi.fn(),
    onConfirmArrival: vi.fn(),
    onOpenArrival: vi.fn(),
    onOpenBed: vi.fn(),
    onOpenArrivals: vi.fn(),
    onOpenDischarges: vi.fn(),
    ...over,
  };
  render(<WardComingAndGoing {...props} />);
  return props;
}

describe("Coming and going (wave 4)", () => {
  it("adds up the Needs a look note when a held-up bed is also past its date (review FS-2)", () => {
    renderPart({
      needsALook: {
        rows: [row({ key: "h1", name: "Ferrowmoor, Alaric", bedNumber: 8, when: "14 Nov" })],
        heldUp: 2,
        pastDate: 3,
        heldUpPastDate: 1,
      },
    });
    expect(screen.getByRole("heading", { name: /Needs a look · now/ })).toHaveTextContent(
      "2 held up, 1 of them past date · 2 more past date",
    );
  });

  it("lists each group once with its count and window, names every row, and keeps one filled button", () => {
    const props = renderPart();
    const part = screen.getByTestId("ward-coming-and-going");
    expect(within(part).getByRole("heading", { name: /2 Arrivals · today/ })).toHaveTextContent("+ 1 back from leave");
    expect(within(part).getByRole("heading", { name: /1 Referrals · now/ })).toHaveTextContent("3 answered today");
    expect(within(part).getByRole("heading", { name: /1 Needs a look · now/ })).toHaveTextContent(
      "1 held up · 0 past date",
    );
    expect(within(part).getByRole("heading", { name: /0 Discharges · today/ })).toBeInTheDocument();
    expect(part).toHaveTextContent("None still due today. Bed 07 freed 07:42.");
    expect(screen.getByTestId("ward-tomorrow-line")).toHaveTextContent(
      "Tomorrow 1 short · range 1 short to 2 free · From ward dates",
    );
    expect(within(part).getByRole("button", { name: "All discharges · 11 open" })).toBeInTheDocument();

    const pull = within(part).getByRole("button", { name: "Pull the bed Pellingworth, Keira" });
    const confirm = within(part).getByRole("button", { name: "Confirm arrival Marrowvale, Gianna" });
    // One filled button per panel, desk-aware (main-ward-*): the ward desk's rows carry Confirm
    // arrival, so it is the filled one there; Pull the bed is outlined beside it.
    expect(pull.className).not.toBe(confirm.className);
    expect(
      within(part)
        .getAllByRole("button")
        .filter((button) => button.className === confirm.className),
    ).toHaveLength(1);
    fireEvent.click(pull);
    expect(props.onPull).toHaveBeenCalledWith(expect.objectContaining({ key: "m1" }));
    fireEvent.click(confirm);
    expect(props.onConfirmArrival).toHaveBeenCalledWith(expect.objectContaining({ key: "m2" }));
    fireEvent.click(within(part).getByRole("button", { name: "Ferrowmoor, Alaric" }));
    expect(props.onOpenBed).toHaveBeenCalledWith(8);
  });

  it("fills Pull the bed on the coordinator's panel, where no row offers Confirm arrival", () => {
    renderPart({
      arrivals: [
        row({ key: "m1", name: "Pellingworth, Keira", movementId: "m1", action: "pull", tone: "info" }),
        row({ key: "m3", name: "Quenfold, Junia", movementId: "m3", action: "pull", tone: "info" }),
      ],
    });
    const first = screen.getByRole("button", { name: "Pull the bed Pellingworth, Keira" });
    const second = screen.getByRole("button", { name: "Pull the bed Quenfold, Junia" });
    expect(first.className).not.toBe(second.className);
  });

  it("keeps a just-pulled row with its inline Undo", () => {
    const run = vi.fn();
    renderPart({ undoFor: (id) => (id === "m2" ? { label: "Undo pull · until 10:46", run } : null) });
    fireEvent.click(screen.getByRole("button", { name: "Undo pull · until 10:46 for Marrowvale, Gianna" }));
    expect(run).toHaveBeenCalled();
  });

  it("folds a long group after eight rows behind Show N more", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      row({ key: `p${index}`, name: `Surname${index}, Given`, bedNumber: index + 1 }),
    );
    renderPart({ needsALook: { rows: many, heldUp: 12, pastDate: 0 } });
    const list = document.getElementById("ward-coming-look-rows")!;
    expect(within(list).getAllByRole("listitem")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "Show 4 more" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(12);
  });

  it("says nobody is expected today and counts the later-day arrivals with a way to All arrivals (review P4-4)", () => {
    const props = renderPart({ arrivals: [], backFromLeave: [], laterArrivals: 2 });
    const group = screen.getByRole("heading", { name: /0 Arrivals · today/ }).closest("section")!;
    expect(group).toHaveTextContent("Nobody expected today.");
    expect(group).not.toHaveTextContent("Nobody is accepted, pulled or on the way.");
    const later = within(group).getByTestId("ward-coming-later");
    expect(later).toHaveTextContent(/^2 more on later days · All arrivals/u);
    fireEvent.click(within(later).getByRole("button", { name: /^All arrivals/u }));
    expect(props.onOpenArrivals).toHaveBeenCalledTimes(1);
  });

  it("shows no later-day line when everyone accepted is expected today", () => {
    renderPart({ laterArrivals: 0 });
    expect(screen.queryByTestId("ward-coming-later")).toBeNull();
  });

  it('words tomorrow as a free figure with no "likely" (D-191 revision, D-198)', () => {
    expect(tomorrowLine({ ...outlook, likely: 2, low: 0, high: 3 })).toBe(
      "2 free · range 0 free to 3 free · From ward dates",
    );
    expect(tomorrowLine({ ...outlook, likely: 2, low: 0, high: 3 })).not.toMatch(/likely/);
  });
});

describe("decline reasons as choice rows (wave 4, notes 6)", () => {
  it("opens with nothing chosen and Confirm decline not yet, with its lock line", () => {
    const onReason = vi.fn();
    const { rerender } = render(
      <WardDeclineReasons movementId="m9" declineReason={undefined} onReason={onReason} onSubmit={vi.fn()} />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBeGreaterThan(3);
    expect(radios.every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText(DECLINE_LOCK_LINE)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "No suitable bed" }));
    expect(onReason).toHaveBeenCalledWith("no_suitable_bed");
    rerender(
      <WardDeclineReasons movementId="m9" declineReason="no_suitable_bed" onReason={onReason} onSubmit={vi.fn()} />,
    );
    expect(screen.queryByText(DECLINE_LOCK_LINE)).toBeNull();
  });
});

describe("bed squares on Every bed (wave 4, notes 2)", () => {
  const bed = (over: Partial<BedItem>): BedItem => ({
    bedNumber: 1,
    bedLabel: "Bed 01",
    status: "occupied",
    statusText: "",
    ...over,
  });
  it("gives each bed one square: ready leaves out named and being-made-ready beds", () => {
    const squares = [
      bedSquareFor(bed({ status: "ready" }), false),
      bedSquareFor(bed({ status: "ready", preparing: true }), false),
      bedSquareFor(bed({ status: "ready", heldFor: "Someone" }), false),
      bedSquareFor(bed({ status: "occupied", admissionId: "a1" }), true),
      bedSquareFor(bed({ status: "occupied", blockReason: "Awaiting accommodation" }), true),
      bedSquareFor(bed({ status: "incoming" }), false),
      bedSquareFor(bed({ status: "closed" }), false),
    ];
    expect(squares).toEqual(["ready", "prep", "use", "free", "use", "use", "closed"]);
    expect(squareCounts(squares)).toEqual({ ready: 1, prep: 1, free: 1, use: 3, closed: 1 });
  });
});

describe("Checking strip words (wave 4 mock-up)", () => {
  it('puts the held-up number straight after its label, then the window: "Held up 1 · by tomorrow"', () => {
    const { wardBand } = wardHeroTopParts({
      unit: allUnits()[0]!,
      states: { ready: 0, occupied: 0 } as BedStateCounts,
      now: NOW_ANCHOR,
      isPhone: false,
      arrivalsToday: 0,
      openArrivals: () => undefined,
      actNowCount: 0,
      heldUpCount: 1,
      pastDateCount: 2,
      bedCountsStale: false,
      staffedSpecialling: 0,
      obsNotRecorded: 0,
      bedFilter: "all",
      pickBedFilter: () => undefined,
      openShiftTodo: () => undefined,
    });
    render(<>{wardBand}</>);
    const text = (screen.getByTestId("ward-hero-checking").textContent ?? "").replace(/\s+/gu, " ");
    expect(text).toContain("Held up 1 · by tomorrow");
    expect(text).toContain("Past date 2");
  });
});

describe("Referrals tab headings (wave 4 mock-up, review FS-12)", () => {
  it('heads the list "N To answer · now" and the wait list "N Wait list · now" under This ward\'s answers', () => {
    const unit = allUnits()[0]!;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <WardScreenReferralsTab active unit={unit} waiting={1} bedRequests={0} onOpenBedRequests={() => undefined} />
        </ToastProvider>
      </WardFlowProvider>,
    );
    expect(screen.getByRole("heading", { name: `Referrals to ${unit.name}` })).toBeInTheDocument();
    expect(screen.getByTestId("ward-referrals-to-answer")).toHaveTextContent("1 To answer · now");
    const answers = screen.getByRole("region", { name: "This ward\u2019s answers" });
    expect(within(answers).getByRole("heading", { name: /^\d+ Wait list · now$/u })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d+ waiting\b/u);
  });
});

describe("phone find button (review EH-4)", () => {
  it("is the kit's icon-only button, so its phone tap cover is 48 x 48 px", () => {
    render(<WardPhoneFind value="" onChange={vi.fn()} />);
    const open = screen.getByRole("button", { name: "Find a bed or person on this ward" });
    expect(open.className).toBe(buttonClass({ variant: "ghost", size: "sm", iconOnly: true }));
  });
});
