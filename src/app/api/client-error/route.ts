import { z } from "zod";
import { withRequestLog } from "@/lib/api-request-log";
import { captureBrowserFailure, startServerSentry } from "@/lib/sentry-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const schema = z
  .object({
    type: z.enum([
      "Error",
      "TypeError",
      "RangeError",
      "ReferenceError",
      "SyntaxError",
      "URIError",
      "EvalError",
      "AggregateError",
      "ChunkLoadError",
      "DOMException",
    ]),
    frames: z
      .array(
        z
          .object({
            filename: z
              .string()
              .max(256)
              .regex(/^\/_next\/static\/chunks\/(?:\d{1,10}-)?[a-f0-9]{8,64}\.js$/i),
            lineno: z.number().int().positive().max(10_000_000),
            colno: z.number().int().nonnegative().max(10_000_000),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export const POST = withRequestLog(async (request: Request) => {
  const headers = { "Cache-Control": "no-store" };
  if (process.env.WARD_CLIENT_ERROR_REPORTING !== "true" || !process.env.SENTRY_DSN)
    return new Response(null, { status: 404, headers });
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return new Response(null, { status: 403, headers });
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? ""))
    return new Response(null, { status: 415, headers });
  // Read a bounded stream: Content-Length is untrusted and may be absent.
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400, headers });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        return new Response(null, { status: 413, headers });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const parsed = schema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    if (!parsed.success) return new Response(null, { status: 400, headers });
    startServerSentry();
    captureBrowserFailure(parsed.data);
    return new Response(null, { status: 202, headers });
  } catch {
    return new Response(null, { status: 400, headers });
  }
});
