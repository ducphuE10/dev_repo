export const dbWorkspace = {
  name: "@dupe-hunt/db",
  purpose: "schema and migration workspace"
} as const;

export * from "./client.ts";
export * from "./schema.ts";
