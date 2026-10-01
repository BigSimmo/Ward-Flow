import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardMhaCalculator } from "@/components/ward-management/tools/ward-mha-calculator";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const referenceNow = new Date("2026-09-25T16:30:00.000Z"); // Saturday 00:30 in Perth.
afterEach(() => vi.useRealTimers());

describe("MHA calculator Perth wall-time controls", () => {
  it.each([
    ["Today 09:00", "2026-09-26", "09:00"],
    ["Yesterday 18:00", "2026-09-25", "18:00"],
  ])("applies %s on the Perth calendar day", (preset, date, time) => {
    render(<WardMhaCalculator referenceNow={referenceNow} />);
    fireEvent.click(screen.getByRole("button", { name: preset }));
    expect(screen.getByLabelText("Order expiry date written on form")).toHaveValue(date);
    expect(screen.getByLabelText("Order expiry time written on form")).toHaveValue(time);
    expect(screen.getByTestId("status-banner-1a")).toHaveTextContent(time);
  });

  it("resolves the provider minute clock from Perth midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(referenceNow);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardMhaCalculator />
      </WardFlowProvider>,
    );
    expect(screen.getByLabelText("Order expiry date written on form")).toHaveValue("2026-09-26");
    expect(screen.getByLabelText("Order expiry time written on form")).toHaveValue("10:42");
  });
});
