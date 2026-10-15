import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { config } from './config.js';

// Return dates as plain "YYYY-MM-DD" strings instead of JS Date objects.
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 20 });

/** Applies schema.sql, which is written to be safe to run repeatedly. */
export async function migrate() {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');
  await pool.query(await readFile(file, 'utf8'));
}
