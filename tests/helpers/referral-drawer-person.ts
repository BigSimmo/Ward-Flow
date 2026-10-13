import { fireEvent, screen, within } from "@testing-library/react";

/**
 * Picks the sample movement WF-009 (Tobias Wren, PT-023, UMRN UM100023) from the referral
 * slide-out's patient search.
 *
 * Merge of the two audit rounds (13 Oct 2026): a sheet opened plainly starts on no patient (A2-3),
 * and a sheet opened naming a person is prefilled from the record as an entry point (option B).
 * Tests that walk step 1 by hand open plainly and choose the person here, which is the same state
 * the sheet used to open on before either change.
 */
export function chooseSampleReferralPerson(query = "UM100023") {
  fireEvent.change(screen.getByRole("searchbox", { name: "Find a patient" }), { target: { value: query } });
  const results = screen.getByRole("listbox", { name: "Matching patients" });
  fireEvent.click(within(results).getAllByRole("option")[0]!);
}
