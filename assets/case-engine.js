// ════════════════════════════════════════════════════════════════
// ARCHIVIO 17 — CASE ENGINE
// ════════════════════════════════════════════════════════════════
// Fabbrica createCaseApp(config). Genera l'intero DOM dell'esperienza
// di gioco a partire dal JSON di un atto e dalla config minimale.
//
// Dipendenze (caricate prima): assets/config.js, assets/case-app.js
// L'HTML deve contenere <div id="case-app-root"></div>.
//
// Validator built-in: 'min-matches'.
// Per validator custom o section plugin (atto3), vedi
// config.validators e config.sectionPlugins.
// ════════════════════════════════════════════════════════════════

(function(global){
'use strict';

function createCaseApp(userConfig){

// ---------- CONFIG ----------
const config = {
  actNum: 1,
  dataUrl: null,
  storageKey: null,
  storageVersion: 1,
  localCodes: [],
  validators: {},
  sectionPlugins: {},
  skin: 'classic',  // 'classic' (atto1/index) | 'rich' (atto2/atto3). Lo scoping CSS avviene via body.skin-{skin}.
  ...userConfig
};
if(!config.dataUrl)    throw new Error('[case-engine] config.dataUrl mancante');
if(!config.storageKey) throw new Error('[case-engine] config.storageKey mancante');

// Body classes: scoping CSS per skin (skin-rich) e atto (atto-N). Tutte le varianti
// in assets/case-app.css sono attaccate a questi selettori.
document.body.classList.add('skin-' + config.skin, 'atto-' + config.actNum);

// ---------- DATA ----------
let data = null;
const dataReady = fetch(config.dataUrl)
  .then(r => { if(!r.ok) throw new Error('Fetch ' + config.dataUrl + ' fallito: ' + r.status); return r.json(); })
  .then(d => { data = d; })
  .catch(err => {
    console.error('[Archivio17] Errore caricamento dati:', err);
    alert('Impossibile caricare i dati del caso. Verifica di aver aperto il sito tramite un web server (non file://). Esempio: python -m http.server 8000');
    throw err;
  });

// ---------- AUTH ----------
const _auth0 = (typeof getCloudAuth === 'function' ? getCloudAuth(config.actNum) : null) || {};
let _sessionToken = _auth0.token || null;
let _codeId       = _auth0.codeId || null;
let _accessCode   = _auth0.code || null;

// ---------- STATE ----------
function defaultState(){
  // Calcolo num parti / num terminali dal config quando data è caricato; qui struttura minima.
  return {
    version: config.storageVersion,
    hintPenaltyTotal: 0,
    hintLevelsUsed: 0,
    errorsTerminal: 0,
    // Documenti aperti per parte: docsOpened.p1, docsOpened.p2, ...
    docsOpened: {},
    // Terminali completati: terminals.t1 = { completed, errors, fb }
    terminals: {},
    finalUnlocked: false,
    hintsRevealed: {},
    hintPuzzleCost: {},
    puzzleOpen: {},
    currentSection: 'intro',
    // Stato custom dai section plugin (es. casella3 di atto3)
    plugins: {}
  };
}
let state = defaultState();
let _storageWarned = false;
let _toastTimer = null;
let _lastFocusedBeforeViewer = null;
let _syncTimer = null;

// Debounce cloud sync: l'apertura rapida di più documenti coalescenza in una sola POST.
function _scheduleSyncToServer(updates){
  if(_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    _syncTimer = null;
    if(!_sessionToken || !_codeId) return;
    fetch(API_BASE + '/updateSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code_id: _codeId, session_token: _sessionToken, updates })
    }).catch(()=>{});
  }, 600);
}

// Invio immediato (non debounced) di un singolo update. Usato per gli pseudo-campi
// "_inc" che richiedono atomicità server-side: il server applica current + N. Tenere
// fuori dal debounce evita che due tentativi rapidi vengano coalescenza in uno solo.
function _sendUpdateNow(updates){
  if(!_sessionToken || !_codeId) return Promise.resolve();
  return fetch(API_BASE + '/updateSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code_id: _codeId, session_token: _sessionToken, updates })
  }).then(r => r.json()).then(d => {
    if(d && d.game_session) mergeServerState(d.game_session);
    return d;
  }).catch(()=>{});
}

// Helper esposto ai plugin per gli increment atomici lato server (vedi
// INCREMENT_FIELDS in base44/functions/updateSession). Tipico uso: casella3
// chiama cloudIncrement('email_attempts_inc', 1) ad ogni tentativo fallito.
function cloudIncrement(field, n){
  const inc = Number(n);
  if(!field || !Number.isFinite(inc) || inc <= 0) return Promise.resolve();
  return _sendUpdateNow({ [field]: inc });
}

// ---------- STORAGE ----------
function saveState(){
  try { localStorage.setItem(config.storageKey, JSON.stringify(state)); }
  catch(e){
    console.warn('[Archivio17] Impossibile salvare lo stato:', e);
    if(!_storageWarned){
      showToast('Attenzione: i progressi non vengono salvati', 'error');
      _storageWarned = true;
    }
  }
  // Cloud sync (debounced, fire-and-forget)
  if(_sessionToken && _codeId){
    const allDocs = [];
    Object.values(state.docsOpened).forEach(arr => arr.forEach(id => allDocs.push(id)));
    const updates = {
      final_unlocked:  state.finalUnlocked,
      hints_revealed:  state.hintsRevealed,
      current_section: state.currentSection,
      current_act:     config.actNum,
      ['docs_opened_act' + config.actNum]: allDocs
    };
    Object.entries(state.terminals).forEach(([tid, t]) => {
      updates[tid + '_completed'] = !!t.completed;
    });
    // Casella3 (atto3): mappa state.plugins.casella3 -> colonne email_* del backend
    // (whitelist in vault-seventeen/functions/updateSession). emailsOpened resta locale:
    // nessuna colonna dedicata e ininfluente sulla progressione.
    // NOTA: email_attempts (contatore consumati) NON viene scritto qui — è gestito
    // server-side via cloudIncrement('email_attempts_inc', 1) dal plugin casella3,
    // per evitare race tra device team in licenza condivisa.
    const c3 = state.plugins && state.plugins.casella3;
    if(c3){
      if(typeof c3.unlocked === 'boolean') updates.email_unlocked = c3.unlocked;
      if(typeof c3.blocked  === 'boolean') updates.email_blocked  = c3.blocked;
    }
    _scheduleSyncToServer(updates);
  }
}
function loadState(){
  if(typeof loadGlobal === 'function') loadGlobal();

  // Global cleanup orfano: se non c'è alcun access_code salvato ma ci sono penalty,
  // resetta il global (browser condiviso / sessione cancellata)
  if(typeof getCloudAuth === 'function' && typeof defaultGlobal === 'function'){
    const a1 = getCloudAuth(1) || {};
    const a2 = getCloudAuth(2) || {};
    const a3 = getCloudAuth(3) || {};
    const anyCode = a1.code || a2.code || a3.code;
    const hasPenalty =
      (_global.penalty_act1.hints||0) > 0 || (_global.penalty_act1.errors||0) > 0 ||
      (_global.penalty_act2.hints||0) > 0 || (_global.penalty_act2.errors||0) > 0 ||
      (_global.penalty_act3.hints||0) > 0 || (_global.penalty_act3.errors||0) > 0;
    if(!anyCode && hasPenalty){
      _global = defaultGlobal();
      saveGlobal();
    }
  }

  let raw;
  try { raw = localStorage.getItem(config.storageKey); }
  catch(e){ console.warn('[Archivio17] localStorage non disponibile:', e); return; }
  if(!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if(parsed.version !== config.storageVersion){
      try { localStorage.removeItem(config.storageKey); } catch(_){}
      return;
    }
    const def = defaultState();
    state = {
      ...def,
      ...parsed,
      docsOpened:    { ...def.docsOpened,    ...(parsed.docsOpened    || {}) },
      terminals:     { ...def.terminals,     ...(parsed.terminals     || {}) },
      hintsRevealed: { ...def.hintsRevealed, ...(parsed.hintsRevealed || {}) },
      hintPuzzleCost:{ ...(parsed.hintPuzzleCost || {}) },
      puzzleOpen:    { ...(parsed.puzzleOpen    || {}) },
      plugins:       { ...def.plugins,       ...(parsed.plugins       || {}) }
    };
    // Normalizza hintsRevealed: converte eventuali valori non-oggetto in {}
    Object.keys(state.hintsRevealed).forEach(pid => {
      if(typeof state.hintsRevealed[pid] !== 'object' || state.hintsRevealed[pid] === null){
        state.hintsRevealed[pid] = {};
      }
    });
    // Assicura array per ogni parte
    (data ? data.parts : []).forEach(p => {
      if(!Array.isArray(state.docsOpened[p.id])) state.docsOpened[p.id] = [];
    });
  } catch(e){
    console.error('[Archivio17] Stato corrotto, reset:', e);
    try { localStorage.removeItem(config.storageKey); } catch(_){}
  }
}

// ---------- SCORING ----------
function computeScore(){
  if(typeof updateGlobalFromActState === 'function'){
    updateGlobalFromActState(config.actNum, state.hintPenaltyTotal, state.errorsTerminal * 10);
  }
  return (typeof globalScore === 'function') ? globalScore() : 100;
}
function fmtPenalty(v){ return v === 0 ? '0' : '−' + v; }

// ---------- VALIDATION HELPERS ----------
function normalize(str){
  return String(str || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ').trim();
}
function hasAny(text, keywords){ return keywords.some(kw => text.includes(normalize(kw))); }
function isAmbiguousGeneric(text, ambiguousList){
  const t = normalize(text).trim();
  if(!t) return true;
  if(t.length < 4) return true;
  const generic = ambiguousList || [];
  const tokens = t.split(/\s+/);
  if(tokens.length <= 2 && tokens.every(tok => generic.includes(tok))) return true;
  return generic.some(g => t === g);
}
function setFieldState(termPrefix, fieldId, st, msg){
  const stEl = document.getElementById(termPrefix + '-state-' + fieldId);
  const fbEl = document.getElementById(termPrefix + '-fb-' + fieldId);
  if(stEl){
    stEl.textContent =
      st === 'ok' ? 'Verificato' :
      st === 'error' ? 'Non valido' :
      st === 'ambiguous' ? 'Da specificare' : 'In attesa';
    stEl.className = 'terminal-field-state ' + (st || 'pending');
  }
  if(fbEl){ fbEl.textContent = msg || ''; fbEl.className = 'terminal-feedback-line ' + (st || ''); }
}
function interp(template, ctx){
  if(!template) return '';
  return String(template).replace(/\{(\w+)\}/g, (_, k) => (ctx && ctx[k] != null ? ctx[k] : ''));
}
function detectSospetto(text, dicts){
  const v = normalize(text);
  if(!v) return null;
  const sospetti = (dicts && dicts.sospetti) || {};
  for(const key in sospetti){
    if((sospetti[key] || []).some(a => v.includes(normalize(a)))) return key;
  }
  const aliases = (dicts && dicts.sospettiAlias) || {};
  for(const alias in aliases){
    if(v.includes(normalize(alias))) return aliases[alias];
  }
  return null;
}

// ---------- DOM BUILDERS ----------
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function buildShell(){
  const root = document.getElementById('case-app-root');
  if(!root) throw new Error('[case-engine] <div id="case-app-root"> non trovato');
  document.title = data.title;

  root.innerHTML =
    buildAccessScreen() +
    buildHeader() +
    buildMobileNav() +
    buildAppBody() +
    buildMobileInvButton() +
    buildMobileDrawer() +
    buildViewerOverlay() +
    buildResetConfirm() +
    buildToast() +
    buildFooter();
}

function buildAccessScreen(){
  const a = data.access;
  return `
<section class="access-screen" id="access-screen">
  <div class="access-eyebrow">${esc(a.eyebrow)}</div>
  <h1 class="access-title">${esc(a.title)}</h1>
  <p class="access-subtitle">${esc(a.subtitle)}</p>
  <p class="access-act">${esc(a.actLabel)}</p>
  <div id="access-loading" style="display:none;text-align:center;padding:2rem 0">
    <p style="font-family:var(--font-mono);font-size:.85rem;color:var(--text-meta);letter-spacing:.08em">${esc(a.loadingMessage)}</p>
  </div>
  <div id="access-form">
    <div class="access-box">
      <div class="access-classification">${esc(a.classification)}</div>
      <p>${esc(a.description)}</p>
      <div class="access-field">
        <label for="code-input">${esc(a.fieldLabel)}</label>
        <input type="text" id="code-input" class="access-input" placeholder="${esc(a.placeholder)}" autocomplete="off" spellcheck="false">
      </div>
      <p id="access-error" class="access-error"></p>
      <button class="btn-primary full" id="access-btn">${esc(a.buttonLabel)}</button>
    </div>
  </div>
  <p class="access-footer">${a.footer}</p>
</section>`;
}

function buildHeader(){
  return `
<header class="app-header" id="app-header" style="display:none">
  <div class="header-left">
    <div class="header-brand">Archivio 17</div>
    <div class="header-sep"></div>
    <div class="header-case-info"><span class="header-status-dot"></span>${esc(data.caseLabel)}</div>
    <div class="header-act-badge">${esc(data.headerBadge)}</div>
  </div>
  <div class="header-right">
    <div class="indice-badge" aria-live="polite">
      <span class="indice-label">Indice</span>
      <span class="indice-value" id="live-indice">100</span>
    </div>
    <button class="btn-ghost" data-action="reset-confirm" aria-label="Azzera sessione">Reset</button>
  </div>
</header>`;
}

// Sincronizza classe .locked e aria-disabled su un item di navigazione.
function setNavLocked(el, locked){
  if(!el) return;
  el.classList.toggle('locked', !!locked);
  if(locked) el.setAttribute('aria-disabled', 'true');
  else       el.removeAttribute('aria-disabled');
}

function buildMobileNav(){
  const items = [
    { id: 'intro', label: data.intro.mNavLabel || 'Archivista', locked: false }
  ];
  data.parts.forEach(p => {
    items.push({ id: p.sectionId, label: p.mNavLabel, locked: !!p.lockedUntilTerminal });
    items.push({ id: p.terminal.sectionId, label: p.terminal.mNavLabel, locked: true });
  });
  items.push({ id: data.esito.sectionId, label: data.esito.mNavLabel, locked: true });
  // Eventuali sezioni extra (atto3: verifiche, casella)
  (data.extraSections || []).forEach(s => {
    items.push({ id: s.sectionId, label: s.mNavLabel, locked: !!s.locked });
  });
  items.push({ id: data.supporto.sectionId, label: data.supporto.mNavLabel, locked: false });

  return `
<nav class="mobile-nav" id="mobile-nav" aria-label="Navigazione fascicolo" style="display:none">
${items.map((it, i) =>
  `<button class="mnav-item${i===0?' active':''}${it.locked?' locked':''}"${it.locked?' aria-disabled="true"':''} data-section="${esc(it.id)}" id="mnav-${esc(it.id)}">${esc(it.label)}</button>`
).join('')}
<button class="mnav-item" data-action="toggle-mobile-drawer">Stato</button>
</nav>`;
}

function buildAppBody(){
  return `
<div class="app-body" id="app-body" style="display:none">
  ${buildSidebar()}
  <main class="main-content">
    ${buildIntroSection()}
    ${data.parts.map(p => buildFascicoloSection(p)).join('')}
    ${data.parts.map(p => buildTerminaleSection(p)).join('')}
    ${buildExtraSections()}
    ${buildEsitoSection()}
    ${buildSupportoSection()}
  </main>
  ${buildInvPanel()}
</div>`;
}

function buildSidebar(){
  const items = [
    `<button class="nav-item active" data-section="intro" id="nav-intro"><span class="nav-dot"></span>${esc(data.intro.navLabel)}</button>`
  ];
  data.parts.forEach(p => {
    items.push(`<button class="nav-item${p.lockedUntilTerminal?' locked':''}"${p.lockedUntilTerminal?' aria-disabled="true"':''} data-section="${esc(p.sectionId)}" id="nav-${esc(p.sectionId)}"><span class="nav-dot"></span>${esc(p.navLabel)}</button>`);
    items.push(`<button class="nav-item locked" aria-disabled="true" data-section="${esc(p.terminal.sectionId)}" id="nav-${esc(p.terminal.sectionId)}"><span class="nav-dot"></span>${esc(p.terminal.navLabel)}</button>`);
  });
  (data.extraSections || []).forEach(s => {
    items.push(`<button class="nav-item${s.locked?' locked':''}"${s.locked?' aria-disabled="true"':''} data-section="${esc(s.sectionId)}" id="nav-${esc(s.sectionId)}"><span class="nav-dot"></span>${esc(s.navLabel)}</button>`);
  });
  items.push(`<button class="nav-item locked" aria-disabled="true" data-section="${esc(data.esito.sectionId)}" id="nav-${esc(data.esito.sectionId)}"><span class="nav-dot"></span>${esc(data.esito.navLabel)}</button>`);
  return `
<nav class="nav-sidebar" aria-label="Indice fascicolo">
  <div class="nav-section-label">Indice fascicolo</div>
  ${items.join('\n  ')}
  <div class="nav-section-label" style="margin-top:.5rem">Strumenti</div>
  <button class="nav-item" data-section="${esc(data.supporto.sectionId)}" id="nav-${esc(data.supporto.sectionId)}"><span class="nav-dot"></span>${esc(data.supporto.navLabel)}</button>
  <div class="nav-sidebar-footer">
    <button class="btn-ghost" style="width:100%" data-action="reset-confirm">Azzera sessione</button>
  </div>
</nav>`;
}

function buildIntroSection(){
  const i = data.intro;
  const facts = i.factGrid.map(f =>
    `<div class="fact-cell"><div class="fact-label">${esc(f.label)}</div><div class="fact-value">${esc(f.value)}</div></div>`
  ).join('');
  const actions = (i.actions || []).map(a =>
    `<button class="btn-${a.variant==='primary'?'primary':'secondary'}" data-section="${esc(a.section)}">${esc(a.label)}</button>`
  ).join('');
  const paras = (i.paragraphs || []).map(p => `<p>${p}</p>`).join('');
  return `
<div class="app-section active" id="section-intro">
  <div class="section-wrapper">
    <div class="section-header">
      <div class="section-eyebrow">${esc(i.eyebrow)}</div>
      <h2 class="section-title">${esc(i.title)}</h2>
      <div class="section-subtitle">${esc(i.subtitle)}</div>
    </div>
    <div class="intro-transmission">
      <span class="intro-transmission-label">${esc(i.transmissionLabel)}</span>
      <span class="intro-transmission-line"></span>
    </div>
    <div class="intro-panel anim-in">
      <div class="intro-text">${paras}</div>
      <div class="intro-signature">${esc(i.signature)}</div>
    </div>
    <div class="fact-grid">${facts}</div>
    <p style="font-size:13px;color:var(--text-meta);margin-bottom:1.5rem;line-height:1.7;">${i.unlockHint}</p>
    <div style="margin-top:2rem;display:flex;gap:.75rem;flex-wrap:wrap">${actions}</div>
  </div>
</div>`;
}

function buildFascicoloSection(p){
  const s = p.section;
  const rich = config.skin === 'rich';

  // Promemoria card opzionale (es. parte2 atto2 dopo t2a)
  let promemoriaHtml = '';
  if(p.promemoria){
    const pm = p.promemoria;
    const paragraphs = (pm.paragraphs || []).map(x => `<p>${x}</p>`).join('');
    promemoriaHtml = `
    <div class="promemoria-card anim-in">
      <div class="promemoria-label">${esc(pm.label)}</div>
      <div class="promemoria-text">${paragraphs}</div>
      ${pm.sig ? `<div class="promemoria-sig">${esc(pm.sig)}</div>` : ''}
    </div>`;
  }

  // section-desc opzionale (può essere assente)
  const sectionDescHtml = s.desc ? `<p class="section-desc">${esc(s.desc)}</p>` : '';

  // Locked sibling banner (es. parte1 atto2: "Reperti ad alta sensibilità bloccati")
  let lockedSiblingHtml = '';
  if(p.lockedSiblingBanner){
    const lsb = p.lockedSiblingBanner;
    lockedSiblingHtml = `
    <div class="locked-banner" id="locked-sibling-${esc(p.id)}" style="margin-top:1.5rem">
      ${lsb.icon ? `<span class="locked-banner-icon">${esc(lsb.icon)}</span>` : ''}
      <span class="locked-banner-text">${lsb.text}</span>
    </div>`;
  }

  // Meta row: per skin 'rich' è opzionale (atto2 omette la riga Caso in p2)
  const metaItems = [];
  if(p.showCaseInMeta !== false){
    metaItems.push(`<div class="fascicolo-meta-item">Caso <span class="val">${esc(data.caseRef)}</span></div>`);
  }
  metaItems.push(`<div class="fascicolo-meta-item">Fase <span class="val">${esc(s.metaPhase)}</span></div>`);
  metaItems.push(`<div class="fascicolo-meta-item">Reperti <span class="val"><span id="docs-count-${esc(p.id)}">0</span> / ${p.totalDocs}</span></div>`);
  const metaHtml = metaItems.join('<div class="fascicolo-meta-sep"></div>');

  // Unlock banner / unlock bar (variante per skin)
  let unlockHtml = '';
  if(p.unlockBar){
    // Skin rich: unlock bar con CTA
    const ub = p.unlockBar;
    unlockHtml = `
    <div class="terminal-unlock-bar" id="terminal-unlock-banner-${esc(p.id)}" style="margin-top:1.5rem;display:none">
      <span class="terminal-unlock-msg">${esc(ub.msg)}</span>
      <button class="btn-primary" data-section="${esc(ub.ctaTarget)}">${esc(ub.ctaLabel)}</button>
    </div>`;
  } else {
    // Skin classic: banner semplice
    unlockHtml = `
    <div class="unlock-banner" id="terminal-unlock-banner-${esc(p.id)}">
      <div class="unlock-banner-dot"></div>
      <span class="unlock-banner-text">${esc(s.unlockBannerText)}</span>
    </div>`;
  }

  const docsSectionLabelHtml = s.docsSectionLabel ? `<div class="docs-section-label">${esc(s.docsSectionLabel)}</div>` : '';
  const ctaHtml = p.ctaNext && !p.unlockBar ? `<div style="margin-top:1.75rem"><button class="btn-primary" data-section="${esc(p.ctaNext.section)}">${esc(p.ctaNext.label)}</button></div>` : '';

  // narrativeOnly: parte priva di documenti (es. atto3 parte3 di pre-conclusione).
  // Niente meta/docs/unlock-bar/locked-sibling — solo promemoria + section-header + CTA.
  if(p.narrativeOnly){
    return `
<div class="app-section" id="section-${esc(p.sectionId)}">
  <div class="section-wrapper">
    ${promemoriaHtml}
    <div class="section-header">
      <div class="section-eyebrow">${esc(s.eyebrow)}</div>
      <h2 class="section-title">${esc(s.title)}</h2>
      <div class="section-subtitle">${esc(s.subtitle)}</div>
      ${sectionDescHtml}
    </div>
    ${ctaHtml}
  </div>
</div>`;
  }

  return `
<div class="app-section" id="section-${esc(p.sectionId)}">
  <div class="section-wrapper">
    ${promemoriaHtml}
    <div class="section-header">
      <div class="section-eyebrow">${esc(s.eyebrow)}</div>
      <h2 class="section-title">${esc(s.title)}</h2>
      <div class="section-subtitle">${esc(s.subtitle)}</div>
      ${sectionDescHtml}
    </div>
    <div class="fascicolo-meta">${metaHtml}</div>
    ${rich ? '' : unlockHtml}
    ${docsSectionLabelHtml}
    <div class="docs-grid" id="docs-grid-${esc(p.id)}"></div>
    ${lockedSiblingHtml}
    ${rich ? unlockHtml : ''}
    ${ctaHtml}
  </div>
</div>`;
}

function buildTerminaleSection(p){
  const t = p.terminal;
  const v = t.validator || {};
  const rich = config.skin === 'rich';
  const fields = (v.fields || []).map(f => {
    const inputCtrl = (f.inputType === 'text')
      ? `<input type="text" class="terminal-input" id="${esc(t.id)}-input-${f.id}" placeholder="${esc(f.placeholder||'')}" autocomplete="off" spellcheck="false">`
      : `<textarea class="${rich ? 'terminal-textarea' : 'terminal-input'}" id="${esc(t.id)}-input-${f.id}" rows="${f.rows||2}" placeholder="${esc(f.placeholder||'')}"></textarea>`;
    return `
      <div class="terminal-field" id="${esc(t.id)}-field-${f.id}">
        <div class="terminal-field-head">
          <div class="terminal-field-id">${esc(f.label)}</div>
          <div class="terminal-field-state pending" id="${esc(t.id)}-state-${f.id}">In attesa</div>
        </div>
        <div class="terminal-q">${esc(f.question)}</div>
        ${inputCtrl}
        <div class="terminal-feedback-line" id="${esc(t.id)}-fb-${f.id}"></div>
      </div>`;
  }).join('');

  const sectionDesc = t.section.desc ? `<p class="section-desc">${esc(t.section.desc)}</p>` : '';

  const panelInner = rich ? `
      <div class="terminal-frame">
        <div class="terminal-topbar">
          <div class="terminal-pulse"></div>
          <div class="terminal-sys-label">${esc(t.systemLabel || (t.panel && t.panel.eyebrow) || t.navLabel)}</div>
        </div>
        <div class="terminal-body">
          <div class="terminal-fields">${fields}</div>
          <div class="terminal-global-feedback" id="${esc(t.id)}-global-fb"></div>
          <div class="terminal-confirmed" id="${esc(t.id)}-confirmed">
            <div class="terminal-confirmed-label">${esc(t.confirmedLabel)}</div>
            <div class="terminal-confirmed-msg" id="${esc(t.id)}-confirmed-msg">${esc(t.confirmedMsg)}</div>
          </div>
          <button class="terminal-submit" id="${esc(t.id)}-submit" data-submit-terminal="${esc(t.id)}">${esc(t.submitLabel)}</button>
        </div>
      </div>
  ` : `
      <div class="terminal-panel">
        <div class="terminal-eyebrow">${esc(t.panel.eyebrow)}</div>
        <div class="terminal-desc">${t.panel.desc}</div>
        <div class="terminal-fields">${fields}</div>
        <button class="terminal-submit" id="${esc(t.id)}-submit" data-submit-terminal="${esc(t.id)}">${esc(t.submitLabel)}</button>
        <div class="terminal-global-feedback" id="${esc(t.id)}-global-fb"></div>
        <div class="terminal-confirmed" id="${esc(t.id)}-confirmed">
          <div class="terminal-confirmed-label">${esc(t.confirmedLabel)}</div>
          <div class="terminal-confirmed-msg" id="${esc(t.id)}-confirmed-msg">${esc(t.confirmedMsg)}</div>
        </div>
      </div>
  `;

  return `
<div class="app-section" id="section-${esc(t.sectionId)}">
  <div class="section-wrapper">
    <div class="section-header">
      <div class="section-eyebrow">${esc(t.section.eyebrow)}</div>
      <h2 class="section-title">${esc(t.section.title)}</h2>
      <div class="section-subtitle">${esc(t.section.subtitle)}</div>
      ${sectionDesc}
    </div>
    <div id="${esc(t.id)}-lock-banner" class="lock-banner" style="display:none">
      <strong>${esc(t.lockBanner.title)}</strong>
      ${esc(t.lockBanner.desc)}
    </div>
    <div id="${esc(t.id)}-form" style="display:none">${panelInner}</div>
  </div>
</div>`;
}

function buildExtraSections(){
  return (data.extraSections || []).map(s => {
    const plugin = config.sectionPlugins[s.plugin];
    const content = plugin && plugin.render ? plugin.render({ data, state, config, helpers }) : '';
    return `<div class="app-section" id="section-${esc(s.sectionId)}"><div class="section-wrapper">${content}</div></div>`;
  }).join('');
}

function buildEsitoSection(){
  const e = data.esito;
  const rich = config.skin === 'rich';
  const actions = (e.actions || []).map(a => {
    if(a.href) return `<a href="${esc(a.href)}" class="btn-${a.variant==='primary'?'primary':'secondary'}">${esc(a.label)}</a>`;
    return `<button class="btn-${a.variant==='primary'?'primary':'secondary'}" data-section="${esc(a.section)}">${esc(a.label)}</button>`;
  }).join('');

  // Score-breakdown: skin rich usa label differenti (es. "Aiuti consultati" / "0 richieste")
  const lbl = e.breakdownLabels || {};
  const breakdownHtml = `
      <div class="bd-row"><span>Punteggio base</span><span class="bd-val" style="color:var(--success-text)">100</span></div>
      <div class="bd-row"><span>${esc(lbl.hintCount || 'Supporti richiesti')}</span><span class="bd-val" id="esito-hint-count">${esc(lbl.hintCountInitial || '0 livelli')}</span></div>
      <div class="bd-row"><span>${esc(lbl.hintCost || 'Penalità supporti')}</span><span class="bd-val penalty" id="esito-hint-cost">0</span></div>
      <div class="bd-row"><span>${esc(lbl.errCost || 'Penalità errori Terminale')}</span><span class="bd-val penalty" id="esito-err-cost">0</span></div>
      <div class="bd-row total"><span>Indice investigativo finale</span><span class="bd-val" id="esito-total">100</span></div>`;

  // Headline statica (rich) o dinamica per tier (classic)
  const headlineHtml = e.staticHeadline
    ? `<div class="final-headline">${esc(e.staticHeadline)}</div>`
    : `<div class="final-headline" id="esito-final-headline">—</div>`;

  // Body: skin rich (final-body branched) vs classic (final-narrative per tier)
  const bodyHtml = e.bodyTemplate
    ? `<div class="final-body" id="esito-narrative">—</div>`
    : `<div class="final-narrative">
        <div class="final-narrative-label">${esc(e.narrativeLabel || '')}</div>
        <div class="final-narrative-text" id="esito-narrative">—</div>
      </div>`;

  // Ipotesi box opzionale (atto2: elementi non allineati)
  let ipotesiHtml = '';
  if(e.ipotesiBox){
    ipotesiHtml = `
      <div class="final-ipotesi-box">
        <div class="final-ipotesi-label">${esc(e.ipotesiBox.label)}</div>
        <div class="final-ipotesi-text">${e.ipotesiBox.text}</div>
      </div>`;
  }

  return `
<div class="app-section" id="section-${esc(e.sectionId)}">
  <div class="section-wrapper">
    <div class="section-header">
      <div class="section-eyebrow">${esc(e.eyebrow)}</div>
      <h2 class="section-title">${esc(e.title)}</h2>
    </div>
    <div class="score-card${rich ? ' anim-in' : ''}">
      <div class="score-main-panel">
        <div class="score-classlabel">${esc(e.scoreClassLabel || 'Indice investigativo')}</div>
        <div class="score-number" id="esito-score">100</div>
        <div class="score-classname" id="esito-classname">—</div>
      </div>
      <div class="score-breakdown">${breakdownHtml}</div>
    </div>
    <div class="final-scene" id="esito-final-scene">
      <div class="final-tag">${esc(e.finalTag)}</div>
      ${headlineHtml}
      <div class="final-divider"></div>
      ${bodyHtml}
      ${ipotesiHtml}
      <div class="final-divider"></div>
      <div class="final-tease">
        <div class="final-tease-label">${esc(e.finalTease.label)}</div>
        <div class="final-tease-text">${e.finalTease.text}</div>
        <div class="final-tease-firm">${esc(e.finalTease.firm)}</div>
      </div>
      <div class="final-actions">${actions}</div>
    </div>
    ${e.bottomReset ? `<div style="margin-top:1.5rem;display:flex;gap:.75rem;flex-wrap:wrap"><button class="btn-ghost" data-action="reset-confirm">${esc(e.bottomReset)}</button></div>` : ''}
  </div>
</div>`;
}

function buildSupportoSection(){
  const s = data.supporto;
  return `
<div class="app-section" id="section-${esc(s.sectionId)}">
  <div class="section-wrapper">
    <div class="section-header">
      <div class="section-eyebrow">${esc(s.eyebrow)}</div>
      <h2 class="section-title">${esc(s.title)}</h2>
      <div class="section-subtitle">${esc(s.subtitle)}</div>
    </div>
    <div class="support-intro-panel">
      <p>${s.intro1}</p>
      <p style="margin-top:.6rem;font-style:italic;color:var(--text-dim)">${esc(s.intro2)}</p>
    </div>
    <div id="puzzles-container"></div>
  </div>
</div>`;
}

function buildInvPanel(){
  const peopleRows = (data.people || []).map(p =>
    `<div class="inv-status-row"><span class="inv-status-label">${esc(p.label)}</span><span class="inv-status-val" id="inv-person-${esc(p.id)}">${p.alwaysVisible ? esc(p.role) : '—'}</span></div>`
  ).join('');
  const termRows = data.parts.map(p =>
    `<div class="inv-status-row"><span class="inv-status-label">${esc(p.terminal.navLabel)}</span><span class="inv-status-val" id="inv-${esc(p.terminal.id)}">non validato</span></div>`
  ).join('');
  const docsRows = data.parts.filter(p => !p.narrativeOnly).map(p =>
    `<div class="inv-status-row"><span class="inv-status-label">${data.parts.length > 1 ? esc(p.mNavLabel) + ' — Reperti' : 'Reperti'}</span><span class="inv-status-val" id="inv-docs-${esc(p.id)}">0 / ${p.totalDocs}</span></div>`
  ).join('');
  const showActRow = data.investigationPanel.showActRow !== false;
  const showPeopleSection = (data.people || []).length > 0;
  const timeline = data.investigationPanel.timeline || [];
  const showTimeline = timeline.length > 0;
  const timelineRowHtml = timeline.map(ev =>
    `<div style="display:flex;gap:.75rem;align-items:flex-start;padding:.4rem 0;border-top:1px solid var(--border-white-soft)">
      <div style="width:11px;height:11px;border-radius:50%;border:1px solid ${ev.color || 'var(--text-dim)'};background:${ev.bg || 'var(--bg-main)'};flex-shrink:0;margin-top:3px"></div>
      <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-dim);flex-shrink:0;margin-top:1px;min-width:40px">${esc(ev.date)}</div>
      <div style="font-size:11px;color:var(--text-secondary);line-height:1.45;margin-top:1px">${ev.text}</div>
    </div>`
  ).join('');
  return `
<aside class="investigation-panel" aria-label="Stato del fascicolo">
  <div class="inv-panel-header"><div class="inv-panel-title">Stato fascicolo</div></div>
  <div class="inv-section">
    <div class="inv-label">Scheda caso</div>
    <div class="inv-case-status" id="inv-case-status">${esc(data.investigationPanel.caseStatusOpen)}</div>
    <div style="margin-top:.65rem">
      <div class="inv-status-row"><span class="inv-status-label">Caso</span><span class="inv-status-val">${esc(data.caseRef)}</span></div>
      <div class="inv-status-row"><span class="inv-status-label">Atto</span><span class="inv-status-val">${esc(data.attoLabel)}</span></div>
      <div class="inv-status-row"><span class="inv-status-label">Fase</span><span class="inv-status-val active" id="inv-fase">${esc(data.investigationPanel.fasePhases.initial)}</span></div>
    </div>
  </div>
  <div class="inv-section">
    <div class="inv-label">Indice investigativo</div>
    <div style="display:flex;align-items:baseline;gap:.4rem;margin-bottom:.4rem">
      <span style="font-family:var(--font-serif);font-size:1.8rem;font-weight:300;color:var(--text-main)" id="inv-score-big">100</span>
      <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-dim);letter-spacing:.15em">/100</span>
    </div>
    <div class="inv-indice-bar"><div class="inv-indice-fill high" id="inv-score-bar" style="width:100%"></div></div>
    <div class="inv-breakdown" id="inv-breakdown" style="font-family:var(--font-mono);font-size:.68rem;color:var(--text-meta);margin-top:.5rem;line-height:1.7;"></div>
    <div class="inv-status-row" style="margin-top:.5rem"><span class="inv-status-label">Reset disponibili</span><span class="inv-status-val" id="inv-resets">●● 2/2</span></div>
    <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-meta);letter-spacing:.1em;margin-top:.3rem" id="inv-class-label">—</div>
  </div>
  <div class="inv-section">
    <div class="inv-label">Progressione</div>
    ${docsRows}
    ${termRows}
    ${showActRow ? `<div class="inv-status-row"><span class="inv-status-label">${esc(data.headerBadge)}</span><span class="inv-status-val blocked" id="inv-atto">${esc(data.investigationPanel.attoLabels.inProgress)}</span></div>` : ''}
  </div>
  <div class="inv-section">
    <div class="inv-label">Dati sessione</div>
    <div class="inv-status-row"><span class="inv-status-label">Supporti richiesti</span><span class="inv-status-val" id="inv-hints-used">0 livelli</span></div>
    <div class="inv-status-row"><span class="inv-status-label">Errori terminale</span><span class="inv-status-val" id="inv-errors">0</span></div>
  </div>
  ${showPeopleSection ? `
  <div class="inv-section">
    <div class="inv-label">Persone coinvolte</div>
    ${peopleRows}
  </div>` : ''}
  ${showTimeline ? `
  <div class="inv-section">
    <div class="inv-label">${esc(data.investigationPanel.timelineLabel || 'Timeline')}</div>
    <div style="display:flex;flex-direction:column;gap:0">${timelineRowHtml}</div>
  </div>` : ''}
</aside>`;
}

function buildMobileInvButton(){
  return `<button class="mobile-inv-btn" data-action="toggle-mobile-drawer" id="mobile-inv-btn" aria-label="Apri stato fascicolo" style="display:none">Stato fascicolo ↑</button>`;
}

function buildMobileDrawer(){
  const docsRows = data.parts.filter(p => !p.narrativeOnly).map(p =>
    `<div class="inv-status-row"><span class="inv-status-label">${data.parts.length > 1 ? esc(p.mNavLabel) + ' — Reperti' : 'Reperti'}</span><span class="inv-status-val" id="minv-docs-${esc(p.id)}">0 / ${p.totalDocs}</span></div>`
  ).join('');
  const termRows = data.parts.map(p =>
    `<div class="inv-status-row"><span class="inv-status-label">${esc(p.terminal.navLabel)}</span><span class="inv-status-val" id="minv-${esc(p.terminal.id)}">non validato</span></div>`
  ).join('');
  return `
<div class="mobile-inv-drawer" id="mobile-inv-drawer" role="dialog" aria-modal="true" aria-label="Stato fascicolo (mobile)" aria-hidden="true">
  <div class="mobile-inv-panel">
    <div class="mobile-inv-close"><button class="btn-ghost" data-action="toggle-mobile-drawer">Chiudi ✕</button></div>
    <div class="inv-section">
      <div class="inv-label">Scheda caso</div>
      <div class="inv-status-row"><span class="inv-status-label">Caso</span><span class="inv-status-val">${esc(data.caseRef)}</span></div>
      <div class="inv-status-row"><span class="inv-status-label">Atto</span><span class="inv-status-val">${esc(data.attoLabel)}</span></div>
      <div class="inv-status-row"><span class="inv-status-label">Fase</span><span class="inv-status-val active" id="minv-fase">${esc(data.investigationPanel.fasePhases.initial)}</span></div>
    </div>
    <div class="inv-section">
      <div class="inv-label">Indice investigativo</div>
      <div style="display:flex;align-items:baseline;gap:.4rem;margin-bottom:.4rem">
        <span style="font-family:var(--font-serif);font-size:1.8rem;font-weight:300;color:var(--text-main)" id="minv-score-big">100</span>
        <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-dim);letter-spacing:.15em">/100</span>
      </div>
      <div class="inv-indice-bar"><div class="inv-indice-fill high" id="minv-score-bar" style="width:100%"></div></div>
      <div class="inv-breakdown" id="minv-breakdown" style="font-family:var(--font-mono);font-size:.68rem;color:var(--text-meta);margin-top:.5rem;line-height:1.7;"></div>
      <div class="inv-status-row" style="margin-top:.5rem"><span class="inv-status-label">Reset disponibili</span><span class="inv-status-val" id="minv-resets">●● 2/2</span></div>
    </div>
    <div class="inv-section">
      <div class="inv-label">Progressione</div>
      ${docsRows}
      ${termRows}
    </div>
    <div class="inv-section">
      <div class="inv-label">Dati sessione</div>
      <div class="inv-status-row"><span class="inv-status-label">Supporti</span><span class="inv-status-val" id="minv-hints">0 livelli</span></div>
      <div class="inv-status-row"><span class="inv-status-label">Errori</span><span class="inv-status-val" id="minv-errors">0</span></div>
    </div>
  </div>
</div>`;
}

function buildViewerOverlay(){
  return `
<div class="viewer-overlay" id="viewer-overlay" role="dialog" aria-modal="true" aria-labelledby="v-title">
  <div class="viewer-card">
    <div class="viewer-back-bar">
      <div class="viewer-doc-meta">
        <span class="viewer-doc-code" id="v-code">—</span>
        <span class="viewer-doc-cat" id="v-cat">—</span>
        <span class="viewer-class-badge">Riservato</span>
        <span class="viewer-consulted" id="v-consulted"></span>
      </div>
      <button class="viewer-close-btn" data-action="close-viewer">Chiudi ✕</button>
    </div>
    <div class="viewer-body" id="viewer-body">
      <h2 class="viewer-title" id="v-title">—</h2>
      <div id="v-img-container"></div>
      <div class="content-panel open" id="v-transcript-panel">
        <div class="content-panel-hdr" data-action="toggle-content-panel">
          <span class="content-panel-lbl">Trascrizione leggibile</span>
          <span class="content-panel-arrow">▼</span>
        </div>
        <div class="content-panel-body"><div class="transcript-text" id="v-transcript">—</div></div>
      </div>
      <div class="content-panel open" id="v-note-panel">
        <div class="content-panel-hdr" data-action="toggle-content-panel">
          <span class="content-panel-lbl">Note del fascicolo</span>
          <span class="content-panel-arrow">▼</span>
        </div>
        <div class="content-panel-body"><div class="fascicolo-note" id="v-note">—</div></div>
      </div>
    </div>
    <div class="viewer-actions">
      <button class="btn-primary" data-action="close-viewer">✓ Esamina reperto</button>
      <button class="btn-ghost" data-action="close-viewer">Torna al fascicolo</button>
    </div>
  </div>
</div>`;
}

function buildResetConfirm(){
  const r = data.resetConfirm;
  return `
<div id="confirm-overlay" class="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
  <div class="confirm-box">
    <h3 id="confirm-title">${esc(r.title)}</h3>
    <p>${esc(r.description)}</p>
    <p style="font-family:var(--font-mono);font-size:.75rem;color:var(--amber);margin-top:.6rem">Reset disponibili: <span id="confirm-resets-left">—</span> / 2 · Dopo questa operazione ne resteranno <span id="confirm-resets-after">—</span>.</p>
    <div class="confirm-actions">
      <button class="btn-primary" id="confirm-reset-btn" data-action="confirm-reset">${esc(r.buttonLabel)}</button>
      <button class="btn-ghost" data-action="cancel-reset">${esc(r.cancelLabel)}</button>
    </div>
  </div>
</div>`;
}

function buildToast(){
  return `<div id="toast" class="toast" role="status" aria-live="polite"></div>`;
}

function buildFooter(){
  return `<footer class="app-footer" id="app-footer" style="display:none">${esc(data.footer)}</footer>`;
}

// ---------- EVENT BINDING ----------
function bindEvents(){
  // Access button + Enter on code input
  const accessBtn = document.getElementById('access-btn');
  if(accessBtn) accessBtn.addEventListener('click', doAccess);
  const codeInput = document.getElementById('code-input');
  if(codeInput) codeInput.addEventListener('keydown', e => { if(e.key === 'Enter') doAccess(); });

  // Section navigation (sidebar, mobile nav, CTAs)
  document.querySelectorAll('[data-section]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      showSection(el.dataset.section);
    });
  });

  // Reset confirm
  document.querySelectorAll('[data-action="reset-confirm"]').forEach(el =>
    el.addEventListener('click', showResetConfirm));
  document.querySelectorAll('[data-action="confirm-reset"]').forEach(el =>
    el.addEventListener('click', confirmReset));
  document.querySelectorAll('[data-action="cancel-reset"]').forEach(el =>
    el.addEventListener('click', () => document.getElementById('confirm-overlay').classList.remove('visible')));

  // Mobile drawer
  document.querySelectorAll('[data-action="toggle-mobile-drawer"]').forEach(el =>
    el.addEventListener('click', toggleMobileDrawer));
  const drawer = document.getElementById('mobile-inv-drawer');
  if(drawer) drawer.addEventListener('click', e => { if(e.target === drawer) toggleMobileDrawer(); });

  // Viewer close + content panel toggles
  document.querySelectorAll('[data-action="close-viewer"]').forEach(el =>
    el.addEventListener('click', closeViewer));
  document.querySelectorAll('[data-action="toggle-content-panel"]').forEach(el =>
    el.addEventListener('click', () => el.parentElement.classList.toggle('open')));

  // Terminal submit
  document.querySelectorAll('[data-submit-terminal]').forEach(el =>
    el.addEventListener('click', () => submitTerminal(el.dataset.submitTerminal)));

  // Esc key
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    const viewer = document.getElementById('viewer-overlay');
    if(viewer && viewer.classList.contains('open')){ closeViewer(); return; }
    const conf = document.getElementById('confirm-overlay');
    if(conf && conf.classList.contains('visible')){ conf.classList.remove('visible'); return; }
    const dr = document.getElementById('mobile-inv-drawer');
    if(dr && dr.classList.contains('open')) toggleMobileDrawer();
  });
}

// ---------- ACCESS ----------
function doAccess(){
  const inpEl = document.getElementById('code-input');
  const errEl = document.getElementById('access-error');
  const btn = document.getElementById('access-btn');
  const inp = (inpEl.value || '').trim().toUpperCase();

  if(!inp){ showAccessError('Inserisci il codice di accesso.'); return; }

  if((config.localCodes || []).includes(inp)){
    errEl.classList.remove('visible');
    bootApp();
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Verifica...';
  const fp = btoa([navigator.userAgent, screen.width, screen.height, navigator.language].join('|')).slice(0, 32);

  const abortCtl = new AbortController();
  const timeoutId = setTimeout(() => abortCtl.abort(), 10000);

  fetch(API_BASE + '/validateCode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: inp, fingerprint: fp }),
    signal: abortCtl.signal
  })
  .then(r => { clearTimeout(timeoutId); return r.json(); })
  .then(d => {
    btn.disabled = false;
    btn.textContent = data.access.buttonLabel;
    if(d && d.ok && d.session_token){
      _sessionToken = d.session_token;
      _codeId       = d.game_session ? d.game_session.code_id : null;
      _accessCode   = inp;
      if(typeof setCloudAuth === 'function') setCloudAuth(config.actNum, { token: _sessionToken, codeId: _codeId, code: inp });
      if(d.game_session) mergeServerState(d.game_session);
      errEl.classList.remove('visible');
      bootApp();
    } else {
      showAccessError((d && d.error) || 'Codice non valido.');
    }
  })
  .catch((e) => {
    clearTimeout(timeoutId);
    btn.disabled = false;
    btn.textContent = data.access.buttonLabel;
    if(e && e.name === 'AbortError'){
      showAccessError('Timeout connessione. Riprova.');
    } else {
      showAccessError('Errore di connessione. Riprova.');
    }
  });
}
function showAccessError(msg){
  const e = document.getElementById('access-error');
  e.textContent = msg;
  e.classList.add('visible');
}
function mergeServerState(gs){
  if(!gs) return;
  data.parts.forEach(p => {
    const t = p.terminal;
    const key = t.id + '_completed';
    if(gs[key]){
      state.terminals[t.id] = { ...(state.terminals[t.id] || {}), completed: true };
    }
  });
  if(gs.final_unlocked) state.finalUnlocked = true;
  const docsKey = 'docs_opened_act' + config.actNum;
  if(Array.isArray(gs[docsKey]) && gs[docsKey].length){
    // Per atti single-part: tutti i docs vanno in p1. Per multi-part, distribuiscili per id documento.
    if(data.parts.length === 1){
      state.docsOpened[data.parts[0].id] = gs[docsKey].slice();
    } else {
      const byId = {};
      data.parts.forEach(p => { p.documents.forEach(d => { byId[d.id] = p.id; }); });
      data.parts.forEach(p => { state.docsOpened[p.id] = []; });
      gs[docsKey].forEach(id => {
        const pid = byId[id];
        if(pid && !state.docsOpened[pid].includes(id)) state.docsOpened[pid].push(id);
      });
    }
  }
  if(gs.hints_revealed && Object.keys(gs.hints_revealed).length){
    Object.assign(state.hintsRevealed, gs.hints_revealed);
  }
  const penHKey = 'penalty_act' + config.actNum + '_hints';
  const penEKey = 'penalty_act' + config.actNum + '_errors';
  if(typeof gs[penHKey] === 'number') state.hintPenaltyTotal = gs[penHKey];
  if(typeof gs[penEKey] === 'number') state.errorsTerminal   = Math.round(gs[penEKey] / 10);
  // Casella3 (atto3): merge dalle colonne email_* del backend in state.plugins.casella3.
  // init() del plugin patcha i campi mancanti dopo il merge.
  // gs.email_attempts è il contatore monotono dei tentativi CONSUMATI server-side
  // (nuova semantica post team-license). Lo convertiamo nel "rimanenti" che il
  // plugin usa per la UI. Monotonia: i rimanenti possono solo scendere — se il
  // valore locale è più basso (questo device ha già consumato di più) lo teniamo.
  if(typeof gs.email_attempts === 'number' || typeof gs.email_unlocked === 'boolean' || typeof gs.email_blocked === 'boolean'){
    state.plugins.casella3 = state.plugins.casella3 || {};
    if(typeof gs.email_attempts === 'number'){
      const maxAttempts = (data && data.casella3 && typeof data.casella3.maxAttempts === 'number')
        ? data.casella3.maxAttempts : 5;
      const remoteRemaining = Math.max(0, maxAttempts - gs.email_attempts);
      const local = state.plugins.casella3.attempts;
      state.plugins.casella3.attempts = (typeof local === 'number')
        ? Math.min(local, remoteRemaining)
        : remoteRemaining;
    }
    if(typeof gs.email_unlocked === 'boolean') state.plugins.casella3.unlocked = gs.email_unlocked;
    if(typeof gs.email_blocked  === 'boolean') state.plugins.casella3.blocked  = gs.email_blocked;
  }
  saveState();
}
function bootApp(){
  document.getElementById('access-screen').classList.add('hidden');
  document.getElementById('app-header').style.display = 'flex';
  document.getElementById('mobile-nav').style.display = '';
  document.getElementById('app-body').style.display = 'flex';
  document.getElementById('mobile-inv-btn').style.display = '';
  document.getElementById('app-footer').style.display = '';
  init();
}

// ---------- NAVIGATION ----------
function showSection(id, silent){
  const drawer = document.getElementById('mobile-inv-drawer');
  if(drawer) drawer.classList.remove('open');
  document.body.classList.remove('no-scroll');

  if(!silent){
    // Gating della part bloccata da terminale precedente (es. parte2 attende t2a)
    const partForSection = data.parts.find(p => p.sectionId === id);
    if(partForSection && partForSection.lockedUntilTerminal){
      const blocker = state.terminals[partForSection.lockedUntilTerminal] || {};
      if(!blocker.completed){
        showToast(partForSection.lockedToast || ('Completa il terminale precedente per accedere a ' + partForSection.navLabel));
        return;
      }
    }
    // Gating del terminale che dipende da un'altra parte (es. terminale2b attende t2a)
    const partForTerm = data.parts.find(p => p.terminal.sectionId === id);
    if(partForTerm){
      if(partForTerm.lockedUntilTerminal){
        const blocker = state.terminals[partForTerm.lockedUntilTerminal] || {};
        if(!blocker.completed){
          showToast(partForTerm.lockedToast || ('Completa il terminale precedente prima di accedere al ' + partForTerm.terminal.navLabel));
          return;
        }
      }
      const opened = state.docsOpened[partForTerm.id] || [];
      const term = partForTerm.terminal;
      const tState = state.terminals[term.id] || {};
      if(opened.length < partForTerm.requiredDocs && !tState.completed){
        showToast('Consulti almeno ' + partForTerm.requiredDocs + ' reperti prima di accedere al ' + partForTerm.terminal.navLabel);
        // Toggle DOM gestito sotto da loop unificato
      }
    }
    // Gating dell'esito
    if(id === data.esito.sectionId && !state.finalUnlocked){
      showToast("Completa il terminale finale per accedere all'esito");
      return;
    }
  }

  // Lock/unlock dei terminali
  data.parts.forEach(p => {
    const term = p.terminal;
    if(id === term.sectionId){
      const opened = state.docsOpened[p.id] || [];
      const tState = state.terminals[term.id] || {};
      const lockEl = document.getElementById(term.id + '-lock-banner');
      const formEl = document.getElementById(term.id + '-form');
      if(opened.length >= p.requiredDocs || tState.completed){
        if(lockEl) lockEl.style.display = 'none';
        if(formEl) formEl.style.display = 'block';
      } else {
        if(lockEl) lockEl.style.display = 'block';
        if(formEl) formEl.style.display = 'none';
      }
    }
  });

  document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('section-' + id);
  if(sec) sec.classList.add('active');

  ['nav-', 'mnav-'].forEach(pfx => {
    document.querySelectorAll('[id^="' + pfx + '"]').forEach(n => n.classList.remove('active'));
    const el = document.getElementById(pfx + id);
    if(el) el.classList.add('active');
  });

  state.currentSection = id;
  saveState();
  if(id === data.esito.sectionId) renderEsito();
  window.scrollTo(0, 0);
}

// ---------- DOCS GRID + VIEWER ----------
function renderDocsGrid(){
  data.parts.forEach(p => {
    const grid = document.getElementById('docs-grid-' + p.id);
    if(!grid) return;
    if(!Array.isArray(state.docsOpened[p.id])) state.docsOpened[p.id] = [];
    const opened = state.docsOpened[p.id];
    grid.innerHTML = '';

    p.documents.forEach(doc => {
      const isOpen = opened.includes(doc.id);
      const div = document.createElement('div');
      div.className = 'doc-card' + (isOpen ? ' consulted' : '');
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');
      div.setAttribute('aria-label', doc.title + (isOpen ? ' — già consultato' : ''));
      div.dataset.docId = doc.id;
      div.dataset.partId = p.id;

      const imgHtml = doc.imageUrl
        ? '<div class="doc-thumb"><img src="' + esc(doc.imageUrl) + '" alt="" loading="lazy" data-doc="' + esc(doc.id) + '"></div>'
        : '<div class="doc-thumb"><div class="doc-thumb-placeholder"><span>DOCUMENTO · TRASCRIZIONE CONTROLLATA</span></div></div>';

      div.innerHTML = imgHtml +
        '<div class="doc-card-body">' +
          '<div class="doc-card-top">' +
            '<span class="doc-code">' + esc(doc.id) + '</span>' +
            '<span class="doc-status-badge ' + (isOpen ? 'consulted' : 'available') + '">' + (isOpen ? 'Consultato' : 'Disponibile') + '</span>' +
          '</div>' +
          '<div class="doc-category">' + esc(doc.cat) + '</div>' +
          '<div class="doc-title">' + esc(doc.title) + '</div>' +
          '<div class="doc-summary">' + esc(doc.desc) + '</div>' +
          '<div class="doc-cta ' + (isOpen ? 'consulted-cta' : '') + '">' + (isOpen ? 'Rileggi reperto' : 'Esamina reperto') + '</div>' +
        '</div>';

      div.addEventListener('click', () => openDoc(doc.id, p.id));
      div.addEventListener('keydown', e => {
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openDoc(doc.id, p.id); }
      });
      grid.appendChild(div);
    });

    grid.querySelectorAll('img[data-doc]').forEach(img => {
      img.addEventListener('error', () => {
        const wrap = img.parentElement;
        if(wrap) wrap.innerHTML = '<div class="doc-thumb-placeholder"><span>DOCUMENTO · TRASCRIZIONE CONTROLLATA</span></div>';
      }, { once: true });
    });
  });
}

function openDoc(id, partId){
  const p = data.parts.find(x => x.id === partId);
  if(!p) return;
  const doc = p.documents.find(d => d.id === id);
  if(!doc) return;

  if(!Array.isArray(state.docsOpened[p.id])) state.docsOpened[p.id] = [];
  const wasOpen = state.docsOpened[p.id].includes(id);
  if(!wasOpen){
    state.docsOpened[p.id].push(id);
    saveState();
    renderDocsGrid();
    const opened = state.docsOpened[p.id];
    const term = p.terminal;
    const tState = state.terminals[term.id] || {};
    if(opened.length >= p.requiredDocs && !tState.completed){
      showToast(term.navLabel + ' sbloccato', 'success');
      const navT  = document.getElementById('nav-'  + term.sectionId);
      const mnavT = document.getElementById('mnav-' + term.sectionId);
      setNavLocked(navT, false);
      setNavLocked(mnavT, false);
    }
    updateUI();
  }

  document.getElementById('v-code').textContent = doc.id;
  document.getElementById('v-cat').textContent  = doc.cat;
  document.getElementById('v-title').textContent = doc.title;
  document.getElementById('v-transcript').textContent = doc.transcript;
  document.getElementById('v-consulted').textContent = '✓ CONSULTATO';

  const imgC = document.getElementById('v-img-container');
  if(doc.imageUrl){
    imgC.innerHTML = '<div class="evidence-frame"><img src="' + esc(doc.imageUrl) + '" alt="" loading="lazy"><div class="evidence-frame-label"><span>' + esc(doc.id) + ' — ' + esc(doc.cat) + '</span><span>RISERVATO</span></div></div>';
  } else {
    imgC.innerHTML = '<div class="evidence-no-image"><p>DOCUMENTO IN TRASCRIZIONE CONTROLLATA</p><small>· ' + esc(doc.id) + ' · Immagine non ancora acquisita ·</small></div>';
  }

  const notePanel = document.getElementById('v-note-panel');
  if(doc.note){
    document.getElementById('v-note').textContent = doc.note;
    notePanel.style.display = '';
  } else {
    notePanel.style.display = 'none';
  }

  _lastFocusedBeforeViewer = document.activeElement;
  document.getElementById('viewer-overlay').classList.add('open');
  document.body.classList.add('no-scroll');
  const vb = document.getElementById('viewer-body');
  if(vb) vb.scrollTop = 0;
  setTimeout(() => {
    const cb = document.querySelector('.viewer-close-btn');
    if(cb) cb.focus();
  }, 50);
}

function closeViewer(){
  document.getElementById('viewer-overlay').classList.remove('open');
  document.body.classList.remove('no-scroll');
  if(_lastFocusedBeforeViewer && typeof _lastFocusedBeforeViewer.focus === 'function'){
    _lastFocusedBeforeViewer.focus();
    _lastFocusedBeforeViewer = null;
  }
}

// ---------- HINTS / PUZZLES ----------
function renderPuzzles(){
  const c = document.getElementById('puzzles-container');
  if(!c) return;
  c.innerHTML = '';
  const groups = (data.supporto.groups && data.supporto.groups.length) ? data.supporto.groups : [{ part: 'all', label: '', badge: '', badgeClass: '' }];
  groups.forEach(g => {
    // Badge dinamico: se g.unlockedAfterTerminal è impostato, override badge/class
    // in base allo stato di completamento del terminale gating.
    let badge = g.badge || '';
    let badgeClass = g.badgeClass || '';
    let groupLocked = false;
    let gateTerminalLabel = '';
    if(g.unlockedAfterTerminal){
      const gate = state.terminals[g.unlockedAfterTerminal] || {};
      if(gate.completed){
        badge = g.badgeUnlocked || 'DISPONIBILE';
        badgeClass = 'unlocked';
      } else {
        badge = g.badgeLocked || 'BLOCCATO';
        badgeClass = 'locked';
        groupLocked = true;
        // Recupera la label del terminale gating per messaggio "Disponibile dopo …"
        const gatePart = data.parts.find(p => p.terminal && p.terminal.id === g.unlockedAfterTerminal);
        if(gatePart) gateTerminalLabel = gatePart.terminal.navLabel;
      }
    }
    const wrap = document.createElement('div');
    wrap.className = 'hints-group-wrapper';
    if(g.label) wrap.innerHTML = '<div class="hints-group-label"><span>' + esc(g.label) + '</span><span class="hints-group-badge ' + esc(badgeClass) + '">' + esc(badge) + '</span></div>';
    c.appendChild(wrap);
    const list = data.puzzles.filter(p => g.part === 'all' || p.part === g.part);
    list.forEach(p => c.appendChild(buildPuzzleEl(p, groupLocked, gateTerminalLabel, g.unlockedAfterTerminal)));
  });
}
function buildPuzzleEl(puzzle, groupLocked, gateTerminalLabel, gateTerminalId){
  const revealed = state.hintsRevealed[puzzle.id] || {};
  const isOpen = state.puzzleOpen[puzzle.id];
  const totalSpent = state.hintPuzzleCost[puzzle.id] || 0;
  const lockedLabel = gateTerminalLabel ? ('— Disponibile dopo ' + gateTerminalLabel + ' —') : '— Fase bloccata —';

  let hintsHtml = '<div class="hint-levels-list">';
  puzzle.hints.forEach(h => {
    const isRev = revealed[h.lvl] === true;
    const lvlName = h.lvl === 1 ? 'Osservazione' : h.lvl === 2 ? 'Connessione' : 'Quasi soluzione';
    let contentHtml;
    if(isRev){
      contentHtml = '<div class="hint-text revealed">' + h.txt + '</div><div class="hint-used-label visible">Supporto utilizzato</div>';
    } else if(groupLocked){
      contentHtml = '<button class="hint-reveal-btn" disabled>' + esc(lockedLabel) + '</button>';
    } else {
      contentHtml = '<button class="hint-reveal-btn" data-hint-puzzle="' + esc(puzzle.id) + '" data-hint-lvl="' + h.lvl + '">— Richiedi supporto (−' + h.cost + ' pt)</button>';
    }
    hintsHtml +=
      '<div class="hint-level-row ' + (isRev ? 'used' : '') + '">' +
        '<div class="hint-level-meta">' +
          '<span class="hint-level-name">' + lvlName + ' · Lv.' + h.lvl + '</span>' +
          '<span class="hint-level-cost">−' + h.cost + ' pt</span>' +
        '</div>' +
        '<div class="hint-level-content">' + contentHtml + '</div>' +
      '</div>';
  });
  hintsHtml += '</div>';

  const costLabel = totalSpent > 0 ? '−' + totalSpent + ' pt usati' : '0 pt usati';

  const acc = document.createElement('div');
  acc.className = 'hint-accordion' + (isOpen ? ' open' : '');
  acc.dataset.puzzle = puzzle.id;
  acc.innerHTML =
    '<div class="hint-hdr" data-toggle-puzzle="' + esc(puzzle.id) + '">' +
      '<div class="hint-hdr-left">' +
        '<span class="hint-puzzle-id">' + esc(puzzle.id) + '</span>' +
        '<span class="hint-puzzle-name">' + esc(puzzle.title) + '</span>' +
      '</div>' +
      '<div class="hint-hdr-right">' +
        '<span class="hint-cost-total">' + costLabel + '</span>' +
        '<span class="hint-arrow">▼</span>' +
      '</div>' +
    '</div>' +
    '<div class="hint-body">' +
      '<div class="hint-scope">' + esc(puzzle.scope) + '</div>' +
      hintsHtml +
    '</div>';

  acc.querySelector('[data-toggle-puzzle]').addEventListener('click', () => togglePuzzle(puzzle.id));
  acc.querySelectorAll('[data-hint-puzzle]').forEach(btn => {
    btn.addEventListener('click', () => useHint(btn.dataset.hintPuzzle, parseInt(btn.dataset.hintLvl, 10)));
  });
  return acc;
}
function useHint(pid, lvl){
  const puzzle = data.puzzles.find(p => p.id === pid);
  if(!puzzle) return;
  // Safety gate: blocca la richiesta se il gruppo di questo puzzle è gated
  // da un terminale non ancora completato (allineato a renderPuzzles).
  const grp = (data.supporto.groups || []).find(g => g.part === puzzle.part);
  if(grp && grp.unlockedAfterTerminal){
    const gate = state.terminals[grp.unlockedAfterTerminal] || {};
    if(!gate.completed){
      showToast('Fase bloccata — completa prima il terminale precedente', 'error');
      return;
    }
  }
  if(!state.hintsRevealed[pid]) state.hintsRevealed[pid] = {};
  if(state.hintsRevealed[pid][lvl]) return;

  const h = puzzle.hints.find(x => x.lvl === lvl);
  if(!h) return;
  const cost = h.cost;

  state.hintsRevealed[pid][lvl] = true;
  state.hintPuzzleCost[pid] = (state.hintPuzzleCost[pid] || 0) + cost;
  state.hintPenaltyTotal += cost;
  state.hintLevelsUsed += 1;

  saveState();
  renderPuzzles();
  updateUI();
  showToast('−' + cost + ' pt — Supporto sbloccato', 'error');
}
function togglePuzzle(pid){
  state.puzzleOpen[pid] = !state.puzzleOpen[pid];
  saveState();
  const el = document.querySelector('[data-puzzle="' + pid + '"]');
  if(el) el.classList.toggle('open', !!state.puzzleOpen[pid]);
  else renderPuzzles();
}

// ---------- TERMINAL SUBMIT (built-in validators) ----------
function submitTerminal(termId){
  const part = data.parts.find(p => p.terminal.id === termId);
  if(!part) return;
  const term = part.terminal;
  const tState = state.terminals[term.id] || {};
  if(tState.completed) return;

  const opened = state.docsOpened[part.id] || [];
  if(opened.length < part.requiredDocs){
    showToast(term.lockToast || ('Consulti almeno ' + part.requiredDocs + ' reperti prima di inviare'));
    return;
  }

  const v = term.validator || {};
  const fields = v.fields || [];
  const raws = fields.map(f => (document.getElementById(term.id + '-input-' + f.id).value || '').trim());
  if(raws.some(r => !r)){
    showToast(term.incompleteToast || 'Completi tutti i campi prima di inviare');
    return;
  }

  let result;
  if(v.type === 'min-matches'){
    result = runMinMatchesValidator(term, raws);
  } else if(v.type === 'sospetto-branch'){
    result = runSospettoBranchValidator(term, raws);
  } else if(v.type && v.type.startsWith('custom:')){
    const name = v.type.slice('custom:'.length);
    const fn = config.validators[name];
    if(typeof fn !== 'function'){
      showToast('Validator custom "' + name + '" non registrato', 'error');
      return;
    }
    result = fn({ term, raws, helpers, state, data });
  } else {
    showToast('Validator type non supportato: ' + v.type, 'error');
    return;
  }

  // Applica errori
  const ts = state.terminals[term.id] = state.terminals[term.id] || { completed: false, errors: 0, fb: null };
  ts.errors = (ts.errors || 0) + Math.min(result.errors, fields.length);
  state.errorsTerminal += Math.min(result.errors, fields.length);
  if(result.sospetto) ts.sospetto = result.sospetto;
  saveState();
  updateUI();

  const gfb = document.getElementById(term.id + '-global-fb');

  if(result.allOk){
    ts.completed = true;
    if(term.completesAct){
      state.finalUnlocked = true;
      if(typeof markActDone === 'function') markActDone(config.actNum);
    }
    document.getElementById(term.id + '-submit').disabled = true;
    const subBtn = document.getElementById(term.id + '-submit');
    if(subBtn && term.hideSubmitOnSuccess) subBtn.style.display = 'none';
    document.getElementById(term.id + '-confirmed').classList.add('visible');
    fields.forEach(f => {
      const el = document.getElementById(term.id + '-input-' + f.id);
      if(el) el.readOnly = true;
    });

    // Success copy: template + bySospettoMap (sospetto-branch) o successMessage piatto (min-matches)
    let copyHtml = '';
    if(term.successCopy && term.successCopy.template){
      const sc = term.successCopy;
      let bySospettoText = '';
      if(sc.bySospettoMap){
        const dicts = data.dictionaries || {};
        const mapName = sc.bySospettoMap;
        const map = dicts[mapName] || sc.bySospettoMap; // accept inline mappa
        if(typeof map === 'object' && result.sospetto){
          bySospettoText = map[result.sospetto] || '';
        }
      }
      copyHtml = interp(sc.template, { bySospetto: bySospettoText, sospetto: result.sospetto || '' });
    } else {
      copyHtml = v.successMessage || '';
    }
    gfb.innerHTML = copyHtml;
    gfb.className = 'terminal-global-feedback show ok';
    ts.fb = { text: copyHtml, cls: gfb.className };

    // Aggiorna confirmed-msg specifico (bySospetto)
    if(term.successCopy && term.successCopy.confirmedMsgFrom && result.sospetto){
      const dicts = data.dictionaries || {};
      const m = dicts[term.successCopy.confirmedMsgFrom];
      if(m && m[result.sospetto]){
        const cm = document.getElementById(term.id + '-confirmed-msg');
        if(cm) cm.textContent = m[result.sospetto];
      }
    }

    // Sblocco delle sezioni dichiarate
    (term.successUnlocks || []).forEach(sid => {
      ['nav-', 'mnav-'].forEach(pfx => {
        const el = document.getElementById(pfx + sid);
        setNavLocked(el, false);
      });
    });

    saveState();
    updateUI();
    renderEsito();
    // Ricalcolo dei gruppi hint: il completamento del terminale può sbloccare
    // gruppi gated via supporto.groups[].unlockedAfterTerminal (atto3 P2/P3).
    renderPuzzles();

    // Salvataggio punteggio sul backend
    if(_accessCode && term.completesAct){
      fetch(API_BASE + '/saveActScore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_code:   _accessCode,
          act:           config.actNum,
          hint_penalty:  state.hintPenaltyTotal || 0,
          error_penalty: (state.errorsTerminal || 0) * 10
        })
      }).catch(()=>{});
    }

    setTimeout(() => {
      if(term.successToast) showToast(term.successToast, 'success');
      if(term.successJumpTo) showSection(term.successJumpTo);
    }, term.successDelayMs || 2000);

  } else if(result.errors > 0){
    gfb.textContent = v.globalErrorMsg || 'Alcune risposte non sono coerenti con il fascicolo. Riveda i campi segnalati.';
    gfb.className = 'terminal-global-feedback show warn';
    showToast('−' + (result.errors * 10) + ' pt — errori rilevati', 'error');
  } else {
    gfb.textContent = v.globalAmbiguousMsg || 'Alcune risposte richiedono maggiore specificità. Integri le osservazioni prima di procedere.';
    gfb.className = 'terminal-global-feedback show ambiguous';
  }
}

function runMinMatchesValidator(term, raws){
  const v = term.validator;
  const fields = v.fields || [];
  let errors = 0;
  let allOk = true;
  fields.forEach((f, idx) => {
    const raw = raws[idx];
    const t = normalize(raw);
    const kwCount = (f.okKeywords || []).filter(k => t.includes(normalize(k))).length;
    const minM = f.minMatches || 1;
    if(kwCount >= minM){
      setFieldState(term.id, f.id, 'ok', f.feedback.ok);
    } else if(kwCount >= 1 && minM > 1){
      // Match parziale: ambiguous (richiesti più match)
      setFieldState(term.id, f.id, 'ambiguous', f.feedback.ambiguous);
      allOk = false;
    } else if(isAmbiguousGeneric(raw, v.ambiguousGeneric)){
      setFieldState(term.id, f.id, 'ambiguous', f.feedback.ambiguous);
      allOk = false;
    } else {
      setFieldState(term.id, f.id, 'error', f.feedback.error);
      errors++;
      allOk = false;
    }
  });
  return { allOk, errors };
}

function runSospettoBranchValidator(term, raws){
  const v = term.validator;
  const fields = v.fields || [];
  const dicts = data.dictionaries || {};
  let errors = 0;
  let allOk = true;
  let sospetto = null;
  // Default ambiguousGeneric: prima il validator.ambiguousGeneric, poi data.dictionaries.ambiguousGeneric
  const defaultAmbiguous = v.ambiguousGeneric || dicts.ambiguousGeneric || [];

  fields.forEach((f, idx) => {
    const raw = raws[idx];
    const fb = f.feedback || {};
    const t = normalize(raw);
    let st, msg;

    if(!raw){
      st = 'error'; msg = fb.empty || fb.error || 'Campo obbligatorio.';
      errors++; allOk = false;
      setFieldState(term.id, f.id, st, msg); return;
    }

    if(f.role === 'detect'){
      const hit = detectSospetto(raw, dicts);
      if(hit){
        sospetto = hit;
        st = 'ok'; msg = interp(fb.ok, { sospetto });
      } else if(isAmbiguousGeneric(raw, defaultAmbiguous) || (f.ambiguousMinLen && t.length < f.ambiguousMinLen)){
        st = 'ambiguous'; msg = fb.ambiguous || '';
        allOk = false;
      } else {
        st = 'error'; msg = fb.error || '';
        errors++; allOk = false;
      }
    }
    else if(f.role === 'branched-min-matches'){
      const minM = f.minMatches || 1;
      if(!sospetto){
        st = 'error'; msg = fb.error_noSospetto || fb.error || 'Identifica prima il sospetto nel Campo 1.';
        errors++; allOk = false;
      } else {
        const kwList = ((dicts[f.kwSource] || {})[sospetto]) || [];
        const matches = kwList.filter(k => t.includes(normalize(k))).length;
        if(matches >= minM){
          st = 'ok'; msg = interp(fb.ok, { matches, required: minM, sospetto });
        } else if(matches >= 1 && minM > 1){
          st = 'ambiguous'; msg = interp(fb.ambiguous, { matches, required: minM });
          allOk = false;
        } else if(f.ambiguousMinLen && t.length < f.ambiguousMinLen){
          st = 'ambiguous'; msg = fb.ambiguous || '';
          allOk = false;
        } else if(f.looseTruncLen){
          const tlen = f.looseTruncLen;
          const looseRoots = kwList.map(k => normalize(k).slice(0, tlen)).filter(k => k.length >= Math.max(2, tlen - 1));
          const looseMatches = looseRoots.filter(r => t.includes(r)).length;
          if(looseMatches >= minM){
            st = 'ok'; msg = interp(fb.ok, { matches: looseMatches, required: minM, sospetto });
          } else if(looseMatches >= 1 && minM > 1){
            st = 'ambiguous'; msg = interp(fb.ambiguous, { matches: looseMatches, required: minM });
            allOk = false;
          } else {
            st = 'error'; msg = fb.error || '';
            errors++; allOk = false;
          }
        } else {
          st = 'error'; msg = fb.error || '';
          errors++; allOk = false;
        }
      }
    }
    else if(f.role === 'list-min-matches'){
      const minM = f.minMatches || 1;
      const kwList = (typeof f.kw === 'string') ? (dicts[f.kw] || []) : (Array.isArray(f.kw) ? f.kw : []);
      const matches = kwList.filter(k => t.includes(normalize(k))).length;
      const ambList = (typeof f.ambiguousKwSource === 'string') ? (dicts[f.ambiguousKwSource] || []) : defaultAmbiguous;
      if(matches >= minM){
        st = 'ok'; msg = interp(fb.ok, { matches, required: minM, sospetto });
      } else if(f.nearMissMin && matches >= f.nearMissMin){
        st = 'ambiguous'; msg = interp(fb.ambiguous, { matches, required: minM });
        allOk = false;
      } else if(f.ambiguousMinLen && t.length < f.ambiguousMinLen){
        st = 'ambiguous'; msg = fb.ambiguous_short || fb.ambiguous || '';
        allOk = false;
      } else if(ambList.some(k => t.includes(normalize(k)))){
        st = 'ambiguous'; msg = interp(fb.ambiguous, { matches, required: minM });
        allOk = false;
      } else if(f.looseRoots && f.looseRoots.some(r => t.includes(normalize(r)))){
        st = 'ok'; msg = interp(fb.ok, { matches, required: minM, sospetto });
      } else {
        st = 'error'; msg = interp(fb.error, { matches, required: minM });
        errors++; allOk = false;
      }
    }
    else {
      st = 'error'; msg = 'role non supportato: ' + f.role;
      errors++; allOk = false;
    }

    setFieldState(term.id, f.id, st, msg);
  });

  return { allOk, errors, sospetto };
}

// ---------- ESITO ----------
function classifyByScore(score){
  const tiers = (data.esito.tiers || []).slice().sort((a, b) => b.min - a.min);
  for(const t of tiers){
    if(score >= t.min) return t;
  }
  return tiers[tiers.length - 1] || { name: '—', headline: '—', narrative: '—' };
}
function renderEsito(){
  const total = computeScore();
  const tier = classifyByScore(total);
  const hc = state.hintPenaltyTotal;
  const ec = state.errorsTerminal * 10;

  const e = data.esito;
  const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  setText('esito-score', total);
  setText('esito-classname', tier.name);
  // Hint count: label finale può essere personalizzato (es. "0 richieste" vs "0 livelli")
  const hintCountLabel = e.breakdownLabels && e.breakdownLabels.hintCountUnit
    ? state.hintLevelsUsed + ' ' + e.breakdownLabels.hintCountUnit
    : state.hintLevelsUsed + ' livell' + (state.hintLevelsUsed === 1 ? 'o' : 'i');
  setText('esito-hint-count', hintCountLabel);
  setText('esito-hint-cost', fmtPenalty(hc));
  setText('esito-err-cost', fmtPenalty(ec));
  setText('esito-total', total);
  // Headline: dinamica (per tier) se staticHeadline non è settato
  if(!e.staticHeadline) setText('esito-final-headline', tier.headline);

  // Body: bodyTemplate (skin rich, branched per sospetto) oppure tier.narrative + appendBySospetto
  let narrative;
  if(e.bodyTemplate){
    let sosp = '';
    if(e.bodyTemplate.includes('{bySospetto}')){
      const fromT = e.bodyFromTerminal || (data.parts[data.parts.length - 1].terminal.id);
      sosp = (state.terminals[fromT] || {}).sospetto || '';
    }
    const dicts = data.dictionaries || {};
    const map = (e.bodyBySospettoMap && dicts[e.bodyBySospettoMap]) || {};
    const bySospettoText = sosp ? (map[sosp] || map[Object.keys(map)[0]] || '') : (map[Object.keys(map)[0]] || '');
    narrative = interp(e.bodyTemplate, { bySospetto: bySospettoText, sospetto: sosp });
  } else {
    narrative = tier.narrative || '—';
    const append = e.appendBySospetto;
    if(append && append.fromTerminal){
      const sosp = (state.terminals[append.fromTerminal] || {}).sospetto;
      if(sosp){
        const extra = (append.byValue || {})[sosp] || '';
        if(extra){
          narrative = narrative + (append.separator || '<br><br>') + extra;
        }
      }
    }
  }
  const narEl = document.getElementById('esito-narrative');
  if(narEl) narEl.innerHTML = narrative;

  const scoreEl = document.getElementById('esito-score');
  const classEl = document.getElementById('esito-classname');
  if(scoreEl) scoreEl.className = total >= 75 ? 'score-number good' : 'score-number';
  if(classEl) classEl.className = total >= 75 ? 'score-classname good' : 'score-classname';
}

// ---------- RESET ----------
function isCaseClosed(){
  // Caso chiuso = atto 3 completato. markActDone(3) setta _global.act3_done = true
  // e _global.locked = true. Da quel momento il punteggio è definitivo e il reset
  // non è più disponibile in nessun atto.
  return typeof _global !== 'undefined' && !!_global.act3_done;
}
function showResetConfirm(){
  if(isCaseClosed()){
    showToast('Caso chiuso — punteggio definitivo.', 'error');
    return;
  }
  if(typeof resetsLeft !== 'function'){ confirmReset(); return; }
  const left = resetsLeft();
  if(left === 0){ showToast('Reset esauriti — nessun tentativo disponibile.', 'error'); return; }
  const rl = document.getElementById('confirm-resets-left');
  const ra = document.getElementById('confirm-resets-after');
  if(rl) rl.textContent = left;
  if(ra) ra.textContent = Math.max(0, left - 1);
  document.getElementById('confirm-overlay').classList.add('visible');
}
function confirmReset(){
  try { localStorage.removeItem(config.storageKey); } catch(_){}
  if(typeof _global !== 'undefined'){
    _global['penalty_act' + config.actNum] = { hints: 0, errors: 0 };
    _global['act' + config.actNum + '_done'] = false;
    if(!_global.act3_done) _global.locked = false;
    if(typeof globalScore === 'function') _global.global_score = globalScore();
    if(typeof saveGlobal === 'function') saveGlobal();
  }
  _sessionToken = null; _codeId = null; _accessCode = null;
  if(typeof clearCloudAuth === 'function') clearCloudAuth(config.actNum);
  state = defaultState();
  data.parts.forEach(p => { state.docsOpened[p.id] = []; });
  // Section plugins: chance di reset
  Object.values(config.sectionPlugins || {}).forEach(pl => {
    if(typeof pl.onReset === 'function') pl.onReset({ data, state, config, helpers });
  });
  saveState();
  document.getElementById('confirm-overlay').classList.remove('visible');

  // Reset UI dei terminali
  data.parts.forEach(p => {
    const term = p.terminal;
    (term.validator.fields || []).forEach(f => {
      const inp = document.getElementById(term.id + '-input-' + f.id);
      if(inp){ inp.value = ''; inp.readOnly = false; }
      setFieldState(term.id, f.id, '', '');
    });
    const sub = document.getElementById(term.id + '-submit');
    if(sub) sub.disabled = false;
    const conf = document.getElementById(term.id + '-confirmed');
    if(conf) conf.classList.remove('visible');
    const gfb = document.getElementById(term.id + '-global-fb');
    if(gfb){ gfb.textContent = ''; gfb.className = 'terminal-global-feedback'; }
  });

  // Re-lock nav items (terminali + esito + parti gated + sezioni extra originally locked)
  data.parts.forEach(p => {
    ['nav-', 'mnav-'].forEach(pfx => {
      const el = document.getElementById(pfx + p.terminal.sectionId);
      setNavLocked(el, true);
    });
    // Parti gated da un terminale precedente (es. atto3 parte2 da t3a, parte3 da t3b)
    if(p.lockedUntilTerminal){
      ['nav-', 'mnav-'].forEach(pfx => {
        const el = document.getElementById(pfx + p.sectionId);
        setNavLocked(el, true);
      });
    }
  });
  ['nav-', 'mnav-'].forEach(pfx => {
    const el = document.getElementById(pfx + data.esito.sectionId);
    setNavLocked(el, true);
  });
  // Sezioni extra originariamente locked (atto3: casella3, verifiche)
  (data.extraSections || []).forEach(s => {
    if(s.locked){
      ['nav-', 'mnav-'].forEach(pfx => {
        const el = document.getElementById(pfx + s.sectionId);
        setNavLocked(el, true);
      });
    }
  });

  // Reset case status
  const caseStatusEl = document.getElementById('inv-case-status');
  if(caseStatusEl) caseStatusEl.textContent = data.investigationPanel.caseStatusOpen;

  // Reset persone (riporta a '—' quelle non sempre visibili)
  (data.people || []).forEach(p => {
    const el = document.getElementById('inv-person-' + p.id);
    if(el && !p.alwaysVisible){ el.textContent = '—'; el.className = 'inv-status-val'; }
  });

  renderDocsGrid();
  renderPuzzles();
  if(typeof consumeReset === 'function') consumeReset();
  updateUI();
  showSection('intro', true);
  showToast(data.resetConfirm.doneToast || 'Sessione azzerata', 'success');
}

// ---------- MOBILE DRAWER ----------
function toggleMobileDrawer(){
  const d = document.getElementById('mobile-inv-drawer');
  const open = d.classList.toggle('open');
  d.setAttribute('aria-hidden', String(!open));
  document.body.classList.toggle('no-scroll', open);
}

// ---------- TOAST ----------
function showToast(msg, type){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.className = 'toast visible' + (type ? ' ' + type : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = 'toast' + (type ? ' ' + type : ''); }, 3000);
}

// ---------- UI UPDATE ----------
function updateUI(){
  const score = computeScore();
  const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };

  setText('live-indice', score);
  setText('inv-score-big', score);
  setText('minv-score-big', score);

  ['inv-score-bar', 'minv-score-bar'].forEach(id => {
    const bar = document.getElementById(id);
    if(!bar) return;
    bar.style.width = score + '%';
    bar.className = 'inv-indice-fill ' + (score >= 75 ? 'high' : score >= 50 ? 'mid' : 'low');
  });

  // Classificazione
  const tier = classifyByScore(score);
  setText('inv-class-label', score > 0 ? tier.name : '—');

  // Reperti per parte
  let totalRequired = 0, totalOpened = 0;
  data.parts.forEach(p => {
    const opened = state.docsOpened[p.id] || [];
    const label = opened.length + ' / ' + p.totalDocs;
    setText('docs-count-' + p.id, opened.length);
    setText('inv-docs-' + p.id, label);
    setText('minv-docs-' + p.id, label);
    totalOpened += opened.length;
    totalRequired += p.requiredDocs;
  });

  // Stato terminali
  const setStatus = (id, text, cls) => {
    const el = document.getElementById(id);
    if(!el) return;
    el.textContent = text;
    el.className = 'inv-status-val ' + (cls || '');
  };
  data.parts.forEach(p => {
    const term = p.terminal;
    const opened = state.docsOpened[p.id] || [];
    const tState = state.terminals[term.id] || {};
    const lbls = data.investigationPanel.terminalLabels;
    const text = tState.completed ? lbls.validated : (opened.length >= p.requiredDocs ? lbls.available : lbls.locked);
    const cls  = tState.completed ? 'ok'              : (opened.length >= p.requiredDocs ? 'active'      : 'blocked');
    setStatus('inv-' + term.id, text, cls);
    setStatus('minv-' + term.id, text, cls);
  });

  // Stato atto
  setStatus('inv-atto', state.finalUnlocked ? data.investigationPanel.attoLabels.done : data.investigationPanel.attoLabels.inProgress,
    state.finalUnlocked ? 'ok' : 'active');

  // Persone (rivelate dopo apertura primo doc — solo se almeno 1 doc aperto in tutto)
  if(totalOpened >= 1){
    (data.people || []).forEach(p => {
      if(p.alwaysVisible) return;
      const required = p.revealAfterDocs || 1;
      if(totalOpened >= required){
        const el = document.getElementById('inv-person-' + p.id);
        if(el) el.textContent = p.role;
      }
    });
  }

  // Supporti / errori
  setText('inv-hints-used', state.hintLevelsUsed + ' livell' + (state.hintLevelsUsed === 1 ? 'o' : 'i'));
  setText('minv-hints',     state.hintLevelsUsed + ' livell' + (state.hintLevelsUsed === 1 ? 'o' : 'i'));
  setText('inv-errors',     state.errorsTerminal);
  setText('minv-errors',    state.errorsTerminal);

  // Breakdown sidebar (mostra solo l'atto corrente per default — atti 2/3 mostreranno tutti)
  const bdHtml = buildBreakdownHtml();
  const bdEl = document.getElementById('inv-breakdown');
  const mbdEl = document.getElementById('minv-breakdown');
  if(bdEl) bdEl.innerHTML = bdHtml;
  if(mbdEl) mbdEl.innerHTML = bdHtml;

  // Fase
  const phases = data.investigationPanel.fasePhases;
  let fase = phases.initial;
  const allTermsDone = data.parts.every(p => (state.terminals[p.terminal.id] || {}).completed);
  const lastTerm = data.parts[data.parts.length - 1].terminal;
  const lastDone = (state.terminals[lastTerm.id] || {}).completed;
  if(state.finalUnlocked) fase = phases.actDone;
  else if(lastDone) fase = phases.terminalDone;
  else if(data.parts[0] && (state.docsOpened[data.parts[0].id] || []).length >= data.parts[0].requiredDocs) fase = phases.terminalAvailable;
  setText('inv-fase', fase);
  setText('minv-fase', fase);

  // Case status
  const caseStatusEl = document.getElementById('inv-case-status');
  if(caseStatusEl && state.finalUnlocked) caseStatusEl.textContent = data.investigationPanel.caseStatusDone;

  // Reset disponibili
  const rLeft = typeof resetsLeft === 'function' ? resetsLeft() : 2;
  const rDots = (rLeft >= 2 ? '●●' : rLeft === 1 ? '●○' : '○○');
  const rLabel = rDots + ' ' + rLeft + '/2' + (rLeft === 0 ? ' — esauriti' : '');
  const rColor = rLeft === 0 ? 'var(--text-dim)' : rLeft === 1 ? 'var(--amber)' : 'var(--success-text,#4CAF80)';
  ['inv-resets', 'minv-resets'].forEach(id => {
    const el = document.getElementById(id);
    if(el){ el.textContent = rLabel; el.style.color = rColor; }
  });
  const hideReset = rLeft === 0 || isCaseClosed();
  document.querySelectorAll('[data-action="reset-confirm"]').forEach(btn => {
    btn.style.display = hideReset ? 'none' : '';
  });

  // Banner unlock per parte (sintassi diversa per skin)
  data.parts.forEach(p => {
    const ub = document.getElementById('terminal-unlock-banner-' + p.id);
    if(!ub) return;
    const opened = state.docsOpened[p.id] || [];
    const tState = state.terminals[p.terminal.id] || {};
    const visible = opened.length >= p.requiredDocs && !tState.completed;
    if(p.unlockBar){
      // skin rich: toggle inline display; preserva la class terminal-unlock-bar
      ub.style.display = visible ? 'flex' : 'none';
    } else {
      // skin classic: toggle .show via className
      ub.className = 'unlock-banner' + (visible ? ' show' : '');
    }
  });
  // Locked sibling banner (es. parte1 atto2: "Reperti ad alta sensibilità bloccati")
  data.parts.forEach(p => {
    if(!p.lockedSiblingBanner) return;
    const el = document.getElementById('locked-sibling-' + p.id);
    if(!el) return;
    // Mostra il banner finché il terminale "sbloccante" non è completato
    const blockerId = p.terminal && p.terminal.id;
    const tDone = blockerId ? (state.terminals[blockerId] || {}).completed : false;
    el.style.display = tDone ? 'none' : '';
  });

  // Nav unlock per terminali raggiunti.
  // Rispetta lockedUntilTerminal: terminale di una part gated resta locked
  // finché il terminale prerequisito non è completato (necessario per parti narrativeOnly
  // tipo atto3 parte3, dove requiredDocs=0 sbloccherebbe T3C subito).
  data.parts.forEach(p => {
    const opened = state.docsOpened[p.id] || [];
    if(opened.length < p.requiredDocs) return;
    if(p.lockedUntilTerminal){
      const gate = state.terminals[p.lockedUntilTerminal] || {};
      if(!gate.completed) return;
    }
    ['nav-', 'mnav-'].forEach(pfx => {
      const el = document.getElementById(pfx + p.terminal.sectionId);
      setNavLocked(el, false);
    });
  });
  if(state.finalUnlocked){
    ['nav-', 'mnav-'].forEach(pfx => {
      const el = document.getElementById(pfx + data.esito.sectionId);
      setNavLocked(el, false);
    });
  }
}

function buildBreakdownHtml(){
  // Mostra breakdown per ogni atto disponibile nel _global. Atto corrente sempre evidenziato.
  // Per ora mostriamo solo l'atto corrente (gli atti 2/3 mostreranno gli altri se desiderato — gestito in JSON).
  const a = config.actNum;
  const pen = (typeof _global !== 'undefined' && _global['penalty_act' + a]) || { hints: 0, errors: 0 };
  const ph = pen.hints || 0;
  const pe = pen.errors || 0;
  const pt = ph + pe;
  return '<span style="color:var(--text-secondary)">' + esc(data.headerBadge) + ':</span> ' +
    (pt > 0 ? '<span style="color:var(--red-highlight)">−' + pt + '</span>' : '<span style="color:var(--success-text,#4CAF80)">0</span>') +
    '<span style="color:var(--text-dim);font-size:.62rem"> (hint −' + ph + ' · err −' + pe + ')</span>';
}

// ---------- INIT ----------
function init(){
  loadState();
  // Garantisce array docsOpened per ogni parte
  data.parts.forEach(p => {
    if(!Array.isArray(state.docsOpened[p.id])) state.docsOpened[p.id] = [];
  });

  // Section plugins init
  Object.values(config.sectionPlugins || {}).forEach(pl => {
    if(typeof pl.init === 'function') pl.init({ data, state, config, helpers });
  });

  renderDocsGrid();
  renderPuzzles();

  // Ripristino terminali completati (input readOnly, banner confirmed, feedback)
  data.parts.forEach(p => {
    const term = p.terminal;
    const tState = state.terminals[term.id] || {};
    if(tState.completed){
      const sub = document.getElementById(term.id + '-submit');
      if(sub) sub.disabled = true;
      const conf = document.getElementById(term.id + '-confirmed');
      if(conf) conf.classList.add('visible');
      (term.validator.fields || []).forEach(f => {
        const el = document.getElementById(term.id + '-input-' + f.id);
        if(el) el.readOnly = true;
      });
      if(tState.fb){
        const gfb = document.getElementById(term.id + '-global-fb');
        if(gfb){ gfb.innerHTML = tState.fb.text; gfb.className = tState.fb.cls; }
      }
      // Hide submit button su terminali con hideSubmitOnSuccess
      if(term.hideSubmitOnSuccess){
        const sub = document.getElementById(term.id + '-submit');
        if(sub) sub.style.display = 'none';
      }
      // Reapply confirmed message bySospetto (se ricaricato da storage)
      if(term.successCopy && term.successCopy.confirmedMsgFrom && tState.sospetto){
        const dicts = data.dictionaries || {};
        const m = dicts[term.successCopy.confirmedMsgFrom];
        if(m && m[tState.sospetto]){
          const cm = document.getElementById(term.id + '-confirmed-msg');
          if(cm) cm.textContent = m[tState.sospetto];
        }
      }
    }
  });

  updateUI();
  showSection(state.currentSection || 'intro', true);
}

// ---------- HELPERS (esposti ai plugin) ----------
const helpers = {
  normalize, hasAny, isAmbiguousGeneric, setFieldState,
  showToast, saveState, updateUI, renderDocsGrid, renderPuzzles,
  showSection, cloudIncrement
};

// ---------- BOOT ----------
async function boot(){
  try { await dataReady; } catch(e){ return; }
  buildShell();
  bindEvents();
  loadState();

  // Auto-login silenzioso: token+codice salvati → rivalida al backend
  const auth = (typeof getCloudAuth === 'function' ? getCloudAuth(config.actNum) : null) || {};
  if(auth.token && auth.code){
    const loadingEl = document.getElementById('access-loading');
    const formEl    = document.getElementById('access-form');
    if(loadingEl) loadingEl.style.display = '';
    if(formEl)    formEl.style.display    = 'none';

    const fp = btoa([navigator.userAgent, screen.width, screen.height, navigator.language].join('|')).slice(0, 32);
    const abortCtl = new AbortController();
    const timeoutId = setTimeout(() => abortCtl.abort(), 8000);
    fetch(API_BASE + '/validateCode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: auth.code, session_token: auth.token, fingerprint: fp }),
      signal: abortCtl.signal
    })
    .then(r => { clearTimeout(timeoutId); return r.json(); })
    .then(d => {
      if(d && d.ok){
        _sessionToken = d.session_token;
        _codeId       = d.game_session ? d.game_session.code_id : (auth.codeId || null);
        _accessCode   = auth.code;
        if(typeof setCloudAuth === 'function') setCloudAuth(config.actNum, { token: _sessionToken, codeId: _codeId, code: _accessCode });
        if(d.game_session) mergeServerState(d.game_session);
        bootApp();
      } else {
        if(typeof clearCloudAuth === 'function') clearCloudAuth(config.actNum);
        _sessionToken = null; _codeId = null; _accessCode = null;
        if(loadingEl) loadingEl.style.display = 'none';
        if(formEl)    formEl.style.display    = '';
      }
    })
    .catch(() => {
      // Rete non disponibile o timeout (8s) — entra con stato locale
      clearTimeout(timeoutId);
      _sessionToken = auth.token;
      _accessCode   = auth.code;
      _codeId       = auth.codeId || null;
      bootApp();
    });
    return;
  }

  // Nessun token: se c'è progresso locale, entra direttamente
  const anyDocsOpened = Object.values(state.docsOpened).some(arr => arr.length > 0);
  const anyTermDone   = Object.values(state.terminals).some(t => t.completed);
  const hasProgress   = anyDocsOpened || anyTermDone || state.hintPenaltyTotal > 0 || state.errorsTerminal > 0;
  if(hasProgress) bootApp();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

return { state: () => state, config, _internal: { showSection, updateUI, renderDocsGrid, renderPuzzles } };
}

global.createCaseApp = createCaseApp;

})(window);
