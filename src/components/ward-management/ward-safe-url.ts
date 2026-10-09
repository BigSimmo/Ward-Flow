/**
 * Decodes one route segment without throwing. A stray `%` in an address (for example
 * `/mockups/ward-flow/ward/100%`) makes `decodeURIComponent` throw a `URIError`, which crashed the
 * page instead of showing its own not-found state. A malformed segment is returned as typed, so
 * the page looks it up, finds nothing and says so.
 */
export function safeDecodeURIComponent(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
