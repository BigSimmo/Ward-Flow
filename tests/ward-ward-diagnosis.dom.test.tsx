import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * FD-10 on the ward board: the ward records its own tentative diagnosis block from the fixed list,
 * and the board then shows it beside the block the stay arrived with, which stays as it was.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/board/rph-adult-secure",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

describe("ward board: the ward's own tentative diagnosis (FD-10)", () => {
  it("records a block from the list and shows it beside the original, which is kept", () => {
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <WardBoard unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );
    fireEvent.click(within(screen.getByTestId("ward-board-bed-1")).getByRole("button"));

    const form = screen.getByTestId("ward-board-ward-diagnosis-form");
    const record = within(form).getByTestId("ward-board-ward-diagnosis-record");
    expect(record).toBeDisabled();
    const original = [...document.querySelectorAll("p")]
      .map((node) => node.textContent ?? "")
      .find((text) => text.startsWith("Tentative diagnosis:"));
    expect(original).toBeDefined();

    fireEvent.change(within(form).getByTestId("ward-board-ward-diagnosis-select"), { target: { value: "F20–F29" } });
    fireEvent.click(record);

    const lines = [...document.querySelectorAll('[data-testid$="-ward-diagnosis"]')].map((node) => node.textContent);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain(
      "Ward's tentative diagnosis: Schizophrenia, schizotypal and delusional disorders (F20–F29)",
    );
    expect(lines[0]).toContain("The one above is kept.");
    const stillThere = [...document.querySelectorAll("p")]
      .map((node) => node.textContent ?? "")
      .find((text) => text.startsWith("Tentative diagnosis:"));
    expect(stillThere).toBe(original);
    expect(within(form).getByTestId("ward-board-ward-diagnosis-record")).toBeDisabled();
  });
});
