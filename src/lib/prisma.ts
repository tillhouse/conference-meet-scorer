import { PrismaClient } from "@prisma/client";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Resolve database URL to absolute path if it's a relative SQLite path
function resolveDatabaseUrl() {
  let dbUrl = process.env.DATABASE_URL || "";
  
  // Remove quotes if present
  dbUrl = dbUrl.replace(/^["']|["']$/g, "");
  
  // If it's a relative SQLite path, resolve it to absolute
  if (dbUrl.startsWith("file:./") || dbUrl.startsWith("file:../") || dbUrl.startsWith("./") || dbUrl.startsWith("../")) {
    // Remove 'file:' prefix if present
    const cleanPath = dbUrl.replace(/^file:/, "");
    
    // Get the project root (where package.json is)
    const projectRoot = process.cwd();
    const absolutePath = path.resolve(projectRoot, cleanPath);
    
    // Convert to forward slashes for SQLite URI format
    const normalizedPath = absolutePath.replace(/\\/g, "/");
    
    // Use file:/// format for Windows absolute paths
    const finalUrl = `file:${normalizedPath}`;
    
    console.log("[Prisma] Resolved database URL:", finalUrl);
    return finalUrl;
  }
  
  console.log("[Prisma] Using database URL as-is:", dbUrl);
  return dbUrl;
}

const databaseUrl = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn", "query"] : ["error"],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
