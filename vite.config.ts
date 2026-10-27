import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// The Naru SDK stays a URL import: Naru serves it, and naru-dev's import map
// points it at the local server.
const NARU_SDK = /^https:\/\/sdk\.naru\.pub\//;

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  build: { rollupOptions: { external: [NARU_SDK] } },
  optimizeDeps: { exclude: ["https://sdk.naru.pub/sdk/1.1.0/naru.js"] },
});
