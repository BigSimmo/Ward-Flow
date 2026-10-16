/**
 * Start an explicit file download. Keep its URL alive for the browser's asynchronous handoff
 * after click returns (the existing F-17 workaround), then release it without retaining the file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement("a");
  const revokeObjectURL = URL.revokeObjectURL.bind(URL);
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => revokeObjectURL(url), 1_000);
  }
}
