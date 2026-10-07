/**
 * Safely decodes a URI component, catching any malformed percent-encoding
 * URIErrors (e.g. from truncated, malformed, or malicious URL parameters)
 * and returning the fallback string instead of throwing a synchronous URIError.
 */
export function safeDecodeURIComponent(uri: string | null | undefined, fallback = ""): string {
  if (uri === null || uri === undefined) return fallback;
  try {
    return decodeURIComponent(uri);
  } catch {
    return fallback;
  }
}
