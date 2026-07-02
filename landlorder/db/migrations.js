// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// db/migrations.js — Migration Runner
//
// Tracks which migrations have been run via a migrations_log table.
// On startup, runs any new migrations in numerical order (001, 002, etc).
// If a migration fails, the process stops and alerts the developer.
//
// Usage:
//   const { runMigrations } = require('./migrations');
//   await runMigrations();
//
// To create a new migration:
//   1. Create db/migrations/00X_description.sql
//   2. Add your SQL (use IF NOT EXISTS / IF EXISTS for safety)
//   3. On next startup, it runs automatically
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const fs = require('fs');
const path = require('path');
const pool = require('./pool');

// ─────────────────────────────────────────────────────────────────
// Step 1: Ensure the migrations_log table exists
// ─────────────────────────────────────────────────────────────────
async function ensureMigrationsTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS migrations_log (
      id                SERIAL PRIMARY KEY,
      migration_name    TEXT UNIQUE NOT NULL,
      executed_at       TIMESTAMPTZ DEFAULT NOW(),
      status            TEXT DEFAULT 'success',
      error_message     TEXT
    );
  `;

  try {
    await pool.query(createTableSQL);
  } catch (err) {
    console.error('Failed to create migrations_log table:', err.message);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────
// Step 2: Get list of migration files from db/migrations/
// ─────────────────────────────────────────────────────────────────
function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, 'migrations');

  // If migrations directory doesn't exist, create it
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
    console.log('✓ Created migrations directory:', migrationsDir);
    return [];
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort numerically: 001, 002, 003...

  return files;
}

// ─────────────────────────────────────────────────────────────────
// Step 3: Check which migrations have already been run
// ─────────────────────────────────────────────────────────────────
async function getExecutedMigrations() {
  try {
    const result = await pool.query(
      'SELECT migration_name FROM migrations_log WHERE status = $1 ORDER BY executed_at ASC',
      ['success']
    );
    return result.rows.map(row => row.migration_name);
  } catch (err) {
    // If query fails, table might not exist yet, return empty array
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// Step 4: Run pending migrations
// ─────────────────────────────────────────────────────────────────
async function runMigrations() {
  console.log('🔄 Starting database migrations...');

  try {
    // Ensure the tracking table exists
    await ensureMigrationsTable();
    console.log('✓ Migrations log table ready');

    // Get all migration files
    const migrationFiles = getMigrationFiles();
    if (migrationFiles.length === 0) {
      console.log('ℹ No migrations found');
      return;
    }

    // Get already-executed migrations
    const executedMigrations = await getExecutedMigrations();
    console.log(`✓ Found ${executedMigrations.length} previously executed migrations`);

    // Filter to get pending migrations
    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    );

    if (pendingMigrations.length === 0) {
      console.log('✓ Database is up to date');
      return;
    }

    console.log(`📋 Running ${pendingMigrations.length} pending migration(s)...\n`);

    // Run each pending migration
    for (const migrationFile of pendingMigrations) {
      const migrationPath = path.join(__dirname, 'migrations', migrationFile);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

      console.log(`  ↳ Running: ${migrationFile}`);

      const client = await pool.connect();
      try {
        // Start transaction
        await client.query('BEGIN');

        // Execute the migration
        await client.query(migrationSQL);

        // Log success
        await client.query(
          'INSERT INTO migrations_log (migration_name, status) VALUES ($1, $2)',
          [migrationFile, 'success']
        );

        // Commit transaction
        await client.query('COMMIT');

        console.log(`    ✓ ${migrationFile} completed`);
      } catch (err) {
        // Rollback on error
        await client.query('ROLLBACK');

        // Log the error
        await client.query(
          'INSERT INTO migrations_log (migration_name, status, error_message) VALUES ($1, $2, $3)',
          [migrationFile, 'failed', err.message]
        );

        console.error(`    ✗ ${migrationFile} FAILED:`, err.message);
        throw err; // Re-throw to stop the process
      } finally {
        client.release();
      }
    }

    console.log('\n✅ All migrations completed successfully');
  } catch (err) {
    console.error('\n❌ Migration process failed:', err.message);
    console.error('⚠️  Database may be in an inconsistent state. Check migrations_log table.');
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────
// Step 5: Helper to view migration history
// ─────────────────────────────────────────────────────────────────
async function getMigrationHistory() {
  try {
    const result = await pool.query(
      'SELECT migration_name, executed_at, status, error_message FROM migrations_log ORDER BY executed_at ASC'
    );
    return result.rows;
  } catch (err) {
    console.error('Failed to fetch migration history:', err.message);
    return [];
  }
}

module.exports = {
  runMigrations,
  getMigrationHistory,
  ensureMigrationsTable,
  getMigrationFiles,
  getExecutedMigrations,
};