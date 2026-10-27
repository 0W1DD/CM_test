// Builds what Naru publishes into dist/: the React app (vite, through
// react-router build) as the site's files, and naru/ as dist/_naru/, each
// TypeScript file compiled to JavaScript at the same path.
//
//   node scripts/build.mjs              the app and the site's code
//   node scripts/build.mjs --naru-only  the site's code alone (for tests)
import { execFileSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const naru = join(root, "naru");
const out = join(root, "dist");
const naruOnly = process.argv.includes("--naru-only");

async function compile(directory) {
  for (const entry of await readdir(join(naru, directory), {
    withFileTypes: true,
  })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await compile(path);
      continue;
    }
    if (entry.name === "tsconfig.json" || entry.name.endsWith(".d.ts"))
      continue;
    const target = join(out, "_naru", path);
    await mkdir(dirname(target), { recursive: true });
    if (entry.name.endsWith(".ts")) {
      const { outputText } = ts.transpileModule(
        await readFile(join(naru, path), "utf8"),
        {
          fileName: path,
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
          },
        },
      );
      await writeFile(target.replace(/\.ts$/, ".js"), outputText);
    } else await cp(join(naru, path), target);
  }
}

// --naru-only overwrites in place, so builds running side by side do not
// remove each other's files.
if (!naruOnly) {
  await rm(out, { recursive: true, force: true });
  execFileSync("pnpm", ["exec", "react-router", "build"], {
    cwd: root,
    stdio: "inherit",
  });
  await cp(join(root, "build", "client"), out, { recursive: true });
  await cp(join(root, "LICENSE"), join(out, "LICENSE.txt"));
}
await compile("");
