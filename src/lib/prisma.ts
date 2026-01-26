import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabasePath(): string {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  
  // Remove "file:" prefix if present
  if (databaseUrl.startsWith("file:")) {
    const filePath = databaseUrl.replace("file:", "");
    // If it's a relative path, resolve it relative to the project root
    if (filePath.startsWith("./") || !path.isAbsolute(filePath)) {
      return path.join(process.cwd(), filePath.replace("./", ""));
    }
    return filePath;
  }
  
  return databaseUrl;
}

const sqlite = new Database(getDatabasePath());
const adapter = new PrismaBetterSqlite3(sqlite);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
