import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { db, closeDatabase } from './db';
import { sql } from 'kysely';

/**
 * QueryResult type definition for backward compatibility
 * Mimics pg.QueryResult without importing from 'pg'
 */
export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  fields?: any[];
  oid?: number;
}

export type QueryResultRow = Record<string, any>;

/**
 * Database Service using Kysely
 * Provides backward-compatible query() method while using Kysely internally
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  /**
   * Get the Kysely database instance
   * Use this for type-safe queries
   */
  get kysely() {
    return db;
  }

  async onModuleInit() {
    console.log('🔄 DatabaseService initialized with Kysely');
  }

  async onModuleDestroy() {
    await closeDatabase();
  }

  /**
   * Execute raw SQL query (backward compatible)
   * @deprecated Use kysely() for type-safe queries instead
   *
   * @example
   * // Old way (still works):
   * const result = await this.databaseService.query('SELECT * FROM users WHERE id = $1', [userId]);
   *
   * // New way (type-safe):
   * const user = await this.databaseService.kysely
   *   .selectFrom('users')
   *   .where('id', '=', userId)
   *   .selectAll()
   *   .executeTakeFirst();
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      // Convert to Kysely raw SQL with parameter substitution
      let processedQuery = text;
      if (params && params.length > 0) {
        // Replace $1, $2, etc. with actual values for Kysely
        params.forEach((param, index) => {
          const placeholder = `$${index + 1}`;
          let value: string;

          if (param === null || param === undefined) {
            value = 'NULL';
          } else if (typeof param === 'string') {
            value = `'${param.replace(/'/g, "''")}'`;
          } else if (param instanceof Date) {
            value = `'${param.toISOString()}'`;
          } else if (Array.isArray(param)) {
            // Handle arrays for PostgreSQL
            // Convert to PostgreSQL array literal format: '{val1,val2}'
            if (param.length === 0) {
              value = "'{}'";
            } else {
              const arrayValues = param
                .map((item) => {
                  if (item === null || item === undefined) {
                    return 'NULL';
                  } else if (typeof item === 'string') {
                    // Escape special characters for PostgreSQL array literals
                    return item.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                  } else {
                    return String(item);
                  }
                })
                .join(',');
              value = `'{${arrayValues}}'`;
            }
          } else if (typeof param === 'object') {
            value = `'${JSON.stringify(param).replace(/'/g, "''")}'`;
          } else {
            value = String(param);
          }

          processedQuery = processedQuery.replace(placeholder, value);
        });
      }

      const kyselyQuery = sql.raw(processedQuery);
      const compiledQuery = kyselyQuery.compile(db);
      const result = await sql.raw(compiledQuery.sql).execute(db);

      const duration = Date.now() - start;

      console.log('executed query', {
        text: text.substring(0, 100),
        duration,
        rows: result.rows.length,
      });

      // Return in QueryResult format for backward compatibility
      return {
        rows: result.rows as T[],
        rowCount: result.rows.length,
        command: this.extractCommand(text),
        fields: [],
        oid: 0,
      };
    } catch (error) {
      console.error('Error executing query:', error);
      throw error;
    }
  }

  /**
   * Get a transaction-capable client
   * @deprecated Use kysely.transaction() instead
   *
   * Returns a pseudo-client for backward compatibility
   * All operations should migrate to kysely.transaction()
   */
  async getClient() {
    console.warn(
      '⚠️ getClient() is deprecated. Migrate to kysely.transaction()',
    );

    // Return a pseudo-client for backward compatibility
    const self = this;
    return {
      query: async <T extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[],
      ): Promise<QueryResult<T>> => {
        return self.query<T>(text, params);
      },
      release: () => {
        // No-op for backward compatibility
      },
    };
  }

  /**
   * Helper method to extract SQL command from query text
   */
  private extractCommand(text: string): string {
    const match = text.trim().match(/^(\w+)/i);
    return match ? match[1].toUpperCase() : 'UNKNOWN';
  }
}

/**
 * MIGRATION GUIDE
 * ===============
 *
 * Old (pg Pool):
 * ```typescript
 * const result = await this.db.query(
 *   'SELECT * FROM users WHERE email = $1',
 *   [email]
 * );
 * const user = result.rows[0];
 * ```
 *
 * New (Kysely):
 * ```typescript
 * const user = await this.db.kysely
 *   .selectFrom('users')
 *   .where('email', '=', email)
 *   .selectAll()
 *   .executeTakeFirst();
 * ```
 *
 * Benefits:
 * - ✅ Type-safe queries
 * - ✅ Auto-completion
 * - ✅ Compile-time error checking
 * - ✅ No SQL injection vulnerabilities
 * - ✅ Better refactoring support
 */
