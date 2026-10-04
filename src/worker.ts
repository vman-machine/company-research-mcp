/**
 * Cloudflare Workers entry point. Storage: the RESEARCH_KV namespace.
 */
import { createServer } from "./server/createServer.js";
import { createHttpApp } from "./server/http.js";
import { KVStore, ResearchRepository, type KVNamespaceLike } from "./server/store.js";

export interface Env {
  RESEARCH_KV: KVNamespaceLike;
  ACCESS_KEY?: string;
}

const app = createHttpApp<Env>({
  createMcpServer: (env) => createServer(new ResearchRepository(new KVStore(env.RESEARCH_KV))),
  getAccessKey: (env) => env.ACCESS_KEY,
});

export default app;
