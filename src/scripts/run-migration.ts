/**
 * Multi-Center Migration Runner
 * Executes the add-multi-center.sql migration and verifies data integrity.
 *
 * The SQL file uses two internal transactions (one for ALTER TYPE ADD VALUE,
 * then another for everything else), so this runner executes the raw SQL
 * as-is without wrapping in an additional transaction.
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Tables that must have NOT NULL center_id after migration
const NOT_NULL_TABLES = [
  'batches',
  'students',
  'skill_assessments',
  'fee_records',
  'curriculum_plans',
  'training_logs',
  'attendance_records',
  'leave_requests',
  'session_schedules',
  'session_notes',
  'drills',
];

function buildConnectionConfig() {
  const sslConfig = { rejectUnauthorized: false };

  if (process.env.PGHOST && process.env.PGUSER) {
    const host = process.env.PGHOST;
    const port = process.env.PGPORT || '5432';
    const user = process.env.PGUSER;
    const password = process.env.PGPASSWORD || '';
    const database = process.env.PGDATABASE || 'postgres';
    const encodedPassword = encodeURIComponent(password);
    const connectionString = `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}`;
    return { connectionString, ssl: sslConfig };
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('No DATABASE_URL or PGHOST/PGUSER environment variables set');
  }
  return { connectionString: url, ssl: sslConfig };
}

const pool = new Pool({
  ...buildConnectionConfig(),
  max: 1,
  connectionTimeoutMillis: 30000,
  statement_timeout: 120000, // migration may take longer
});

async function runMultiCenterMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting multi-center migration...\n');

    // ─── Read migration SQL ─────────────────────────────────────────────
    const migrationPath = path.resolve(__dirname, '../migrations/add-multi-center.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    console.log(`📄 Reading migration file: add-multi-center.sql`);
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    console.log(`   ↳ ${sql.length} bytes loaded\n`);

    // ─── Execute migration SQL (contains its own BEGIN/COMMIT blocks) ───
    console.log('⚙️  Executing migration SQL...');
    await client.query(sql);
    console.log('✅ Migration SQL executed successfully\n');

    // ─── Post-migration verification ────────────────────────────────────
    console.log('🔍 Running post-migration verification...\n');

    // Verify centers table exists and has at least one row
    const centersResult = await client.query('SELECT COUNT(*) AS count FROM centers');
    const centersCount = parseInt(centersResult.rows[0].count, 10);

    if (centersCount === 0) {
      throw new Error('VERIFICATION FAILED: centers table has zero rows — expected at least the default center');
    }
    console.log(`   ✅ centers table exists with ${centersCount} row(s)`);

    // Verify zero NULL center_id in all NOT NULL tables
    let allPassed = true;
    const results: { table: string; nullCount: number }[] = [];

    for (const table of NOT_NULL_TABLES) {
      const res = await client.query(`SELECT COUNT(*) AS count FROM ${table} WHERE center_id IS NULL`);
      const nullCount = parseInt(res.rows[0].count, 10);
      results.push({ table, nullCount });

      if (nullCount > 0) {
        allPassed = false;
        console.log(`   ❌ ${table}: ${nullCount} row(s) with NULL center_id`);
      } else {
        console.log(`   ✅ ${table}: 0 NULL center_id rows`);
      }
    }

    if (!allPassed) {
      throw new Error('VERIFICATION FAILED: Some tables still have NULL center_id rows. See details above.');
    }

    // ─── Summary ────────────────────────────────────────────────────────
    console.log('\n📊 Migration Summary:');
    console.log('─────────────────────');
    console.log(`   Centers created: ${centersCount}`);
    console.log(`   Tables verified: ${NOT_NULL_TABLES.length}`);
    console.log(`   NULL center_id rows: 0`);
    console.log('\n🎉 Multi-center migration completed and verified successfully!');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMultiCenterMigration();
