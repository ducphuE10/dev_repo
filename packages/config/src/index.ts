import type { EnvironmentContract, EnvironmentVariableSpec, ParsedEnvironment } from "@dupe-hunt/types";

const apiEnvironmentVariables = [
  {
    key: "DATABASE_URL",
    required: true,
    description: "PostgreSQL connection string for the API.",
    example: "postgresql://postgres:postgres@localhost:5432/dupe_hunt"
  },
  {
    key: "REDIS_URL",
    required: true,
    description: "Redis connection string for queues and cache.",
    example: "redis://localhost:6379"
  },
  {
    key: "SUPABASE_URL",
    required: true,
    description: "Supabase project URL used by the API.",
    example: "https://your-project.supabase.co"
  },
  {
    key: "SUPABASE_SERVICE_KEY",
    required: true,
    description: "Supabase service role key for privileged backend operations.",
    example: "super-secret-service-role-key"
  },
  {
    key: "JWT_SECRET",
    required: true,
    description: "Signing secret for API-issued JWTs.",
    example: "replace-with-a-long-random-string"
  },
  {
    key: "CLOUDFLARE_R2_ACCOUNT_ID",
    required: true,
    description: "Cloudflare R2 account identifier.",
    example: "account-id"
  },
  {
    key: "CLOUDFLARE_R2_ACCESS_KEY",
    required: true,
    description: "Cloudflare R2 access key.",
    example: "access-key"
  },
  {
    key: "CLOUDFLARE_R2_SECRET_KEY",
    required: true,
    description: "Cloudflare R2 secret key.",
    example: "secret-key"
  },
  {
    key: "CLOUDFLARE_R2_BUCKET",
    required: true,
    description: "Cloudflare R2 bucket for private and public media assets.",
    example: "dupe-hunt-media"
  },
  {
    key: "TYPESENSE_HOST",
    required: true,
    description: "Typesense host URL.",
    example: "http://localhost:8108"
  },
  {
    key: "TYPESENSE_API_KEY",
    required: true,
    description: "Typesense admin API key.",
    example: "typesense-api-key"
  },
  {
    key: "AFFILIATE_WRAPPING_DOMAIN",
    required: true,
    description: "Redirect host used to wrap affiliate links.",
    example: "https://go.dupehunt.com"
  },
  {
    key: "OCR_SERVICE_KEY",
    required: true,
    description: "Key for the receipt OCR provider.",
    example: "ocr-service-key"
  },
  {
    key: "PORT",
    required: true,
    description: "Port the Fastify API binds to.",
    example: "3001"
  },
  {
    key: "NODE_ENV",
    required: true,
    description: "Runtime environment name.",
    example: "development"
  }
] as const satisfies readonly EnvironmentVariableSpec[];

const webEnvironmentVariables = [
  {
    key: "NEXT_PUBLIC_API_URL",
    required: true,
    description: "Public API base URL used by the browse web app.",
    example: "http://localhost:3001"
  },
  {
    key: "NEXT_PUBLIC_APP_URL",
    required: true,
    description: "Canonical public URL for the web app.",
    example: "http://localhost:3000"
  }
] as const satisfies readonly EnvironmentVariableSpec[];

const mobileEnvironmentVariables = [
  {
    key: "EXPO_PUBLIC_API_URL",
    required: true,
    description: "Public API base URL used by the Expo mobile app.",
    example: "http://localhost:3001"
  },
  {
    key: "EXPO_PUBLIC_SUPABASE_URL",
    required: true,
    description: "Supabase project URL exposed to the Expo app.",
    example: "https://your-project.supabase.co"
  },
  {
    key: "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    description: "Supabase anonymous key exposed to the Expo app.",
    example: "public-anon-key"
  }
] as const satisfies readonly EnvironmentVariableSpec[];

const createEnvironmentContract = <const TVariables extends readonly EnvironmentVariableSpec[]>(
  app: EnvironmentContract<TVariables>["app"],
  variables: TVariables
): EnvironmentContract<TVariables> => ({
  app,
  envFile: ".env",
  exampleFile: ".env.example",
  variables
});

export const apiEnvironmentContract = createEnvironmentContract("api", apiEnvironmentVariables);
export const webEnvironmentContract = createEnvironmentContract("web", webEnvironmentVariables);
export const mobileEnvironmentContract = createEnvironmentContract("mobile", mobileEnvironmentVariables);

export const environmentContracts = {
  api: apiEnvironmentContract,
  web: webEnvironmentContract,
  mobile: mobileEnvironmentContract
} as const;

export const sharedTypeScriptConfig = {
  base: "./typescript/base.json"
} as const;

export const sharedConfigPackage = {
  name: "@dupe-hunt/config",
  purpose: "shared workspace configuration"
} as const;

type EnvironmentSource = Partial<Record<string, string | undefined>>;

export const getMissingEnvironmentVariables = <TContract extends EnvironmentContract>(
  contract: TContract,
  source: EnvironmentSource
): Array<TContract["variables"][number]["key"]> =>
  contract.variables
    .filter((variable) => variable.required && !source[variable.key])
    .map((variable) => variable.key);

export const parseEnvironment = <TContract extends EnvironmentContract>(
  contract: TContract,
  source: EnvironmentSource
): ParsedEnvironment<TContract> => {
  const missingVariables = getMissingEnvironmentVariables(contract, source);

  if (missingVariables.length > 0) {
    throw new Error(`Missing environment variables for ${contract.app}: ${missingVariables.join(", ")}`);
  }

  return Object.fromEntries(
    contract.variables.map((variable) => [variable.key, source[variable.key] ?? ""])
  ) as ParsedEnvironment<TContract>;
};
