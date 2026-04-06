export { mobileAppShell } from "./lib/api.ts";

export const mobileWorkspace = {
  name: "@dupe-hunt/mobile",
  framework: "expo",
  status: "scaffolded",
  navigationEntry: "./src/navigation/index.tsx"
} as const;
