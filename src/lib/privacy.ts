export function safeIngestionJobLog(jobId: string) {
  return `Processing ingestion job ${jobId}`;
}

/**
 * Redact paths, URLs, secrets, emails, and Ward Flow patient identity (record numbers and
 * capitalised names) from support/diagnostic strings.
 */
export function redactLogValue(value: unknown): unknown {
  if (typeof value !== "string") {
    // Audit L12: non-string code/details/hint fields (objects/arrays from
    // non-standard error shapes) used to pass through verbatim, skipping the
    // path/url/secret/email redaction below. Serialize them (guarded) and
    // redact the serialized form; primitives stay as-is.
    if (value === null || value === undefined) return value;
    if (typeof value === "number" || typeof value === "boolean") return value;
    try {
      return redactLogValue(JSON.stringify(value) ?? "[unserializable]");
    } catch {
      return "[unserializable]";
    }
  }
  const htmlTitle = value.match(/<title>\s*([^<]+?)\s*<\/title>/i)?.[1]?.trim();
  const normalizedValue = htmlTitle ? `HTML response: ${htmlTitle}` : value;
  return redactWardFlowIdentifiers(
    normalizedValue
      // URLs before path shapes so https://host/path?q=… becomes [url], not https:[path]
      // with a residual query string. The class excludes whitespace and the DOUBLE
      // quote only. Two things depend on that exact set:
      //   - parentheses and apostrophes stay consumed. encodeURIComponent escapes
      //     neither, so `?q=patient's suicidal thoughts` is a realistic clinical
      //     query; excluding `'` left `[url]'s%20suicidal%20thoughts` in the
      //     clipboard, which is the leak this redaction exists to prevent.
      //   - stopping at `"` keeps a serialized object readable. Non-string fields
      //     are JSON-stringified above and compact JSON has no spaces, so a
      //     `\S+` class would swallow every field after the first URL.
      // Over-consuming a trailing `'` in JS-style single-quoted log output is the
      // safe direction: it redacts slightly more, never less.
      .replace(/https?:\/\/[^\s"]+/g, "[url]")
      .replace(/\b[A-Za-z]:\\[^\s'\")]+/g, "[path]")
      .replace(/\/(?:[^\s'\")]+\/)+[^\s'\")]+/g, "[path]")
      // Redact common secret/token formats, including modern Supabase keys like sb_secret_ and sb_publishable_
      .replace(/\b(?:sk|pk|sbp|sb_secret_|sb_publishable_|eyJ)[A-Za-z0-9._-]{8,}\b/g, "[secret]")
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email]"),
  ).slice(0, 500);
}

// Record markers followed by an id, real or synthetic: `UMRN UM100001`, `UR No. 1234567`,
// `Medicare 2123 45678 1`, `IHI 8003 6012 3456 7890`.
const RECORD_MARKER_ID =
  /\b(?:UMRN|MRN|URN|UR(?:\s*(?:No\.?|Number))?|Medicare(?:\s*(?:No\.?|Number))?|IHI)\s*[:#.-]?\s*[A-Za-z]{0,2}\d(?:[ . -]?\d)*/gi;
// Ward Flow's synthetic UMRN shape (two letters, six digits) on its own.
const SYNTHETIC_UMRN = /\bUM\d{6}\b/g;
// Medicare (10-11 digits starting 2-6) and IHI (16 digits starting 800360), any grouping.
const LONG_HEALTH_NUMBER =
  /(?<![\d.])(?:[2-6]\d{3}[ . -]?\d{5}[ . -]?\d(?:[ ./-]?\d)?|8003[ . -]?6\d{2}(?:[ . -]?\d{4}){2,3})(?![\d])/g;
// Two or more capitalised words in a row: a person's name ("Jane Citizen"). Over-redacts ward and
// site names in a diagnostic, which is the safe direction.
const CAPITALISED_NAME = /\b[A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+)+\b/g;

/**
 * Redacts Ward Flow patient identity from diagnostic text: record numbers (real and synthetic
 * UMRNs, Medicare, IHI) and capitalised names. Used by `redactLogValue`, which is what the error
 * boundaries' "Copy diagnostics" button runs (12 October 2026 review, A4-10).
 */
export function redactWardFlowIdentifiers(value: string): string {
  return value
    .replace(RECORD_MARKER_ID, "[id]")
    .replace(SYNTHETIC_UMRN, "[id]")
    .replace(LONG_HEALTH_NUMBER, "[id]")
    .replace(CAPITALISED_NAME, "[name]");
}

export function safeErrorLogDetails(error: unknown) {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : record.message;
  const stack = error instanceof Error ? error.stack : typeof record.stack === "string" ? record.stack : null;
  const errorName = error instanceof Error ? error.name : typeof error;
  const firstStackLine = stack
    ?.split("\n")
    .map((line) => line.trim())
    .find(
      (line) =>
        line &&
        !line.startsWith("Error:") &&
        !line.startsWith(`${errorName}:`) &&
        !/^<(!doctype|html|head|body|!--)/i.test(line),
    );

  return {
    name: errorName,
    ...(message ? { message: redactLogValue(message) } : {}),
    ...(record.code ? { code: redactLogValue(record.code) } : {}),
    ...(record.details ? { details: redactLogValue(record.details) } : {}),
    ...(record.hint ? { hint: redactLogValue(record.hint) } : {}),
    ...(firstStackLine ? { stack: redactLogValue(firstStackLine) } : {}),
  };
}

export function redactCaptionIdentifiers(value: string): string {
  const clinicalRangePattern = /^\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?(?:\s*[A-Za-zµ/%][\w/%.-]*)?$/i;
  return (
    value
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email]")
      // Ward Flow / Australian record markers (the former UK NHS pattern did not apply here).
      .replace(SYNTHETIC_UMRN, "[id]")
      .replace(LONG_HEALTH_NUMBER, "[id]")
      .replace(
        /\b(?:umrn|mrn|urn|ur(?:\s*(?:no\.?|number))?|medicare(?:\s*(?:no\.?|number))?|ihi)\s*[:#.-]?\s*([0-9]+(?:[ \-][0-9]+)+|[A-Za-z0-9-]{4,})\b/gi,
        (match, idPart: string) => {
          const trimmed = idPart.replace(/\s+/g, " ").trim();
          // Count digits only; require at least 4 digits to consider it an identifier (avoids short numeric ranges).
          const digitCount = trimmed.replace(/\D/g, "").length;
          if (digitCount > 0 && digitCount < 4) return match;
          return "[id]";
        },
      )
      .replace(/\b(?:\+?\d[\d\s().-]{6,}\d)\b/g, (match) => {
        const digits = match.replace(/\D/g, "");
        return digits.length >= 8 && !clinicalRangePattern.test(match.trim()) ? "[phone]" : match;
      })
  );
}
