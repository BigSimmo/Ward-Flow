import { logger } from "./logger";
import { captureServerFailure } from "./sentry-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Log fixed operational fields only. URLs, headers, bodies and error messages stay out. */
export function withRequestLog<T extends Request = Request>(
  handler: (request: T) => Response,
): (request?: T) => Response;
export function withRequestLog<T extends Request = Request>(
  handler: (request: T) => Promise<Response>,
): (request?: T) => Promise<Response>;
export function withRequestLog<T extends Request = Request>(handler: (request: T) => Response | Promise<Response>) {
  return (request?: T): Response | Promise<Response> => {
    const supplied = request?.headers.get("x-request-id");
    const incidentId = supplied && UUID.test(supplied) ? supplied : crypto.randomUUID();
    const method =
      request?.method && /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/.test(request.method) ? request.method : "GET";
    const started = Date.now();
    const finish = (response: Response): Response => {
      logger.info("ward.api_response", {
        incidentId,
        method,
        status: response.status,
        durationMs: Math.max(0, Date.now() - started),
      });
      response.headers.set("X-Request-ID", incidentId);
      return response;
    };
    const fail = (error: unknown): Response => {
      logger.error("ward.api_failure", { incidentId, method });
      captureServerFailure(error, { incidentId, method, routeType: "route" });
      const response = Response.json(
        { error: "The request could not be completed." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
      response.headers.set("X-Request-ID", incidentId);
      return response;
    };
    try {
      const response = handler(request ?? (new Request("http://localhost/") as T));
      return response instanceof Promise ? response.then(finish, fail) : finish(response);
    } catch (error) {
      return fail(error);
    }
  };
}
