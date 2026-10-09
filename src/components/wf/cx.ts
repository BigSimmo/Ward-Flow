/**
 * True when a slot has something to render. 0 is a value and renders as 0 (design system v8,
 * contract I6); only null, undefined, false and the empty string mean "nothing here".
 */
export function present(node: unknown): boolean {
  return node !== null && node !== undefined && node !== false && node !== "";
}

/** Joins class names, skipping falsy parts. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
