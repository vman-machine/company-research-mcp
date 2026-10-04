/** Static landing page served at "/" so the deployment can be checked in a browser. */

export interface LandingOptions {
  mcpUrl: string;
  protectedByKey: boolean;
  version: string;
  tools: { name: string; title: string; ui: boolean }[];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function renderLanding(o: LandingOptions): string {
  const url = o.protectedByKey ? `${o.mcpUrl}/YOUR_ACCESS_KEY` : o.mcpUrl;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Company Research MCP</title>
<style>
  :root { color-scheme: light dark; --bg: light-dark(#faf9f5, #141413); --card: light-dark(#ffffff, #262624); --fg: light-dark(#141413, #faf9f5); --fg2: light-dark(#5c5b56, #b5b3aa); --line: light-dark(#e6e4dc, #3a3936); --accent: light-dark(#3b5bdb, #8ea2ff); --ok: light-dark(#265b19, #7ab948); --okbg: light-dark(#e9f1dc, #1b4614); }
  * { box-sizing: border-box; }
  body { margin: 0; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--fg); }
  main { max-width: 760px; margin: 0 auto; padding: 56px 20px 80px; }
  .eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ok); background: var(--okbg); padding: 4px 10px; border-radius: 999px; font-weight: 600; }
  .eyebrow::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--ok); }
  h1 { font-size: 36px; line-height: 1.1; margin: 18px 0 10px; letter-spacing: -0.02em; }
  p.lead { font-size: 18px; color: var(--fg2); margin: 0 0 32px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 22px 24px; margin: 0 0 18px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--fg2); margin: 0 0 12px; }
  .url { display: flex; gap: 10px; align-items: center; }
  code.url-text { flex: 1; font: 14px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 10px 12px; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; overflow-x: auto; white-space: nowrap; }
  button { font: inherit; font-weight: 600; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--accent); color: #fff; cursor: pointer; }
  ol { margin: 0; padding-left: 20px; } li { margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; } td, th { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: top; } th { color: var(--fg2); font-weight: 600; }
  .pill { font-size: 12px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--fg2); }
  .pill.ui { color: var(--accent); border-color: var(--accent); }
  .note { font-size: 14px; color: var(--fg2); }
  footer { margin-top: 28px; font-size: 13px; color: var(--fg2); }
  a { color: var(--accent); }
</style>
</head>
<body>
<main>
  <span class="eyebrow">Online · v${esc(o.version)}</span>
  <h1>Company Research MCP</h1>
  <p class="lead">An MCP App for Claude: a guided onboarding that learns why you research companies, purpose-tailored deep research playbooks, and an interactive report.</p>

  <section class="card">
    <h2>Your connector URL</h2>
    <div class="url"><code class="url-text" id="url">${esc(url)}</code><button onclick="navigator.clipboard.writeText(document.getElementById('url').textContent).then(()=>{this.textContent='Copied'})">Copy</button></div>
    ${o.protectedByKey ? `<p class="note">This server is protected with an access key. Replace <code>YOUR_ACCESS_KEY</code> with the value of the <code>ACCESS_KEY</code> environment variable set on this deployment.</p>` : `<p class="note">No access key is configured. Anyone with this URL can read saved profiles and reports. Set an <code>ACCESS_KEY</code> environment variable to protect it; the endpoint then becomes <code>/mcp/&lt;key&gt;</code>.</p>`}
  </section>

  <section class="card">
    <h2>Add it to Claude</h2>
    <ol>
      <li>Claude Desktop or claude.ai: <strong>Settings → Connectors → Add custom connector</strong>.</li>
      <li>Name it <strong>Company Research</strong> and paste the URL above. Leave OAuth fields empty.</li>
      <li>In a new chat, enable the connector and say: <em>"Set up my company research profile."</em></li>
      <li>Then: <em>"Research Acme Corp."</em> Claude runs the deep research protocol and renders the interactive report.</li>
    </ol>
    <p class="note">Interactive UI renders for remote connectors on claude.ai and Claude Desktop. Turn on web search in Claude so it can research.</p>
  </section>

  <section class="card">
    <h2>Tools</h2>
    <table>
      <tr><th>Tool</th><th>What it does</th><th></th></tr>
      ${o.tools.map((t) => `<tr><td><code>${esc(t.name)}</code></td><td>${esc(t.title)}</td><td>${t.ui ? '<span class="pill ui">interactive</span>' : '<span class="pill">data</span>'}</td></tr>`).join("\n      ")}
    </table>
  </section>

  <footer>MCP endpoint: <code>POST ${esc(o.mcpUrl)}</code> · Health: <a href="/healthz">/healthz</a></footer>
</main>
</body>
</html>`;
}
