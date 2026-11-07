/** Raw request bounds for the public sign-in route, before JSON/schema or provider work. */
const BODY_BYTES = 16 * 1024;
const BODY_TIMEOUT_MS = 5_000;
const BODY_READS = 8;
let reading = 0;

type BodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 408 | 413 | 429 };
const refused = (status: 400 | 408 | 413 | 429): BodyResult => ({ ok: false, status });

function cancel(body: Pick<ReadableStream<Uint8Array>, "cancel"> | null) {
  try {
    // Cancellation can itself be noncooperative. It must not hold the caller's response open.
    void body?.cancel().catch(() => {});
  } catch {
    // A failed/locked stream is still refused; cancellation is best effort.
  }
}

/** Per-process bounds, with no queue. A timed-out read retains its permit until actual settlement. */
export async function readFrontDoorBody(request: Request): Promise<BodyResult> {
  const body = request.body;
  if (request.signal.aborted) {
    cancel(body);
    return refused(400);
  }
  const length = request.headers.get("content-length");
  if (length !== null && /^\d+$/.test(length.trim()) && Number(length) > BODY_BYTES) {
    cancel(body);
    return refused(413);
  }
  if (!body) return refused(400);
  if (reading >= BODY_READS) {
    cancel(body);
    return refused(429);
  }
  reading += 1;
  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = body.getReader();
  } catch {
    reading -= 1;
    return refused(400);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: () => void = () => {};
  let interruptedStatus: 400 | 408 | undefined;
  const interrupted = new Promise<BodyResult>((resolve) => {
    abort = () => {
      interruptedStatus ??= 400;
      cancel(reader);
      resolve(refused(interruptedStatus));
    };
    request.signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => {
      interruptedStatus ??= 408;
      cancel(reader);
      resolve(refused(interruptedStatus));
    }, BODY_TIMEOUT_MS);
  });
  const operation = (async (): Promise<BodyResult> => {
    try {
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        // A noncooperative pending read may settle with a chunk after the caller was refused.
        // Its actual settlement releases the permit; it must never start another read.
        if (interruptedStatus !== undefined) return refused(interruptedStatus);
        if (done) break;
        size += value.byteLength;
        if (size > BODY_BYTES) {
          cancel(reader);
          return refused(413);
        }
        if (value.byteLength) chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
    } catch {
      return refused(400);
    } finally {
      reading -= 1;
      reader.releaseLock();
    }
  })();
  if (request.signal.aborted) abort();
  try {
    return await Promise.race([operation, interrupted]);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
  }
}
