import { authorisationShort } from "@/components/ward-management/ward-authorisation";
import { gateMark, type EligibilityGate, type GateResult } from "@/components/ward-management/ward-eligibility";

/**
 * SMART BED MATCH, AS A FIT LINE (Josh, 9 Nov 2026: "Show fit, keep neutral order"). Each ward card
 * says in plain words which of the patient's needs the ward meets, using the verdict the eligibility
 * gates already give. It changes no order, gives no score and picks no ward: the never-build rule
 * against "best match" suggestions (19 Oct 2026) still holds. Distance stays on the card's road time.
 */
const FIT_GROUPS: readonly { label: string; gates: readonly EligibilityGate[] }[] = [
  { label: "Sex", gates: ["gender_designation", "sex_mix"] },
  { label: "Security", gates: ["security", "forensic"] },
  // Review R7 (D-189 items 8(a), 9(a)): authorisation is its own group, never folded into a met
  // security gate. The gate is information only (D-209 item 9: no steering), so a person whose
  // recorded status needs an involuntary-capable bed reads "Check authorisation" with the register's
  // answer for the ward, the same answer the ward page gives (R-LEGAL-8). On the referral path the
  // same gate is named `legal_status`.
  { label: "Authorisation", gates: ["legal_status", "authorisation"] },
  { label: "Age", gates: ["age", "cohort"] },
  { label: "Special care", gates: ["specialling", "acuity"] },
];

export type FitLine = {
  met: string[];
  notMet: string[];
  toConfirm: string[];
  /** The register's short answer when Authorisation is to check ("hospital on register"). */
  authorisation?: string;
};

export function fitLine(gates: readonly GateResult[]): FitLine {
  const line: FitLine = { met: [], notMet: [], toConfirm: [] };
  for (const group of FIT_GROUPS) {
    const marks = gates.filter((gate) => group.gates.includes(gate.gate)).map(gateMark);
    if (marks.length === 0) continue;
    if (marks.includes("not_met")) line.notMet.push(group.label);
    else if (marks.includes("met")) line.met.push(group.label);
    // Information-only groups (special care, authorisation) ask for a check only when the patient has that need.
    else {
      const needed = gates.find((gate) => group.gates.includes(gate.gate) && gate.need);
      if (!needed) continue;
      line.toConfirm.push(group.label);
      if (needed.authorisation) line.authorisation = authorisationShort(needed.authorisation);
    }
  }
  return line;
}

/** "Fits sex, security and age · Check special care", or undefined when no group was checked. */
export function fitLineText(line: FitLine): string | undefined {
  const parts: string[] = [];
  if (line.met.length > 0) parts.push(`Fits ${listWords(line.met)}`);
  if (line.notMet.length > 0) parts.push(`Not met: ${listWords(line.notMet)}`);
  if (line.toConfirm.length > 0) {
    const words = line.toConfirm.map((label) =>
      label === "Authorisation" && line.authorisation ? `${label} (${line.authorisation})` : label,
    );
    parts.push(`Check ${listWords(words)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function listWords(words: readonly string[]): string {
  const lower = words.map((word) => word.toLowerCase());
  if (lower.length === 1) return lower[0]!;
  return `${lower.slice(0, -1).join(", ")} and ${lower.at(-1)}`;
}

/**
 * MORE FIT DETAILS (item 26). The "More" list under the fit line names the other gates the ward
 * card already computed, one plain status each, in this fixed order. Explain only (D-71): it never
 * sorts, tints, scores or suggests a ward, and it reads the same verdict the fit line reads.
 */
const MORE_GATES: readonly { gate: EligibilityGate; label: string }[] = [
  { gate: "prior_decline", label: "Not declined by this ward before" },
  { gate: "allocatable_bed", label: "Allocatable bed" },
  { gate: "capacity_freshness", label: "Beds confirmed recently" },
  { gate: "acuity", label: "High-acuity places" },
  { gate: "specialling", label: "Observation staffing" },
];

type FitDetailStatus = "Met" | "Not met" | "To check";
export type FitDetail = { gate: EligibilityGate; label: string; status: FitDetailStatus };

/** Information-only gates appear only as "To check", and only when the patient has that need. */
export function fitDetails(gates: readonly GateResult[]): FitDetail[] {
  const details: FitDetail[] = [];
  for (const { gate: name, label } of MORE_GATES) {
    const gate = gates.find((candidate) => candidate.gate === name);
    if (!gate) continue;
    const mark = gateMark(gate);
    if (mark === "info") {
      if (gate.need) details.push({ gate: name, label, status: "To check" });
      continue;
    }
    details.push({ gate: name, label, status: mark === "met" ? "Met" : "Not met" });
  }
  return details;
}
