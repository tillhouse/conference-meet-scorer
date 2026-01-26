import path from "node:path";
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
  migrate: {
    adapter: async () => {
      const { PrismaBetterSQLite3 } = await import("@prisma/adapter-better-sqlite3");
      return new PrismaBetterSQLite3({
        url: process.env.DATABASE_URL ?? "file:./dev.db",
      });
    },
  },
});
