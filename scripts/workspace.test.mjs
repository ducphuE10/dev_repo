import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("root package exposes runnable workspace commands", async () => {
  const packageJson = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));

  assert.equal(packageJson.scripts.dev.includes("turbo run dev"), true);
  assert.equal(packageJson.scripts["db:migrate"], "pnpm --filter @dupe-hunt/db migrate");
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

test("api workspace exposes a runnable Fastify scaffold", async () => {
  const manifest = JSON.parse(await readFile(path.join(rootDir, "apps/api/package.json"), "utf8"));
  const appSource = await readFile(path.join(rootDir, "apps/api/src/app.ts"), "utf8");
  const serverSource = await readFile(path.join(rootDir, "apps/api/src/server.ts"), "utf8");
  const testSource = await readFile(path.join(rootDir, "apps/api/src/app.test.ts"), "utf8");

  assert.equal(manifest.scripts.dev, "node --watch ./src/server.ts");
  assert.equal(manifest.scripts.start, "node ./src/server.ts");
  assert.equal(manifest.scripts.test, "node --test ./src/*.test.ts");
  assert.equal(manifest.dependencies.fastify, "^5.6.1");
  assert.match(appSource, /app\.get\("\/health"/);
  assert.match(appSource, /app\.decorate\("database"/);
  assert.match(appSource, /app\.decorate\("redis"/);
  assert.match(serverSource, /await app\.listen/);
  assert.match(testSource, /buildApiServer/);
});

test("mobile workspace exposes an Expo shell with centralized navigation and session plumbing", async () => {
  const manifest = JSON.parse(await readFile(path.join(rootDir, "apps/mobile/package.json"), "utf8"));
  const appJson = JSON.parse(await readFile(path.join(rootDir, "apps/mobile/app.json"), "utf8"));
  const appSource = await readFile(path.join(rootDir, "apps/mobile/App.tsx"), "utf8");
  const navigationSource = await readFile(path.join(rootDir, "apps/mobile/src/navigation/index.tsx"), "utf8");
  const authSource = await readFile(path.join(rootDir, "apps/mobile/src/auth/AuthSessionProvider.tsx"), "utf8");
  const apiSource = await readFile(path.join(rootDir, "apps/mobile/src/lib/api.ts"), "utf8");
  const mainScreensSource = await readFile(path.join(rootDir, "apps/mobile/src/screens/MainScreens.tsx"), "utf8");
  const profileHooksSource = await readFile(path.join(rootDir, "apps/mobile/src/hooks/useProfileQueries.ts"), "utf8");
  const socialHooksSource = await readFile(path.join(rootDir, "apps/mobile/src/hooks/useSocialActions.ts"), "utf8");
  const composerHooksSource = await readFile(path.join(rootDir, "apps/mobile/src/hooks/usePostComposer.ts"), "utf8");

  assert.equal(manifest.main, "expo/AppEntry");
  assert.equal(manifest.scripts.dev, "expo start --clear");
  assert.equal(manifest.dependencies.expo, "^55.0.11");
  assert.equal(manifest.dependencies["@tanstack/react-query"], "^5.96.2");
  assert.equal(appJson.expo.slug, "dupe-hunt");
  assert.match(appSource, /GestureHandlerRootView/);
  assert.match(navigationSource, /createBottomTabNavigator/);
  assert.match(navigationSource, /createNativeStackNavigator/);
  assert.match(authSource, /expo-secure-store/);
  assert.match(authSource, /dupe-hunt\.mobile\.session/);
  assert.match(apiSource, /parseEnvironment\(mobileEnvironmentContract/);
  assert.match(apiSource, /\/auth\/login/);
  assert.match(apiSource, /\/upload\/media/);
  assert.match(apiSource, /\/posts\/\$?\{?postId?\}?\/save/);
  assert.match(navigationSource, /PostStack/);
  assert.match(navigationSource, /ProfileStack/);
  assert.match(navigationSource, /SavedCollection/);
  assert.match(mainScreensSource, /PostFormatScreen/);
  assert.match(mainScreensSource, /EditProfileScreen/);
  assert.match(mainScreensSource, /PublicProfileScreen/);
  assert.match(mainScreensSource, /FlatList/);
  assert.match(profileHooksSource, /useSavedPostsQuery/);
  assert.match(socialHooksSource, /viewer-interactions/);
  assert.match(composerHooksSource, /requestMediaUpload/);
});

test("database workspace exposes drizzle schema and migration workflow", async () => {
  const manifest = JSON.parse(await readFile(path.join(rootDir, "packages/db/package.json"), "utf8"));
  const schemaSource = await readFile(path.join(rootDir, "packages/db/src/schema.ts"), "utf8");
  const clientSource = await readFile(path.join(rootDir, "packages/db/src/client.ts"), "utf8");
  const migrateScript = await readFile(path.join(rootDir, "packages/db/scripts/migrate.mjs"), "utf8");

  assert.equal(manifest.scripts.migrate, "node ./scripts/migrate.mjs");
  assert.equal(manifest.dependencies["drizzle-orm"], "^0.45.2");
  assert.equal(manifest.dependencies.postgres, "^3.4.8");
  assert.match(schemaSource, /export const users = pgTable\("users"/);
  assert.match(schemaSource, /export const affiliateClicks = pgTable\(/);
  assert.match(clientSource, /createDatabaseClient/);
  assert.match(migrateScript, /schema_migrations/);
});

test("database migrations remain sequential and cover the MVP tables", async () => {
  const migrationFiles = [
    "001_enable_pgcrypto_and_create_users.sql",
    "002_create_categories.sql",
    "003_create_posts.sql",
    "004_create_upvotes_downvotes.sql",
    "005_create_flags.sql",
    "006_create_saves.sql",
    "007_create_follows.sql",
    "008_create_user_categories.sql",
    "009_create_affiliate_clicks.sql"
  ];

  for (const fileName of migrationFiles) {
    const contents = await readFile(path.join(rootDir, "packages/db/migrations", fileName), "utf8");

    assert.equal(contents.length > 0, true);
  }
});

test("local infrastructure config provisions postgres and redis", async () => {
  const composeFile = await readFile(path.join(rootDir, "docker-compose.yml"), "utf8");

  assert.match(composeFile, /^services:/m);
  assert.match(composeFile, /^  postgres:/m);
  assert.match(composeFile, /^  redis:/m);
});
