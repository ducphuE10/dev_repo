#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const expectedWorkspaces = [
  ["apps/api", "@dupe-hunt/api"],
  ["apps/web", "@dupe-hunt/web"],
  ["apps/mobile", "@dupe-hunt/mobile"],
  ["packages/config", "@dupe-hunt/config"],
  ["packages/types", "@dupe-hunt/types"],
  ["packages/db", "@dupe-hunt/db"]
];

for (const [workspacePath, expectedName] of expectedWorkspaces) {
  const manifestPath = path.join(rootDir, workspacePath, "package.json");
  const sourcePath = path.join(rootDir, workspacePath, "src", "index.ts");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  if (manifest.name !== expectedName) {
    throw new Error(`${workspacePath} expected ${expectedName} but found ${manifest.name ?? "missing name"}`);
  }

  await readFile(sourcePath, "utf8");
}

const envExamplePaths = ["apps/api/.env.example", "apps/web/.env.example", "apps/mobile/.env.example"];

for (const relativePath of envExamplePaths) {
  await readFile(path.join(rootDir, relativePath), "utf8");
}

console.log(
  `Workspace lint passed for ${expectedWorkspaces.length} packages and ${envExamplePaths.length} env examples.`
);
