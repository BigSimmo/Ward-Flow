// TE-04: a thrown error's message never leaves the browser. Only its type, the route template, the
// release and the desk role are sent.
import { afterEach, expect, it, vi } from "vitest";

import {
  CLIENT_REPORTS_PER_MINUTE,
  errorType,
  installBrowserErrorReport,
  routeTemplate,
} from "@/lib/browser-error-report";

const SYNTHETIC_NAME = "Test Patient Alpha";
let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

function throwUncaught(error: unknown) {
  window.dispatchEvent(new ErrorEvent("error", { error, message: String((error as Error)?.message ?? error) }));
}

function rejectUnhandled(reason: unknown) {
  const event = new Event("unhandledrejection") as PromiseRejectionEvent;
  Object.defineProperty(event, "reason", { value: reason });
  window.dispatchEvent(event);
}

it("sends none of a thrown error's text, the real address or the query", () => {
  window.history.replaceState(null, "", "/ward-flow/people/SYN-0042/triage?q=Test+Patient+Alpha#Alpha");
  window.sessionStorage.setItem(
    "wardflow:access-desk-v1",
    JSON.stringify({ role: "ward", scope: { kind: "ward", id: "SYN-W1" } }),
  );
  const send = vi.fn();
  stop = installBrowserErrorReport(window, "abc123", send);

  throwUncaught(new TypeError(`Cannot read notes for ${SYNTHETIC_NAME}`));

  expect(send).toHaveBeenCalledTimes(1);
  const body = send.mock.calls[0][0] as string;
  expect(JSON.parse(body)).toEqual({
    type: "TypeError",
    route: "/ward-flow/people/[id]/triage",
    release: "abc123",
    role: "ward",
  });
  for (const leaked of ["Patient", "Alpha", "SYN-0042", "SYN-W1", "notes", "q=", "#"])
    expect(body).not.toContain(leaked);
});

it("reports an unhandled rejection by type only, and a thrown string as its primitive type", () => {
  const send = vi.fn();
  stop = installBrowserErrorReport(window, "dev", send);
  class SyncFailure extends Error {}
  rejectUnhandled(new SyncFailure(SYNTHETIC_NAME));
  rejectUnhandled(SYNTHETIC_NAME);
  const bodies = send.mock.calls.map(([body]) => JSON.parse(body as string));
  expect(bodies.map((body) => body.type)).toEqual(["SyncFailure", "string"]);
  expect(bodies.map((body) => body.role)).toEqual(["none", "none"]);
  expect(JSON.stringify(bodies)).not.toContain("Alpha");
});

it("never uses an error's name property, which code can set to any text", () => {
  const error = new Error("x");
  error.name = SYNTHETIC_NAME;
  expect(errorType(error)).toBe("Error");
  expect(errorType(Object.create(null))).toBe("Unknown");
});

it("sends each type on each screen once, and at most a few a minute", () => {
  const send = vi.fn();
  stop = installBrowserErrorReport(window, "dev", send);
  throwUncaught(new TypeError("a"));
  throwUncaught(new TypeError("b"));
  expect(send).toHaveBeenCalledTimes(1);
  for (const Kind of [RangeError, SyntaxError, URIError, EvalError, ReferenceError]) throwUncaught(new Kind("c"));
  expect(send).toHaveBeenCalledTimes(CLIENT_REPORTS_PER_MINUTE);
});

it("turns ids into [id] and keeps fixed segments", () => {
  expect(routeTemplate("/ward-flow/ward/SYN-U1/answer")).toBe("/ward-flow/ward/[id]/answer");
  expect(routeTemplate("/ward-flow/people/new")).toBe("/ward-flow/people/new");
  expect(routeTemplate("/ward-flow/statistics/ed/SYN-E2")).toBe("/ward-flow/statistics/ed/[id]");
  expect(routeTemplate("/ward-flow/community/")).toBe("/ward-flow/community");
  expect(routeTemplate("/")).toBe("/");
});
