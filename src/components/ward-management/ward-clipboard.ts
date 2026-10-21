/**
 * Clipboard copy for Ward Flow screens. Every Ward Flow copy goes through here, so every copy gets
 * the same two safeguards whatever the screen built (D-71 item 7, Josh 21 Oct 2026):
 * - the first line is the synthetic line, so a pasted copy always says it came from the prototype;
 * - no UMRN or date of birth leaves the app on the clipboard. Screens should not put one in, and
 *   this strips any UMRN and any UMRN or date of birth line that does, so a new copy button cannot
 *   reopen the gap.
 * Whether names may appear in copied text is still to be decided before any real data (D-71).
 */

/** The first line of every text Ward Flow puts on the clipboard (Audit 1, CS-12, Josh 20 Oct). */
export const SYNTHETIC_COPY_LINE = "Synthetic prototype.";

/** A synthetic record number, `UMnnnnnn` (hand-authored, generated and demo network bands alike). */
const UMRN_TOKEN = String.raw`\bUM\d{6}\b`;
/** A line whose whole job is an identifier, such as the letter's "UMRN: UM100001" or "DOB: …". */
const IDENTIFIER_LINE = /^\s*(?:UMRN|DOB|Date of birth)\b.*$/i;

function stripUmrnFromLine(line: string): string {
  return (
    line
      // "(UM100001)" or "(UMRN UM100001)" beside a name.
      .replace(new RegExp(String.raw`\s*\(\s*(?:UMRN\s*:?\s*)?${UMRN_TOKEN}\s*\)`, "g"), "")
      // "UMRN UM100001" or "UMRN not recorded" inside a sentence, with the separator before it.
      .replace(new RegExp(String.raw`\s*[,;·]?\s*UMRN\s*:?\s*(?:${UMRN_TOKEN}|not recorded)`, "gi"), "")
      // A bare "UM100001", with the separator before it.
      .replace(new RegExp(String.raw`\s*[,;·]?\s*${UMRN_TOKEN}`, "g"), "")
      // Tidy what the removal leaves: "act now ()", "Identify:, legal", "- , name", "Name ." and
      // doubled spaces.
      .replace(/\s*\(\s*\)/g, "")
      .replace(/:\s*[,;·]\s*/g, ": ")
      .replace(/^(\s*(?:[-•]\s*)?)[,;·]\s*/, "$1")
      .replace(/\s+([.,;])/g, "$1")
      .replace(/ {2,}/g, " ")
  );
}

/** Strips record numbers from text bound for the clipboard. Lines that held only a UMRN or date of birth go. */
export function withoutCopiedIdentifiers(text: string): string {
  return text
    .split("\n")
    .filter((line) => !IDENTIFIER_LINE.test(line))
    .map((line) => (/UM\d{6}|UMRN/i.test(line) ? stripUmrnFromLine(line) : line))
    .join("\n");
}

/**
 * The exact text Ward Flow puts on the clipboard: no UMRN, and the synthetic line first. Text that
 * already opens with "Synthetic prototype" (the referral letter's "Synthetic prototype. Draft …")
 * keeps its own first line rather than gaining a second.
 */
export function copiedText(value: string): string {
  const body = withoutCopiedIdentifiers(value);
  return body.trimStart().startsWith("Synthetic prototype") ? body.trimStart() : `${SYNTHETIC_COPY_LINE}\n${body}`;
}

/**
 * Copies `copiedText(value)`. Tries the async Clipboard API, then the legacy hidden textarea
 * selection for restricted browser contexts and older engines. Throws when both fail, so the caller
 * can say the copy did not happen. Ward-local, so Ward Flow keeps its repository seam.
 */
export async function copyTextToClipboard(value: string): Promise<void> {
  const text = copiedText(value);
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy selection path.
    }
  }
  if (typeof document === "undefined") throw new Error("copy unavailable");
  // Selecting the textarea moves focus; put it back so keyboard and screen reader users stay put.
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  try {
    // Only an explicit true means the fallback copied; a missing execCommand is a failure.
    const copied = typeof document.execCommand === "function" && document.execCommand("copy");
    if (!copied) throw new Error("copy command rejected");
  } finally {
    document.body.removeChild(textArea);
    returnFocus?.focus({ preventScroll: true });
  }
}
