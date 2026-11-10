import { receiveClientError } from "@/lib/client-error-receiver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * TE-04: name-free browser error counts (src/lib/browser-error-report.ts). Error type, route
 * template, release and desk role only; anything else is refused. Rate limited, and written to the
 * server log as `ward.client_error`. The proxy's CSRF guard refuses a cross-site POST, and the front
 * door, when on, refuses one without a pass.
 */
export function POST(request: Request) {
  return receiveClientError(request);
}
