import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '../src/generated/client';

const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath });

const useDb = (process.env.USE_DB || 'dev').toLowerCase();
const dbUrl = useDb === 'prod' ? process.env.PROD_DATABASE_URL : process.env.DEV_DATABASE_URL;

if (!dbUrl) {
  console.error(`[db:schema:check] Missing database URL for USE_DB=${useDb}`);
  process.exit(1);
}

process.env.DATABASE_URL = dbUrl;

const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');
const modelNames = [...schema.matchAll(/^model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/gm)]
  .map((m) => m[1])
  .filter((name) => name !== 'leads');

async function main() {
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    const existing = new Set(tables.map((t) => t.table_name));
    const missing = modelNames.filter((m) => !existing.has(m)).sort();

    console.log(`[db:schema:check] USE_DB=${useDb}`);
    console.log(`[db:schema:check] Models checked: ${modelNames.length}`);
    console.log(`[db:schema:check] Tables found: ${existing.size}`);

    if (missing.length === 0) {
      console.log('[db:schema:check] OK: no missing Prisma tables.');
      return;
    }

    console.log(`[db:schema:check] Missing tables (${missing.length}):`);
    for (const t of missing) console.log(`- ${t}`);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[db:schema:check] Failed to inspect schema:', err);
  process.exit(1);
});
