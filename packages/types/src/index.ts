export type WorkspaceStatus = "scaffolded";

export type WorkspaceAppName = "api" | "web" | "mobile";

export type WorkspacePackageName =
  | "@dupe-hunt/api"
  | "@dupe-hunt/web"
  | "@dupe-hunt/mobile"
  | "@dupe-hunt/config"
  | "@dupe-hunt/types"
  | "@dupe-hunt/db";

export type NodeEnvironment = "development" | "test" | "production";

export interface WorkspaceDescriptor {
  name: WorkspacePackageName;
  status: WorkspaceStatus;
}

export interface EnvironmentVariableSpec {
  key: string;
  required: boolean;
  description: string;
  example: string;
}

export interface EnvironmentContract<
  TVariables extends readonly EnvironmentVariableSpec[] = readonly EnvironmentVariableSpec[]
> {
  app: WorkspaceAppName;
  envFile: ".env";
  exampleFile: ".env.example";
  variables: TVariables;
}

export type ParsedEnvironment<TContract extends EnvironmentContract> = {
  [TKey in TContract["variables"][number]["key"]]: string;
};

export const workspacePackageNames = {
  api: "@dupe-hunt/api",
  web: "@dupe-hunt/web",
  mobile: "@dupe-hunt/mobile",
  config: "@dupe-hunt/config",
  types: "@dupe-hunt/types",
  db: "@dupe-hunt/db"
} as const;
