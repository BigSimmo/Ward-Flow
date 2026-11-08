import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { ToastProvider } from "@/components/wf/toast-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function ConfirmRphAdultSecureCapacityAtZero() {
  const { dispatch, now, units } = useWardFlow();
  const observed = units.find((unit) => unit.id === "rph-adult-secure")!;
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "CONFIRM_CAPACITY",
          role: "ward",
          now,
          unitId: "rph-adult-secure",
          actingUnitId: "rph-adult-secure",
          expectedRevision: observed.allocatable.revision ?? 0,
          value: 0,
        })
      }
    >
      confirm rph-adult-secure capacity at zero
    </button>
  );
}

function CapacityWorldControls({
  unitId,
  replacement,
}: {
  unitId: string;
  replacement: "RESET_SCENARIO" | "SET_SCENARIO";
}) {
  const { dispatch, now, units, worldGeneration } = useWardFlow();
  const unit = units.find((candidate) => candidate.id === unitId)!;
  return (
    <>
      <output data-testid="capacity-world-generation">{worldGeneration}</output>
      <output data-testid="capacity-world-value">{unit.allocatable.value}</output>
      <output data-testid="capacity-world-revision">{unit.allocatable.revision ?? 0}</output>
      <button
        type="button"
        data-testid="replace-capacity-world"
        onClick={() =>
          dispatch(
            replacement === "RESET_SCENARIO"
              ? { type: replacement, role: "demo", now }
              : { type: replacement, role: "demo", now, scenario: "scarce" },
          )
        }
      >
        Replace synthetic world
      </button>
    </>
  );
}

describe("ward capacity draft world and unit identity", () => {
  it.each([
    ["RESET_SCENARIO", "beds only"],
    ["RESET_SCENARIO", "beds and morning numbers"],
    ["SET_SCENARIO", "beds only"],
    ["SET_SCENARIO", "beds and morning numbers"],
  ] as const)("retires the old capacity draft after %s before confirming %s", async (replacement, confirmation) => {
    const unitId = "rph-adult-secure";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityWorldControls unitId={unitId} replacement={replacement} />
        <WardScreen unitId={unitId} />
      </WardFlowProvider>,
    );
    const generation = Number(screen.getByTestId("capacity-world-generation").textContent);
    fireEvent.click(screen.getByRole("button", { name: "Confirm numbers" }));
    const abandonedInput = await screen.findByTestId("ward-capacity-input");
    fireEvent.change(abandonedInput, { target: { value: "2" } });

    // Keep the provider and ward mounted while their underlying world is replaced.
    fireEvent.click(screen.getByTestId("replace-capacity-world"));
    expect(Number(screen.getByTestId("capacity-world-generation").textContent)).toBeGreaterThan(generation);
    const replacementValue = Number(screen.getByTestId("capacity-world-value").textContent);
    expect(replacementValue).not.toBe(2);
    expect(abandonedInput).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-capacity-input")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Confirm numbers" }));
    const freshInput = await screen.findByTestId("ward-capacity-input");
    expect(freshInput).toHaveValue(replacementValue);
    const freshValue = replacementValue === 0 ? 1 : 0;
    fireEvent.change(freshInput, { target: { value: String(freshValue) } });
    const revision = Number(screen.getByTestId("capacity-world-revision").textContent);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", {
          name: confirmation === "beds only" ? "Confirm beds only" : /^Confirm beds and morning numbers/,
        }),
      );
    });
    expect(Number(screen.getByTestId("capacity-world-value").textContent)).toBe(freshValue);
    expect(Number(screen.getByTestId("capacity-world-revision").textContent)).toBeGreaterThan(revision);
  });

  it("retires the previous ward's capacity draft without replacing the world", async () => {
    const viewFor = (unitId: string) => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityWorldControls unitId={unitId} replacement="RESET_SCENARIO" />
        <WardScreen unitId={unitId} />
      </WardFlowProvider>
    );
    const view = render(viewFor("rph-adult-secure"));
    const generation = Number(screen.getByTestId("capacity-world-generation").textContent);
    fireEvent.click(screen.getByRole("button", { name: "Confirm numbers" }));
    const abandonedInput = await screen.findByTestId("ward-capacity-input");
    fireEvent.change(abandonedInput, { target: { value: "2" } });

    view.rerender(viewFor("bty-adult-secure"));
    expect(Number(screen.getByTestId("capacity-world-generation").textContent)).toBe(generation);
    expect(abandonedInput).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm numbers" }));
    expect(await screen.findByTestId("ward-capacity-input")).toHaveValue(
      Number(screen.getByTestId("capacity-world-value").textContent),
    );
  });

  it.each(["beds only", "beds and morning numbers"] as const)(
    "keeps an ordinary competing capacity revision stale until explicitly refreshed before confirming %s",
    async (confirmation) => {
      render(
        <ToastProvider>
          <WardFlowProvider initialNow={NOW_ANCHOR}>
            <CapacityWorldControls unitId="rph-adult-secure" replacement="RESET_SCENARIO" />
            <ConfirmRphAdultSecureCapacityAtZero />
            <WardScreen unitId="rph-adult-secure" />
          </WardFlowProvider>
        </ToastProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Confirm numbers" }));
      const input = await screen.findByTestId("ward-capacity-input");
      fireEvent.change(input, { target: { value: "2" } });
      fireEvent.click(screen.getByRole("button", { name: "confirm rph-adult-secure capacity at zero", hidden: true }));
      const currentRevision = Number(screen.getByTestId("capacity-world-revision").textContent);
      expect(input).toHaveValue(2);
      const confirm = () =>
        fireEvent.click(
          screen.getByRole("button", {
            name: confirmation === "beds only" ? "Confirm beds only" : /^Confirm beds and morning numbers/,
          }),
        );
      await act(async () => {
        confirm();
      });
      expect(Number(screen.getByTestId("capacity-world-value").textContent)).toBe(0);
      expect(Number(screen.getByTestId("capacity-world-revision").textContent)).toBe(currentRevision);

      fireEvent.click(screen.getByRole("button", { name: "Use current count" }));
      expect(input).toHaveValue(0);
      fireEvent.change(input, { target: { value: "1" } });
      await act(async () => {
        confirm();
      });
      expect(Number(screen.getByTestId("capacity-world-value").textContent)).toBe(1);
      expect(Number(screen.getByTestId("capacity-world-revision").textContent)).toBeGreaterThan(currentRevision);
    },
  );
  it("starts the draft from the current count when another desk confirmed before the dialog opened", async () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <CapacityWorldControls unitId="rph-adult-secure" replacement="RESET_SCENARIO" />
          <ConfirmRphAdultSecureCapacityAtZero />
          <WardScreen unitId="rph-adult-secure" />
        </WardFlowProvider>
      </ToastProvider>,
    );
    // Concurrent-sign-in test, 8 Nov 2026: the page was open, another desk confirmed, then this
    // desk opened the dialog. The confirm must go through, not be refused as changed meanwhile.
    fireEvent.click(screen.getByRole("button", { name: "confirm rph-adult-secure capacity at zero", hidden: true }));
    const revision = Number(screen.getByTestId("capacity-world-revision").textContent);
    fireEvent.click(screen.getByRole("button", { name: "Confirm numbers" }));
    const input = await screen.findByTestId("ward-capacity-input");
    expect(input).toHaveValue(0);
    expect(screen.queryByRole("button", { name: "Use current count" })).toBeNull();
    fireEvent.change(input, { target: { value: "1" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm beds only" }));
    });
    expect(Number(screen.getByTestId("capacity-world-value").textContent)).toBe(1);
    expect(Number(screen.getByTestId("capacity-world-revision").textContent)).toBeGreaterThan(revision);
    expect(document.body.textContent).not.toMatch(/CONFIRM_CAPACITY|expected revision/);
  });
});
