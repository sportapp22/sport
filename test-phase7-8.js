const { load, test, eq, ok, summary, oldDB, dayOffset } = require('./harness');
const ROOT = (require('fs').existsSync(require('path').join(__dirname,'index.html')) ? __dirname : require('path').join(__dirname,'..'));
const fs = require('fs'), path = require('path');
console.log('Phases 7-8 : PWA + rappel de sauvegarde');
const root = ROOT;

test('manifest valide, icônes présentes, liens dans le <head>', () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  eq([m.display, m.start_url, m.scope], ['standalone', './', './']);
  m.icons.forEach(i => ok(fs.existsSync(path.join(root, i.src)), i.src));
  ok(fs.existsSync(path.join(root, 'apple-touch-icon.png')));
  const w = load(oldDB());
  ok(w.document.querySelector('link[rel=manifest]'));
  ok(w.document.querySelector('meta[name=apple-mobile-web-app-capable]'));
});

test('service worker : syntaxe OK, met en cache tous les fichiers de l\'appli', () => {
  const src = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  new Function(src);
  ['./index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'].forEach(f => ok(src.includes(`'${f}'`), f));
  ok(!/localStorage/.test(src.replace(/\/\/.*$/gm, '')), 'le SW ne touche pas au localStorage');
});

test('rappel : jamais exporté + données → encart', () => {
  const w = load(oldDB());
  ok(w.document.getElementById('backup-alert').textContent.includes('jamais été exportées'));
});

test('rappel : export il y a 3 j → rien ; il y a 8 j → encart', () => {
  const b1 = oldDB(); b1.dernier_export = dayOffset(-3);
  eq(load(b1).document.getElementById('backup-alert').innerHTML, '');
  const b2 = oldDB(); b2.dernier_export = dayOffset(-8);
  ok(load(b2).document.getElementById('backup-alert').textContent.includes('il y a 8 jours'));
});

test('export : date enregistrée, fichier contient la date, encart disparaît', () => {
  const w = load(oldDB());
  w.exportData();
  eq(w.__downloaded, `workout_${dayOffset(0)}.json`);
  eq(w.stored().dernier_export, dayOffset(0));
  eq(w.document.getElementById('backup-alert').innerHTML, '');
  w.showPage('settings');
  ok(w.document.getElementById('about-export').textContent.includes("aujourd'hui"));
});

test('base vide hors appli installée : pas d\'encart', () => {
  const w = load(null);
  eq(w.document.getElementById('backup-alert').innerHTML, '');
});

test('appli installée vide : encart d\'import', () => {
  const w = load(null);
  w.navigator.__defineGetter__('standalone', () => true);
  w.renderDash();
  ok(w.document.getElementById('backup-alert').textContent.includes('importe tes données'));
});

summary();
