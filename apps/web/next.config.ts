import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@dupe-hunt/config", "@dupe-hunt/types"],
  outputFileTracingRoot: rootDir
};

export default nextConfig;
