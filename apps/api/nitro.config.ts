import { defineConfig } from "nitro";

export default defineConfig({
  // Overridable via NITRO_PRESET env (e.g. "node-server" for self-hosting).
  preset: "vercel",
  modules: ["workflow/nitro"],
  alias: {
    "@": "./src",
  },
  routes: {
    "/**": "./src/index.ts",
  },
  // sharp ships a native binary; keep it external so node-file-trace copies it
  // into the output instead of trying to bundle the .node addon.
  externals: {
    external: ["sharp"],
  },
});
