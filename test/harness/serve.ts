/**
 * Serves the built harness: host page on HOST_PORT (8080) and the sandbox proxy
 * on SANDBOX_PORT (8081, different origin) with a CSP header built from ?csp=.
 * Build first: npm run harness:build
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../dist/harness/test/harness");

function buildCsp(csp?: { resourceDomains?: string[]; connectDomains?: string[]; frameDomains?: string[]; baseUriDomains?: string[] }): string {
  const ok = (d?: string[]) => (d ?? []).filter((x) => typeof x === "string" && !/[;\r\n'" ]/.test(x)).join(" ");
  const res = ok(csp?.resourceDomains);
  const con = ok(csp?.connectDomains);
  const frame = ok(csp?.frameDomains);
  const base = ok(csp?.baseUriDomains);
  return [
    "default-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline' blob: data: ${res}`.trim(),
    `style-src 'self' 'unsafe-inline' blob: data: ${res}`.trim(),
    `img-src 'self' data: blob: ${res}`.trim(),
    `font-src 'self' data: blob: ${res}`.trim(),
    `media-src 'self' data: blob: ${res}`.trim(),
    `connect-src 'self' ${con}`.trim(),
    `worker-src 'self' blob: ${res}`.trim(),
    frame ? `frame-src ${frame}` : "frame-src 'none'",
    "object-src 'none'",
    base ? `base-uri ${base}` : "base-uri 'none'",
  ].join("; ");
}

export function startHarness(opts: { hostPort?: number; sandboxPort?: number; servers?: string[] } = {}) {
  const hostPort = opts.hostPort ?? 8080;
  const sandboxPort = opts.sandboxPort ?? 8081;
  const hostHtml = fs.readFileSync(path.join(root, "host.html"), "utf8");
  const sandboxHtml = fs.readFileSync(path.join(root, "sandbox.html"), "utf8");

  const host = http.createServer({ maxHeaderSize: 4 * 1024 * 1024 }, (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(hostHtml);
  });
  const sandbox = http.createServer({ maxHeaderSize: 1024 * 1024 }, (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${sandboxPort}`);
    let csp: Parameters<typeof buildCsp>[0];
    try {
      csp = url.searchParams.get("csp") ? JSON.parse(url.searchParams.get("csp")!) : undefined;
    } catch { /* ignore */ }
    res.setHeader("Content-Security-Policy", buildCsp(csp));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(sandboxHtml);
  });
  host.listen(hostPort);
  sandbox.listen(sandboxPort);
  return {
    hostUrl: `http://localhost:${hostPort}/`,
    close: () => {
      host.close();
      sandbox.close();
    },
  };
}

if (process.argv[1] && /serve\.ts$/.test(process.argv[1])) {
  const h = startHarness();
  console.log(`Harness host: ${h.hostUrl}  (sandbox on 8081). Example: ${h.hostUrl}?tool=report_render&input=%7B%7D`);
}
