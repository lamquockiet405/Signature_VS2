import { TypeOrmModuleOptions } from '@nestjs/typeorm';

// Build TypeORM config. Prioritize split env vars; fallback to DATABASE_URL; finally use defaults.
const buildConfig = (): TypeOrmModuleOptions => {
  const hasSplitVars = !!(
    process.env.DB_HOST ||
    process.env.DB_PORT ||
    process.env.DB_USER ||
    process.env.DB_PASSWORD ||
    process.env.DB_NAME ||
    process.env.DATABASE_HOST ||
    process.env.DATABASE_PORT ||
    process.env.DATABASE_USER ||
    process.env.DATABASE_PASSWORD ||
    process.env.DATABASE_NAME
  );

  if (hasSplitVars) {
    return {
      type: 'postgres',
      host: process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost',
      // default to 5433 for the HSM service container mapping
      port: parseInt((process.env.DB_PORT || process.env.DATABASE_PORT || '5433') as string),
      username: process.env.DB_USER || process.env.DATABASE_USER || 'postgres',
      // Default password 123456 (overridable)
      password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || '123456',
      // default DB name to 'postgres' to match container defaults
      database: process.env.DB_NAME || process.env.DATABASE_NAME || 'postgres',
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
      maxQueryExecutionTime: 1000,
      extra: {
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      },
    };
  }

  const url = process.env.DATABASE_URL;
  if (url) {
    return {
      type: 'postgres',
      url,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
      maxQueryExecutionTime: 1000,
      extra: {
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      },
    };
  }

  // Final safe defaults
  return {
    type: 'postgres',
    host: 'localhost',
    port: 5433,
    username: 'postgres',
    password: '123456',
    database: 'postgres',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
    maxQueryExecutionTime: 1000,
    extra: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
  };
};

export const databaseConfig: TypeOrmModuleOptions = buildConfig();
