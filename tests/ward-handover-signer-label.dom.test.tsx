import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HandoverSignOffPanel } from "@/components/ward-management/handover/handover-panels";

const NOW = 1_800_000_000_000;

function panel(props: {
  signedAt: number | null;
  signedBy: "coordinator" | "ward" | null;
  viewerRole: "coordinator" | "ward";
}) {
  render(
    <HandoverSignOffPanel
      title="Sign off this shift"
      subtitle="Day shift"
      checks={[{ id: "one", done: true, text: "Every move has a next step" }]}
      now={NOW}
      canSignOff
      onSignOff={vi.fn()}
      onUndoSignOff={vi.fn()}
      {...props}
    />,
  );
  return screen.getByTestId("ward-handover-sign-off");
}

describe("handover sign-off names who signed", () => {
  it("names the recorded signer, not the desk viewing it", () => {
    const card = panel({ signedAt: NOW - 60_000, signedBy: "coordinator", viewerRole: "ward" });
    expect(card).toHaveTextContent("Handed over byFlow coordinator");
    expect(card).not.toHaveTextContent("Flow coordinatoryou");
    expect(screen.getByTestId("ward-handover-sign-off-visible-status")).toHaveTextContent("as flow coordinator.");
  });

  it("names the viewing desk while the handover is unsigned", () => {
    const card = panel({ signedAt: null, signedBy: null, viewerRole: "ward" });
    expect(card).toHaveTextContent("Nurse in chargeyou");
  });

  it("marks a sign-off as yours when your desk recorded it", () => {
    panel({ signedAt: NOW - 60_000, signedBy: "ward", viewerRole: "ward" });
    expect(screen.getByTestId("ward-handover-sign-off-visible-status")).toHaveTextContent("as nurse in charge.");
  });
});
