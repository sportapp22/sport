// Test navigateur réel (Chromium) : service worker, hors ligne, import JSON.
// Lancer : node tests/e2e-pwa.js (sert le dossier en local sur un port libre).
const path = require('path');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(__dirname, '..', '..')] }));
const http = require('http'), fs = require('fs');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
  const fp = path.join(root, f);
  if (!fs.existsSync(fp)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': types[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(r);
}).listen(0, async () => {
  const url = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let fails = 0; const check = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
  await p.goto(url);
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  check(await p.evaluate(() => !!navigator.serviceWorker.controller), 'service worker actif et contrôle la page');
  const tmp = path.join(require('os').tmpdir(), 'import-test.json');
  fs.writeFileSync(tmp, JSON.stringify({ metriques: [{ date: '2026-09-01', poids: 61 }], seances: [{ date: '2026-09-02', type: 'PUSH', exercices: [] }] }));
  await p.setInputFiles('#fileInput', tmp);
  await p.waitForTimeout(300);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('wdb')));
  check(st && st.seances.length === 1 && st.seances[0].programme_id === 'ppl' && st.reglages.kcal === 2750, 'import JSON : données restaurées et migrées');
  await ctx.setOffline(true);
  await p.reload();
  check((await p.textContent('#page-dash h1')).length > 0 && await p.evaluate(() => typeof renderNutrition === 'function'), 'hors ligne : l\'appli se recharge depuis le cache');
  await p.evaluate(() => showPage('nutrition'));
  check(await p.evaluate(() => document.getElementById('nutri-content').innerHTML.includes('Overnight')), 'hors ligne : onglet Nutrition fonctionnel');
  const icon = await p.evaluate(async () => (await fetch('icon-192.png')).ok);
  check(icon, 'hors ligne : icônes servies depuis le cache');
  check(errs.length === 0, 'aucune erreur JS ' + errs.join(' | '));
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} échec(s)` : '\ne2e ok'); if (fails) process.exitCode = 1;
});
