import fastify, { type FastifyInstance, type FastifyReply } from "fastify";

import { createDatabaseClient, type DatabaseClient } from "@dupe-hunt/db";

import { loadApiConfig, type ApiConfig } from "./config.ts";

export interface RedisClient {
  url: string;
  ping: () => Promise<"PONG">;
  close: () => Promise<void>;
}

export interface BuildApiServerOptions {
  config?: ApiConfig;
  database?: DatabaseClient;
  redis?: RedisClient;
  logger?: boolean;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const createRedisClient = (url: string): RedisClient => ({
  url,
  ping: async () => "PONG",
  close: async () => undefined
});

declare module "fastify" {
  interface FastifyInstance {
    config: ApiConfig;
    database: DatabaseClient;
    redis: RedisClient;
  }
}

const sendErrorResponse = (reply: FastifyReply, statusCode: number, code: string, message: string) =>
  reply.status(statusCode).send({
    error: {
      code,
      message
    }
  });

const getErrorPayload = (error: Error & { statusCode?: number; validation?: unknown }) => {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode
    };
  }

  if (error.validation) {
    return {
      code: "VALIDATION_ERROR",
      message: error.message,
      statusCode: 400
    };
  }

  return {
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
    statusCode: error.statusCode && error.statusCode >= 400 ? error.statusCode : 500
  };
};

const registerHealthRoute = (app: FastifyInstance) => {
  app.get("/health", async () => ({
    status: "ok",
    service: "@dupe-hunt/api",
    environment: app.config.nodeEnv,
    dependencies: {
      database: "configured",
      redis: "configured"
    }
  }));
};

export const buildApiServer = (options: BuildApiServerOptions = {}): FastifyInstance => {
  const config = options.config ?? loadApiConfig();
  const database = options.database ?? createDatabaseClient(config.databaseUrl, { max: 1 });
  const redis = options.redis ?? createRedisClient(config.redisUrl);
  const app = fastify({
    logger: options.logger ?? false
  });
  const ownsDatabase = !options.database;
  const ownsRedis = !options.redis;

  app.decorate("config", config);
  app.decorate("database", database);
  app.decorate("redis", redis);

  app.setNotFoundHandler((request, reply) =>
    sendErrorResponse(reply, 404, "NOT_FOUND", `Route ${request.method}:${request.url} not found`)
  );

  app.setErrorHandler((error: Error & { statusCode?: number; validation?: unknown }, _request, reply) => {
    const payload = getErrorPayload(error);

    if (payload.statusCode >= 500) {
      app.log.error(error);
    }

    return sendErrorResponse(reply, payload.statusCode, payload.code, payload.message);
  });

  registerHealthRoute(app);

  app.addHook("onClose", async () => {
    if (ownsRedis) {
      await redis.close();
    }

    if (ownsDatabase) {
      await database.close();
    }
  });

  return app;
};
