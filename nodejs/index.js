const express = require('express');
const os = require('os');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo:27017/testdb';

mongoose.connect(MONGO_URL)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ Mongo connection error:', err));

app.get('/', (_, res) => {
    res.type('html').send(`
  <!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Node.js Docker Lab</title>
    <style>
      :root { --bg:#0b1220; --card:#111827; --accent:#38a169; --text:#e5e7eb; }
      *{box-sizing:border-box} body{margin:0;background:linear-gradient(120deg,#0b1220,#0f172a);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;color:var(--text)}
      .wrap{min-height:100vh;display:grid;place-items:center;padding:40px}
      .card{width:min(900px,92vw);background:rgba(17,24,39,.75);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.06);border-radius:20px;padding:34px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
      .top{display:flex;gap:22px;align-items:center;flex-wrap:wrap}
      .logo{width:72px;height:72px;display:grid;place-items:center;background:#111;border-radius:18px;border:1px solid rgba(255,255,255,.08)}
      h1{margin:0;font-size:28px;letter-spacing:.2px}
      p{color:#cbd5e1;margin:.25rem 0 0}
      .grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:24px}
      .tile{background:#0f1629;border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:16px}
      .k{opacity:.7}
      .btns{margin-top:24px;display:flex;gap:12px;flex-wrap:wrap}
      .btn{padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.12);text-decoration:none;color:var(--text)}
      .btn.primary{background:var(--accent);border-color:transparent;color:#04110a;font-weight:600}
      code{background:#0b1324;padding:2px 6px;border-radius:6px;color:#93c5fd}
      footer{margin-top:22px;opacity:.7;font-size:13px}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="top">
          <div class="logo">
            <!-- Inline Node.js SVG logo -->
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 288" width="56" height="56">
              <path fill="#539E43" d="M128 .011c3.083 0 6.145.793 8.856 2.321l97.269 56.116c5.498 3.175 8.856 9.055 8.856 15.377v112.232a17.746 17.746 0 0 1-8.856 15.377l-97.269 56.116a17.764 17.764 0 0 1-17.712 0l-97.27-56.116A17.745 17.745 0 0 1 12.288 186.1V73.825c0-6.322 3.358-12.202 8.856-15.377L118.413 2.332A17.732 17.732 0 0 1 128 .011Z"/>
              <path fill="#fff" d="M128 42.202a9.14 9.14 0 0 0-4.562 1.21l-70.486 40.643a9.135 9.135 0 0 0-4.571 7.875v81.347a9.134 9.134 0 0 0 4.571 7.875l70.486 40.643a9.14 9.14 0 0 0 9.123 0l70.486-40.643a9.135 9.135 0 0 0 4.571-7.875V91.93a9.134 9.134 0 0 0-4.571-7.875l-70.486-40.643A9.14 9.14 0 0 0 128 42.202Z"/>
              <path fill="#8CC84B" d="M128 53.781 195.053 92.4v80.799L128 211.818 60.947 173.199V92.4L128 53.781Z"/>
            </svg>
          </div>
          <div>
            <h1>Node.js is running in Docker 🎉</h1>
            <p>Unified dev lab: Node + PHP + MySQL + Mongo</p>
          </div>
        </div>

        <div class="grid">
          <div class="tile"><div class="k">Node version</div><div><code>${process.version}</code></div></div>
          <div class="tile"><div class="k">Platform</div><div><code>${process.platform} ${process.arch}</code></div></div>
          <div class="tile"><div class="k">Mongo URL</div><div><code>${process.env.MONGO_URL || 'not set'}</code></div></div>
        </div>

        <div class="btns">
          <a class="btn primary" href="/info">Open /info</a>
          <a class="btn" href="/api/ping">Test API /api/ping</a>
        </div>

        <footer>Tip: visit <code>http://localhost:3000</code> and <code>/info</code></footer>
      </div>
    </div>
  </body>
  </html>`);
});


app.get('/api/ping', (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/info', (_, res) => {
    res.type('html').send(`
    <h2>Node.js Info</h2>
    <p><b>Node:</b> ${process.version}</p>
    <p><b>Platform:</b> ${process.platform} ${process.arch}</p>
    <p><b>CPU cores:</b> ${os.cpus().length}</p>
    <p><b>Uptime (min):</b> ${(os.uptime()/60).toFixed(1)}</p>
    <hr><pre>${JSON.stringify(process.env, null, 2)}</pre>
  `);
});

app.listen(PORT, () => console.log(`✅ Listening on ${PORT}`));
