import { gateMark, type EligibilityGate, type GateResult } from "@/components/ward-management/ward-eligibility";

/**
 * SMART BED MATCH, AS A FIT LINE (Josh, 9 Nov 2026: "Show fit, keep neutral order"). Each ward card
 * says in plain words which of the patient's needs the ward meets, using the verdict the eligibility
 * gates already give. It changes no order, gives no score and picks no ward: the never-build rule
 * against "best match" suggestions (19 Oct 2026) still holds. Distance stays on the card's road time.
 */
const FIT_GROUPS: readonly { label: string; gates: readonly EligibilityGate[] }[] = [
  { label: "Sex", gates: ["gender_designation", "sex_mix"] },
  { label: "Security", gates: ["security", "legal_status", "authorisation", "forensic"] },
  { label: "Age", gates: ["age", "cohort"] },
  { label: "Special care", gates: ["specialling", "acuity"] },
];

export type FitLine = { met: string[]; notMet: string[]; toConfirm: string[] };

export function fitLine(gates: readonly GateResult[]): FitLine {
  const line: FitLine = { met: [], notMet: [], toConfirm: [] };
  for (const group of FIT_GROUPS) {
    const marks = gates.filter((gate) => group.gates.includes(gate.gate)).map(gateMark);
    if (marks.length === 0) continue;
    if (marks.includes("not_met")) line.notMet.push(group.label);
    else if (marks.includes("met")) line.met.push(group.label);
    // Information-only groups (special care) ask for a check only when the patient has that need.
    else if (gates.some((gate) => group.gates.includes(gate.gate) && gate.need)) line.toConfirm.push(group.label);
  }
  return line;
}

/** "Fits sex, security and age · Check special care", or undefined when no group was checked. */
export function fitLineText(line: FitLine): string | undefined {
  const parts: string[] = [];
  if (line.met.length > 0) parts.push(`Fits ${listWords(line.met)}`);
  if (line.notMet.length > 0) parts.push(`Not met: ${listWords(line.notMet)}`);
  if (line.toConfirm.length > 0) parts.push(`Check ${listWords(line.toConfirm)}`);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function listWords(words: readonly string[]): string {
  const lower = words.map((word) => word.toLowerCase());
  if (lower.length === 1) return lower[0]!;
  return `${lower.slice(0, -1).join(", ")} and ${lower.at(-1)}`;
}
