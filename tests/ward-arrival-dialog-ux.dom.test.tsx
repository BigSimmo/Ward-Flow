import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { patientIdentityLine, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seed = seedWardFlowState();
const movement = seed.movements[0]!;
const identity = patientIdentityLine(resolveSubjectPatient(movement, seed));

function renderPlan() {
  const close = vi.fn();
  function Host() {
    const [open, setOpen] = useState(true);
    return (
      <ArrivalTimeModal
        isOpen={open}
        movement={movement}
        onClose={() => {
          close();
          setOpen(false);
        }}
      />
    );
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Host />
    </WardFlowProvider>,
  );
  return close;
}

describe("arrival plan identity and unsaved changes", () => {
  it("names the linked patient and keeps the recorded pull limit explicit", () => {
    const close = renderPlan();
    const dialog = screen.getByRole("dialog", { name: "Update arrival time & transport" });
    expect(dialog).toHaveAccessibleDescription(`For ${identity}`);
    expect(dialog).toHaveTextContent("recorded pull time limit still applies");
    expect(dialog).not.toHaveTextContent(/clears the .*pull clock/);
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(close).toHaveBeenCalledOnce();
  });

  it.each(["close", "Escape"])("retains a changed plan on %s until discard is confirmed", (way) => {
    const close = renderPlan();
    const tracking = screen.getByLabelText("CAD or tracking number");
    fireEvent.change(tracking, { target: { value: "SYNTHETIC-TRACKING" } });
    if (way === "close") fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    else fireEvent.keyDown(tracking, { key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Discard arrival plan changes?" })).toHaveTextContent(identity);
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(tracking).toHaveValue("SYNTHETIC-TRACKING");
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(close).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
