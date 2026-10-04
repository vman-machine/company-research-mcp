import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Each MCP App view is built into one self-contained HTML file (inline JS + CSS),
// because the host serves it from an MCP resource with no same-origin server.
const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error("INPUT environment variable is not set (e.g. INPUT=onboarding.html)");
}

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    target: "es2022",
    rollupOptions: { input: INPUT },
    outDir: process.env.OUT_DIR ?? "dist/ui",
    emptyOutDir: false,
    minify: true,
    cssMinify: true,
    sourcemap: false,
  },
});
