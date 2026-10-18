/**
 * Clipboard copy for Ward Flow screens. Tries the async Clipboard API, then the legacy hidden
 * textarea selection for restricted browser contexts and older engines. Throws when both fail, so
 * the caller can say the copy did not happen. Ward-local, so Ward Flow keeps its repository seam.
 */
export async function copyTextToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the legacy selection path.
    }
  }
  const textArea = document.createElement("textarea");
  textArea.value = value;
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
  }
}
