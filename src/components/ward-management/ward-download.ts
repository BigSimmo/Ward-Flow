/**
 * Start an explicit file download. Keep its URL alive for the browser's asynchronous handoff
 * after click returns (the existing F-17 workaround), then release it without retaining the file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement("a");
  let url: string;
  try {
    url = URL.createObjectURL(blob);
  } catch (cause) {
    throw new DownloadRefusedError(cause);
  }
  const revokeObjectURL = URL.revokeObjectURL.bind(URL);
  link.href = url;
  link.download = filename;
  try {
    document.body.appendChild(link);
    link.click();
  } catch (cause) {
    throw new DownloadRefusedError(cause);
  } finally {
    link.remove();
    window.setTimeout(() => revokeObjectURL(url), 1_000);
  }
}

/** The browser would not hand over the file (no file links, or a locked-down frame). */
export class DownloadRefusedError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : "The browser refused the download", { cause });
    this.name = "DownloadRefusedError";
  }
}
