import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createHash } from "node:crypto";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  PhoneMoreFigures,
  StatisticsSummaryPhone,
} from "@/components/ward-management/statistics/statistics-summary-phone";

const observed = vi.hoisted(() => ({ phone: null as Record<string, unknown> | null }));

vi.mock("@/components/ward-management/statistics/statistics-summary-phone", async (importOriginal) => {
  const actual = await importOriginal<{ StatisticsSummaryPhone: typeof StatisticsSummaryPhone }>();
  return {
    ...actual,
    StatisticsSummaryPhone: (props: ComponentProps<typeof StatisticsSummaryPhone>) => {
      observed.phone = props;
      return <actual.StatisticsSummaryPhone {...props} />;
    },
  };
});

import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";

function phoneViewport() {
  let phone = true;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query === WF_PHONE_QUERY && phone;
    },
    media: query,
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  }));
  return (next: boolean) => {
    act(() => {
      phone = next;
      listeners.forEach((listener) => listener());
    });
  };
}

function has(value: unknown, ...keys: string[]): boolean {
  return typeof value === "object" && value !== null && keys.every((key) => key in value);
}

/** Count actual array work, without production instrumentation or replacing React's memo hook. */
function desktopWork() {
  const counts = { wardSort: 0, edTableCopy: 0, arrivalBands: 0, finderSort: 0 };
  const sort = Array.prototype.sort;
  const slice = Array.prototype.slice;
  const map = Array.prototype.map;
  vi.spyOn(Array.prototype, "sort").mockImplementation(function <T>(this: T[], compare?: (a: T, b: T) => number): T[] {
    if (has(this[0], "occupancyRate", "referred", "beds")) counts.wardSort++;
    if (has(this[0], "ready", "meta", "code")) counts.finderSort++;
    return Reflect.apply(sort, this, [compare]) as T[];
  });
  vi.spyOn(Array.prototype, "slice").mockImplementation(function <T>(this: T[], start?: number, end?: number): T[] {
    if (has(this[0], "waits", "over24", "median", "site")) counts.edTableCopy++;
    return Reflect.apply(slice, this, [start, end]) as T[];
  });
  vi.spyOn(Array.prototype, "map").mockImplementation(function <T, U>(
    this: T[],
    callback: (value: T, index: number, array: T[]) => U,
    thisArg?: unknown,
  ): U[] {
    if (has(this[0], "id", "label", "from", "to")) counts.arrivalBands++;
    return Reflect.apply(map, this, [callback, thisArg]) as U[];
  });
  return counts;
}

function phoneFigures() {
  // Excludes callbacks; includes every data prop passed to the real phone component.
  return JSON.parse(JSON.stringify(observed.phone)) as Record<string, unknown>;
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  observed.phone = null;
});

describe("Statistics phone computation work", () => {
  it("keeps all phone figures while avoiding four desktop-only calculations", () => {
    phoneViewport();
    const counts = desktopWork();
    let patients = 0;
    function Sample() {
      patients = useWardFlow().patients.length;
      return <StatisticsScreen />;
    }
    const result = render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Sample />
        </WardFlowProvider>
      </ToastProvider>,
    );
    expect(patients).toBe(362);
    expect(observed.phone?.wardCount).toBe(22);
    expect(screen.getByRole("button", { name: /ED waits for a bed/u })).toBeInTheDocument();
    console.info(
      "Statistics phone work",
      JSON.stringify({
        counts,
        figures: fingerprint(phoneFigures()),
        output: fingerprint(result.container.textContent),
      }),
    );
    expect(counts).toEqual({ wardSort: 0, edTableCopy: 0, arrivalBands: 0, finderSort: 0 });
  });

  it("recomputes desktop data after phone changes and retains table state across viewport changes", () => {
    const setPhone = phoneViewport();
    const counts = desktopWork();
    let liveAdmissions: Admission[] = [];
    function Sample({ admissions }: { admissions?: Admission[] }) {
      liveAdmissions = useWardFlow().admissions;
      return <StatisticsScreen admissions={admissions} />;
    }
    function Tree({ admissions }: { admissions?: Admission[] }) {
      return (
        <ToastProvider>
          <WardFlowProvider initialNow={NOW_ANCHOR}>
            <Sample admissions={admissions} />
          </WardFlowProvider>
        </ToastProvider>
      );
    }
    const result = render(<Tree />);
    const initialFigures = phoneFigures();
    setPhone(false);
    for (const count of Object.values(counts)) expect(count).toBeGreaterThan(0);
    const query = "NO_MATCH_FOR_PERFORMANCE_TEST";
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter wards or hospitals" }), {
      target: { value: query },
    });
    expect(result.container.querySelectorAll("#wardPressureTable tbody tr")).toHaveLength(0);
    setPhone(true);
    expect(phoneFigures()).toEqual(initialFigures);

    const measured = liveAdmissions.find((admission) => admission.pulledAt !== null && admission.arrivedAt !== null);
    expect(measured).toBeDefined();
    const changed = liveAdmissions.map((admission) =>
      admission === measured ? { ...admission, arrivedAt: (admission.arrivedAt as number) + 60 } : admission,
    );
    Object.assign(counts, { wardSort: 0, edTableCopy: 0, arrivalBands: 0, finderSort: 0 });
    result.rerender(<Tree admissions={changed} />);
    const changedFigures = phoneFigures();
    expect(changedFigures.moreFigures).not.toEqual(initialFigures.moreFigures);
    console.info(
      "Statistics phone update work",
      JSON.stringify({
        counts,
        figures: fingerprint(changedFigures),
        output: fingerprint(result.container.textContent),
      }),
    );
    expect(counts).toEqual({ wardSort: 0, edTableCopy: 0, arrivalBands: 0, finderSort: 0 });

    setPhone(false);
    expect(screen.getByRole("searchbox", { name: "Filter wards or hospitals" })).toHaveValue(query);
    expect(result.container.querySelectorAll("#wardPressureTable tbody tr")).toHaveLength(0);
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter wards or hospitals" }), { target: { value: "" } });
    expect(result.container.querySelectorAll("#wardPressureTable tbody tr").length).toBeGreaterThan(0);
    for (const count of Object.values(counts)) expect(count).toBeGreaterThan(0);
    const chart = screen.getByText("Pull to arrival, admissions by band").closest("figure");
    expect(chart).not.toBeNull();
    const bands = within(chart as HTMLElement).getAllByRole("listitem");
    expect(bands).toHaveLength(4);
    expect(bands.reduce((total, band) => total + Number(band.textContent?.split(": ").at(-1)), 0)).toBe(
      (changedFigures.moreFigures as PhoneMoreFigures).arrivals.measured,
    );
    expect(result.container.querySelectorAll("#edPressureTable tbody tr").length).toBeGreaterThan(0);
    setPhone(true);
    expect(phoneFigures()).toEqual(changedFigures);
  });
});
