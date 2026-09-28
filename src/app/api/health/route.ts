export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Liveness probe for the Railway healthcheck (service setting `healthcheckPath: /api/health`).
 *
 * Railway only switches traffic to a new deployment once this path answers 200. The route did not
 * exist, so every deploy after the healthcheck was turned on built cleanly, started, answered 404
 * and was marked failed (28 September 2026). It reads nothing and calls nothing: Ward Flow runs on
 * synthetic data, so "the server is up and routing" is the whole of its health.
 */
export function GET() {
  return Response.json(
    { status: "ok" },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
