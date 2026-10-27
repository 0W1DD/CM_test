// The built-in commands: one file each in naru/modules/commands/, named
// after the command, every one listed in naru/modules/commands.ts.
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import test from "node:test";
import { BUILTIN_COMMANDS } from "../dist/_naru/modules/commands.js";

const SOURCES = new URL("../naru/modules/commands/", import.meta.url);

test("every command file is listed, named after its file, once", async () => {
  const files = (await readdir(SOURCES))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => name.slice(0, -3))
    .sort();
  const names = BUILTIN_COMMANDS.map((command) => command.name);
  assert.deepEqual([...names].sort(), files);
  assert.equal(new Set(names).size, names.length);
  for (const command of BUILTIN_COMMANDS) {
    assert.match(command.name, /^[a-z][a-z0-9_-]{0,30}$/);
    assert.ok(command.description.trim(), `${command.name} has a description`);
    assert.equal(typeof command.run, "function");
  }
});
