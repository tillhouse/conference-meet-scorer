import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabasePath(): string {
  // Safely get DATABASE_URL with multiple fallbacks
  let databaseUrl: string;
  
  if (typeof process !== "undefined" && process.env && process.env.DATABASE_URL) {
    databaseUrl = String(process.env.DATABASE_URL);
  } else {
    databaseUrl = "file:./dev.db";
  }
  
  // Ensure we have a valid string
  if (!databaseUrl || typeof databaseUrl !== "string") {
    databaseUrl = "file:./dev.db";
  }
  
  // Extract file path from "file:./dev.db" format
  let filePath: string;
  if (databaseUrl.startsWith("file:")) {
    filePath = databaseUrl.substring(5); // Remove "file:" prefix (5 characters)
  } else {
    filePath = databaseUrl;
  }
  
  // Ensure filePath is a valid string
  if (!filePath || typeof filePath !== "string") {
    filePath = "./dev.db";
  }
  
  // Remove leading "./" if present
  if (filePath.startsWith("./")) {
    filePath = filePath.substring(2);
  }
  
  // Resolve to absolute path
  if (!path.isAbsolute(filePath)) {
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to initialize Prisma: ${errorMessage}`);
  }
}

export { prisma };
export default prisma;
