const { load, test, eq, ok, summary, oldDB, dayOffset, nextDow } = require('./harness');
console.log('Phase 4 : nutrition & hydratation');

test('migration V0 : aucune séance ni métrique perdue, repas + réglages ajoutés', () => {
  const w = load(oldDB());
  const db = w.get('db');
  eq(db.seances.length, 2); eq(db.metriques.length, 3);
  eq(db.seances[0].exercices[0].series, [{ poids: 30, reps: 8 }]);
  eq(db.repas, {});
  eq([db.reglages.kcal, db.reglages.prot, db.reglages.eau_repos, db.reglages.eau_entrainement], [2750, 140, 2200, 2700]);
  eq(w.__errors, []);
});

test('migration : une cible personnalisée n\'est jamais écrasée', () => {
  const base = oldDB(); base.reglages = { kcal: 3080 };
  const w = load(base);
  eq(w.get('db.reglages.kcal'), 3080);
  eq(w.get('db.reglages.prot'), 140);
});

test('migration : repas déjà saisis conservés tels quels', () => {
  const base = oldDB(); base.repas = { '2026-09-01': { items: { pdj: true }, eau_ml: 1500 } };
  const w = load(base);
  eq(w.get('db.repas["2026-09-01"]'), { items: { pdj: true }, eau_ml: 1500 });
});

test('jour d\'entraînement : suit le planning FBX3 (mardi) et les exceptions', () => {
  const base = oldDB(); base.programme_actif = 'fbx3';
  const w = load(base);
  const mardi = nextDow(2), lundi = nextDow(1);
  ok(w.get(`isTrainingDay('${mardi}')`), 'mardi = entraînement');
  ok(!w.get(`isTrainingDay('${lundi}')`), 'lundi = repos');
  w.get(`db.planning.exceptions['${lundi}']={programme_id:'fbx3',seance_id:'A'}`);
  ok(w.get(`isTrainingDay('${lundi}')`), 'lundi avec exception = entraînement');
});

test('jour d\'entraînement : une séance loguée hors planning compte', () => {
  const w = load(oldDB());
  ok(w.get(`isTrainingDay('2026-08-05')`));
});

test('créneaux : 6 en entraînement (collations), 5 en repos', () => {
  const base = oldDB(); base.programme_actif = 'fbx3';
  const w = load(base);
  eq(w.get(`getNutriSlots('${nextDow(2)}').map(s=>s.key)`), ['pdj', 'coll_matin', 'dej', 'whey', 'coll_aprem', 'din']);
  eq(w.get(`getNutriSlots('${nextDow(1)}').map(s=>s.key)`), ['pdj', 'dej', 'whey', 'fruit', 'din']);
});

test('modèle de semaine : lundi gratin puis poulet, dimanche au choix', () => {
  const w = load(oldDB());
  eq(w.get(`getRepasChoix('${nextDow(1)}','dej')`), 'r3');
  eq(w.get(`getRepasChoix('${nextDow(1)}','din')`), 'r1');
  eq(w.get(`getRepasChoix('${nextDow(0)}','dej')`), '');
});

test('totaux : journée d\'entraînement complète = 2692 kcal / 177 g (plan §7 arrondi)', () => {
  const base = oldDB(); base.programme_actif = 'fbx3';
  const mardi = nextDow(2);
  base.repas = { [mardi]: { items: { pdj: 1, coll_matin: 1, dej: 1, whey: 1, coll_aprem: 1, din: 1 } } };
  const w = load(base);
  // mardi : poulet (710/50) + gratin (740/52) + 660/31 + 180/6 + 152/30 + 250/8
  eq(w.get(`computeNutriTotals('${mardi}')`), { kcal: 2692, prot: 177 });
});

test('totaux : hors plan + extra comptés, choix non coché ignoré', () => {
  const base = oldDB();
  const lundi = nextDow(1);
  base.repas = { [lundi]: { items: { dej: true }, choix: { dej: 'hors', din: 'r2' }, hors: { dej: { kcal: 800, prot: 35 }, extra: { kcal: 200, prot: 5 } } } };
  const w = load(base);
  eq(w.get(`computeNutriTotals('${lundi}')`), { kcal: 1000, prot: 40 });
});

test('interactions écran : cocher, choisir, eau, persistance localStorage', () => {
  const w = load(oldDB());
  w.showPage('nutrition');
  const today = w.get('nutriDateStr()');
  ok(!(w.stored().repas||{})[today], 'aucune écriture au simple affichage');
  w.toggleRepasItem('pdj');
  w.addWater(500); w.addWater(250); w.addWater(-250);
  w.setRepasChoix('din', 'r2');
  const r = w.stored().repas[today];
  eq(r.items.pdj, true); eq(r.eau_ml, 500); eq(r.choix.din, 'r2');
  w.addWater(-2000); eq(w.stored().repas[today].eau_ml, 0, 'eau jamais négative');
  ok(w.document.getElementById('nutri-content').innerHTML.includes('Overnight oats'));
  eq(w.__errors, []);
});

test('ensureRepasDay ne détruit rien', () => {
  const w = load(oldDB());
  w.get(`db.repas['2026-09-10']={items:{pdj:true},eau_ml:750,note:'x'}`);
  w.get(`ensureRepasDay('2026-09-10')`);
  eq(w.get(`db.repas['2026-09-10'].items`), { pdj: true });
  eq(w.get(`db.repas['2026-09-10'].eau_ml`), 750);
  eq(w.get(`db.repas['2026-09-10'].note`), 'x');
});

test('navigation jour : veille OK, pas de futur', () => {
  const w = load(oldDB());
  w.showPage('nutrition');
  w.shiftNutriDay(-1); eq(w.get('nutriDateStr()'), dayOffset(-1));
  w.shiftNutriDay(1); w.shiftNutriDay(1); eq(w.get('nutriDateStr()'), dayOffset(0));
});

test('cible eau : 2,7 L entraînement / 2,2 L repos, réglages modifiables', () => {
  const base = oldDB(); base.programme_actif = 'fbx3';
  const w = load(base);
  eq(w.get(`getNutriTargets('${nextDow(2)}').eau`), 2700);
  eq(w.get(`getNutriTargets('${nextDow(1)}').eau`), 2200);
  w.setReglage('kcal', '3080'); eq(w.stored().reglages.kcal, 3080);
  w.setReglage('kcal', '-5'); eq(w.stored().reglages.kcal, 3080, 'valeur invalide ignorée');
});

test('toutes les pages s\'affichent sans erreur (non-régression)', () => {
  const w = load(oldDB());
  ['dash', 'session', 'nutrition', 'history', 'progress', 'settings', 'week'].forEach(p => w.showPage(p));
  eq(w.__errors, []);
  eq(w.document.getElementById('reg-kcal').value, '2750');
});

test('base vide (premier lancement) : aucune erreur', () => {
  const w = load(null);
  w.showPage('nutrition'); w.toggleRepasItem('pdj');
  eq(w.__errors, []);
  ok(w.stored().reglages.kcal === 2750);
});

summary();
