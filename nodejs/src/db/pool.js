const { Pool, types } = require('pg');

// Every id/FK column in schema.sql is BIGSERIAL/BIGINT (OID 20 = int8). node-postgres
// returns those as strings by default (a JS number can't safely hold the full 64-bit
// range), but this app will never get remotely close to Number.MAX_SAFE_INTEGER rows,
// and every model/TS interface assumes ids are numbers (e.g. `item.ownerId === user.id`
// checks on the frontend). Parsing bigint as a JS number here fixes that app-wide
// instead of Number()-ing every id field in every model individually.
types.setTypeParser(20, (val) => parseInt(val, 10));

// DATE columns (OID 1082 — booking start_date/end_date, availability blocks) default to
// a JS Date object at local-timezone midnight. Serializing that (toISOString/JSON.stringify)
// shifts the calendar date by a day whenever the server's timezone isn't UTC (e.g.
// 2026-10-01 becomes "2026-09-30T20:00:00.000Z" in UTC+4). A booking's start/end date is
// a plain calendar date with no meaningful time-of-day component, so keep it as the raw
// 'YYYY-MM-DD' string Postgres already formats it as — no Date object, no timezone math.
types.setTypeParser(1082, (val) => val);

const POSTGRES_URL =
    process.env.POSTGRES_URL || 'postgresql://gearshare:changeme@postgres:5432/gearshare';

const pool = new Pool({ connectionString: POSTGRES_URL });

pool.on('error', (err) => {
    // Don't let a dropped idle connection crash the process.
    console.error('❌ Unexpected Postgres pool error:', err.message);
});

module.exports = { pool, POSTGRES_URL };
