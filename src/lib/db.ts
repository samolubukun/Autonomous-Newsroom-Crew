import { neon } from '@neondatabase/serverless';

/**
 * Neon Database Client (Serverless-native Postgres)
 * This uses HTTP-based connection pooling, which is perfect for Vercel functions.
 */
const sql = neon(process.env.DATABASE_URL as string);

export { sql };
