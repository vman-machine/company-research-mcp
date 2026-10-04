/**
 * Minimal MCP Apps host for local testing. Connects to the MCP server, calls a
 * tool, loads the tool's ui:// resource in a sandboxed iframe (via the sandbox
 * proxy on another origin) and bridges the app protocol, like Claude does.
 *
 * Query params: server, tool, input (JSON), theme (light|dark), width (px)
 */
import { AppBridge, PostMessageTransport, getToolUiResourceUri, RESOURCE_MIME_TYPE, type McpUiResourceCsp } from "@modelcontextprotocol/ext-apps/app-bridge";
import { Client, StreamableHTTPClientTransport, type CallToolResult } from "@modelcontextprotocol/client";
import { CLAUDE_STYLE_VARIABLES } from "./host-vars";

const params = new URLSearchParams(location.search);
const serverUrl = params.get("server") ?? "http://localhost:3000/mcp";
const toolName = params.get("tool") ?? "report_render";
const input = JSON.parse(params.get("input") ?? "{}") as Record<string, unknown>;
const theme = (params.get("theme") === "dark" ? "dark" : "light") as "light" | "dark";
const SANDBOX_URL = params.get("sandbox") ?? "http://localhost:8081/sandbox.html";

document.documentElement.setAttribute("data-theme", theme);
document.documentElement.style.colorScheme = theme;
const width = params.get("width");
if (width) (document.querySelector("main") as HTMLElement).style.maxWidth = `${width}px`;

const $ = (id: string) => document.getElementById(id)!;
const log = (id: string, text: string) => {
  $(id).textContent += (($(id).textContent ?? "") ? "\n---\n" : "") + text;
};
$("prompt").textContent = `Call ${toolName}`;
$("status").textContent = `connecting to ${serverUrl}`;

async function main() {
  const client = new Client({ name: "Harness Host", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(serverUrl)));
  const tools = (await client.listTools()).tools;
  const tool = tools.find((t) => t.name === toolName);
  if (!tool) throw new Error(`Unknown tool ${toolName}; available: ${tools.map((t) => t.name).join(", ")}`);
  const uri = getToolUiResourceUri(tool);
  if (!uri) throw new Error(`Tool ${toolName} has no UI`);
  const resource = await client.readResource({ uri });
  const content = resource.contents[0] as { mimeType?: string; text?: string; _meta?: { ui?: { csp?: McpUiResourceCsp } } };
  if (content.mimeType !== RESOURCE_MIME_TYPE) throw new Error(`Unexpected mime type ${content.mimeType}`);
  const html = content.text!;
  const csp = content._meta?.ui?.csp;
  $("status").textContent = `connected; UI ${(html.length / 1024).toFixed(0)} KB`;

  const iframe = $("app") as HTMLIFrameElement;
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  const proxyReady = new Promise<void>((resolve) => {
    const listener = (e: MessageEvent) => {
      if (e.source === iframe.contentWindow && e.data?.method === "ui/notifications/sandbox-proxy-ready") {
        window.removeEventListener("message", listener);
        resolve();
      }
    };
    window.addEventListener("message", listener);
  });
  const sandboxUrl = new URL(SANDBOX_URL);
  if (csp) sandboxUrl.searchParams.set("csp", JSON.stringify(csp));
  iframe.src = sandboxUrl.href;
  await proxyReady;

  const caps = client.getServerCapabilities();
  const bridge = new AppBridge(
    client,
    { name: "Harness Host", version: "1.0.0" },
    { openLinks: {}, serverTools: caps?.tools, serverResources: caps?.resources, updateModelContext: { text: {} }, message: { text: {} }, logging: {} },
    {
      hostContext: {
        theme,
        platform: "web",
        locale: "en-GB",
        styles: { variables: CLAUDE_STYLE_VARIABLES },
        containerDimensions: { maxHeight: 6000, width: iframe.clientWidth },
        displayMode: "inline",
        availableDisplayModes: ["inline", "fullscreen"],
      },
    },
  );
  bridge.onmessage = async (p) => {
    log("messages", p.content.map((c) => ("text" in c ? c.text : `<${c.type}>`)).join("\n"));
    return {};
  };
  bridge.onupdatemodelcontext = async (p) => {
    log("context", (p.content ?? []).map((c) => ("text" in c ? c.text : `<${c.type}>`)).join("\n"));
    return {};
  };
  bridge.onopenlink = async (p) => {
    log("links", p.url);
    return {};
  };
  bridge.onloggingmessage = (p) => console.log("[app]", p);
  bridge.onsizechange = async ({ height }) => {
    if (height) iframe.style.height = `${height}px`;
  };
  bridge.onrequestdisplaymode = async (p) => {
    const mode = p.mode === "fullscreen" ? "fullscreen" : "inline";
    document.body.classList.toggle("fullscreen", mode === "fullscreen");
    bridge.sendHostContextChange({ displayMode: mode });
    return { mode };
  };
  (window as unknown as { setTheme: (t: "light" | "dark") => void }).setTheme = (t) => {
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.style.colorScheme = t;
    bridge.sendHostContextChange({ theme: t });
  };

  const initialized = new Promise<void>((resolve) => {
    bridge.oninitialized = () => resolve();
  });
  await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
  await bridge.sendSandboxResourceReady({ html, csp });
  await initialized;
  $("status").textContent = "app initialized";

  const resultPromise = client.callTool({ name: toolName, arguments: input }) as Promise<CallToolResult>;
  bridge.sendToolInput({ arguments: input });
  const result = await resultPromise;
  bridge.sendToolResult(result);
  log("result", JSON.stringify(result.structuredContent ?? result.content).slice(0, 600));
  $("status").textContent = "tool result delivered";
  document.body.dataset.ready = "1";
}

main().catch((err) => {
  $("status").textContent = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
  document.body.dataset.error = "1";
  console.error(err);
});
