#!/usr/bin/env node
/**
 * Node entry point.
 *   node dist/server/node.js            Streamable HTTP on $PORT (default 3000), JSON-file storage in $DATA_DIR
 *   node dist/server/node.js --stdio    stdio transport (text-only hosts; MCP Apps do not render over stdio)
 */
import path from "node:path";
import { serve } from "@hono/node-server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./server/createServer.js";
import { createHttpApp } from "./server/http.js";
import { ResearchRepository } from "./server/store.js";
import { FileStore } from "./stores/fileStore.js";

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const repo = new ResearchRepository(new FileStore(path.join(dataDir, "store.json")));

if (process.argv.includes("--stdio")) {
  await createServer(repo).connect(new StdioServerTransport());
} else {
  const port = Number(process.env.PORT ?? 3000);
  const hostname = process.env.HOST ?? "0.0.0.0";
  const app = createHttpApp({
    createMcpServer: () => createServer(repo),
    getAccessKey: () => process.env.ACCESS_KEY,
  });
  serve({ fetch: app.fetch, port, hostname }, (info) => {
    console.log(`Company Research MCP listening on http://localhost:${info.port}/mcp${process.env.ACCESS_KEY ? "/<ACCESS_KEY>" : ""}  (data: ${dataDir})`);
  });
}
