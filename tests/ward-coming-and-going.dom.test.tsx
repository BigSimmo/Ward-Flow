import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WardComingAndGoing, tomorrowLine } from "@/components/ward-management/ward/ward-coming-and-going";
import type { ComingRow } from "@/components/ward-management/ward/ward-coming-and-going-rows";
import { WardDeclineReasons, DECLINE_LOCK_LINE } from "@/components/ward-management/ward/ward-decline-reasons";
import { bedSquareFor, squareCounts } from "@/components/ward-management/ward/ward-every-bed-squares";
import type { BedItem } from "@/components/ward-management/ward/ward-bed-tone";
import type { WardTomorrowOutlook } from "@/components/ward-management/ward/ward-home-outlook";

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
    // One filled button per panel: Pull the bed.
    expect(pull.className).not.toBe(confirm.className);
    fireEvent.click(pull);
    expect(props.onPull).toHaveBeenCalledWith(expect.objectContaining({ key: "m1" }));
    fireEvent.click(confirm);
    expect(props.onConfirmArrival).toHaveBeenCalledWith(expect.objectContaining({ key: "m2" }));
    fireEvent.click(within(part).getByRole("button", { name: "Ferrowmoor, Alaric" }));
    expect(props.onOpenBed).toHaveBeenCalledWith(8);
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
