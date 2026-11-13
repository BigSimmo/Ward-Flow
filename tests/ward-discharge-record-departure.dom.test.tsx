import { fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, useRef, type ReactNode } from "react";
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
import { ToastProvider } from "@/components/wf/toast-provider";
import { transportPendingFor } from "@/components/ward-management/ward-left-ward";

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

/** Who the newest step was recorded by, read back from the Undo record. */
function LastStepRole() {
  const { undoRecords } = useWardFlow();
  return <output data-testid="last-step-role">{undoRecords?.at(-1)?.role ?? "none"}</output>;
}

describe("Record departure from the release sheet", () => {
  it("records the departure in the name of the acting desk, which Undo then matches", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Probe />
          <LastStepRole />
          <DischargeBoard />
        </ToastProvider>
      </WardFlowProvider>,
    );
    fireEvent.click(firstRecordRow(screen.getByTestId("ward-discharge-group-confirmed"))!);
    fireEvent.change(screen.getByTestId("ward-discharge-departure-destination"), {
      target: { value: "discharged-to-the-community" },
    });
    fireEvent.click(screen.getByTestId("ward-discharge-record-departure"));
    // With no ward desk selected the sheet is read as the coordinator, so the departure is its own.
    expect(screen.getByTestId("last-step-role").textContent).toBe("coordinator");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(probe()[1]).toBe(0);
  });

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

    // Open ward stays as the secondary way; since D-98 (8 Nov 2026) it opens the Ward peek first.
    const openWard = screen.getByRole("button", { name: "Open ward" });
    expect(openWard).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(openWard);
    const peek = screen.getByRole("dialog", { name: /at a glance$/ });
    expect(within(peek).getByText("Ready now")).toBeInTheDocument();
    expect(within(peek).getByRole("link", { name: "Open ward" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/ward-flow\/ward\//),
    );
    fireEvent.keyDown(peek, { key: "Escape" });
    const destination = screen.getByTestId("ward-discharge-departure-destination");
    // F-45 (Josh, 13 Nov 2026): no destination starts selected, and the record waits for one.
    expect(destination).toHaveValue("");
    expect(screen.getByTestId("ward-discharge-record-departure")).toBeDisabled();
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
    fireEvent.change(screen.getByTestId("ward-discharge-departure-destination"), {
      target: { value: "discharged-to-the-community" },
    });
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

/** Item 18: the confirmed releases still waiting on transport, and who is now waiting on site. */
function TransportProbe() {
  const { bedReleases, admissions, dispatch } = useWardFlow();
  // Holds one confirmed release up on transport, once, so its departure has transport still to come.
  const held = useRef(false);
  useEffect(() => {
    if (held.current) return;
    held.current = true;
    const release = bedReleases.find((candidate) => candidate.state === "confirmed" && !candidate.blocker);
    if (release)
      dispatch({
        type: "BLOCK_BED_RELEASE",
        role: "coordinator",
        now: NOW_ANCHOR,
        releaseId: release.id,
        actingUnitId: release.unitId,
        blocker: "Awaiting transport",
      });
  }, [bedReleases, dispatch]);
  const pending = bedReleases.filter((release) => {
    const stay = admissions.find((admission) => admission.id === release.admissionId);
    return release.state === "confirmed" && stay !== undefined && transportPendingFor(stay, bedReleases);
  });
  const waiting = admissions.filter((admission) => admission.waitingForTransport !== undefined);
  return (
    <output data-testid="transport-probe">
      {pending.map((release) => release.id).join(",")}|{waiting.map((admission) => admission.id).join(",")}
    </output>
  );
}

describe("Record discharge asks about transport while it is still to come (item 18, CodeRabbit #1608)", () => {
  it("asks before recording, and a still-waiting answer puts the person on the Waiting for transport list", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <TransportProbe />
        <DischargeBoard />
      </WardFlowProvider>,
    );
    const [pendingIds] = screen.getByTestId("transport-probe").textContent!.split("|");
    const releaseId = pendingIds!.split(",").filter(Boolean)[0];
    expect(releaseId, "the seed has a confirmed release still waiting on transport").toBeDefined();
    const row = document.querySelector(`[data-release-id="${releaseId}"]`) as HTMLElement;
    fireEvent.click(row);
    const record = screen.getByTestId("ward-discharge-record-departure");
    // Nothing is chosen for them: no destination (F-45), and then the transport answer.
    expect(record).toBeDisabled();
    fireEvent.change(screen.getByTestId("ward-discharge-departure-destination"), {
      target: { value: "discharged-to-the-community" },
    });
    expect(record).toBeDisabled();
    const transport = screen.getByTestId("ward-discharge-departure-transport");
    fireEvent.click(within(transport).getByRole("radio", { name: "Still waiting" }));
    expect(record).toBeEnabled();
    const waitingBefore = screen.getByTestId("transport-probe").textContent!.split("|")[1]!;
    fireEvent.click(record);
    const waitingAfter = screen.getByTestId("transport-probe").textContent!.split("|")[1]!;
    expect(waitingAfter.split(",").filter(Boolean).length).toBe(waitingBefore.split(",").filter(Boolean).length + 1);
  });

  it("does not ask for someone who did not return", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <TransportProbe />
        <DischargeBoard />
      </WardFlowProvider>,
    );
    const releaseId = screen.getByTestId("transport-probe").textContent!.split("|")[0]!.split(",")[0];
    fireEvent.click(document.querySelector(`[data-release-id="${releaseId}"]`) as HTMLElement);
    fireEvent.change(screen.getByTestId("ward-discharge-departure-destination"), {
      target: { value: "did-not-return" },
    });
    expect(screen.queryByTestId("ward-discharge-departure-transport")).toBeNull();
    expect(screen.getByTestId("ward-discharge-record-departure")).toBeEnabled();
  });
});
