import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Options, type Sql } from "postgres";

import { schema } from "./schema.ts";

export type DupeHuntDatabase = PostgresJsDatabase<typeof schema>;

export interface DatabaseClient {
  db: DupeHuntDatabase;
  sql: Sql;
  close: () => Promise<void>;
}

export const createDatabaseClient = (
  connectionString: string,
  options: Options<Record<string, postgres.PostgresType>> = {}
): DatabaseClient => {
  const sql = postgres(connectionString, options);

  return {
    db: drizzle(sql, { schema }),
    sql,
    close: async () => {
      await sql.end({ timeout: 5 });
    }
  };
};
