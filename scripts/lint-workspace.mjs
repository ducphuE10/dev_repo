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

const requiredApiArtifacts = [
  "apps/api/src/app.ts",
  "apps/api/src/config.ts",
  "apps/api/src/server.ts",
  "apps/api/src/app.test.ts"
];

for (const relativePath of requiredApiArtifacts) {
  await readFile(path.join(rootDir, relativePath), "utf8");
}

const requiredMobileArtifacts = [
  "apps/mobile/app.json",
  "apps/mobile/tsconfig.json",
  "apps/mobile/App.tsx",
  "apps/mobile/src/providers/AppProviders.tsx",
  "apps/mobile/src/auth/AuthSessionProvider.tsx",
  "apps/mobile/src/navigation/index.tsx",
  "apps/mobile/src/components/PrimaryButton.tsx",
  "apps/mobile/src/components/ScreenFrame.tsx",
  "apps/mobile/src/hooks/useApiClient.ts",
  "apps/mobile/src/hooks/useCategoryOptionsQuery.ts",
  "apps/mobile/src/hooks/useFeedPreviewQuery.ts",
  "apps/mobile/src/hooks/usePostComposer.ts",
  "apps/mobile/src/hooks/useProfileQueries.ts",
  "apps/mobile/src/hooks/useSocialActions.ts",
  "apps/mobile/src/lib/api.ts",
  "apps/mobile/src/screens/AuthScreens.tsx",
  "apps/mobile/src/screens/OnboardingScreens.tsx",
  "apps/mobile/src/screens/MainScreens.tsx"
];

for (const relativePath of requiredMobileArtifacts) {
  await readFile(path.join(rootDir, relativePath), "utf8");
}

const requiredDatabaseArtifacts = [
  "docker-compose.yml",
  "packages/db/scripts/migrate.mjs",
  "packages/db/src/schema.ts",
  "packages/db/src/client.ts",
  "packages/db/migrations/001_enable_pgcrypto_and_create_users.sql",
  "packages/db/migrations/002_create_categories.sql",
  "packages/db/migrations/003_create_posts.sql",
  "packages/db/migrations/004_create_upvotes_downvotes.sql",
  "packages/db/migrations/005_create_flags.sql",
  "packages/db/migrations/006_create_saves.sql",
  "packages/db/migrations/007_create_follows.sql",
  "packages/db/migrations/008_create_user_categories.sql",
  "packages/db/migrations/009_create_affiliate_clicks.sql"
];

for (const relativePath of requiredDatabaseArtifacts) {
  await readFile(path.join(rootDir, relativePath), "utf8");
}

console.log(
  `Workspace lint passed for ${expectedWorkspaces.length} packages, ${envExamplePaths.length} env examples, ${requiredApiArtifacts.length} API artifacts, ${requiredMobileArtifacts.length} mobile artifacts, and ${requiredDatabaseArtifacts.length} database artifacts.`
);
