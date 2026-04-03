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

test("shared config package exports reusable TypeScript config", async () => {
  const manifest = JSON.parse(await readFile(path.join(rootDir, "packages/config/package.json"), "utf8"));
  const sharedTsconfig = JSON.parse(
    await readFile(path.join(rootDir, "packages/config/typescript/base.json"), "utf8")
  );
  const rootTsconfig = JSON.parse(await readFile(path.join(rootDir, "tsconfig.json"), "utf8"));

  assert.equal(manifest.exports["./typescript/base"], "./typescript/base.json");
  assert.equal(sharedTsconfig.compilerOptions.strict, true);
  assert.equal(rootTsconfig.extends, "./packages/config/typescript/base.json");
});

test("app environment examples exist for api, web, and mobile", async () => {
  const expectedExamples = [
    ["apps/api/.env.example", ["DATABASE_URL", "REDIS_URL", "PORT", "NODE_ENV"]],
    ["apps/web/.env.example", ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_APP_URL"]],
    [
      "apps/mobile/.env.example",
      ["EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"]
    ]
  ];

  for (const [relativePath, expectedKeys] of expectedExamples) {
    const fileContents = await readFile(path.join(rootDir, relativePath), "utf8");

    for (const key of expectedKeys) {
      assert.match(fileContents, new RegExp(`^${key}=`, "m"));
    }
  }
});
