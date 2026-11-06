/**
 * CL-8 (content and locale audit, 5 Nov 2026): people sort by family name, then given name, with
 * one Australian English collator. Comparing the whole "Family, Given" string put "Smith-Jones, Ava"
 * before "Smith, Zoe", and a device's own locale could move Østergaard to the end.
 */
let collator: Intl.Collator | undefined;

function compareText(a: string, b: string): number {
  collator ??= new Intl.Collator("en-AU", { sensitivity: "base" });
  return collator.compare(a, b);
}

/** Compares two "Family, Given" names: family first, then given. A name with no comma is all family. */
export function compareFormalNames(a: string, b: string): number {
  const [familyA = "", ...givenA] = a.split(",");
  const [familyB = "", ...givenB] = b.split(",");
  return compareText(familyA.trim(), familyB.trim()) || compareText(givenA.join(",").trim(), givenB.join(",").trim());
}
