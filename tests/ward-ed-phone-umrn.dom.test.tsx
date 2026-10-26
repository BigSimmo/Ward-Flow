import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
 * Audit CS3-09: a phone ED row showed the name only, and the demo wards hold look-alike names. Each
 * row now carries the UMRN beside the name, as the desktop row does. Synthetic seed data only.
 */

const original = typeof window !== "undefined" ? window.matchMedia : undefined;

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: query === "(max-width: 48rem)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  if (original) window.matchMedia = original;
});

describe("phone ED rows name the person with a second identifier (audit CS3-09)", () => {
  it("shows a UMRN after the name on every row, and no two rows read the same", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="rph-ed" />
      </WardFlowProvider>,
    );
    const rows = screen.getAllByRole("listitem").filter((row) => row.dataset.testid?.startsWith("ward-ed-patient-"));
    expect(rows.length).toBeGreaterThan(1);
    const identities = rows.map((row) => {
      const umrn = within(row).getByText(/^· (UM\d+|UMRN not recorded)$/);
      return umrn.parentElement?.textContent ?? "";
    });
    expect(identities.every((line) => /\S · UM\d+$/.test(line))).toBe(true);
    expect(new Set(identities).size).toBe(identities.length);
  });
});
