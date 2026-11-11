// Audit M45 (GNG row C7): a synthetic name and note marker sent through every Next.js server
// error and log path never leaves the server. One marker test per path: the server logger, the
// server Sentry error envelope, the server Sentry Logs bridge and the request-error hook.
// The backend paths are in backend/ward-flow/ward-audit-m45-log-markers.test.mjs.
// Browser error reporting (TE-04) is owned by another thread and is not covered here.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const NAME = "Zephyrine Quandtwhistle";
const NOTE = "M45-NOTE-MARKER said she feels unsafe at home";
const UMRN = "UMRN 9900123";
const MARKERS = ["Quandtwhistle", "M45-NOTE-MARKER", "9900123"];
const DSN = "https://publickey@o0.ingest.invalid/1";

function expectNoMarker(text: string) {
  for (const marker of MARKERS) expect(text, `leaked "${marker}"`).not.toContain(marker);
}

function bodyText(body: unknown): string {
  if (typeof body === "string") return body;
  return new TextDecoder().decode(body as Uint8Array);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("M45 server logger", () => {
  it("drops a name, note and record number sent under patient-shaped keys", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const lines: string[] = [];
    vi.spyOn(console, "error").mockImplementation((line: string) => void lines.push(line));
    const { logger } = await import("@/lib/logger");
    logger.error("ward.save_failed", {
      patientName: NAME,
      patient: { name: NAME },
      query: NOTE,
      content: NOTE,
      reference: UMRN,
      error: new Error(`failed for ${UMRN}`),
    });
    expect(lines).toHaveLength(1);
    expectNoMarker(lines.join("\n"));
  });

  it("is called only from reviewed call sites that pass closed fields", () => {
    // The logger redacts by key and by record-number shape, so a name under a neutral key such as
    // `label` would pass. Every call site is therefore reviewed: adding one fails this test until
    // it is checked to pass closed fields only and added here.
    // client-error-receiver.ts (TE-04) logs only the error type, route template, release and role.
    const reviewed = new Set(["src/instrumentation.ts", "src/lib/client-error-receiver.ts"]);
    const root = path.resolve(__dirname, "..");
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry) && /\blogger\.(debug|info|warn|error)\(/.test(readFileSync(full, "utf8")))
          found.push(path.relative(root, full).split(path.sep).join("/"));
      }
    };
    walk(path.join(root, "src"));
    expect(found.filter((file) => file !== "src/lib/logger.ts").sort()).toEqual([...reviewed].sort());
  });
});

describe("M45 server Sentry", () => {
  it("sends neither name nor note in an error envelope or a Sentry Logs line", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const sentry = await import("@/lib/sentry-server");
    const { logger } = await import("@/lib/logger");
    sentry.resetServerReportThrottle();
    expect(sentry.startServerSentry({ NODE_ENV: "production", SENTRY_DSN: DSN })).toBe(true);
    sentry.captureServerFailure(new TypeError(`could not save ${NAME} (${UMRN}): ${NOTE}`), {
      routeType: "action",
      path: `/ward-flow/patients/${NAME}`,
    });
    logger.error("ward.save_failed", { patientName: NAME, content: NOTE, reference: UMRN });
    const { getClient } = await import("@sentry/core");
    await getClient()?.flush(2000);
    expect(fetchMock).toHaveBeenCalled();
    const bodies = fetchMock.mock.calls.map(([, init]) => bodyText(init?.body)).join("\n");
    expect(bodies).toContain("TypeError");
    expect(bodies).toContain("ward.save_failed");
    expectNoMarker(bodies);
    await getClient()?.close(0);
  });
});

describe("M45 request-error hook", () => {
  it("logs and reports neither a name in the address nor a note in the error", async () => {
    const { logger } = await import("@/lib/logger");
    const emit = vi.spyOn(logger, "error").mockImplementation(() => {});
    const outbound = vi.spyOn(globalThis, "fetch");
    const { onRequestError } = await import("../src/instrumentation");
    await onRequestError(
      new Error(`${NAME} ${NOTE} ${UMRN}`),
      {
        method: "POST",
        path: `/ward-flow/patients/${encodeURIComponent(NAME)}?note=${encodeURIComponent(NOTE)}`,
        headers: { cookie: NOTE },
      },
      {
        routerKind: "App Router",
        routePath: "/ward-flow/patients/[id]",
        routeType: "action",
        renderSource: "react-server-components",
        revalidateReason: undefined,
      },
    );
    expect(emit).toHaveBeenCalledOnce();
    expectNoMarker(JSON.stringify(emit.mock.calls));
    expect(outbound).not.toHaveBeenCalled();
  });
});
