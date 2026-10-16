/*
 * Server-safe (no "use client"): the ward layout, a Server Component, calls this on each request.
 */

/**
 * Whether a user-agent string names a phone. Tablets (iPad, Android without "Mobile") are not phones.
 */
export function guessPhoneFromUserAgent(userAgent: string | null): boolean {
  return /iPhone|iPod|Android.+Mobile|Windows Phone/u.test(userAgent ?? "");
}

/**
 * Whether request headers name a phone: the `Sec-CH-UA-Mobile` client hint where the browser sends
 * it, else the user agent. Tablets (iPad, Android without "Mobile") are not phones.
 */
export function guessPhoneFromRequest(userAgent: string | null, clientHintMobile: string | null): boolean {
  if (clientHintMobile === "?1") return true;
  if (clientHintMobile === "?0") return false;
  return guessPhoneFromUserAgent(userAgent);
}

/**
 * Whether a user-agent string names a tablet (iPad, Android tablet without "Mobile", Kindle/Silk/Tablet).
 */
export function guessTabletFromUserAgent(userAgent: string | null): boolean {
  const ua = userAgent ?? "";
  if (!ua || guessPhoneFromUserAgent(ua)) return false;
  return /iPad|Tablet|PlayBook|Silk|(?:Android(?!.*Mobile))/iu.test(ua);
}

/**
 * Whether request headers name a tablet: `Sec-CH-UA-Mobile: ?1` rules out a tablet; otherwise
 * inspects the user agent for iPad / Android tablet tokens.
 */
export function guessTabletFromRequest(userAgent: string | null, clientHintMobile?: string | null): boolean {
  if (clientHintMobile === "?1") return false;
  return guessTabletFromUserAgent(userAgent);
}
