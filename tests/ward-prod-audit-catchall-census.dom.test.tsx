import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => cleanup());

/**
 * Audit 24-7 item 2: the Patients page empty state offered "Add patient" after a one-letter typo
 * with no near spellings, which invites a duplicate record. It now shows "Did you mean?" first.
 */
describe("Patients empty state offers near spellings before Add patient", () => {
  it("lists the one-keystroke-away name above Add patient", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
    const box = screen.getByLabelText("Search");
    fireEvent.change(box, { target: { value: "Hallowey" } });
    const group = screen.getByRole("group", { name: "Did you mean?" });
    const link = within(group).getByRole("link", { name: /Talia Halloway/ });
    expect(link.getAttribute("href")).toMatch(/^\/ward-flow\/people\//);
    const add = within(group.parentElement!).getByRole("link", { name: /Add patient/ });
    expect(group.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no near spellings when nothing is one keystroke away", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
    const box = screen.getByLabelText("Search");
    fireEvent.change(box, { target: { value: "Zzqxv" } });
    expect(screen.queryByRole("group", { name: "Did you mean?" })).toBeNull();
  });
});
