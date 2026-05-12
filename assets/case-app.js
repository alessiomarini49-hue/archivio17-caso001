// ════════════════════════════════════════════════════════════════
// ARCHIVIO 17 — CASE APP · ENGINE CONDIVISO
// ════════════════════════════════════════════════════════════════
// Storage unificato + scoring globale cross-act.
//
// CHIAVI localStorage gestite qui:
//   a17_session : oggetto unificato { version, global, cloud }
//     - .global : ex a17_global_v1
//     - .cloud.atto{1,2,3} : ex a17_atto{N}_session_token / code_id / access_code
//
// Chiavi NON gestite qui (rimangono separate):
//   a17_atto1_v3, a17_atto2_v2, a17_atto3_v1 : stato gameplay per atto
//   a17_admin_session : admin panel
//
// Dipendenze attese nello scope globale dell'HTML che la include:
//   - GLOBAL_KEY (const string, conservato per retrocompatibilità ma
//     non più usato per la lettura — il valore viene da a17_session.global)
// Stato esportato:
//   - _global : let object, lo stato globale cross-act
// Funzioni esportate:
//   - defaultGlobal(), loadGlobal(), saveGlobal()
//   - globalScore(), globalClassification(score)
//   - updateGlobalFromActState(actNum, hintPenalty, errorPenalty)
//   - markActDone(actNum)
//   - getCloudAuth(actNum) → { token, codeId, code } | null
//   - setCloudAuth(actNum, { token, codeId, code })
//   - clearCloudAuth(actNum)
// ════════════════════════════════════════════════════════════════

const A17_SESSION_KEY = 'a17_session';
const A17_SESSION_VERSION = 1;

// ----------------------------------------------------------------
// MIGRAZIONE DAL VECCHIO STORAGE
// ----------------------------------------------------------------
// Se trova le vecchie chiavi a17_global_v1 / a17_atto*_session_*, le
// copia in a17_session e cancella le originali. Eseguita una sola volta.
function _migrateLegacyStorage(){
  try {
    if(localStorage.getItem(A17_SESSION_KEY)) return; // già migrato o nuovo

    const session = { version: A17_SESSION_VERSION, global: null, cloud: {} };
    let migrated = false;

    // Global score
    const legacyGlobal = localStorage.getItem('a17_global_v1');
    if(legacyGlobal){
      try { session.global = JSON.parse(legacyGlobal); migrated = true; } catch(e) {}
    }

    // Cloud auth per atto
    [1, 2, 3].forEach(n => {
      const token = localStorage.getItem('a17_atto' + n + '_session_token');
      const codeId = localStorage.getItem('a17_atto' + n + '_code_id');
      const code = localStorage.getItem('a17_atto' + n + '_access_code');
      if(token || codeId || code){
        session.cloud['atto' + n] = { token, codeId, code };
        migrated = true;
      }
    });

    if(migrated){
      localStorage.setItem(A17_SESSION_KEY, JSON.stringify(session));
      // Pulizia chiavi legacy
      localStorage.removeItem('a17_global_v1');
      [1, 2, 3].forEach(n => {
        localStorage.removeItem('a17_atto' + n + '_session_token');
        localStorage.removeItem('a17_atto' + n + '_code_id');
        localStorage.removeItem('a17_atto' + n + '_access_code');
      });
    }
  } catch(e) {
    console.warn('[Archivio17] Migrazione storage fallita:', e);
  }
}
_migrateLegacyStorage();

// ----------------------------------------------------------------
// SESSION (oggetto unificato in memoria)
// ----------------------------------------------------------------
function _readSession(){
  try {
    const r = localStorage.getItem(A17_SESSION_KEY);
    if(!r) return { version: A17_SESSION_VERSION, global: null, cloud: {} };
    const p = JSON.parse(r);
    return {
      version: p.version || A17_SESSION_VERSION,
      global: p.global || null,
      cloud: p.cloud || {}
    };
  } catch(e) {
    return { version: A17_SESSION_VERSION, global: null, cloud: {} };
  }
}
function _writeSession(s){
  try { localStorage.setItem(A17_SESSION_KEY, JSON.stringify(s)); } catch(e) {}
}

// ----------------------------------------------------------------
// GLOBAL SCORE (ex a17_global_v1)
// ----------------------------------------------------------------
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
  const s = _readSession();
  const p = s.global;
  if(!p){ _global = defaultGlobal(); return; }
  const def = defaultGlobal();
  _global = {
    ...def, ...p,
    penalty_act1: { ...def.penalty_act1, ...(p.penalty_act1 || {}) },
    penalty_act2: { ...def.penalty_act2, ...(p.penalty_act2 || {}) },
    penalty_act3: { ...def.penalty_act3, ...(p.penalty_act3 || {}) }
  };
}

function saveGlobal(){
  const s = _readSession();
  s.global = _global;
  _writeSession(s);
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

// ----------------------------------------------------------------
// CLOUD AUTH per atto (ex a17_atto{N}_session_token / code_id / access_code)
// ----------------------------------------------------------------
function getCloudAuth(actNum){
  const s = _readSession();
  return (s.cloud && s.cloud['atto' + actNum]) || null;
}
function setCloudAuth(actNum, auth){
  const s = _readSession();
  if(!s.cloud) s.cloud = {};
  s.cloud['atto' + actNum] = {
    token:  auth && auth.token  != null ? auth.token  : null,
    codeId: auth && auth.codeId != null ? auth.codeId : null,
    code:   auth && auth.code   != null ? auth.code   : null
  };
  _writeSession(s);
}
function clearCloudAuth(actNum){
  const s = _readSession();
  if(s.cloud) delete s.cloud['atto' + actNum];
  _writeSession(s);
}
