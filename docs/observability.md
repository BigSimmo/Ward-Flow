# Ward Flow operational observability

The Next.js `src/instrumentation.ts` request-error hook emits a structured local
`ward.request_failed` event through `src/lib/logger.ts`, with an internally generated
incident UUID and allowlisted method/router/route-type labels. It intentionally
excludes the raw error/stack, route/query, headers, user/record identifiers and body.
Its tests use sentinel data and verify no network export or monitoring failure
can change application failure handling. This does not prove that every framework
or application log is redacted.

The separate backend emits its own bounded request-correlated diagnostics; see
[`backend/ward-flow/README.md`](../backend/ward-flow/README.md). Source tests prove
the local metadata contract, not delivery to a deployed log service.

## Existing seams and required setup

`registerSentryLogForwarder` is an optional server callback. No Sentry project,
SDK registration, DSN, alert or external export has been configured by these
changes. The browser CSP remains same-origin. A named vendor is not required
to collect operational events: first verify the named Ward hosting log sink,
retention/access/region, health checks and alert ownership.

Before any external error export, choose and configure its privacy-reviewed
processor, redacted metadata contract, sampling/quotas and failure behaviour.
Verify ingestion on the exact deployed revision using synthetic sentinel data;
trigger one test alert and obtain acknowledgement from its owner. Record the
test evidence, response target, on-call escalation and outage runbook.

Backend readiness, failed storage requests, conflicts, authentication failures,
browser recovery and source/deployment revision should have distinct monitored
signals. Do not claim a healthy provider proves authenticated shared workflows.
Do not log access tokens, snapshots, free-text notes or patient data to diagnose them.

Audit OPS-002 is **partially addressed locally**; hosted collection, actionable
alerts and processor approval remain unverified. Configuration and deployment
require verified Ward-only resources and their separately applicable authority.
