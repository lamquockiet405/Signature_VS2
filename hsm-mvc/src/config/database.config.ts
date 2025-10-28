import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  database: process.env.DB_NAME || 'HSM',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false, // Disable auto-sync to avoid conflicts with existing data
  logging: process.env.NODE_ENV === 'development',
  maxQueryExecutionTime: 1000,
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
};
