import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cursorMcpPath = path.join(repoRoot, ".cursor", "mcp.json");
function describeConfiguredCursor(name: string, body: () => void) {
  if (existsSync(cursorMcpPath)) describe(name, body);
}

type CursorMcpConfig = {
  mcpServers?: Record<
    string,
    {
      url?: string;
      headers?: Record<string, string>;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
    }
  >;
};

if (!existsSync(cursorMcpPath)) {
  describe("public Cursor MCP boundary", () => {
    it("ships no partial project MCP configuration", () => {
      expect(existsSync(path.join(repoRoot, ".mcp.json"))).toBe(false);
      const cursorDir = path.join(repoRoot, ".cursor");
      if (!existsSync(cursorDir)) return;
      // Cloud Agent setup is the only Cursor project file this repository ships.
      // MCP servers, skills, and rules stay absent.
      expect(readdirSync(cursorDir).sort()).toEqual([
        "cloud-agent-install.sh",
        "cloud-agent-start.sh",
        "environment.json",
      ]);
      const environment = JSON.parse(readFileSync(path.join(cursorDir, "environment.json"), "utf8")) as {
        install?: string;
        start?: string;
        mcpServers?: unknown;
      };
      expect(environment.install).toBe("bash .cursor/cloud-agent-install.sh");
      expect(environment.start).toBe("bash .cursor/cloud-agent-start.sh");
      expect(environment.mcpServers).toBeUndefined();
    });
  });
}

describeConfiguredCursor("Cursor project MCP contract", () => {
  const raw = readFileSync(cursorMcpPath, "utf8");
  const config = JSON.parse(raw) as CursorMcpConfig;
  const servers = config.mcpServers ?? {};

  it("runs Context7 as pinned local stdio MCP with env-interpolated API key", () => {
    expect(servers.context7?.command).toBe("npx");
    expect(servers.context7?.args).toEqual(["-y", "@upstash/context7-mcp@3.2.5"]);
    expect(servers.context7?.env?.CONTEXT7_API_KEY).toBe("${env:CONTEXT7_API_KEY}");
    expect(servers.context7?.url).toBeUndefined();
    expect(servers.context7?.headers).toBeUndefined();
  });

  it("does not embed Context7 API key literals", () => {
    expect(raw).not.toMatch(/ctx7sk/i);
  });

  it("keeps the sanctioned co-resident MCP set with chrome-devtools pinned", () => {
    expect(Object.keys(servers).sort()).toEqual(["chrome-devtools", "context7", "figma", "supabase"]);
    expect(servers["chrome-devtools"]?.command).toBe("npx");
    expect(servers["chrome-devtools"]?.args).toEqual(["-y", "chrome-devtools-mcp@1.6.0"]);
    expect(servers.figma?.url).toBe("https://mcp.figma.com/mcp");
  });

  it("restricts the Supabase MCP to the docs and development feature groups, like the Claude and Codex entries", () => {
    // Without `features=`, the hosted server enables its default groups in read-only mode,
    // which include `database` (execute_sql, list_tables) and `debugging` (logs, advisors)
    // against the live clinical project — enforced by prose only (audit L39). The Claude
    // (`.mcp.json`) and Codex (`.codex/config.toml`) entries pin docs + development; Cursor
    // must match.
    expect(servers.supabase?.url).toBe(
      "https://mcp.supabase.com/mcp?project_ref=sjrfecxgysukkwxsowpy&read_only=true&features=docs%2Cdevelopment",
    );
    const claudeMcp = JSON.parse(readFileSync(path.join(repoRoot, ".mcp.json"), "utf8")) as CursorMcpConfig;
    expect(servers.supabase?.url).toBe(claudeMcp.mcpServers?.supabase?.url);
  });
});
