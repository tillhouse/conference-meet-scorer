import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import { existsSync } from "fs";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabasePath(): string {
  let databaseUrl = process.env.DATABASE_URL;
  
  // Default to dev.db in project root if not set
  if (!databaseUrl) {
    databaseUrl = "file:./dev.db";
  }
  
  // Ensure it's a string
  if (typeof databaseUrl !== "string") {
    databaseUrl = "file:./dev.db";
  }
  
  // Remove "file:" prefix if present
  let filePath: string;
  if (databaseUrl.startsWith("file:")) {
    filePath = databaseUrl.replace("file:", "");
  } else {
    filePath = databaseUrl;
  }
  
  // If it's a relative path, resolve it relative to the project root
  if (filePath.startsWith("./") || (!path.isAbsolute(filePath) && !filePath.startsWith("/"))) {
    const resolvedPath = path.join(process.cwd(), filePath.replace(/^\.\//, ""));
    return resolvedPath;
  }
  
  return filePath;
}

let prisma: PrismaClient;

try {
  const dbPath = getDatabasePath();
  const sqlite = new Database(dbPath);
  const adapter = new PrismaBetterSqlite3(sqlite);
  
  prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
  
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
  }
} catch (error) {
  console.error("Failed to initialize Prisma client:", error);
  throw error;
}

export { prisma };
export default prisma;
