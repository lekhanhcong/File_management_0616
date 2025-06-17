import { drizzle } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import Database from 'better-sqlite3';
import ws from "ws";
import {
  users,
  files,
  projects,
  organizations,
  fileVersions,
  filePermissions,
  auditLogs,
  shareLinks
} from "../shared/schema.sqlite";

// Configure Neon for WebSocket (only for Neon cloud)
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to create a .env file?",
  );
}

const isSQLite = process.env.DATABASE_URL.startsWith('sqlite:');
const isNeonCloud = process.env.DATABASE_URL.includes('neon.tech');

// Create appropriate database connection
export const db = (() => {
  if (isSQLite) {
    // SQLite for local development
    const dbPath = process.env.DATABASE_URL.replace('sqlite:', '');
    const sqlite = new Database(dbPath);
    
    // Enable foreign keys for SQLite
    sqlite.pragma('foreign_keys = ON');
    
    return drizzle(sqlite, { schema: { users, files, projects, organizations, fileVersions, filePermissions, auditLogs, shareLinks } });
  } else if (isNeonCloud) {
    // Neon serverless for production
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return drizzleNeon({ client: pool });
  } else {
    // Regular PostgreSQL for local development
    const pool = new PgPool({ connectionString: process.env.DATABASE_URL });
    return drizzlePg(pool);
  }
})();

// Export pool for session store (only for PostgreSQL)
export const pool = !isSQLite ? (isNeonCloud ? new Pool({ connectionString: process.env.DATABASE_URL }) : new PgPool({ connectionString: process.env.DATABASE_URL })) : null;
