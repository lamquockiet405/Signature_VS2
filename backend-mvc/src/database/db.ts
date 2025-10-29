/**
 * Kysely Database Connection
 * Central database instance using Kysely SQL builder
 * NO pg.Pool - Pure Kysely implementation
 */

import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './types';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Kysely database instance with PostgresDialect
 * PostgresDialect creates and manages its own internal pool
 * No need to manually manage Pool anymore
 */
// Allow DATABASE_URL (postgres://user:pass@host:port/db) or individual vars
const connectionFromUrl = (() => {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: parseInt(u.port || '5432'),
      database: decodeURIComponent(u.pathname.replace(/^\//, '')),
      user: decodeURIComponent(u.username || 'postgres'),
      password: decodeURIComponent(u.password || '123456'),
    };
  } catch {
    return undefined;
  }
})();

// Support both DB_* and DATABASE_* aliases for convenience
const hostEnv =
  connectionFromUrl?.host ||
  process.env.DB_HOST ||
  process.env.DATABASE_HOST ||
  'localhost';
const portEnv =
  connectionFromUrl?.port ||
  process.env.DB_PORT ||
  process.env.DATABASE_PORT ||
  '5432';
const dbNameEnv =
  connectionFromUrl?.database ||
  process.env.DB_NAME ||
  process.env.DATABASE_NAME ||
  'signature_db';
const userEnv =
  connectionFromUrl?.user ||
  process.env.DB_USER ||
  process.env.DATABASE_USER ||
  'postgres';
const passwordEnv =
  connectionFromUrl?.password ||
  process.env.DB_PASSWORD ||
  process.env.DATABASE_PASSWORD ||
  '123456';

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({
      host: hostEnv,
      port: parseInt(String(portEnv)),
      database: dbNameEnv,
      user: userEnv,
      password: passwordEnv,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }),
  }),
});

/**
 * Gracefully close database connections
 * Kysely will handle pool cleanup automatically
 */
export async function closeDatabase(): Promise<void> {
  await db.destroy();
  console.log('🔌 Kysely database connections closed');
}

/**
 * Health check for database connection
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.selectFrom('users').select('id').limit(1).execute();
    console.log('✅ Kysely database health check passed');
    return true;
  } catch (error) {
    console.error('❌ Kysely database health check failed:', error);
    return false;
  }
}

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// SELECT examples:
const users = await db.selectFrom('users').selectAll().execute();
const user = await db.selectFrom('users').where('id', '=', userId).selectAll().executeTakeFirst();

// SELECT with JOIN:
const usersWithRoles = await db
  .selectFrom('users')
  .leftJoin('roles', 'users.role_id', 'roles.id')
  .select(['users.id', 'users.username', 'roles.name as role_name'])
  .execute();

// INSERT:
const newUser = await db
  .insertInto('users')
  .values({
    username: 'john_doe',
    email: 'john@example.com',
    password_hash: 'hashed_password',
    status: 'active'
  })
  .returningAll()
  .executeTakeFirstOrThrow();

// UPDATE:
const updated = await db
  .updateTable('users')
  .set({ status: 'inactive' })
  .where('id', '=', userId)
  .returningAll()
  .executeTakeFirst();

// DELETE:
const deleted = await db
  .deleteFrom('users')
  .where('id', '=', userId)
  .returningAll()
  .executeTakeFirst();

// TRANSACTION:
await db.transaction().execute(async (trx) => {
  await trx.insertInto('users').values(userData).execute();
  await trx.insertInto('role_permissions').values(permissions).execute();
});

// COUNT:
const count = await db
  .selectFrom('users')
  .select(db.fn.count<number>('id').as('count'))
  .executeTakeFirst();
*/
