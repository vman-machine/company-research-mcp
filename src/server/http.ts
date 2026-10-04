/**
 * HTTP layer (Hono, web-standard). Runs unchanged on Node, Cloudflare Workers,
 * Deno or Bun. Each MCP request gets a fresh server + stateless transport.
 */
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { WebStandardStreamableHTTPServerTransport, type McpServer } from "@modelcontextprotocol/server";
import { renderLanding } from "./landing.js";
import { SERVER_VERSION, TOOL_CATALOG } from "./createServer.js";

export interface HttpAppOptions<TEnv> {
  createMcpServer: (env: TEnv) => McpServer;
  /** Optional shared secret. When set, the MCP endpoint is /mcp/<key> and bare /mcp is rejected. */
  getAccessKey?: (env: TEnv) => string | undefined;
}

const rpcError = (code: number, message: string) => ({ jsonrpc: "2.0" as const, error: { code, message }, id: null });

/** Public origin, honouring reverse-proxy headers (Render, Fly, etc.). */
function publicOrigin(c: Context): string {
  const url = new URL(c.req.url);
  const proto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  const host = c.req.header("x-forwarded-host")?.split(",")[0]?.trim() || c.req.header("host") || url.host;
  return `${proto}://${host}`;
}

export function createHttpApp<TEnv extends object = Record<string, never>>(opts: HttpAppOptions<TEnv>) {
  const app = new Hono<{ Bindings: TEnv }>();

  // Browser-based MCP hosts (the MCP Inspector, the local test harness) call the
  // endpoint cross-origin. Claude's connector calls server-to-server and ignores this.
  app.use(
    "/mcp/*",
    cors({ origin: "*", allowMethods: ["GET", "POST", "DELETE", "OPTIONS"], allowHeaders: ["Content-Type", "Accept", "Authorization", "Mcp-Session-Id", "Mcp-Protocol-Version", "Last-Event-ID"], exposeHeaders: ["Mcp-Session-Id", "Mcp-Protocol-Version"] }),
  );
  app.use("/mcp", cors({ origin: "*", allowMethods: ["GET", "POST", "DELETE", "OPTIONS"], allowHeaders: ["Content-Type", "Accept", "Authorization", "Mcp-Session-Id", "Mcp-Protocol-Version", "Last-Event-ID"], exposeHeaders: ["Mcp-Session-Id", "Mcp-Protocol-Version"] }));

  app.get("/", (c) => {
    const key = opts.getAccessKey?.(c.env)?.trim();
    return c.html(
      renderLanding({
        mcpUrl: `${publicOrigin(c)}/mcp`,
        protectedByKey: !!key,
        version: SERVER_VERSION,
        tools: TOOL_CATALOG,
      }),
    );
  });

  app.get("/healthz", (c) => c.json({ ok: true, name: "company-research-mcp", version: SERVER_VERSION, time: new Date().toISOString() }));

  const handleMcp = async (c: Context<{ Bindings: TEnv }>) => {
    const required = opts.getAccessKey?.(c.env)?.trim();
    const given = c.req.param("key" as never) as string | undefined;
    if (required) {
      if (given !== required) return c.json(rpcError(-32001, "Unauthorized: missing or invalid access key in the URL path"), 401);
    } else if (given !== undefined) {
      return c.json(rpcError(-32601, "Not found"), 404);
    }

    const server = opts.createMcpServer(c.env);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    try {
      await server.connect(transport);
      return await transport.handleRequest(c.req.raw);
    } catch (err) {
      console.error("[mcp] request failed:", err);
      return c.json(rpcError(-32603, "Internal server error"), 500);
    }
  };

  app.all("/mcp", handleMcp);
  app.all("/mcp/:key", handleMcp);

  app.notFound((c) => c.json({ error: "Not found", hint: "MCP endpoint is POST /mcp" }, 404));

  return app;
}
