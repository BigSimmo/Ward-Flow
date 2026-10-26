// Audit CS3-04 (CS-14): with no legal form held, "No form" is said only for a recorded Voluntary
// status. For anyone else the form is not recorded, which the handover and phone ED now say too.
import { describe, expect, it } from "vitest";

import { noFormWords } from "@/components/ward-management/ward-legal-status";

describe("the words for a stay with no legal form (audit CS3-04)", () => {
  it.each([
    ["Voluntary", "No form"],
    ["Involuntary inpatient", "Form not recorded"],
    ["Referred for psychiatric examination", "Form not recorded"],
    ["Not recorded", "Form not recorded"],
    [undefined, "Form not recorded"],
    ["", "Form not recorded"],
  ] as const)("%s reads %s", (status, words) => {
    expect(noFormWords(status)).toBe(words);
  });
});
