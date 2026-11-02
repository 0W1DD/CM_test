import { readFileSync } from "node:fs";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// @naru-pub/sdk is imported from Naru, at the address of the installed
// version, rather than bundled: Naru serves the SDK's fixes there, and
// naru-dev's import map points it at the local server.
const { version } = JSON.parse(
  readFileSync("node_modules/@naru-pub/sdk/package.json", "utf8"),
);
const NARU_SDK = `https://sdk.naru.pub/sdk/${version.replace(/-.*/, "")}/naru.js`;
const naruSdk: Plugin = {
  name: "naru-sdk",
  enforce: "pre",
  resolveId: (id) =>
    id === "@naru-pub/sdk" ? { id: NARU_SDK, external: true } : null,
};

export default defineConfig({
  plugins: [naruSdk, tailwindcss(), reactRouter(), tsconfigPaths()],
  optimizeDeps: { exclude: ["@naru-pub/sdk"] },
});
