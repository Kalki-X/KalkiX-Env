const { Pool } = require('pg');

const POSTGRES_URL =
    process.env.POSTGRES_URL || 'postgresql://gearshare:changeme@postgres:5432/gearshare';

const pool = new Pool({ connectionString: POSTGRES_URL });

pool.on('error', (err) => {
    // Don't let a dropped idle connection crash the process.
    console.error('❌ Unexpected Postgres pool error:', err.message);
});

module.exports = { pool, POSTGRES_URL };
