const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

// Idempotent: schema.sql is all CREATE TABLE/INDEX/SEQUENCE ... IF NOT EXISTS,
// so it's safe to run this on every API startup.
async function migrate() {
    const sqlPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Postgres schema is up to date');
}

module.exports = { migrate };
