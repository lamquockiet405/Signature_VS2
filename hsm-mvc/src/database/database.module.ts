import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from '../config/database.config';
import { Client } from 'pg';

async function ensureDatabaseExists(): Promise<void> {
  const url = process.env.DATABASE_URL;
  let host = process.env.DB_HOST || 'localhost';
  let port = parseInt(process.env.DB_PORT || '5433');
  let user = process.env.DB_USER || 'postgres';
  let password = process.env.DB_PASSWORD || '123456';
  let database = process.env.DB_NAME || 'postgres';

  if (url) {
    try {
      const u = new URL(url);
      host = u.hostname || host;
      port = parseInt(u.port || String(port));
      user = decodeURIComponent(u.username || user);
      password = decodeURIComponent(u.password || password);
      database = decodeURIComponent(u.pathname.replace(/^\//, '') || database);
    } catch {
      // ignore malformed URL and fall back to env vars
    }
  }

  const adminClient = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
  });

  await adminClient.connect();
  try {
    if (database && database !== 'postgres') {
      // quote identifier to allow lowercase/uppercase safely
      await adminClient.query(`CREATE DATABASE "${database}"`);
    }
  } catch (e: any) {
    // 42P04 = duplicate_database
    if (e && e.code !== '42P04') {
      throw e;
    }
  } finally {
    await adminClient.end();
  }
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        await ensureDatabaseExists();
        return databaseConfig;
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
