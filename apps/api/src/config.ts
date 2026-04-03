import { apiEnvironmentContract, parseEnvironment } from "@dupe-hunt/config";
import type { NodeEnvironment } from "@dupe-hunt/types";

const nodeEnvironmentValues = new Set<NodeEnvironment>(["development", "test", "production"]);

export interface ApiConfig {
  databaseUrl: string;
  redisUrl: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  jwtSecret: string;
  cloudflareR2AccountId: string;
  cloudflareR2AccessKey: string;
  cloudflareR2SecretKey: string;
  cloudflareR2Bucket: string;
  typesenseHost: string;
  typesenseApiKey: string;
  affiliateWrappingDomain: string;
  ocrServiceKey: string;
  port: number;
  nodeEnv: NodeEnvironment;
}

type EnvironmentSource = Partial<Record<string, string | undefined>>;

const requireValidUrl = (value: string, key: string): string => {
  try {
    new URL(value);
  } catch {
    throw new Error(`Invalid ${key}: expected an absolute URL.`);
  }

  return value;
};

const requirePort = (value: string): number => {
  const port = Number.parseInt(value, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Invalid PORT: expected an integer between 1 and 65535.");
  }

  return port;
};

const requireNodeEnv = (value: string): NodeEnvironment => {
  if (!nodeEnvironmentValues.has(value as NodeEnvironment)) {
    throw new Error(`Invalid NODE_ENV: expected one of ${Array.from(nodeEnvironmentValues).join(", ")}.`);
  }

  return value as NodeEnvironment;
};

export const loadApiConfig = (source: EnvironmentSource = process.env): ApiConfig => {
  const environment = parseEnvironment(apiEnvironmentContract, source);

  return {
    databaseUrl: environment.DATABASE_URL,
    redisUrl: environment.REDIS_URL,
    supabaseUrl: requireValidUrl(environment.SUPABASE_URL, "SUPABASE_URL"),
    supabaseServiceKey: environment.SUPABASE_SERVICE_KEY,
    jwtSecret: environment.JWT_SECRET,
    cloudflareR2AccountId: environment.CLOUDFLARE_R2_ACCOUNT_ID,
    cloudflareR2AccessKey: environment.CLOUDFLARE_R2_ACCESS_KEY,
    cloudflareR2SecretKey: environment.CLOUDFLARE_R2_SECRET_KEY,
    cloudflareR2Bucket: environment.CLOUDFLARE_R2_BUCKET,
    typesenseHost: requireValidUrl(environment.TYPESENSE_HOST, "TYPESENSE_HOST"),
    typesenseApiKey: environment.TYPESENSE_API_KEY,
    affiliateWrappingDomain: requireValidUrl(environment.AFFILIATE_WRAPPING_DOMAIN, "AFFILIATE_WRAPPING_DOMAIN"),
    ocrServiceKey: environment.OCR_SERVICE_KEY,
    port: requirePort(environment.PORT),
    nodeEnv: requireNodeEnv(environment.NODE_ENV)
  };
};
