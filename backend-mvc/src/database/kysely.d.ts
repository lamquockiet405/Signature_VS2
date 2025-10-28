/**
 * Kysely type augmentation
 * Ensures Kysely is properly typed in the project
 */

import 'kysely';
import { Database } from './types';

declare module 'kysely' {
  // Ensure Database type is available globally
  interface KyselyDatabase extends Database {}
}

export {};

