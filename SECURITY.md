# Ward Flow security policy

Ward Flow is the standalone `BigSimmo/Ward-Flow` synthetic prototype. Its Next.js
UI and separate Ward backend are distinct from PsychSift. It is not approved for
real patient information or clinical deployment.

## Reporting a vulnerability

Do not open a public issue, pull request or discussion containing a security
finding. Use GitHub Private Vulnerability Reporting if available under this
repository's Security tab. If unavailable, contact the maintainer (`@BigSimmo`)
privately through an available private channel; do not post sensitive details publicly.
Channel availability and response times have not been verified here.

Include impact, affected paths, synthetic reproduction steps and suggested repair.
Never include credentials, tokens, patient information or private service contents.

## Scope and versions

Reports may concern the current repository's UI, local API routes, authentication,
persistence and separate Azure/PostgreSQL backend code. Name the affected revision.
Third-party service vulnerabilities belong with their vendor; integration defects
in Ward remain in scope. Do not use PsychSift's Supabase or Railway resources.

## Safe investigation

Prefer local, mocked, offline checks with synthetic data. Live service testing,
provider calls, credential changes and deployment require explicit authority and
verification of the exact Ward resource. A documentation repair grants none.

## Evidence and related documentation

See [repository boundaries](AGENTS.md), [hosting records](docs/hosting.md) and
[Ward's workflow source](.github/workflows/ward-flow.yml). Local workflow source
is not evidence that hosted checks or deployment ran. The Ward workflow includes
full-history Gitleaks with a pinned, checksum-verified release and required application
checks. The read-only 8 October 2026 audit verified successful checks for main at
`e7b7f325346ea7abb5004bd2e60e63f64f5c9f95`, including identical-tree PR result reuse.
No Ward Semgrep workflow was found. Newer main commits include source changes;
that dated verdict does not establish their hosted scan, application checks or deployment.
