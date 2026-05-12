// ════════════════════════════════════════════════════════════════
// ARCHIVIO 17 — CASE APP · ENGINE CONDIVISO
// ════════════════════════════════════════════════════════════════
// Funzioni di scoring globale cross-act (penalità Atto I/II/III,
// classificazione finale, blocco caso al termine). Identiche in
// tutti gli atti: tenute qui per avere una sola fonte di verità.
//
// Dipendenze attese nello scope globale dell'HTML che la include:
//   - GLOBAL_KEY  (const string, es. 'a17_global_v1')
// Stato esportato (accessibile dagli script inline degli HTML):
//   - _global     (let object, lo stato globale corrente)
// Funzioni esportate:
//   - defaultGlobal()
//   - loadGlobal(), saveGlobal()
//   - globalScore(), globalClassification(score)
//   - updateGlobalFromActState(actNum, hintPenalty, errorPenalty)
//   - markActDone(actNum)
// ════════════════════════════════════════════════════════════════

function defaultGlobal(){
  return {
    global_score: 100,
    penalty_act1: { hints: 0, errors: 0 },
    penalty_act2: { hints: 0, errors: 0 },
    penalty_act3: { hints: 0, errors: 0 },
    act1_done: false,
    act2_done: false,
    act3_done: false,
    locked: false
  };
}

let _global = defaultGlobal();

function loadGlobal(){
  try {
    const r = localStorage.getItem(GLOBAL_KEY);
    if(!r){ _global = defaultGlobal(); return; }
    const p = JSON.parse(r);
    const def = defaultGlobal();
    _global = {
      ...def, ...p,
      penalty_act1: { ...def.penalty_act1, ...(p.penalty_act1 || {}) },
      penalty_act2: { ...def.penalty_act2, ...(p.penalty_act2 || {}) },
      penalty_act3: { ...def.penalty_act3, ...(p.penalty_act3 || {}) }
    };
  } catch(e) {
    _global = defaultGlobal();
  }
}

function saveGlobal(){
  try { localStorage.setItem(GLOBAL_KEY, JSON.stringify(_global)); } catch(e) {}
}

function globalScore(){
  if(_global.locked) return _global.global_score;
  const p1 = (_global.penalty_act1.hints || 0) + (_global.penalty_act1.errors || 0);
  const p2 = (_global.penalty_act2.hints || 0) + (_global.penalty_act2.errors || 0);
  const p3 = (_global.penalty_act3.hints || 0) + (_global.penalty_act3.errors || 0);
  return Math.max(0, 100 - p1 - p2 - p3);
}

function globalClassification(s){
  if(s >= 90) return 'Archivista in formazione';
  if(s >= 75) return 'Investigatore';
  if(s >= 60) return 'Collaboratore';
  return 'Osservatore esterno';
}

function updateGlobalFromActState(actNum, hintPenalty, errorPenalty){
  if(_global.locked) return;
  _global['penalty_act' + actNum] = { hints: hintPenalty, errors: errorPenalty };
  _global.global_score = globalScore();
  saveGlobal();
}

function markActDone(actNum){
  _global['act' + actNum + '_done'] = true;
  if(actNum === 3) _global.locked = true;
  _global.global_score = globalScore();
  saveGlobal();
}
