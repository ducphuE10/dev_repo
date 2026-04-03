export const apiWorkspace = {
  name: "@dupe-hunt/api",
  runtime: "fastify",
  status: "scaffolded"
} as const;

export * from "./app.ts";
export * from "./config.ts";
