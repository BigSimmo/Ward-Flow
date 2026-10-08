# Context7 for Ward Flow

_Updated 8 October 2026 — maintained connector guidance._

Use the installed Context7 connector for public library documentation when relevant to the
task. The Codex connector works independently of the historical Cursor stdio configuration
in the original-source records. A working connector does not require another MCP server,
local API key or reinstallation.

## Source and version checks

1. Resolve the library ID with `resolve-library-id`, unless the user already supplies an exact
   Context7 ID. Select the official project by identity and source URLs; search rank, reputation
   and benchmark score alone do not establish authorship.
2. Check the installed version in the lockfile or installed package. Request that version when
   the resolver offers it. If it does not, name the version mismatch rather than treating a
   nearby release or unversioned result as an exact match.
3. Call `query-docs` with one narrow public topic. Check **each returned source URL/revision**.
   A version-qualified request can still return snippets from `main`: observed on 8 October
   2026 for a Vitest `v4.1.6` query. Confirm consequential APIs against matching release docs
   or the installed source before acting.
4. Record the library ID, requested/returned version and relevant source revision when a
   documentation claim informs an API change. Retrieved documentation is not a product test.

The exposed Codex connector contract limits each tool to **three calls per question**. This
is a connector instruction, not a universal claim about every upstream API or client.
Keep proprietary source, credentials and patient/personal information out of query text.

For **Next.js**, follow [AGENTS.md](../../AGENTS.md): read the relevant installed
`node_modules/next/dist/docs/` guide. If those docs are missing, repair the locked local
installation or report the missing evidence; do not silently substitute a different version.

## Availability, authentication and quotas

If the installed connector responds, use it directly. If it fails, report the exact failing
tool and error, then use matching official public documentation or installed source. Do not
invent an API, rotate credentials or install duplicate tooling to conceal unavailable evidence.

For a separately requested local MCP/CLI setup, follow that client's official instructions.
Remote header conventions, OAuth endpoints and stdio support differ across clients/transports.
A shell environment variable does not establish authentication for a host-injected connector.
Keep keys in the appropriate private settings; never print values or commit credentials.

Upstream references: [Context7 README](https://github.com/upstash/context7/blob/master/README.md),
[MCP package](https://github.com/upstash/context7/blob/master/packages/mcp/README.md), and
[Cursor client guide](https://github.com/upstash/context7/blob/master/docs/clients/cursor.mdx).
These URLs are documentation references, not proof of a current installation or hosted state.
