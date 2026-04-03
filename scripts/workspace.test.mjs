import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("root package exposes runnable workspace commands", async () => {
  const packageJson = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));

  assert.equal(packageJson.scripts.dev.includes("turbo run dev"), true);
  assert.equal(packageJson.scripts.lint, "node ./scripts/lint-workspace.mjs");
  assert.equal(packageJson.scripts.typecheck, "tsc --noEmit --project tsconfig.json");
  assert.equal(packageJson.scripts.test, "node --test ./scripts/workspace.test.mjs");
});

test("pnpm workspace includes app and package globs", async () => {
  const workspaceYaml = await readFile(path.join(rootDir, "pnpm-workspace.yaml"), "utf8");

  assert.match(workspaceYaml, /apps\/\*/);
  assert.match(workspaceYaml, /packages\/\*/);
});
