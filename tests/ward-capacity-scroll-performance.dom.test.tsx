import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BedMap, bedMapWards, groupBedMapWardsByService } from "@/components/ward-management/capacity/bed-map";
import { allUnits } from "@/components/ward-management/ward-sites";

const fixture = groupBedMapWardsByService(bedMapWards(allUnits(), [])).find((group) => group.wards.length >= 4)!;
const units = fixture.wards.slice(0, 4).map((ward) => ward.unit);
const trackName = `${fixture.service} wards track`;

type Observation = {
  callback: ResizeObserverCallback;
  targets: Set<Element>;
  disconnect: ReturnType<typeof vi.fn<() => void>>;
};

function mockGeometry(initialWidth = 200) {
  let width = initialWidth;
  let scrollWidthReads = 0;
  const observations: Observation[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  const isTrack = (element: HTMLElement) => element.getAttribute("aria-label") === trackName;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
    return isTrack(this) ? width : 0;
  });
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (this: HTMLElement) {
    if (!isTrack(this)) return 0;
    scrollWidthReads += 1;
    return 400;
  });
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
    return this.parentElement && isTrack(this.parentElement)
      ? Array.from(this.parentElement.children).indexOf(this) * 100
      : 0;
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observation: Observation;
      constructor(callback: ResizeObserverCallback) {
        this.observation = { callback, targets: new Set(), disconnect: vi.fn<() => void>() };
        observations.push(this.observation);
      }
      observe(target: Element) {
        this.observation.targets.add(target);
      }
      unobserve(target: Element) {
        this.observation.targets.delete(target);
      }
      disconnect() {
        this.observation.disconnect();
      }
    },
  );
  return {
    observations,
    frames,
    reads: () => scrollWidthReads,
    resetReads: () => {
      scrollWidthReads = 0;
    },
    flush: () => {
      act(() => {
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach((callback) => callback(0));
      });
    },
    resize: (track: Element, nextWidth: number) => {
      width = nextWidth;
      const observer = observations.findLast((entry) => entry.targets.has(track))!;
      act(() => observer.callback([], observer as unknown as ResizeObserver));
    },
  };
}

function mount() {
  const view = render(<BedMap units={units} bedReleases={[]} service={fixture.service} initialBedDetail={false} />);
  const group = screen.getByTestId(`ward-bed-map-service-${fixture.service}`);
  const track = within(group).getByRole("region", { name: trackName });
  const previous = () =>
    within(group).getAllByRole("button", { name: `Previous wards in ${fixture.service}` })[0] as HTMLButtonElement;
  const next = () =>
    within(group).getAllByRole("button", { name: `Next wards in ${fixture.service}` })[0] as HTMLButtonElement;
  return { ...view, group, track, previous, next };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Capacity carousel measurement lifecycle", () => {
  it("measures each scroll frame once without reattaching its track observer when the visible ward changes", () => {
    const geometry = mockGeometry();
    const { track, group, previous, next, unmount } = mount();
    expect(within(group).getByText("1–2 of 4")).toBeInTheDocument();
    expect(previous()).toBeDisabled();
    expect(next()).toBeEnabled();
    geometry.resetReads();

    for (const [offset, range] of [
      [100, "2–3 of 4"],
      [200, "3–4 of 4"],
      [0, "1–2 of 4"],
    ] as const) {
      track.scrollLeft = offset;
      fireEvent.scroll(track);
      fireEvent.scroll(track);
      expect(geometry.frames.size).toBe(1);
      geometry.flush();
      expect(within(group).getByText(range)).toBeInTheDocument();
      expect(previous().disabled).toBe(offset === 0);
      expect(next().disabled).toBe(offset === 200);
    }

    const observers = geometry.observations.filter((entry) => entry.targets.has(track));
    const counts = {
      scrollFrames: 3,
      scrollWidthReads: geometry.reads(),
      trackObservers: observers.length,
      disconnectsBeforeUnmount: observers.reduce((total, entry) => total + entry.disconnect.mock.calls.length, 0),
    };
    console.info("capacity-scroll-counters", JSON.stringify(counts));
    expect(counts).toEqual({ scrollFrames: 3, scrollWidthReads: 6, trackObservers: 1, disconnectsBeforeUnmount: 0 });

    fireEvent.scroll(track);
    unmount();
    expect(geometry.frames.size).toBe(0);
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
  });

  it("retains the four-pixel edge tolerance, resize feedback and grid transition", () => {
    const geometry = mockGeometry();
    const { track, group, previous, next } = mount();
    for (const [offset, start, end] of [
      [4, true, false],
      [5, false, false],
      [195, false, false],
      [196, false, true],
    ] as const) {
      track.scrollLeft = offset;
      fireEvent.scroll(track);
      geometry.flush();
      expect(previous().disabled).toBe(start);
      expect(next().disabled).toBe(end);
    }
    track.scrollLeft = 0;
    geometry.resize(track, 400);
    expect(previous()).toBeDisabled();
    expect(next()).toBeDisabled();
    expect(within(group).getByText("1–4 of 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Grid" }));
    expect(within(group).queryByRole("button", { name: `Next wards in ${fixture.service}` })).toBeNull();
    expect(group).toHaveAttribute("data-layout", "grid");
  });

  it("retains zero-width fallback arrows after advancing and then receiving a resize notification", () => {
    const geometry = mockGeometry(0);
    const { track, group, previous, next } = mount();
    expect(previous()).toBeDisabled();
    expect(next()).toBeEnabled();
    for (let index = 1; index <= 3; index += 1) {
      fireEvent.click(next());
      geometry.resize(track, 0);
      expect(previous()).toBeEnabled();
      expect(next().disabled).toBe(index === 3);
    }
    expect(within(group).getByText("4–4 of 4")).toBeInTheDocument();
    for (let index = 2; index >= 0; index -= 1) {
      fireEvent.click(previous());
      geometry.resize(track, 0);
      expect(previous().disabled).toBe(index === 0);
      expect(next()).toBeEnabled();
    }
    expect(within(group).getByText("1–3 of 4")).toBeInTheDocument();
  });
});
