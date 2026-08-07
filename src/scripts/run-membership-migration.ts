/**
 * User Center Memberships Migration Runner
 * Executes the 017_user_center_memberships.sql migration with idempotency checks.
 *
 * Before running the SQL, checks if the target tables already exist.
 * If they do, logs a message and skips execution to ensure safe re-runs.
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
  statement_timeout: 120000,
});

async function tableExists(client: any, tableName: string): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists`,
    [tableName]
  );
  return result.rows[0].exists;
}

async function functionExists(client: any, functionName: string): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = $1
    ) AS exists`,
    [functionName]
  );
  return result.rows[0].exists;
}

async function runMembershipMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting user_center_memberships migration...\n');

    // ─── Idempotency check ──────────────────────────────────────────────
    const ucmExists = await tableExists(client, 'user_center_memberships');
    const scrExists = await tableExists(client, 'slug_change_requests');

    if (ucmExists && scrExists) {
      console.log('⏭️  Tables already exist — migration has already been applied.');
      console.log('   • user_center_memberships: ✅ exists');
      console.log('   • slug_change_requests: ✅ exists');
      console.log('\n🔄 Skipping migration execution (idempotent).');
      return;
    }

    // ─── Read migration SQL ─────────────────────────────────────────────
    const migrationPath = path.resolve(__dirname, '../migrations/017_user_center_memberships.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    console.log('📄 Reading migration file: 017_user_center_memberships.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    console.log(`   ↳ ${sql.length} bytes loaded\n`);

    // ─── Execute migration SQL ──────────────────────────────────────────
    console.log('⚙️  Executing migration SQL...');
    await client.query(sql);
    console.log('✅ Migration SQL executed successfully\n');

    // ─── Post-migration verification ────────────────────────────────────
    console.log('🔍 Running post-migration verification...\n');

    // Verify user_center_memberships table exists
    const ucmVerified = await tableExists(client, 'user_center_memberships');
    if (!ucmVerified) {
      throw new Error('VERIFICATION FAILED: user_center_memberships table was not created');
    }
    console.log('   ✅ user_center_memberships table exists');

    // Verify slug_change_requests table exists
    const scrVerified = await tableExists(client, 'slug_change_requests');
    if (!scrVerified) {
      throw new Error('VERIFICATION FAILED: slug_change_requests table was not created');
    }
    console.log('   ✅ slug_change_requests table exists');

    // Count memberships created from existing users
    const membershipCountResult = await client.query(
      'SELECT COUNT(*) AS count FROM user_center_memberships'
    );
    const membershipCount = parseInt(membershipCountResult.rows[0].count, 10);
    console.log(`   ✅ Memberships populated: ${membershipCount} record(s)`);

    // Verify trigger function exists
    const triggerExists = await functionExists(client, 'check_membership_limit');
    if (triggerExists) {
      console.log('   ✅ Trigger function check_membership_limit exists');
    } else {
      console.log('   ⚠️  Trigger function check_membership_limit not found');
    }

    // ─── Summary ────────────────────────────────────────────────────────
    console.log('\n📊 Migration Summary:');
    console.log('─────────────────────');
    console.log(`   Tables created: user_center_memberships, slug_change_requests`);
    console.log(`   Memberships populated: ${membershipCount}`);
    console.log(`   Trigger function: ${triggerExists ? '✅ created' : '⚠️ not found'}`);
    console.log('\n🎉 Membership migration completed and verified successfully!');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMembershipMigration();
