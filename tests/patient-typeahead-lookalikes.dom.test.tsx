import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PatientTypeahead } from "@/components/ward-management/search/patient-typeahead";
import { findPatients, type Patient } from "@/components/ward-management/ward-patients";
import { EXACT_ALEX_MORGAN_IDS, LOOKALIKES } from "./fixtures/patient-search-lookalikes";

/*
 * Audit 3 (issue #1566): the patient typeahead's list for a look-alike set. It is deliberately
 * unranked (its own header), so this pins what it does promise: only matching people, each with a
 * record number and date of birth, and a pick hands back that row's own record.
 */
function Harness(props: Omit<ComponentProps<typeof PatientTypeahead>, "value" | "onValueChange" | "referrals">) {
  const [value, setValue] = useState("");
  return <PatientTypeahead {...props} referrals={[]} value={value} onValueChange={setValue} />;
}

const OPTION_PREFIX = "ward-patient-typeahead-option-";

function typeQuery(query: string) {
  fireEvent.change(screen.getByTestId("ward-patient-typeahead-input"), { target: { value: query } });
  return within(screen.getByRole("listbox", { name: "People found" })).getAllByRole("option");
}

const byId = (id: string | null) => LOOKALIKES.find((patient) => patient.id === id) as Patient;

describe("patient typeahead with look-alike names (Audit 3)", () => {
  it.each(["Alex Morgan", "Morgan, Alex", "morg", "a. morgan", "o'morgan"])(
    "%s lists only matching people, each with a UMRN and date of birth",
    (query) => {
      render(<Harness patients={LOOKALIKES} />);
      const options = typeQuery(query);
      const shown = options.map((option) => option.dataset.testid?.slice(OPTION_PREFIX.length) ?? null);
      expect(shown).toEqual(findPatients(LOOKALIKES, query).map((patient) => patient.id));
      for (const [index, option] of options.entries()) {
        const patient = byId(shown[index]);
        expect(option).toHaveTextContent(patient.umrn);
        expect(option).toHaveTextContent(`born ${patient.dateOfBirth}`);
      }
    },
  );

  it("tells the two Alex Morgans apart and a click picks that exact record", () => {
    const onPick = vi.fn();
    render(<Harness patients={LOOKALIKES} onPick={onPick} />);
    typeQuery("Alex Morgan");
    const [first, second] = EXACT_ALEX_MORGAN_IDS.map((id) => screen.getByTestId(`${OPTION_PREFIX}${id}`));
    expect(first).toHaveTextContent("UM900012");
    expect(second).toHaveTextContent("UM900013");
    expect(first.textContent).not.toBe(second.textContent);
    fireEvent.click(second);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0].id).toBe("PT-LA-13");
  });

  it("Enter picks the row the keyboard is on, not another look-alike", () => {
    const onPick = vi.fn();
    render(<Harness patients={LOOKALIKES} onPick={onPick} />);
    const options = typeQuery("Alex Morgan");
    const input = screen.getByTestId("ward-patient-typeahead-input");
    fireEvent.keyDown(input, { key: "End" });
    const active = options.find((option) => option.getAttribute("aria-selected") === "true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(`${OPTION_PREFIX}${onPick.mock.calls[0][0].id}`).toBe(active?.dataset.testid);
  });
});
