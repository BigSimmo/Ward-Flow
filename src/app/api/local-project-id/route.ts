import { localProjectRequestIdentityPayload } from "@/lib/local-project-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Local tooling asks this route which project a dev server belongs to. Anywhere else (the hosted
 * site, or a local server reached through a non-loopback Host) it answers 404, so the project hash
 * and port range are never published.
 */
export async function GET(request: Request) {
  const payload = localProjectRequestIdentityPayload(request);
  if (payload.localServer.currentUrl === null || payload.reason === "non-local-host")
    return Response.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return Response.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
