---
name: node-best-practices
description: >-
  Enforce, audit, and implement Node.js and Next.js backend best practices based on Yoni Goldberg's
  nodebestpractices guide (error handling, async hygiene, security headers, input validation, and architecture).
---

# Node.js Best Practices for Ward Flow

A curated implementation guide based on Yoni Goldberg's [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices), tailored for Next.js App Router API routes, Node.js HTTP servers, and Azure Functions.

---

## 1. Architecture & Project Structure

- **Separate Routes from Domain Logic:**
  - Route handlers (`route.ts` or Azure `function.mjs`) must only parse requests, extract headers/claims, validate inputs, delegate to domain stores/services, and format responses.
  - Keep domain state, business rules, and persistence logic in `@/lib/` or separate service modules (e.g. `clinical-assessment-dual-signoff.ts`, `database.mjs`).
- **Configuration & Environment Management:**
  - Read configuration centrally at boot time (e.g. `config.mjs`). Fail closed immediately if required environment variables or secrets are missing.
  - Never hard-code credentials, tenant IDs, or private keys in source code.

---

## 2. Error Handling & Resilience

- **Operational vs. Programmer Errors:**
  - **Operational errors** (expected runtime conditions: 400 Bad Request, 403 Forbidden, 404 Not Found, 409 Conflict) should use structured custom error classes (e.g., `NotFoundError`, `ForbiddenError`, `StateConflictError`).
  - **Programmer errors** (unhandled exceptions, bugs, syntax errors): Return a generic `500 Internal Server Error` to the client. Never leak internal stack traces or database driver errors.
- **Async Safety:**
  - Always `await` asynchronous calls or properly chain promises.
  - Never allow unhandled promise rejections. In standalone servers, subscribe to `uncaughtException` and `unhandledRejection` to exit cleanly after logging.
- **Fail Gracefully & Avoid Silent Catches:**
  - Never write empty catch blocks (`try { ... } catch {}`). Always log or map the error.

---

## 3. Security & Input Protection

- **Defensive Headers:**
  - Always set `"Cache-Control": "no-store"` for sensitive or dynamic API routes.
  - Set `"X-Content-Type-Options": "nosniff"`.
- **Payload & Body Limits:**
  - Protect against Denial of Service (DoS) by enforcing strict payload size limits (e.g., 1MB ceiling as in `BODY_LIMIT = 1_048_576`).
  - Reject unexpected `Content-Type` headers with `415 Unsupported Media Type`.
- **Input Validation:**
  - Validate all incoming request bodies, query params, and route parameters (using Zod or strict runtime guards) before passing them to domain functions.
  - Enforce synthetic data privacy guards on any clinical or user-submitted payload.
- **Optimistic Locking:**
  - Use revision counters (`expectedRevision`) or ETags to prevent concurrent write collisions (lost updates). Return `409 Conflict` if the resource changed.

---

## 4. Operational Readiness & Health Checks

- **Dual Health Probes:**
  - **Liveness (`/healthz` or `/api/health`):** Lightweight probe returning `200 OK` to confirm the server process is responsive and routing traffic.
  - **Readiness (`/readyz`):** Deep probe that actively tests downstream connectivity (e.g., Azure Storage, database) before accepting live user requests.
- **Graceful Shutdown:**
  - Listen for `SIGINT` and `SIGTERM`. Stop accepting new incoming requests, allow in-flight requests to complete within a timeout, and close connections.
- **Connection & Request Timeouts:**
  - Enforce explicit request timeouts (e.g., 10–15 seconds) so stalled client connections or hung downstream sockets do not tie up worker memory.

---

## 5. Testing & Verification

- **Arrange-Act-Assert (AAA):** Structure API integration tests clearly with explicit setup, execution, and expectation phases.
- **Test Error Paths:** Write tests not just for happy paths (`200`/`201`), but specifically asserting `400` (invalid input), `403` (permission denied), `404` (not found), and `409` (version clash).
- **Synthetic Test Data:** Ensure zero live PII/PHI in test fixtures. Use deterministic synthetic IDs.
