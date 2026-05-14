// ════════════════════════════════════════════════════════════════
// ARCHIVIO 17 — CASE APP · ENGINE CONDIVISO
// ════════════════════════════════════════════════════════════════
// Storage unificato + scoring globale cross-act.
//
// CHIAVI localStorage gestite qui:
//   a17_session : oggetto unificato { version, global, cloud }
//     - .global : ex a17_global_v1
//     - .cloud.atto{1,2,3} : ex a17_atto{N}_session_token / code_id / access_code
//     - .cloud.shared : auth condivisa cross-atto (fallback per getCloudAuth).
//       In team un solo Device serve tutta la sessione: senza fallback la
//       transizione atto1→atto2 forzava un secondo validateCode "Nuovo device"
//       saturando max_devices. Vedi project_archivio17_team_license.md Bug 3.
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
//   - resetsLeft(), canReset(), consumeReset()
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

    // Cloud auth per atto + shared cross-atto (vedi getCloudAuth/setCloudAuth)
    [1, 2, 3].forEach(n => {
      const token = localStorage.getItem('a17_atto' + n + '_session_token');
      const codeId = localStorage.getItem('a17_atto' + n + '_code_id');
      const code = localStorage.getItem('a17_atto' + n + '_access_code');
      if(token || codeId || code){
        const auth = { token, codeId, code };
        session.cloud['atto' + n] = auth;
        // L'ultimo atto trovato vince come shared: indifferente perché
        // tutte le entry legacy puntavano comunque allo stesso Device.
        if(token) session.cloud.shared = auth;
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
    locked: false,
    resets_used: 0,
    resets_max: 2
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
    penalty_act3: { ...def.penalty_act3, ...(p.penalty_act3 || {}) },
    resets_used: typeof p.resets_used === 'number' ? p.resets_used : 0,
    resets_max:  typeof p.resets_max  === 'number' ? p.resets_max  : 2
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
// RESET COUNTER (limite reset sessione per giocatore)
// ----------------------------------------------------------------
function resetsLeft(){
  const used = _global.resets_used || 0;
  const max  = _global.resets_max  || 2;
  return Math.max(0, max - used);
}
function canReset(){
  return resetsLeft() > 0;
}
function consumeReset(){
  const max = _global.resets_max || 2;
  _global.resets_used = Math.min((_global.resets_used || 0) + 1, max);
  saveGlobal();
}

// ----------------------------------------------------------------
// CLOUD AUTH cross-atto (ex a17_atto{N}_session_token / code_id / access_code)
// ----------------------------------------------------------------
// La sessione cloud (Device + session_token) è UNICA per tutta la partita:
// validateCode crea un Device per (code_id, session_token) e quel record
// vale per atti 1/2/3. cloud.shared è la fonte canonica; cloud.atto{N} resta
// scritto per retrocompat con eventuali client vecchi che leggono solo per-atto.
function getCloudAuth(actNum){
  const s = _readSession();
  if(!s.cloud) return null;
  // 1) Lookup per-atto (prevale se presente)
  const perAct = s.cloud['atto' + actNum];
  if(perAct && perAct.token) return perAct;
  // 2) Fallback condiviso (caso normale post-fix)
  if(s.cloud.shared && s.cloud.shared.token) return s.cloud.shared;
  // 3) Migrazione lazy: client vecchio che ha solo cloud.attoX → promuovi a shared
  for(const k of ['atto1','atto2','atto3']){
    const legacy = s.cloud[k];
    if(legacy && legacy.token){
      s.cloud.shared = { token: legacy.token, codeId: legacy.codeId || null, code: legacy.code || null };
      _writeSession(s);
      return s.cloud.shared;
    }
  }
  return null;
}
function setCloudAuth(actNum, auth){
  const s = _readSession();
  if(!s.cloud) s.cloud = {};
  const normalized = {
    token:  auth && auth.token  != null ? auth.token  : null,
    codeId: auth && auth.codeId != null ? auth.codeId : null,
    code:   auth && auth.code   != null ? auth.code   : null
  };
  s.cloud['atto' + actNum] = normalized;
  s.cloud.shared = normalized;
  _writeSession(s);
}
// Pulisce TUTTO il blocco cloud (non solo l'atto richiesto): in team la sessione
// cloud è condivisa, quindi revoke/logout/reset locale devono azzerare l'intera
// auth, non solo quella per-atto (altrimenti il fallback shared resusciterebbe
// un token ormai invalido al prossimo getCloudAuth). Gli altri device del team
// mantengono il proprio token nel proprio localStorage — non sono toccati.
function clearCloudAuth(_actNum){
  const s = _readSession();
  if(!s.cloud){ _writeSession(s); return; }
  s.cloud = {};
  _writeSession(s);
}
