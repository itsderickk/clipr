import { neon } from '@neondatabase/serverless';

export type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

let cached: Sql | null = null;

/**
 * Tagged-template SQL client. Usage: const rows = await db()`select 1`;
 * Neon URLs use the serverless HTTP driver; any other Postgres URL
 * (local dev, docker, RDS…) falls back to node-postgres.
 */
export function db(): Sql {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  if (/\.neon\.tech\b/i.test(url)) {
    cached = neon(url) as unknown as Sql;
  } else {
    const { Pool } = require('pg') as typeof import('pg');
    const pool = new Pool({ connectionString: url });
    cached = async (strings, ...values) => {
      let text = strings[0];
      for (let i = 0; i < values.length; i++) text += `$${i + 1}` + strings[i + 1];
      const res = await pool.query(text, values);
      return res.rows;
    };
  }
  return cached;
}
