import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { SAMPLE_OBSERVATION_MIX_LABEL } from "@/components/ward-management/ward-sample-choices";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { ToastProvider } from "@/components/wf/toast-provider";

// D-189 item 2 (Josh, 13 Nov 2026): until Josh sets an observation mix, the ward page says beside its
// constant observation figure that the sample day's levels are a sample mix, not clinical guidance.
// A label only: no level changes (the matching unit test). Synthetic data only.

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("D-189 item 2: the ward page labels the observation mix", () => {
  it("shows Sample mix, not clinical guidance beside the constant observation staff figure", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <WardScreen unitId="rph-adult-secure" />
        </ToastProvider>
      </WardFlowProvider>,
    );
    // Found by its test id only: PR F renames the tile's label, so the test does not pin it.
    const note = screen.getByTestId("ward-hero-obs-sample");
    expect(note).toHaveTextContent(SAMPLE_OBSERVATION_MIX_LABEL);
  });
});
