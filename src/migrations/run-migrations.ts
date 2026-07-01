/**
 * Database Migration Runner
 * Executes SQL migration files in order
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : undefined
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database migrations...\n');
    
    // Get all SQL files in migrations directory
    const migrationsDir = __dirname;
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Alphabetical order ensures 001, 002, etc. run in sequence
    
    if (files.length === 0) {
      console.log('⚠️  No migration files found');
      return;
    }
    
    // Run each migration file
    for (const file of files) {
      console.log(`📄 Running migration: ${file}`);
      
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        
        console.log(`✅ Successfully executed: ${file}\n`);
      } catch (error: any) {
        await client.query('ROLLBACK');
        console.error(`❌ Error executing ${file}:`);
        console.error(error.message);
        throw error;
      }
    }
    
    console.log('🎉 All migrations completed successfully!');
    
    // Display summary
    const result = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM students) as students_count,
        (SELECT COUNT(*) FROM batches) as batches_count,
        (SELECT COUNT(*) FROM skill_assessments) as assessments_count,
        (SELECT COUNT(*) FROM fee_records) as fees_count,
        (SELECT COUNT(*) FROM curriculum_plans) as plans_count,
        (SELECT COUNT(*) FROM training_logs) as logs_count
    `);
    
    console.log('\n📊 Database Summary:');
    console.log('-------------------');
    console.log(`Users: ${result.rows[0].users_count}`);
    console.log(`Students: ${result.rows[0].students_count}`);
    console.log(`Batches: ${result.rows[0].batches_count}`);
    console.log(`Skill Assessments: ${result.rows[0].assessments_count}`);
    console.log(`Fee Records: ${result.rows[0].fees_count}`);
    console.log(`Curriculum Plans: ${result.rows[0].plans_count}`);
    console.log(`Training Logs: ${result.rows[0].logs_count}`);
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations
runMigrations();
