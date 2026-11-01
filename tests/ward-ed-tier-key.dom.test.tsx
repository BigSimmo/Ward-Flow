import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Simplification A6: every ED board that shows the T1 to T3 codes spells them out once. Phone rows
 * show the codes too, so the key must not live only beside the wider-screen table.
 */

const original = typeof window !== "undefined" ? window.matchMedia : undefined;

function emulate(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query === "(max-width: 48rem)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  if (original) window.matchMedia = original;
});

describe("ED board tier key", () => {
  it("spells out the tier codes on the phone list", () => {
    emulate(true);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="rph-ed" />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-tier-key")).toHaveTextContent("T1 most urgent");
    expect(screen.queryByRole("table", { name: /Emergency department/u })).toBeNull();
  });

  it("keys the priority bars on the wider-screen table, which has no T column (handover build, 1 Nov 2026)", () => {
    emulate(false);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="rph-ed" />
      </WardFlowProvider>,
    );
    const key = screen.getByTestId("ward-tier-bars-key");
    expect(key).toHaveTextContent("Most urgent");
    expect(key).toHaveTextContent("Urgent");
    expect(key).toHaveTextContent("Least urgent");
    expect(screen.getByRole("table", { name: /Emergency department handover/u })).toBeInTheDocument();
  });
});
