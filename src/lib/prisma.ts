import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Get DATABASE_URL from environment
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  
  // Extract the file path from "file:./dev.db" format
  let filePath = databaseUrl;
  if (databaseUrl.startsWith("file:")) {
    filePath = databaseUrl.slice(5); // Remove "file:" prefix
  }
  
  // Resolve to absolute path
  const path = require("path");
  const absolutePath = path.isAbsolute(filePath) 
    ? filePath 
    : path.resolve(process.cwd(), filePath);
  
  // Create SQLite database connection
  const sqlite = new Database(absolutePath);
  const adapter = new PrismaBetterSqlite3(sqlite);
  
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
