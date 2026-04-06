import { pathToFileURL } from "node:url";

import { buildApiServer } from "./app.ts";

export const startApiServer = async () => {
  const app = buildApiServer({
    logger: process.env.NODE_ENV !== "test"
  });

  const closeServer = async (signal: string) => {
    app.log.info({ signal }, "Shutting down API server.");
    await app.close();
  };

  process.once("SIGINT", () => {
    void closeServer("SIGINT");
  });

  process.once("SIGTERM", () => {
    void closeServer("SIGTERM");
  });

  try {
    await app.listen({
      host: "0.0.0.0",
      port: app.config.port
    });
  } catch (error) {
    app.log.error(error);
    await app.close();
    throw error;
  }

  return app;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startApiServer();
}
