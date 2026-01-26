import path from "node:path";
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
  migrate: {
    adapter: async () => {
      const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
      return new PrismaBetterSqlite3({
        url: process.env.DATABASE_URL ?? "file:./dev.db",
      });
    },
  },
});
