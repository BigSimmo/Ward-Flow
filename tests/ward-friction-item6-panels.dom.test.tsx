import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardToolsSheet } from "@/components/ward-management/tools/ward-tools-sheet";
import { BookingsPeekLink } from "@/components/ward-management/alerts/bookings-peek";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/alerts",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Friction pass item 6 (Josh's approval, 9 Nov 2026): each panel keeps the reader on the page.
describe("Log a delay as a short form in Tools (item 6c)", () => {
  it("records what is holding the chosen person up, without leaving Tools", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardToolsSheet isPhone={false} roleLabel="Bed coordinator" onNavigate={vi.fn()} onNewReferral={vi.fn()} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-tools-toggle-log-delay"));
    const form = await screen.findByTestId("tools-log-delay");
    const save = within(form).getByTestId("tools-log-delay-save");
    // Nothing to save until a person and the words are given.
    expect(save).toHaveAttribute("aria-disabled", "true");
    const person = within(form).getAllByRole("radio")[0]!;
    fireEvent.click(person);
    fireEvent.change(within(form).getByTestId("tools-log-delay-text"), {
      target: { value: "Awaiting single-room clean" },
    });
    // The button is drawn afresh once it can act, so it is found again.
    const ready = within(form).getByTestId("tools-log-delay-save");
    expect(ready).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(ready);
    expect(await within(form).findByRole("status")).toHaveTextContent(/^Logged for .+ at /u);
    // The note now shows on that person's row, as it does on Waiting and their record.
    expect(within(form).getAllByText(/Awaiting single-room clean/u).length).toBeGreaterThan(0);
  });

  it("finds a person by name or UR number", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardToolsSheet isPhone={false} roleLabel="Bed coordinator" onNavigate={vi.fn()} onNewReferral={vi.fn()} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-tools-toggle-log-delay"));
    const form = await screen.findByTestId("tools-log-delay");
    fireEvent.change(within(form).getByRole("searchbox", { name: "Find a person by name or UR number" }), {
      target: { value: "zzzz-no-one" },
    });
    expect(within(form).getByText("No one open matches.")).toBeInTheDocument();
  });
});

describe("Alerts bookings in a pop-up (item 6b)", () => {
  it("opens the ward's bookings over the page and keeps the ward page one link away", async () => {
    const href = "/ward-flow/ward/fre-adult-open?bookings=1";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BookingsPeekLink unitId="fre-adult-open" href={href}>
          Open bookings
        </BookingsPeekLink>
      </WardFlowProvider>,
    );
    const link = screen.getByRole("link", { name: "Open bookings" });
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("aria-haspopup", "dialog");
    expect(fireEvent.click(link)).toBe(false);
    const peek = await screen.findByTestId("bookings-peek");
    expect(within(peek).getByTestId("bookings-peek-ward-page")).toHaveAttribute("href", href);
    expect(await within(peek).findByTestId("ward-capacity-planned-admissions")).toBeInTheDocument();
  });

  it("stays a plain link when there is no ward to show", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BookingsPeekLink unitId={undefined} href="/ward-flow/capacity">
          Open bookings
        </BookingsPeekLink>
      </WardFlowProvider>,
    );
    expect(screen.getByRole("link", { name: "Open bookings" })).not.toHaveAttribute("aria-haspopup");
  });
});
