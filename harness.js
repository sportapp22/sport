// Harnais de test : charge le vrai index.html dans jsdom (scripts exécutés),
// avec un localStorage pré-rempli, pour tester le code réellement livré.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(require.resolve('jsdom', { paths: [path.join(__dirname, '..', '..')] }));

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function load(seedDB, extraStorage) {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    url: 'https://sportapp22.github.io/sport/',
    pretendToBeVisual: true,
    beforeParse(win) {
      if (seedDB !== undefined && seedDB !== null) win.localStorage.setItem('wdb', JSON.stringify(seedDB));
      Object.entries(extraStorage || {}).forEach(([k, v]) => win.localStorage.setItem(k, v));
      win.URL.createObjectURL = () => 'blob:x';
      win.URL.revokeObjectURL = () => {};
      win.HTMLAnchorElement.prototype.click = function () { win.__downloaded = this.download; };
      win.scrollTo = () => {};
      win.__errors = [];
      win.addEventListener('error', e => win.__errors.push(e.message));
    }
  });
  const w = dom.window;
  // Les `let` du script ne sont pas exposés sur window : accès via eval.
  w.get = expr => w.eval(expr);
  w.stored = () => JSON.parse(w.localStorage.getItem('wdb'));
  return w;
}

function localDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function dayOffset(n) { const d = new Date(); d.setDate(d.getDate() + n); return localDateStr(d); }
// Prochaine date (>= aujourd'hui) tombant sur un jour donné (0=dim..6=sam)
function nextDow(dow) { const d = new Date(); while (d.getDay() !== dow) d.setDate(d.getDate() + 1); return localDateStr(d); }

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + (e && e.stack || e)); }
}
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || '') + ' attendu ' + JSON.stringify(b) + ', obtenu ' + JSON.stringify(a)); }
function ok(v, msg) { if (!v) throw new Error(msg || 'assertion'); }
function summary() { console.log(`\n${passed} ok, ${failed} échec(s)`); if (failed) process.exitCode = 1; }

// Base "V0" réaliste : format d'avant Phase 0 (aucune clé nouvelle).
function oldDB() {
  return {
    metriques: [{ date: '2026-08-01', poids: 61 }, { date: '2026-08-02', sommeil_h: 7.5 }, { date: '2026-09-28', poids: 64, sommeil_h: 6.5 }],
    seances: [
      { date: '2026-08-05', type: 'PUSH', note_globale: 4, exercices: [{ id: 'dc', nom: 'Développé couché', series: [{ poids: 30, reps: 8 }] }] },
      { date: '2026-08-07', type: 'PULL', exercices: [] }
    ]
  };
}

module.exports = { load, test, eq, ok, summary, oldDB, dayOffset, nextDow, localDateStr };
