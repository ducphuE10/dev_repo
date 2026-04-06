export const apiWorkspace = {
  name: "@dupe-hunt/api",
  runtime: "fastify",
  status: "scaffolded"
} as const;

export * from "./app.ts";
export * from "./auth.ts";
export * from "./config.ts";
export * from "./repository.ts";
