import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardArrivalsCorridor } from "@/components/ward-management/ward/ward-arrivals-corridor";
import type { ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";

/**
 * Audit A1-5 (13 Oct 2026): the arrivals cards used to tag every secure patient "HDU / Close
 * Observation", read from the bed's security alone. Only a recorded observation level is shown.
 */
const SECURE = wardMovements.find((movement) => movement.security === "Secure")!;

function renderCard(overrides: Partial<typeof SECURE>) {
  const movement = { ...SECURE, ...overrides };
  render(
    <WardArrivalsCorridor
      unit={allUnits()[0]!}
      accepted={[movement]}
      now={NOW_ANCHOR}
      resolvePatientIdentity={() => ({ displayName: "Synthetic Person" }) as ResolvedPatientInfo}
      releaseOpenFor={undefined}
      toggleRelease={() => undefined}
      releaseReason={undefined}
      setReleaseReason={() => undefined}
      submitRelease={() => undefined}
      lastActionRejection={undefined}
      dispatch={() => undefined}
      setCheckToken={() => undefined}
      priorRejectionCountRef={createRef<number>() as React.MutableRefObject<number>}
      rejections={[]}
      overrideReasonForm={() => null}
    />,
  );
  return screen.getByTestId(`ward-accepted-${movement.id}`);
}

describe("arrivals cards show only a recorded observation level (A1-5)", () => {
  it("adds no observation tag to a secure patient with none recorded", () => {
    const card = renderCard({ specialling: false, highAcuity: false });
    expect(card).not.toHaveTextContent(/HDU|Close Observation|specialling|High-acuity/);
  });

  it("shows 1:1 specialling only when it is recorded", () => {
    expect(renderCard({ specialling: true, highAcuity: false })).toHaveTextContent("1:1 specialling");
  });
});
