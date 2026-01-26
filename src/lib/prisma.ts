import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabasePath(): string {
  // Get DATABASE_URL from environment, default to dev.db
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  
  // Extract file path from "file:./dev.db" format
  let filePath = databaseUrl;
  if (databaseUrl.startsWith("file:")) {
    filePath = databaseUrl.substring(5); // Remove "file:" prefix
  }
  
  // Resolve to absolute path
  if (filePath.startsWith("./") || filePath.startsWith("../") || (!path.isAbsolute(filePath) && !filePath.startsWith("/"))) {
    return path.resolve(process.cwd(), filePath);
  }
  
  return filePath;
}

let prisma: PrismaClient;

if (globalForPrisma.prisma) {
  prisma = globalForPrisma.prisma;
} else {
  try {
    const dbPath = getDatabasePath();
    const sqlite = new Database(dbPath);
    const adapter = new PrismaBetterSqlite3(sqlite);
    prisma = new PrismaClient({ adapter });
    
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = prisma;
    }
  } catch (error) {
    console.error("Failed to initialize Prisma client:", error);
    throw new Error(`Failed to initialize Prisma: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export { prisma };
export default prisma;
