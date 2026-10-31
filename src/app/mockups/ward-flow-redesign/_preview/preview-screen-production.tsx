import { notFound } from "next/navigation";

/**
 * Production builds use this in place of `preview-screen.tsx` (next.config.ts): the mock-ups are
 * not served there, and leaving their lazy screens out keeps the shared webpack runtime small.
 */
export function PreviewScreen(): never {
  notFound();
}
