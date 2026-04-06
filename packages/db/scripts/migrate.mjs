#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const rootDir = path.resolve(packageDir, "..", "..");
const migrationsDir = path.join(packageDir, "migrations");
const migrationTableName = "schema_migrations";

const readEnvFile = async (filePath) => {
  try {
    const raw = await readFile(filePath, "utf8");

    return Object.fromEntries(
      raw
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#"))
        .map((line) => {
          const separatorIndex = line.indexOf("=");
          const key = line.slice(0, separatorIndex);
          const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/gu, "");

          return [key, value];
        })
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
};

const collectEnvironment = async () => {
  const rootEnv = await readEnvFile(path.join(rootDir, ".env"));
  const apiEnv = await readEnvFile(path.join(rootDir, "apps/api/.env"));

  return {
    ...rootEnv,
    ...apiEnv,
    ...process.env
  };
};

const ensureMigrationTable = async (sql) => {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS ${migrationTableName} (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

const getMigrationFiles = async () => {
  const fileNames = await readdir(migrationsDir);

  return fileNames.filter((fileName) => /^\d+_.+\.sql$/u.test(fileName)).sort((left, right) => left.localeCompare(right));
};

const run = async () => {
  const env = await collectEnvironment();
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Set it in apps/api/.env, .env, or the current shell.");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    await ensureMigrationTable(sql);

    const appliedRows = await sql`SELECT filename FROM schema_migrations ORDER BY filename ASC;`;
    const appliedFiles = new Set(appliedRows.map((row) => row.filename));
    const migrationFiles = await getMigrationFiles();

    for (const fileName of migrationFiles) {
      if (appliedFiles.has(fileName)) {
        continue;
      }

      const filePath = path.join(migrationsDir, fileName);
      const migrationSql = await readFile(filePath, "utf8");

      await sql.begin(async (tx) => {
        await tx.unsafe(migrationSql);
        await tx`INSERT INTO schema_migrations ${tx({ filename: fileName })};`;
      });

      console.log(`Applied migration ${fileName}`);
    }

    console.log(`Database migrations are up to date (${migrationFiles.length} files checked).`);
  } finally {
    await sql.end({ timeout: 5 });
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
