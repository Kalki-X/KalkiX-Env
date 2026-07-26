const os = require('os');
const { createApp } = require('./src/app');
const { migrate } = require('./src/db/migrate');
const { bootstrapSuperAdmin } = require('./src/db/bootstrapSuperAdmin');
const { POSTGRES_URL } = require('./src/db/pool');

const PORT = process.env.PORT || 3000;
const REACT_URL = process.env.REACT_URL || 'http://localhost:5173';

const app = createApp();

// Dev dashboard — quick visual check that the stack is wired up correctly.
app.get('/', (_req, res) => {
    res.type('html').send(`
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GearShare Dev Lab</title>
  <style>
    :root { --bg:#0b1220; --card:#111827; --accent:#38a169; --text:#e5e7eb; --muted:#cbd5e1; }
    *{box-sizing:border-box} body{margin:0;background:linear-gradient(120deg,#0b1220,#0f172a);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;color:var(--text)}
    .wrap{min-height:100vh;display:grid;place-items:center;padding:40px}
    .card{width:min(920px,92vw);background:rgba(17,24,39,.75);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.06);border-radius:20px;padding:34px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
    h1{margin:0;font-size:28px;letter-spacing:.2px}
    p{color:var(--muted);margin:.25rem 0 0}
    .grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:24px}
    .tile{background:#0f1629;border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:16px}
    .k{opacity:.7}
    .btns{margin-top:24px;display:flex;gap:12px;flex-wrap:wrap}
    .btn{padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.12);text-decoration:none;color:var(--text)}
    .btn.primary{background:var(--accent);border-color:transparent;color:#04110a;font-weight:600}
    code{background:#0b1324;padding:2px 6px;border-radius:6px;color:#93c5fd;word-break:break-all}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>GearShare API is running 🎉</h1>
      <p>Node + Express + PostgreSQL</p>
      <div class="grid">
        <div class="tile"><div class="k">Node version</div><div><code>${process.version}</code></div></div>
        <div class="tile"><div class="k">Platform</div><div><code>${process.platform} ${process.arch}</code></div></div>
        <div class="tile"><div class="k">Postgres</div><div><code>${POSTGRES_URL.replace(/:[^:@]*@/, ':***@')}</code></div></div>
        <div class="tile"><div class="k">React</div><div><code>${REACT_URL}</code></div></div>
      </div>
      <div class="btns">
        <a class="btn primary" href="/api/ping">Test /api/ping</a>
        <a class="btn" href="${REACT_URL}" target="_blank" rel="noreferrer">Open React</a>
      </div>
    </div>
  </div>
</body>
</html>`);
});

app.get('/info', (_req, res) => {
    res.type('html').send(`
    <h2>GearShare Node Info</h2>
    <p><b>Node:</b> ${process.version}</p>
    <p><b>Platform:</b> ${process.platform} ${process.arch}</p>
    <p><b>CPU cores:</b> ${os.cpus().length}</p>
    <p><b>Uptime (min):</b> ${(os.uptime() / 60).toFixed(1)}</p>
    <p><b>React URL:</b> ${REACT_URL}</p>
  `);
});

migrate()
    .then(() => bootstrapSuperAdmin())
    .catch((err) => {
        console.error('❌ Startup task failed:', err.message);
    })
    .finally(() => {
        app.listen(PORT, () => console.log(`✅ Listening on ${PORT}`));
    });
