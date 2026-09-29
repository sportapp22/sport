const { load, test, eq, ok, summary, oldDB, dayOffset } = require('./harness');
console.log('Phases 5-6 : sommeil détaillé + poids & jalons');

test('durée de sommeil : passage de minuit, avant minuit, invalide', () => {
  const w = load(oldDB());
  eq(w.computeSleepHours('23:30', '07:00'), 7.5);
  eq(w.computeSleepHours('00:45', '07:15'), 6.5);
  eq(w.computeSleepHours('22:00', '22:00'), null);
  eq(w.computeSleepHours('', '07:00'), null);
  eq(w.computeSleepHours('08:00', '07:00'), null, '> 16 h refusé');
});

test('écart lever vs cible 7h00', () => {
  const w = load(oldDB());
  eq(w.leverEcart('07:25', '07:00'), 25);
  eq(w.leverEcart('06:40', '07:00'), -20);
  eq(w.leverEcart('00:30', '23:50'), 40);
});

test('migration : anciennes entrées sommeil_h intactes, moyenne 7 j inchangée', () => {
  const base = oldDB();
  base.metriques.push({ date: dayOffset(-1), sommeil_h: 7 });
  const w = load(base);
  w.renderDash();
  eq(w.get('db.metriques').filter(m => m.sommeil_h).length, 3);
  eq(w.document.getElementById('d-sleep').textContent, '6.8', '(7 + 6.5 de oldDB) / 2');
  eq(w.__errors, []);
});

test('saisie d\'une nuit : horaires + qualité, sommeil_h calculé, poids du jour conservé', () => {
  const w = load(oldDB());
  const today = dayOffset(0);
  w.document.getElementById('weightInput').value = '62.4'; w.logWeight();
  w.document.getElementById('sleepBed').value = '23:40';
  w.document.getElementById('sleepWake').value = '07:25';
  w.setSleepQuality(4); w.logSleep();
  const m = w.stored().metriques.find(x => x.date === today);
  eq([m.poids, m.coucher, m.lever, m.sommeil_h, m.sommeil_qualite], [62.4, '23:40', '07:25', 7.75, 4]);
  ok(w.document.getElementById('sleepLast').textContent.includes('lever +25 min vs 07h00'), w.document.getElementById('sleepLast').textContent);
  ok(w.document.getElementById('d-sleep-sub').textContent.includes('qualité 4.0/5'));
});

test('formulaire pré-rempli avec la dernière nuit (saisie en < 10 s)', () => {
  const base = oldDB();
  base.metriques.push({ date: dayOffset(-1), coucher: '00:15', lever: '07:30', sommeil_h: 7.25, sommeil_qualite: 3 });
  const w = load(base);
  eq(w.document.getElementById('sleepBed').value, '00:15');
  eq(w.document.getElementById('sleepWake').value, '07:30');
  eq(w.get('sleepQuality'), 0, 'qualité non reprise d\'une autre nuit');
});

test('re-saisie le même jour : écrase la nuit, qualité retirée si non notée', () => {
  const w = load(oldDB());
  w.setSleepQuality(5); w.logSleep();
  w.setSleepQuality(5); // re-clic = désélection
  w.logSleep();
  const m = w.stored().metriques.filter(x => x.date === dayOffset(0));
  eq(m.length, 1); ok(!('sommeil_qualite' in m[0]));
});

test('poids lissé : moyenne des pesées sur 7 jours', () => {
  const base = oldDB();
  base.metriques = [{ date: dayOffset(-20), poids: 61 }, { date: dayOffset(-5), poids: 63 }, { date: dayOffset(-1), poids: 64 }];
  const w = load(base);
  eq(w.getPoidsActuel(), { last: 64, date: dayOffset(-1), avg: 63.5, n: 2 });
  const txt = w.document.getElementById('poids-card').textContent;
  ok(txt.includes('+2,5 kg sur les 9 kg visés'), txt);
  ok(txt.includes('encore 1,5 kg'), txt);
});

test('jalon : détecté une seule fois, suggestion, appliquer met à jour les cibles', () => {
  const base = oldDB();
  base.metriques = [{ date: dayOffset(-3), poids: 64.8 }];
  const w = load(base);
  eq(w.document.getElementById('jalon-alert').innerHTML, '');
  w.document.getElementById('weightInput').value = '65.4'; w.logWeight(); // moyenne 65.1
  const st = w.stored();
  eq(st.jalons.jalon.poids, 65.1);
  ok(w.document.getElementById('jalon-alert').textContent.includes('Jalon 65 kg atteint'));
  eq(w.suggestCibles(65.1), { kcal: 2950, prot: 150, eau_repos: 2300, eau_entrainement: 2800 });
  w.dismissJalon(true);
  eq(w.stored().reglages.kcal, 2950);
  eq(w.document.getElementById('jalon-alert').innerHTML, '');
  w.document.getElementById('weightInput').value = '65.9'; w.logWeight();
  eq(w.stored().jalons.jalon.poids, 65.1, 'pas de re-déclenchement');
});

test('jalon : "garder mes cibles" ne touche pas aux réglages', () => {
  const base = oldDB(); base.reglages = { kcal: 3000 };
  base.metriques = [{ date: dayOffset(0), poids: 66 }];
  const w = load(base);
  w.dismissJalon(false);
  eq(w.stored().reglages.kcal, 3000);
  eq(w.stored().jalons.jalon.vu, true);
});

test('suggestion jamais à la baisse', () => {
  const base = oldDB(); base.reglages = { kcal: 3200, prot: 160 };
  const w = load(base);
  const s = w.suggestCibles(65);
  eq([s.kcal, s.prot], [3200, 160]);
});

test('réglages : lever cible et jalons modifiables', () => {
  const w = load(oldDB());
  w.showPage('settings');
  eq(w.document.getElementById('reg-lever_cible').value, '07:00');
  w.setReglage('lever_cible', '06:45'); eq(w.stored().reglages.lever_cible, '06:45');
  w.setReglage('lever_cible', 'n/a'); eq(w.stored().reglages.lever_cible, '06:45');
  w.setReglage('poids_jalon', '66'); eq(w.stored().reglages.poids_jalon, 66);
});

test('aucune pesée : carte poids sans erreur ; toutes les pages OK', () => {
  const w = load(null);
  ok(w.document.getElementById('poids-card').textContent.includes('Aucune pesée'));
  ['dash', 'session', 'nutrition', 'history', 'progress', 'settings', 'week'].forEach(p => w.showPage(p));
  eq(w.__errors, []);
});

summary();
