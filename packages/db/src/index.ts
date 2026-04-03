export const dbWorkspace = {
  name: "@dupe-hunt/db",
  purpose: "schema and migration workspace"
} as const;

export * from "./client.js";
export * from "./schema.js";
