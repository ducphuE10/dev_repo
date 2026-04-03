#!/usr/bin/env node

const label = process.argv[2] ?? "workspace";

console.log(`[${label}] scaffold ready`);
console.log(`[${label}] waiting for framework implementation`);

const shutdown = (signal) => {
  console.log(`[${label}] received ${signal}, stopping`);
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

setInterval(() => {}, 60_000);
