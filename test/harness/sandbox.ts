/**
 * Outer sandbox proxy (separate origin from the host). Relays JSON-RPC messages
 * between the host window and the inner iframe that holds the untrusted app HTML.
 * Adapted from the ext-apps basic-host example.
 */
import { buildAllowAttribute } from "@modelcontextprotocol/ext-apps/app-bridge";

if (window.self === window.top) throw new Error("sandbox.html must be loaded in an iframe");
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(document.referrer)) throw new Error(`Unexpected embedder: ${document.referrer}`);
const HOST_ORIGIN = new URL(document.referrer).origin;
const OWN_ORIGIN = location.origin;

const inner = document.createElement("iframe");
inner.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
inner.style.cssText = "width:100%;height:100%;border:none;";
document.body.appendChild(inner);

window.addEventListener("message", (event) => {
  if (event.source === window.parent) {
    if (event.origin !== HOST_ORIGIN) return;
    if (event.data?.method === "ui/notifications/sandbox-resource-ready") {
      const { html, sandbox, permissions } = event.data.params ?? {};
      if (typeof sandbox === "string") inner.setAttribute("sandbox", sandbox);
      const allow = buildAllowAttribute(permissions);
      if (allow) inner.setAttribute("allow", allow);
      const doc = inner.contentDocument;
      if (doc && typeof html === "string") {
        doc.open();
        doc.write(html);
        doc.close();
      } else if (typeof html === "string") {
        inner.srcdoc = html;
      }
    } else {
      inner.contentWindow?.postMessage(event.data, "*");
    }
  } else if (event.source === inner.contentWindow) {
    if (event.origin !== OWN_ORIGIN) return;
    window.parent.postMessage(event.data, HOST_ORIGIN);
  }
});

window.parent.postMessage({ jsonrpc: "2.0", method: "ui/notifications/sandbox-proxy-ready", params: {} }, HOST_ORIGIN);
