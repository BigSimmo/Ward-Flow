/**
 * Client-side privacy guard to prevent real Australian healthcare identifiers
 * from being transmitted or saved to development/cloud storage.
 *
 * Scans payloads for:
 * 1. Australian Medicare numbers (10 digits starting with 2-6)
 * 2. Australian hospital identifiers (UMRN / UR / MRN with 6-8 digits)
 * 3. Australian mobile and landline telephone numbers
 */

export type SyntheticCheckResult = { safe: true } | { safe: false; reason: string; sample?: string };

// 10 digits, starts with 2, 3, 4, 5, or 6 (optionally formatted: 2xxx xxxxx x)
const MEDICARE_PATTERN = /\b([2-6]\d{3}[ -]?\d{5}[ -]?\d)\b/;

// Explicit hospital patient record markers followed by 6-9 digits
const HOSPITAL_RECORD_PATTERN = /\b(?:UMRN|MRN|UR[N#]?)\s*[:#]?\s*(\d{6,9})\b/i;

// Australian phone numbers: Mobile 04xx xxx xxx or +61 4xx, WA landline (08) xxxx xxxx
const PHONE_PATTERN =
  /\b(?:\+?61\s*4\d{2}[ -]?\d{3}[ -]?\d{3}|04\d{2}[ -]?\d{3}[ -]?\d{3}|\(?08\)?\s*\d{4}[ -]?\d{4})\b/;

function scanString(value: string): SyntheticCheckResult | null {
  const medicareMatch = MEDICARE_PATTERN.exec(value);
  if (medicareMatch) {
    // Redact digits for privacy in the error message
    const redacted = `${medicareMatch[1].slice(0, 3)}****${medicareMatch[1].slice(-2)}`;
    return {
      safe: false,
      reason: "Potential Australian Medicare number detected",
      sample: redacted,
    };
  }

  const recordMatch = HOSPITAL_RECORD_PATTERN.exec(value);
  if (recordMatch) {
    return {
      safe: false,
      reason: "Potential real hospital record number (UMRN/MRN/UR) detected",
      sample: recordMatch[0].slice(0, 4) + "****",
    };
  }

  const phoneMatch = PHONE_PATTERN.exec(value);
  if (phoneMatch) {
    return {
      safe: false,
      reason: "Potential real telephone number detected",
      sample: phoneMatch[0].slice(0, 4) + "****",
    };
  }

  return null;
}

export function checkSyntheticPayload(payload: unknown, maxDepth = 16): SyntheticCheckResult {
  if (payload === null || payload === undefined) {
    return { safe: true };
  }

  const seen = new WeakSet<object>();

  function walk(node: unknown, depth: number): SyntheticCheckResult {
    if (depth > maxDepth) {
      return {
        safe: false,
        reason: "Payload nesting too deep to scan for real identifiers",
      };
    }

    if (typeof node === "string") {
      const violation = scanString(node);
      if (violation) return violation;
      return { safe: true };
    }

    if (typeof node === "object" && node !== null) {
      if (seen.has(node)) {
        return { safe: true };
      }
      seen.add(node);

      if (Array.isArray(node)) {
        for (const item of node) {
          const result = walk(item, depth + 1);
          if (!result.safe) return result;
        }
      } else {
        for (const [key, value] of Object.entries(node)) {
          // Check key itself
          const keyViolation = scanString(key);
          if (keyViolation) return keyViolation;

          // Check value
          const valueViolation = walk(value, depth + 1);
          if (!valueViolation.safe) return valueViolation;
        }
      }
    }

    return { safe: true };
  }

  return walk(payload, 0);
}
