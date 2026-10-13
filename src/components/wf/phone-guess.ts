/*
 * Server-safe (no "use client"): the ward layout, a Server Component, calls this on each request.
 */

/**
 * Whether request headers name a phone: the `Sec-CH-UA-Mobile` client hint where the browser sends
 * it, else the user agent. Tablets (iPad, Android without "Mobile") are not phones.
 */
export function guessPhoneFromRequest(userAgent: string | null, clientHintMobile: string | null): boolean {
  if (clientHintMobile === "?1") return true;
  if (clientHintMobile === "?0") return false;
  return /iPhone|iPod|Android.+Mobile|Windows Phone/u.test(userAgent ?? "");
}
