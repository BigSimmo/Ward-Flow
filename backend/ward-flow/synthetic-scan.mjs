/**
 * The one synthetic-data identifier scan, shared by the browser and the backend.
 *
 * Ward Flow runs on synthetic data only. This scan refuses payloads that carry something shaped
 * like a real Australian health or contact identifier, so a real record cannot be saved by
 * mistake. It is deliberately plain JavaScript with no imports: the Azure backend imports it
 * directly (and ships it in the deployment package), and `src/lib/synthetic-data-guard.ts`
 * re-exports this same function for the browser. Change the patterns here, once, and both sides
 * move together.
 *
 * Detects:
 * 1. Medicare numbers: 10 digits starting 2-6, optionally with the 11th (IRN) digit, written
 *    plain or grouped with spaces, dots, hyphens or non-breaking spaces (2123 45678 1).
 * 2. Healthcare identifiers: 16 digits starting 80036 then 0-2 (IHI 800360, HPI-I 800361,
 *    HPI-O 800362), in any grouping.
 * 3. Hospital record numbers after a marker: UMRN / MRN / URN / UR No. followed by 6-9 digits
 *    (UMRN-1234567, UR No. 1234567, MRN: 12345678).
 * 4. A bare all-digit value of 6 or more digits under a record-number field (umrn, mrn, ur,
 *    medicare, ihi).
 * 5. Australian mobile and landline telephone numbers, national or +61 form.
 *
 * Numbers are scanned too: an identifier stored as a JSON number is still an identifier.
 *
 * Never flagged: the app's own synthetic shapes. Synthetic UMRNs are two letters and six digits
 * (`UM100001`, `UM700000`), patient ids are `PT-...` / `SYN-...`, and none of them is a run of
 * digits after a record marker.
 */

/** @typedef {{ safe: true } | { safe: false; reason: string; sample?: string }} SyntheticCheckResult */

/** Unicode spaces people paste between digit groups; normalised to a plain space first. */
const UNICODE_SPACES = /[   -   　]/g;

// The same separator is required between both groups, so a decimal such as 3456.789012 is not
// read as a dotted Medicare number.
const MEDICARE_PATTERN = /(?<![\d.])([2-6]\d{3})([ .-]?)(\d{5})\2(\d)(?:[ ./-]?\d)?(?!\d|\.\d)/;

// 16 digits beginning 8, any grouping; the prefix is checked on the digits alone.
const SIXTEEN_DIGIT_PATTERN = /(?<![\d.])8(?:[ .-]?\d){15}(?!\d|\.\d)/g;
const HEALTHCARE_IDENTIFIER_PREFIX = /^80036[0-2]/;

const HOSPITAL_RECORD_PATTERN =
  /\b(?:UMRN|MRN|URN|UR)(?:\s*(?:No\.?|Number|#))?\s*[:#.-]?\s*(\d(?:[ -]?\d){5,8})(?!\d)/i;

// A bare record number stored under its own field name.
const RECORD_NUMBER_KEY = /^(?:umrn|mrn|urn?|ur[-_ ]?(?:no|number)|medicare(?:[-_ ]?(?:no|number))?|ihi)$/i;
const BARE_DIGITS = /^\d(?:[ .-]?\d){5,}$/;

const PHONE_PATTERN = new RegExp(
  [
    // Mobile: 04xx xxx xxx, +61 4xx xxx xxx, 61 4xx xxx xxx
    String.raw`(?<!\d)(?:\+?61[ .-]?|0)4\d{2}[ .-]?\d{3}[ .-]?\d{3}(?!\d)`,
    // Landline: (08) 9xxx xxxx, 08 9xxx xxxx, +61 8 9xxx xxxx (area codes 2, 3, 7, 8)
    String.raw`(?<!\d)(?:\+?61[ .-]?\(?|\(?0)[2378]\)?[ .-]?\d{4}[ .-]?\d{4}(?!\d)`,
  ].join("|"),
);

/** @param {string} value */
function redactDigits(value) {
  const digits = value.replace(/\D/g, "");
  return `${digits.slice(0, 3)}****${digits.slice(-2)}`;
}

/**
 * Medicare's check digit: the first eight digits weighted 1, 3, 7, 9, 1, 3, 7, 9, modulo 10.
 * @param {string} digits
 */
function medicareCheckDigitValid(digits) {
  const weights = [1, 3, 7, 9, 1, 3, 7, 9];
  const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
  return sum % 10 === Number(digits[8]);
}

/**
 * Scans one string. `numeric` marks text that came from a JSON number: there a 10-digit run must
 * also carry a valid Medicare check digit, because durations and counts are often 10 digits long,
 * while free text with a Medicare-shaped run is suspicious on its own.
 *
 * @param {string} raw
 * @param {{ numeric?: boolean }} [options]
 * @returns {SyntheticCheckResult | null}
 */
export function scanIdentifierText(raw, { numeric = false } = {}) {
  const value = raw.replace(UNICODE_SPACES, " ");

  SIXTEEN_DIGIT_PATTERN.lastIndex = 0;
  for (const match of value.matchAll(SIXTEEN_DIGIT_PATTERN)) {
    if (HEALTHCARE_IDENTIFIER_PREFIX.test(match[0].replace(/\D/g, ""))) {
      return {
        safe: false,
        reason: "Potential Australian healthcare identifier (IHI) detected",
        sample: redactDigits(match[0]),
      };
    }
  }

  const medicareMatch = MEDICARE_PATTERN.exec(value);
  if (medicareMatch && (!numeric || medicareCheckDigitValid(medicareMatch[0].replace(/\D/g, "")))) {
    return {
      safe: false,
      reason: "Potential Australian Medicare number detected",
      sample: redactDigits(medicareMatch[0]),
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

/**
 * @param {string} key
 * @param {unknown} value
 * @returns {SyntheticCheckResult | null}
 */
function scanRecordField(key, value) {
  if (!RECORD_NUMBER_KEY.test(key)) return null;
  const text = typeof value === "number" || typeof value === "bigint" ? String(value) : value;
  if (typeof text !== "string" || !BARE_DIGITS.test(text.replace(UNICODE_SPACES, " ").trim())) return null;
  return {
    safe: false,
    reason: "Potential real hospital record number (UMRN/MRN/UR) detected",
    sample: redactDigits(text),
  };
}

/**
 * Walks a JSON-like payload and returns the first real-looking identifier it finds. Fails closed
 * when the payload nests deeper than `maxDepth`.
 *
 * @param {unknown} payload
 * @param {number} [maxDepth]
 * @returns {SyntheticCheckResult}
 */
export function checkSyntheticPayload(payload, maxDepth = 16) {
  if (payload === null || payload === undefined) return { safe: true };

  const seen = new WeakSet();

  /**
   * @param {unknown} node
   * @param {number} depth
   * @returns {SyntheticCheckResult}
   */
  function walk(node, depth) {
    if (depth > maxDepth) {
      return { safe: false, reason: "Payload nesting too deep to scan for real identifiers" };
    }
    if (typeof node === "string") return scanIdentifierText(node) ?? { safe: true };
    // Identifiers are whole numbers; a fractional value is a measurement, not an identifier.
    if ((typeof node === "number" && Number.isInteger(node)) || typeof node === "bigint") {
      return scanIdentifierText(BigInt(node).toString(), { numeric: true }) ?? { safe: true };
    }
    if (typeof node === "object" && node !== null) {
      if (seen.has(node)) return { safe: true };
      seen.add(node);
      if (Array.isArray(node)) {
        for (const item of node) {
          const result = walk(item, depth + 1);
          if (!result.safe) return result;
        }
      } else {
        for (const [key, value] of Object.entries(node)) {
          const keyViolation = scanIdentifierText(key) ?? scanRecordField(key, value);
          if (keyViolation) return keyViolation;
          const valueViolation = walk(value, depth + 1);
          if (!valueViolation.safe) return valueViolation;
        }
      }
    }
    return { safe: true };
  }

  return walk(payload, 0);
}
