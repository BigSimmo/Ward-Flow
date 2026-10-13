import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/ui/toast";

/*
 * A4-21 (audit 13 Oct 2026): a confirmed release records the departure from the Discharges sheet,
 * with its destination, instead of Open ward, find the bed, open the drawer and record there.
 */
/** Reads the shared state back into the page: confirmed releases and refusals so far. */
function Probe() {
  const { bedReleases, rejections } = useWardFlow();
  return (
    <output data-testid="probe">
      {bedReleases.filter((release) => release.state === "confirmed").length}|{rejections.length}
    </output>
  );
}
const probe = () => screen.getByTestId("probe").textContent!.split("|").map(Number) as [number, number];

/** The first release row of a group: a row of cells, not the group's own header row. */
function firstRecordRow(group: HTMLElement): HTMLElement | undefined {
  return within(group)
    .getAllByRole("row")
    .find((candidate) => !candidate.querySelector("th") && candidate.querySelector("td"));
}

describe("Record departure from the release sheet", () => {
  it("records a confirmed release's departure with the chosen destination", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Probe />
        <DischargeBoard />
      </WardFlowProvider>,
    );
    const confirmed = screen.getByTestId("ward-discharge-group-confirmed");
    const row = firstRecordRow(confirmed);
    expect(row).toBeDefined();
    const [before] = probe();
    fireEvent.click(row!);

    // Open ward stays as the secondary way.
    expect(screen.getByRole("link", { name: "Open ward" })).toBeInTheDocument();
    const destination = screen.getByTestId("ward-discharge-departure-destination");
    expect(destination).toHaveValue("discharged-to-the-community");
    fireEvent.change(destination, { target: { value: "transferred-to-a-general-hospital" } });
    fireEvent.click(screen.getByTestId("ward-discharge-record-departure"));

    expect(probe()).toEqual([before - 1, 0]);
    // The departed release no longer offers the action.
    expect(screen.queryByTestId("ward-discharge-record-departure")).toBeNull();
  });

  it("offers Undo on the departure's toast, which puts the release back", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Probe />
          <DischargeBoard />
        </ToastProvider>
      </WardFlowProvider>,
    );
    const row = firstRecordRow(screen.getByTestId("ward-discharge-group-confirmed"));
    const [before] = probe();
    fireEvent.click(row!);
    fireEvent.click(screen.getByTestId("ward-discharge-record-departure"));
    expect(probe()).toEqual([before - 1, 0]);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(probe()).toEqual([before, 0]);
    expect(screen.getByText(/^Undone\. .+ is back in their bed\.$/u)).toBeInTheDocument();
  });

  it("does not offer Record departure on an expected release", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
      </WardFlowProvider>,
    );
    const expected = screen.getByTestId("ward-discharge-group-expected");
    const row = firstRecordRow(expected);
    fireEvent.click(row!);
    expect(screen.queryByTestId("ward-discharge-record-departure")).toBeNull();
  });
});
