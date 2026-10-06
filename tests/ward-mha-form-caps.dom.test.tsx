import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WardMhaCalculator } from "@/components/ward-management/tools/ward-mha-calculator";

// Fixed reference now: 2026-09-26 10:00 (Saturday) in Perth time
const referenceNow = new Date("2026-09-26T02:00:00.000Z");

describe("MHA calculator statutory duration safeguard caps", () => {
  it("alerts when Form 1A entered time is >72h from reference time", () => {
    render(<WardMhaCalculator referenceNow={referenceNow} />);

    // Default is Form 1A tab. Set to 80h in the future
    fireEvent.change(screen.getByLabelText("Order expiry date written on form"), {
      target: { value: "2026-09-29" },
    });
    fireEvent.change(screen.getByLabelText("Order expiry time written on form"), {
      target: { value: "19:00" },
    });

    const alert = screen.getByTestId("safeguard-alert-1a");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(
      "Time written on form is more than 72 hours from reference time. Check the physical form.",
    );
  });

  it("provides 18h and 22h presets for Form 3A and alerts if expiry >24h", () => {
    render(<WardMhaCalculator referenceNow={referenceNow} />);

    // Switch to Form 3A tab
    fireEvent.click(screen.getByRole("tab", { name: /Form 3A/i }));

    // Check presets exist
    const btn18h = screen.getByRole("button", { name: "18h reference" });
    const btn22h = screen.getByRole("button", { name: "22h reference" });
    expect(btn18h).toBeInTheDocument();
    expect(btn22h).toBeInTheDocument();

    // Click 18h preset - should NOT exceed 24h cap
    fireEvent.click(btn18h);
    expect(screen.queryByTestId("safeguard-alert-3a")).not.toBeInTheDocument();

    // Set date to 2 days later (>24h)
    fireEvent.change(screen.getByLabelText("Order expiry date written on form"), {
      target: { value: "2026-09-28" },
    });
    fireEvent.change(screen.getByLabelText("Order expiry time written on form"), {
      target: { value: "12:00" },
    });

    const alert = screen.getByTestId("safeguard-alert-3a");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(
      "Time written on form is more than 24 hours from reference time. Check the physical form.",
    );
  });
});
