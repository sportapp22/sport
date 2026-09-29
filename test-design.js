const { load, test, eq, ok, summary, oldDB, nextDow, dayOffset } = require('./harness');
console.log('V2.1 : choix de séance + accueil');

function fbx() { const b = oldDB(); b.programme_actif = 'fbx3'; return b; }

test('accueil : séance prévue pré-sélectionnée, chips A/B/C', () => {
  const w = load(fbx());
  const chips = [...w.document.querySelectorAll('#seance-chips .seance-chip')].map(c => c.textContent.trim());
  eq(chips, ['A', 'B', 'C']);
  const planned = w.getNextSeance().seance_id;
  eq(w.getChosenSeance(), planned);
  ok(w.document.getElementById('next-name').textContent === 'Séance ' + planned);
});

test('choisir B puis Commencer : la séance B s\'ouvre, planning intact', () => {
  const w = load(fbx());
  const planningAvant = JSON.stringify(w.get('db.planning'));
  const autre = w.getNextSeance().seance_id === 'B' ? 'C' : 'B';
  w.chooseSeance(autre);
  ok(w.document.getElementById('next-day').textContent.includes('Choix libre'));
  ok(w.document.getElementById('btn-go').textContent.includes('séance ' + autre));
  w.goToSession();
  eq(w.get('tab'), autre);
  ok(w.document.getElementById('page-session').classList.contains('active'));
  eq(JSON.stringify(w.get('db.planning')), planningAvant, 'planning non modifié');
  eq(w.get('dashSeance'), null, 'choix réinitialisé après lancement');
});

test('séance sauvegardée avec la séance choisie', () => {
  const w = load(fbx());
  w.chooseSeance('C'); w.goToSession(); w.goPhase(1);
  const inp = w.document.querySelector('.set-input[data-field=poids]'); inp.value = '40';
  w.goPhase(2);
  w.saveSession();
  const s = w.stored().seances.find(x => x.date === dayOffset(0));
  ok(s && s.seance_id === 'C' && s.programme_id === 'fbx3', JSON.stringify(s));
});

test('PPL : chips PUSH/PULL/LEGS', () => {
  const w = load(oldDB());
  eq([...w.document.querySelectorAll('#seance-chips .seance-chip')].map(c => c.textContent.trim()), ['PUSH', 'PULL', 'LEGS']);
});

test('résumé nutrition du jour sur l\'accueil', () => {
  const b = fbx(); b.repas = { [dayOffset(0)]: { items: { pdj: true }, eau_ml: 750 } };
  const w = load(b);
  const t = w.document.getElementById('dash-nutri').textContent;
  ok(t.includes('660 / 2750') && t.includes('0,75 L'), t);
});

test('squat renommé, identifiant (et historique) conservés', () => {
  const w = load(fbx());
  const ex = w.get("FBX3.A.exos[0]");
  eq([ex.id, ex.nom], ['a_squat_smith', 'Squat barre']);
});

test('toutes les pages sans erreur', () => {
  const w = load(fbx());
  ['dash', 'session', 'nutrition', 'history', 'progress', 'settings', 'week'].forEach(p => w.showPage(p));
  eq(w.__errors, []);
});

summary();
