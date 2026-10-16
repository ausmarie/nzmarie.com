import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from './db';
import * as schema from '@/database/schema';

export const db = drizzle(pool, { schema });
