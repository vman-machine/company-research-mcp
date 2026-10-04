/**
 * Thin wrapper over the MCP Apps React hook. Collects tool input / result /
 * host context into React state and exposes the handful of host actions the
 * views use. Also provides a preview mode (open the built HTML with `#preview`)
 * so the views can be designed without a host.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { App, McpUiHostContext, McpUiDisplayMode } from "@modelcontextprotocol/ext-apps";
import { useApp, useHostFonts, useHostStyleVariables } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/client";

export interface AppActions {
  sendMessage(text: string): Promise<boolean>;
  openLink(url: string): Promise<void>;
  callServerTool(name: string, args: Record<string, unknown>): Promise<CallToolResult>;
  updateModelContext(text: string): Promise<void>;
  requestDisplayMode(mode: McpUiDisplayMode): Promise<McpUiDisplayMode>;
}

export interface McpAppState {
  status: "connecting" | "connected" | "error" | "preview";
  error: Error | null;
  toolInput: Record<string, unknown> | null;
  toolResult: CallToolResult | null;
  cancelledReason: string | null;
  hostContext: McpUiHostContext | undefined;
  displayMode: McpUiDisplayMode;
  canFullscreen: boolean;
  actions: AppActions;
}

export const isPreview = () => typeof window !== "undefined" && /preview/.test(window.location.hash);

function wrapActions(app: App | null): AppActions {
  return {
    async sendMessage(text) {
      if (!app) return false;
      const res = await app.sendMessage({ role: "user", content: [{ type: "text", text }] });
      return !res.isError;
    },
    async openLink(url) {
      if (!app) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      await app.openLink({ url });
    },
    async callServerTool(name, args) {
      if (!app) throw new Error("Not connected to a host");
      return app.callServerTool({ name, arguments: args });
    },
    async updateModelContext(text) {
      if (!app) return;
      try {
        await app.updateModelContext({ content: [{ type: "text", text }] });
      } catch (err) {
        console.warn("updateModelContext not supported by host", err);
      }
    },
    async requestDisplayMode(mode) {
      if (!app) return mode;
      const res = await app.requestDisplayMode({ mode });
      return res.mode;
    },
  };
}

export function useMcpApp(name: string, version = "1.0.0"): McpAppState {
  const preview = useMemo(isPreview, []);
  const [toolInput, setToolInput] = useState<Record<string, unknown> | null>(null);
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [cancelledReason, setCancelled] = useState<string | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();

  const { app, error, isConnected } = useApp({
    appInfo: { name, version },
    capabilities: { availableDisplayModes: ["inline", "fullscreen"] },
    onAppCreated: (a) => {
      a.ontoolinput = (params) => setToolInput((params.arguments as Record<string, unknown>) ?? {});
      a.ontoolresult = (result) => setToolResult(result);
      a.ontoolcancelled = (params) => setCancelled(params.reason ?? "The tool call was cancelled.");
      a.onhostcontextchanged = (ctx) => setHostContext((prev) => ({ ...prev, ...ctx }));
      a.onerror = (e) => console.error("[mcp-app]", e);
    },
  });

  useEffect(() => {
    if (app) setHostContext(app.getHostContext());
  }, [app]);

  useHostStyleVariables(app, app?.getHostContext());
  useHostFonts(app, app?.getHostContext());

  // Preview mode: follow the OS colour scheme since there is no host.
  useEffect(() => {
    if (!preview) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme = /dark/.test(window.location.hash) ? "dark" : /light/.test(window.location.hash) ? "light" : mq.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", theme);
      document.documentElement.style.colorScheme = theme;
    };
    apply();
    mq.addEventListener("change", apply);
    window.addEventListener("hashchange", apply);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("hashchange", apply);
    };
  }, [preview]);

  const actions = useMemo(() => wrapActions(app), [app]);

  const displayMode: McpUiDisplayMode = hostContext?.displayMode ?? "inline";
  const canFullscreen = preview || (hostContext?.availableDisplayModes?.includes("fullscreen") ?? false);

  const status: McpAppState["status"] = preview ? "preview" : error ? "error" : isConnected ? "connected" : "connecting";

  return { status, error, toolInput, toolResult, cancelledReason, hostContext, displayMode, canFullscreen, actions };
}

/** Toggle inline/fullscreen; returns the resulting mode. */
export function useFullscreenToggle(state: McpAppState) {
  const [localMode, setLocalMode] = useState<McpUiDisplayMode | null>(null);
  const mode = localMode ?? state.displayMode;
  useEffect(() => setLocalMode(null), [state.displayMode]);
  const toggle = useCallback(async () => {
    const next: McpUiDisplayMode = mode === "fullscreen" ? "inline" : "fullscreen";
    if (state.status === "preview") {
      setLocalMode(next);
      return;
    }
    const result = await state.actions.requestDisplayMode(next);
    setLocalMode(result);
  }, [mode, state]);
  return { mode, toggle };
}
