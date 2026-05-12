# Archivio 17 — Caso 001: Il Caso Marini

Esperienza investigativa narrativa: il giocatore consulta documenti d'archivio (verbali, foto, agende, tabulati, email) per ricostruire un caso e validare le proprie deduzioni a un terminale. Tre atti più una versione beta one-shot del primo atto.

## Stack

- **HTML + CSS + JavaScript vanilla** (nessun framework, nessun build step)
- **Dati narrativi** in JSON (`data/atto{1,2,3}.json`)
- **Logica condivisa** in `assets/case-app.js` (scoring globale, storage unificato)
- **Configurazione** in `assets/config.js` (APP_ID, API_BASE)
- **Stile condiviso** in `assets/case-app.css` (atto1/index)
- **Stato e progresso** in `localStorage` (chiave unificata `a17_session`)
- **Sincronizzazione cloud** opzionale con backend Base44
- **Deploy** come sito statico su GitHub Pages (`.nojekyll`)

## Struttura del repository

```
archivio17-caso001/
├── index.html              ← entry beta one-shot (codice A17-BETA)
├── atto1.html              ← primo atto della trilogia prod
├── atto2.html              ← secondo atto — traccia finanziaria
├── atto3.html              ← terzo atto — chiusura del caso
├── admin.html              ← pannello admin (gestione codici, sessioni)
├── assets/
│   ├── config.js           ← APP_ID, API_BASE (single source of truth)
│   ├── case-app.js         ← scoring globale + storage a17_session + migrazione
│   └── case-app.css        ← CSS condiviso atto1/index
├── data/
│   ├── atto1.json          ← documenti, puzzle, hint, validazione Atto I
│   ├── atto2.json          ← documenti, puzzle, sospetti, feedback Atto II
│   └── atto3.json          ← documenti, email, puzzle, password casella Atto III
├── public/assets/case001/  ← immagini documenti (PNG, fallback offline)
├── DESIGN.md               ← direzione visuale (target di stile)
└── README.md
```

## Avvio in locale

Essendo HTML statico ma con `fetch()` dei JSON, serve un web server. Apertura diretta via `file://` rompe il caricamento dati.

```bash
# Opzione 1 — Node (consigliata)
npx serve .

# Opzione 2 — Python
python -m http.server 8000

# Opzione 3 — VS Code
# Estensione "Live Server"
```

Poi apri `http://localhost:3000/atto1.html` (o `index.html`, `atto2.html`, `atto3.html`).

## Deploy

Già configurato per **GitHub Pages**:

1. Push su `main`
2. GitHub Pages serve la root del repo (`.nojekyll` disattiva Jekyll)
3. Modifiche live entro 1–2 minuti

## Codici di accesso

| Codice | Dove |
|---|---|
| `A17-BETA` | (da configurare in `LOCAL_CODES` di index.html — attualmente `A17-ATTO1`, `A17-DEMO`) |
| `A17-ATTO1` | Codice locale Atto I — bypassa backend |
| `A17-DEMO` | Codice demo Atto I — bypassa backend |

Codici aggiuntivi sono validati lato backend Base44 e gestiti dal pannello admin (`admin.html`).

## Sistema di scoring

- Punteggio base per atto: **100**
- Hint: **−2 / −5 / −8** punti per livello sbloccato
- Risposta errata al terminale: **−10** punti (cap a 3 errori per singolo invio in Atto I)
- Minimo: **0**
- Lo scoring **globale cross-act** (`_global` in `assets/case-app.js`) accumula le penalità dai tre atti

**Classificazioni finali** (basate sul punteggio globale):

| Punteggio | Classificazione |
|---|---|
| ≥ 90 | Archivista in formazione |
| ≥ 75 | Investigatore |
| ≥ 60 | Collaboratore |
| < 60 | Osservatore esterno |

## Storage

Una sola chiave principale in `localStorage`: **`a17_session`**

```json
{
  "version": 1,
  "global": { "global_score": 100, "penalty_act1": {...}, "penalty_act2": {...}, "penalty_act3": {...}, "act1_done": false, ... },
  "cloud": {
    "atto1": { "token": "...", "codeId": "...", "code": "..." },
    "atto2": { ... },
    "atto3": { ... }
  }
}
```

Chiavi gameplay per atto (mantenute separate per isolamento):
- `a17_atto1_v3` — stato gameplay Atto I
- `a17_atto2_v2` — stato gameplay Atto II
- `a17_atto3_v1` — stato gameplay Atto III

**Migrazione automatica**: al primo caricamento dopo l'aggiornamento, `case-app.js` migra le vecchie chiavi (`a17_global_v1`, `a17_atto*_session_token`, ecc.) in `a17_session` e le cancella. Trasparente per il giocatore.

## Procedura test manuale

1. Inserire codice di accesso e accedere
2. Navigare tra Intro, Fascicolo, Hint, Terminale, Esito
3. Aprire almeno 4 documenti nel viewer
4. Richiedere hint e verificare il decremento del punteggio
5. Inserire risposte errate al Terminale e verificare la penalità (cap a 3)
6. Completare l'atto con risposte corrette
7. Verificare il breakdown finale e la classificazione
8. Testare "Resetta sessione" con conferma
9. Ricaricare la pagina e verificare la persistenza in `a17_session`
10. Verificare la leggibilità mobile (<768px)
11. Passare al successivo atto e verificare che il punteggio globale sia coerente

<details>
<summary><strong>SPOILER — Risposte corrette Terminale 01 (Atto I)</strong></summary>

Le risposte concrete vivono in `data/atto1.json` sotto `terminal.fields[*].okKeywords`. Per editare le risposte modificare quel file, non il codice HTML.

### Campo 1 — anomalia fisica
Esempi validi: `MANCINO`, `MANO SINISTRA`, `MANO DOMINANTE`, `PISTOLA DESTRA`, `PISTOLA NELLA MANO DESTRA`

### Campo 2 — elemento temporale
Esempi validi: `S`, `STEFANO`, `CENA CON S`, `1930`, `18:42`, `FINESTRA TEMPORALE`

### Campo 3 — sintesi investigativa
Valida se contiene almeno 2 concetti tra: suicidio non semplice, scena non coerente, presenza di terzi, timeline incompleta, accesso da chiarire, messa in scena, pistola nella mano sbagliata.

</details>

## Note tecniche

- **Validazione risposte:** lato client (vedi `submitTerminal*` in ciascun HTML). Bypassabile da DevTools — accettabile per beta; da spostare server-side per release pubblica.
- **Documenti narrativi modificabili senza toccare HTML:** modifica `data/atto{1,2,3}.json` per cambiare testi, hint, immagini, keyword di validazione.
- **Single source of truth per il backend:** modifica `assets/config.js` (`APP_ID`) per puntare a un'altra app Base44.
- **Casella privata Atto III:** password attualmente `12041945` (data di nascita di Carla Bianchi, madre di Andrea — derivata dal documento C01). Modificabile in `data/atto3.json` → `casella.password`.
- **Asset offline:** la cartella `public/assets/case001/` contiene 4 PNG dei documenti A01, A02, A04, A05 ma non è attualmente referenziata dagli HTML (che usano la CDN `media.base44.com`). Riservata per un possibile fallback offline.

## Storia del refactor

Il progetto è partito come 5 file HTML autonomi con CSS+JS inline duplicato (~531 KB totali). Refactor in 5 fasi:

1. **Dati narrativi → JSON** (`data/atto{1,2,3}.json`) — testi, puzzle, hint, validazione
2. **CSS condiviso** (`assets/case-app.css`) — estratto da atto1/index
3. **JS scoring engine** (`assets/case-app.js`) — funzioni `_global`, `loadGlobal`, ecc.
4. **Storage unificato** (`a17_session`) — 10 chiavi → 1 + migrazione automatica
5. **Config unico** (`assets/config.js`) — APP_ID, API_BASE single source

Il design originale (`DESIGN.md`) prevede una migrazione futura a Next.js + React + CSS Modules: lo stack HTML vanilla attuale è la vertical slice precedente a quella migrazione.
