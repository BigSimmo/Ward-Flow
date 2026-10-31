// Patients redesign (Josh, "Yes to all", 31 Oct 2026): the census's date of birth box is the kit's
// typed DD/MM/YYYY field beside the search, the table's "Where" header keeps its full spoken name,
// the phone highlight chips put the count first, and every "Show all" is the kit's Show more row.
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/ward-flow/search",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { DobField, DobToggle } from "@/components/ward-management/search/patient-census-view";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

afterEach(() => installMatchMediaStub(false));

function DobHarness({ onDob }: { onDob: (next: string) => void }) {
  const [dob, setDob] = useState("");
  return (
    <DobField
      dob={dob}
      onDob={(next) => {
        setDob(next);
        onDob(next);
      }}
    />
  );
}

describe("Patients redesign: the census search parts", () => {
  it("the DOB switch starts off and says so", () => {
    const toggle = vi.fn();
    render(<DobToggle dobOn={false} onDobToggle={toggle} />);
    const button = screen.getByRole("button", { name: "DOB" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("the date of birth box is typed as DD/MM/YYYY and hands back a real day only", () => {
    const onDob = vi.fn();
    render(<DobHarness onDob={onDob} />);
    const box = screen.getByRole("textbox", { name: "Date of birth" });
    expect(box).toHaveAttribute("placeholder", "DD/MM/YYYY");
    expect(box).toHaveAttribute("inputmode", "numeric");

    fireEvent.change(box, { target: { value: "16/07" } });
    expect(onDob).toHaveBeenLastCalledWith("");
    fireEvent.change(box, { target: { value: "16/07/1987" } });
    expect(onDob).toHaveBeenLastCalledWith("1987-07-16");
    expect(box).toHaveValue("16/07/1987");

    // A day that cannot exist is marked, not searched for.
    fireEvent.change(box, { target: { value: "31/02/1987" } });
    expect(onDob).toHaveBeenLastCalledWith("");
    expect(box).toHaveAttribute("aria-invalid", "true");
  });

  it("Clear empties a half-typed date too", () => {
    const onDob = vi.fn();
    render(<DobHarness onDob={onDob} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Date of birth" }), { target: { value: "16/07" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("textbox", { name: "Date of birth" })).toHaveValue("");
    expect(onDob).toHaveBeenLastCalledWith("");
  });
});

describe("Patients redesign: the census page", () => {
  it("the table's Where column header still reads Where now to a screen reader", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
    const table = screen.getByRole("table", { name: "Patients by where they are now" });
    const header = within(table).getByRole("columnheader", { name: "Where now" });
    expect(header).toHaveTextContent(/^Where$/u);
  });

  it("on a phone each highlight chip shows its count before its words", () => {
    installMatchMediaStub(true);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
    const chips = within(screen.getByRole("group", { name: "Highlight" })).getAllByRole("button");
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      expect(chip.textContent ?? "").toMatch(/^\d+\D/u);
    }
  });
});
