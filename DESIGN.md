# DESIGN.md — Archivio 17 / Caso 001 « Il Caso Marini »

> **Direzione visuale per sviluppatore (Codex).**
> Stile: **Logicus Escape Room** — dark, premium, cinematografico, horror‑thriller elegante, investigativo, realistico.
> NON è una rifondazione dell'app: è uno **strato visuale** da applicare ai componenti già esistenti (`CaseApp.tsx`, `CaseApp.module.css`, `globals.css`).
> NON modificare la logica di gioco, validazione, scoring, persistenza, o i contenuti narrativi del caso.

---

## 1. Palette colori

Una palette **a tre strati**: notte profonda → carta d'archivio sbiadita → accenti diagnostici. Tutti i valori in `oklch` per consistenza percettiva, con fallback `hex`.

### 1.1 Background — la stanza buia

| Token | Hex | Uso |
|---|---|---|
| `--bg-void` | `#06070A` | sfondo radice, dietro a tutto |
| `--bg-room` | `#0B0D12` | superficie principale dell'app (dashboard) |
| `--bg-panel` | `#11141B` | pannelli, card, side rail |
| `--bg-panel-2` | `#171B24` | hover su card, terminale chrome |
| `--bg-elevated` | `#1E232E` | modali, popover, dropdown |

### 1.2 Carta d'archivio — i documenti

I documenti sono **isole di luce calda** in una stanza buia. È il contrasto su cui si regge tutta l'estetica.

| Token | Hex | Uso |
|---|---|---|
| `--paper` | `#E8DFC8` | carta principale del documento |
| `--paper-aged` | `#D9CBA8` | carta più vecchia (rubrica, cartolina) |
| `--paper-edge` | `#7A6A45` | bordo bruciato/macchiato |
| `--ink` | `#1A1410` | inchiostro principale |
| `--ink-faded` | `#4A3F30` | inchiostro sbiadito / footer |

### 1.3 Accenti — sangue, fosforo, ottone

| Token | Hex | Uso |
|---|---|---|
| `--accent-blood` | `#A12121` | timbri RISERVATO, errori, anomalie |
| `--accent-blood-dim` | `#5A1414` | hover/active del rosso |
| `--accent-phosphor` | `#7CFF8E` | testo del Terminale 01, LED attivi |
| `--accent-phosphor-dim` | `#2C7C3A` | terminale spento, completato |
| `--accent-brass` | `#C9A35A` | dettagli premium (logo, finalizzazione) |
| `--accent-brass-dim` | `#7A6437` | hover ottone |

### 1.4 Testo

| Token | Hex | Uso |
|---|---|---|
| `--text-primary` | `#E8E5DD` | titoli, body principale |
| `--text-secondary` | `#A39E92` | label, meta, sottotitoli |
| `--text-tertiary` | `#6B6759` | placeholder, disabilitato |
| `--text-on-paper` | `#1A1410` | testo SU documenti chiari |

### 1.5 Stati semantici

| Token | Hex | Uso |
|---|---|---|
| `--state-success` | `#5FA572` | validazione corretta |
| `--state-warning` | `#C9A35A` | tentativo parziale |
| `--state-danger` | `#A12121` | errore, anomalia |
| `--state-info` | `#5A8FA3` | notifiche, hint sbloccato |

---

## 2. Font consigliati

**Sistema a 3 famiglie**, da caricare via `next/font/google` (vedi §15).

| Ruolo | Famiglia | Pesi | Note |
|---|---|---|---|
| **Display / titoli investigativi** | `Cormorant Garamond` | 500, 600 (italic 500, 600) | corsivo per nomi in codice « ... » |
| **UI / corpo / label** | `Inter` | 400, 500, 600 | tutto il chrome dell'app |
| **Macchina da scrivere / documenti** | `Special Elite` | 400 | titoli documenti, timbri, briefing |
| **Mono / terminale / codici** | `JetBrains Mono` | 400, 500, 700 | Terminale 01, telegrammi, codici cifrati |

**Regole d'oro:**
- Mai più di 3 famiglie attive nella stessa schermata.
- I documenti usano **Special Elite** o **JetBrains Mono** (a seconda del tipo).
- Il chrome dell'app usa **Inter**.
- I momenti narrativi (intro Archivista, finale) usano **Cormorant** in italic.

---

## 3. Layout desktop a due colonne

Layout principale della **Dashboard fascicolo** e del **Document Viewer**.

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOP BAR · 56px  ·  ARCHIVIO 17  ·  CASO 001  ·  punteggio  terminale│
├──────────────────┬───────────────────────────────────────────────────┤
│                  │                                                   │
│  SIDE RAIL       │   DOCUMENT STAGE                                  │
│  280px           │   max-width 760px, centrato, padding 32px         │
│                  │                                                   │
│  · Obiettivo     │   ┌─ paper sheet ──────────────────┐              │
│  · DOC-A         │   │                                │              │
│  · DOC-B         │   │      [contenuto documento]     │              │
│  · DOC-C         │   │                                │              │
│  · ─────         │   └────────────────────────────────┘              │
│  · Indizi        │                                                   │
│  · Reset         │                                                   │
│                  │                                                   │
└──────────────────┴───────────────────────────────────────────────────┘
```

**Specifiche:**
- Grid: `grid-template-columns: 280px 1fr;` con `min-height: 100vh - 56px`.
- Side rail: `background: var(--bg-panel); border-right: 1px solid rgba(255,255,255,0.06);`
- Document stage: scrollabile internamente, MAI scroll del body.
- Top bar: `position: sticky; top: 0; z-index: 50; backdrop-filter: blur(12px);`
- Padding interno generoso: il documento deve "respirare" nel buio.

---

## 4. Layout mobile

Sotto **880px** la side rail collassa in **tab bar orizzontale** sopra il document stage.

```
┌──────────────────────────────┐
│  TOP BAR (compatta)          │
├──────────────────────────────┤
│  ◀ DOC-A  DOC-B  DOC-C  ▶    │  ← scroll-x
├──────────────────────────────┤
│                              │
│       DOCUMENT STAGE          │
│       (full width, padding 16)│
│                              │
├──────────────────────────────┤
│  [INDIZI]   [TERMINALE 01]   │  ← bottom action bar fissa
└──────────────────────────────┘
```

- Tab bar documenti: `overflow-x: auto; scroll-snap-type: x mandatory;`
- Bottom bar: `position: fixed; bottom: 0; height: 64px; padding-bottom: env(safe-area-inset-bottom);`
- Pannello indizi diventa **bottom sheet** con drag-to-dismiss.
- Terminale a schermo intero (modal full-bleed).

---

## 5. Schermata accesso beta

**Concept:** una porta blindata. Il giocatore non sta entrando in un'app, sta entrando in un **archivio**.

**Composizione:**
- Sfondo `--bg-void` con vignettatura radiale + grana sottile (SVG noise).
- **Card centrale** 480×auto, `--bg-panel`, bordo `1px solid rgba(201,163,90,0.18)` (ottone tenue), padding 48px.
- Eyebrow: `REPUBBLICA ITALIANA · SERVIZIO INFORMAZIONI` — Inter 10px, letter-spacing 0.3em, `--text-tertiary`.
- Titolo: **ARCHIVIO 17** — Cormorant Garamond 600, 64px, `--text-primary`, `letter-spacing: 0.04em`.
- Sottotitolo: `Sezione D · Materiale Riservato` — Inter 13px, `--text-secondary`.
- Divider: timbro **RISERVATISSIMO** ruotato −6° in `--accent-blood`.
- Input codice: full-width, `background: rgba(255,255,255,0.03)`, `border: 1px solid rgba(255,255,255,0.1)`, `border-bottom: 2px solid var(--accent-brass)`, font JetBrains Mono 20px, letter-spacing 0.12em, uppercase.
- Bottone primario: `APRIRE IL FASCICOLO →` — full-width, `background: var(--accent-blood)`, no border, padding 16×24, hover: `background: var(--accent-blood-dim)`.
- Footer: tre micro-tag `FASC. 17/D-001 · NON DUPLICARE · USO INTERNO` in `--text-tertiary` 10px.

**Animazione d'ingresso:** card fade-in + slide-up 24px in 600ms, easing `cubic-bezier(0.16, 1, 0.3, 1)`. LED ottone in alto a sinistra che pulsa 1.6s.

---

## 6. Intro Archivista

**Concept:** una voce. L'Archivista parla per la prima volta. Pochi elementi, molto silenzio attorno.

**Composizione:**
- Schermo intero `--bg-void`.
- Centrato verticalmente, max-width 640px:
  - Piccolo glifo (•) ottone in alto, animato (typewriter dot blink).
  - Etichetta `L'ARCHIVISTA` — Inter 11px, letter-spacing 0.32em, `--accent-brass`.
  - Testo narrativo: **Cormorant Garamond italic 500**, 26px, line-height 1.7, `--text-primary`. Animazione typewriter (caratteri che appaiono uno alla volta, 28ms/char, salta su click).
  - Dopo il testo, pausa 800ms, poi appare bottone:
    `[ ENTRARE NEL FASCICOLO ]` — outline ottone, hover fill ottone su nero.

**Audio (opzionale):** ticking di un orologio a pendolo a `volume: 0.15`. Toggle nell'angolo.

**Regola contenutistica:** il testo dell'Archivista è già definito nel `case.json`. **NON inventare nuovo testo.**

---

## 7. Dashboard fascicolo

Layout §3. Più nel dettaglio:

**Top bar (56px):**
- Sinistra: logo `★ ARCHIVIO 17` (Special Elite 16px) + breadcrumb `CASO 001 · « IL CASO MARINI »` (Inter 12px, secondary).
- Destra: tre pillole:
  - `PUNTEGGIO 100` — bordo `--text-tertiary`, valore brass.
  - `INDIZI 0/4` — bordo `--text-tertiary`, valore primary.
  - Bottone primario `TERMINALE 01 →` con LED phosphor pulsante.

**Side rail (280px):**
- Sezione `OBIETTIVO` in cima — micro-card con bordo dashed `--accent-blood` opacity 0.4.
- Sezione `PROVE / DOCUMENTI` — lista verticale di card (vedi §8).
- In fondo: link minore `↺ Azzerare la sessione` in `--text-tertiary`.

**Document stage (centro):**
- Background `--bg-room` con vignettatura sottile.
- Documento attivo centrato, fade-in 240ms al cambio.
- Sotto al documento: nessuna chrome, nessun "next/prev" — la navigazione è SOLO via side rail.

**Stato vuoto:** se nessun documento è ancora visualizzato, mostra al centro un placeholder Cormorant italic: *« Selezionate una prova dalla colonna a sinistra. »*

---

## 8. Card documenti (side rail)

Compatta, premium, leggermente "fisica".

```
┌────────────────────────────────┐
│ DOC-A                       ●  │  ← LED stato (visto/non visto)
│ Telegramma cifrato             │
│ ─────────────                  │
│ RISERVATO · 12.XI.73           │
└────────────────────────────────┘
```

**Specifiche:**
- Padding: 14px 16px.
- Background: `rgba(255,255,255,0.02)`, hover `rgba(255,255,255,0.05)`.
- Border-left: `2px solid transparent`, attivo: `2px solid var(--accent-brass)`.
- Border (resto): `1px solid rgba(255,255,255,0.06)`.
- Codice doc (`DOC-A`): JetBrains Mono 10px, letter-spacing 0.22em, `--text-tertiary`.
- Label: Inter 14px, weight 500, `--text-primary`.
- Hairline divider: 1px, `rgba(255,255,255,0.08)`.
- Meta: Inter 10px, letter-spacing 0.18em — `RISERVATO` in `--accent-blood`, data in `--text-secondary`.
- LED stato (8px circle): visto = `--accent-phosphor-dim`, non visto = `transparent` con ring.
- Stato attivo: background `rgba(201,163,90,0.06)`, border-left ottone, lieve glow brass `box-shadow: inset 4px 0 0 -2px var(--accent-brass)`.

---

## 9. Viewer documento

Il documento è una **isola di luce calda** sospesa nel buio. È il momento più cinematografico dell'app.

**Wrapper:**
- `max-width: 760px`, `margin: 0 auto`.
- `background: var(--paper)` (o `--paper-aged` per documenti vecchi).
- `padding: 48px 56px 36px`.
- `box-shadow: 0 40px 80px -20px rgba(0,0,0,0.7), 0 4px 12px -4px rgba(0,0,0,0.5);`
- `border-radius: 2px` (carta non ha angoli arrotondati pronunciati).
- Texture grain: SVG turbulence overlay, `mix-blend-mode: multiply`, opacity 0.08.
- Macchie d'acqua (opzionali, per DOC-B/C): pseudo-elementi `::before` con `radial-gradient` `oklch(0.6 0.02 60)` opacity 0.15, posizionati ad angoli random.

**Header documento:**
- Riga superiore: emblema (★ in `--accent-blood`) + titolo doc (Special Elite 18px) + timbro RISERVATO ruotato.
- Bordo inferiore: `2px solid var(--ink)`.

**Body:**
- Telegramma → JetBrains Mono 14px, line-height 1.9, lettere leggermente sbiadite (`color: var(--ink)`, `opacity: 0.92`).
- Cartolina → split 50/50: sinistra immagine + caption corsivo, destra messaggio + indirizzo + timbro postale circolare ruotato.
- Rubrica → griglia mono 4 colonne (n° / cognome / mestiere / telefono), separator `dotted` `rgba(0,0,0,0.18)`, riga evidenziata: `background: rgba(255,210,80,0.45)` con outline `--accent-blood` e marker `►` a sinistra.

**Footer documento:**
- Border-top dashed `--ink-faded`.
- Tag micro: `DOC. A — intercettazione 12/XI/73` — Special Elite 10px, letter-spacing 0.2em, allineato a destra.

**Animazione di apertura:** scale `0.98 → 1.0` + fade-in in 280ms, ease-out.

---

## 10. Hint panel

**Concept:** un cassetto che si apre. Modale dark con **carta dentro**.

**Trigger:** bottone `INDIZI` in top bar.

**Container:**
- Overlay: `background: rgba(0,0,0,0.72); backdrop-filter: blur(8px);`
- Pannello: 560×auto, centrato, `background: var(--bg-panel)`, `border: 1px solid rgba(201,163,90,0.2)`, `box-shadow: 0 30px 80px rgba(0,0,0,0.6)`, padding 32px.

**Header:**
- Titolo `INDIZI` Special Elite 22px letter-spacing 0.22em.
- Sub Cormorant italic: *« Ogni indizio costa punti dal vostro punteggio. »*
- X close: 30×30, border 1px brass, hover fill brass.

**Lista indizi:**
- Tre stati visivi:
  1. **Sbloccato** → background `rgba(232,223,200,0.04)`, border `1px solid rgba(201,163,90,0.3)`, testo pieno.
  2. **Prossimo** → border `1px dashed var(--accent-blood)`, bottone `Sbloccare questo indizio (−10 pt)` rosso pieno.
  3. **Bloccato** → opacity 0.4, testo *« sbloccare prima l'indizio precedente »* italic.
- Ogni card: `padding: 16px 18px; margin-bottom: 12px;`.
- Header card: titolo `INDIZIO I — GEOGRAFIA` + costo `−10 pt` in `--accent-blood`.

**Helper sotto Indizio III:** mini-bottone outline rosso `evidenziare le righe nella rubrica →` che apre DOC-C ed evidenzia righe 3,17,9,5,21.

---

## 11. Terminale 01

**Concept:** un CRT verde fosforo annegato in una scrivania d'ottone. È il **momento di verità** dell'esperienza.

**Container modale:**
- Full overlay nero `rgba(0,0,0,0.85)` con vignettatura.
- Bezel esterno (la "macchina"): 720×auto, `background: linear-gradient(180deg, #2A2519 0%, #1A160E 100%)`, `border-radius: 14px`, `padding: 14px`, `box-shadow: 0 30px 60px rgba(0,0,0,0.7), inset 0 2px 0 rgba(255,255,255,0.08)`. Angoli stondati come una vera macchina anni 70.
- Bordo interno: `1px solid rgba(255, 220, 150, 0.1)`.

**Head bar (chrome):**
- LED phosphor pulsante (10px circle, `box-shadow: 0 0 8px var(--accent-phosphor)`, `animation: pulse 1.6s ease infinite`).
- Titolo `TERMINALE 01 — VALIDAZIONE` Inter 11px letter-spacing 0.22em `--text-secondary`.
- Bottone `chiudere` outline tenue.

**Schermo CRT:**
- `background: var(--crt-bg)` `#07140A`.
- Scanlines: `repeating-linear-gradient(180deg, rgba(124,255,142,0.04) 0 2px, transparent 2px 4px)`.
- Glow centrale: `radial-gradient(ellipse at 50% 50%, rgba(124,255,142,0.06) 0%, transparent 70%)`.
- `border-radius: 8px`, padding 24px 28px, height 380px, scroll-y interno.
- Font: JetBrains Mono 14px, line-height 1.7.
- Colore testo: `var(--accent-phosphor)`, `text-shadow: 0 0 6px rgba(124,255,142,0.5)`.
- Cursore: blocco `█` `--accent-phosphor` blink 1s steps(2).

**Boot lines (statiche):**
```
ARCHIVIO 17 / TERM-01 v1.4 — ROMA
CONNESSIONE STABILE · FASC. 001
────────────────────────────────
> INSERIRE IDENTITÀ DEL CONTATTO
> CAMPO 1/2: NOME (solo nome di battesimo)
> CAMPO 2/2: PROFESSIONE (al singolare)
────────────────────────────────
NOME > _
```

**Risposta corretta:** verde brillante con `[✓] CORRISPONDENZA TROVATA`.
**Risposta sbagliata:** linea rossa `[✗] NESSUNA CORRISPONDENZA — Tentativo N fallito. − 5 punti.` + shake del bezel (translateX ±6px in 400ms).

**Foot bar:** `F1 chiudere · ↵ inviare · PUNTEGGIO 100 · TENTATIVI 0` — Inter 10px letter-spacing 0.18em.

---

## 12. Score card

Pillola in top bar + card espansa nel finale.

**Pillola top bar (compact):**
- Box: `padding: 6px 12px`, `border: 1px solid rgba(255,255,255,0.12)`, no background.
- Label: `PUNTEGGIO` Inter 10px letter-spacing 0.22em `--text-secondary`.
- Valore: Inter 14px weight 600 `--accent-brass`.
- Animazione su decremento: flash rosso 200ms + count-down animato (`requestAnimationFrame` 400ms).

**Card espansa (post-game / dashboard finale):**
```
┌──────────────────────────────────────┐
│  PUNTEGGIO FINALE                    │
│                                      │
│   72 / 100        ┌────────┐         │
│                   │   B    │  voto   │
│                   └────────┘         │
│  ────                                │
│  Indizi usati ········· 2 / 4        │
│  Tentativi falliti ··· 3             │
│  Tempo trascorso ····· 14:32         │
└──────────────────────────────────────┘
```
- `background: var(--bg-panel)`, `border: 1px solid rgba(201,163,90,0.18)`, padding 28px.
- Punteggio grande: Cormorant 56px `--accent-brass`.
- Voto: quadrato 64×64, `border: 2px solid var(--accent-brass)`, lettera Cormorant 36px.
- Riga statistiche: leader-dots `··········` con Special Elite, valore Inter 600.

---

## 13. Finale "Anomalia confermata"

**Concept:** il caso si chiude. Tono **horror-thriller elegante** — non un trionfo, una rivelazione cupa.

**Composizione:**
- Background `--bg-void` con vignettatura accentuata.
- Centrato, max-width 720px.
- In alto: timbro grande `ANOMALIA CONFERMATA` ruotato −4°, `--accent-blood`, 22px Special Elite letter-spacing 0.18em, bordo doppio.
- Titolo: *« Identità confermata. »* — Cormorant italic 600, 44px, `--text-primary`.
- Sotto al titolo: griglia 2 colonne con NOME e PROFESSIONE — bordo `2px double var(--accent-brass)`, valori Special Elite 28px letter-spacing 0.1em.
- Blocco spiegazione: background `rgba(58,143,163,0.06)`, border-left `3px solid var(--state-info)`, padding 16px, JetBrains Mono 13px, line-height 1.8.
- Score card §12 sotto.
- In fondo, **due** bottoni:
  - Outline brass: `↺ AZZERARE E RICOMINCIARE`
  - Pieno blood: `CHIUDERE IL FASCICOLO →`

**Animazione di entrata:** sequenza in 1.4s totali:
1. (0–400ms) Vignettatura si stringe.
2. (200–600ms) Timbro ANOMALIA appare con scale 1.4 → 1.0 + rotate −4°.
3. (600–1000ms) Titolo typewriter.
4. (1000–1400ms) NOME/PROFESSIONE/spiegazione fade-in scaglionato.

**Audio (opzionale):** singolo *thud* grave a t=0, ticking si ferma.

---

## 14. CSS tokens

Da incollare in `src/styles/globals.css`. Sostituisce le variabili attuali del prototipo.

```css
:root {
  /* === Background === */
  --bg-void: #06070A;
  --bg-room: #0B0D12;
  --bg-panel: #11141B;
  --bg-panel-2: #171B24;
  --bg-elevated: #1E232E;

  /* === Paper === */
  --paper: #E8DFC8;
  --paper-aged: #D9CBA8;
  --paper-edge: #7A6A45;
  --ink: #1A1410;
  --ink-faded: #4A3F30;

  /* === Accents === */
  --accent-blood: #A12121;
  --accent-blood-dim: #5A1414;
  --accent-phosphor: #7CFF8E;
  --accent-phosphor-dim: #2C7C3A;
  --accent-brass: #C9A35A;
  --accent-brass-dim: #7A6437;

  /* === Text === */
  --text-primary: #E8E5DD;
  --text-secondary: #A39E92;
  --text-tertiary: #6B6759;
  --text-on-paper: #1A1410;

  /* === States === */
  --state-success: #5FA572;
  --state-warning: #C9A35A;
  --state-danger: #A12121;
  --state-info: #5A8FA3;

  /* === CRT === */
  --crt-bg: #07140A;
  --crt-bg-2: #0A1C0E;

  /* === Spacing scale === */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 96px;

  /* === Radii === */
  --radius-sm: 2px;     /* documenti, card */
  --radius-md: 8px;     /* CRT screen */
  --radius-lg: 14px;    /* terminale bezel */
  --radius-pill: 999px;

  /* === Border === */
  --border-hairline: 1px solid rgba(255,255,255,0.06);
  --border-soft: 1px solid rgba(255,255,255,0.10);
  --border-brass: 1px solid rgba(201,163,90,0.20);
  --border-blood: 1px solid rgba(161,33,33,0.40);

  /* === Shadows === */
  --shadow-paper: 0 40px 80px -20px rgba(0,0,0,0.7), 0 4px 12px -4px rgba(0,0,0,0.5);
  --shadow-modal: 0 30px 80px rgba(0,0,0,0.6);
  --shadow-pill: 0 1px 2px rgba(0,0,0,0.4);

  /* === Type === */
  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-ui: 'Inter', system-ui, sans-serif;
  --font-typewriter: 'Special Elite', 'Courier New', monospace;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;

  --fs-xs: 10px;
  --fs-sm: 11px;
  --fs-base: 13px;
  --fs-md: 14px;
  --fs-lg: 16px;
  --fs-xl: 18px;
  --fs-2xl: 22px;
  --fs-3xl: 28px;
  --fs-4xl: 36px;
  --fs-5xl: 44px;
  --fs-6xl: 56px;

  --tracking-tight: 0.02em;
  --tracking-normal: 0.04em;
  --tracking-wide: 0.12em;
  --tracking-wider: 0.18em;
  --tracking-widest: 0.30em;

  /* === Motion === */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-fast: 160ms;
  --dur-base: 240ms;
  --dur-slow: 480ms;
  --dur-narrative: 1400ms;

  /* === Z === */
  --z-rail: 10;
  --z-topbar: 50;
  --z-overlay: 100;
  --z-modal: 110;
  --z-toast: 200;
}

/* Body / global */
html, body {
  background: var(--bg-void);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: var(--fs-base);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* Vignette utility — applicare al body o al wrapper di scena */
.vignette::after {
  content: "";
  position: fixed; inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%);
  z-index: 1;
}

/* Grain utility */
.grain::before {
  content: "";
  position: absolute; inset: 0;
  pointer-events: none;
  background-image: url("/textures/grain.svg");
  opacity: 0.06;
  mix-blend-mode: overlay;
}
```

---

## 15. Indicazioni per implementazione in Next.js

### 15.1 Struttura cartelle

```
src/
  app/
    layout.tsx              ← font + metadata + vignette wrapper
    page.tsx                ← entry, monta <CaseApp />
    globals.css             ← tokens da §14
  components/
    CaseApp.tsx             ← (esistente, NON riscrivere)
    case/
      GateScreen.tsx
      ArchivistIntro.tsx
      Dashboard.tsx
      DocumentRail.tsx
      DocumentCard.tsx
      DocumentViewer/
        TelegramView.tsx
        PostcardView.tsx
        PhonebookView.tsx
        index.tsx           ← discriminator su doc.kind
      HintPanel.tsx
      Terminal.tsx
      ScoreCard.tsx
      FinaleScreen.tsx
    ui/
      Stamp.tsx
      PaperSheet.tsx
      Pill.tsx
      Button.tsx
  styles/
    globals.css
    tokens.css              ← solo :root tokens (importato da globals)
  data/
    case.json               ← (esistente, NON modificare)
  lib/
    storage.ts              ← localStorage helpers
    types.ts
public/
  textures/
    grain.svg
    paper-grain.svg
  fonts/                    ← solo se self-host
```

### 15.2 Font loading

In `src/app/layout.tsx`:

```tsx
import { Inter, Cormorant_Garamond, Special_Elite, JetBrains_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ui',
  display: 'swap',
});
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});
const specialElite = Special_Elite({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-typewriter',
  display: 'swap',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export default function RootLayout({ children }) {
  return (
    <html lang="it" className={`${inter.variable} ${cormorant.variable} ${specialElite.variable} ${jetbrains.variable}`}>
      <body className="vignette">{children}</body>
    </html>
  );
}
```

I tokens `--font-ui`, `--font-display`, ecc. in `globals.css` vengono **automaticamente sovrascritti** dalle variabili di `next/font` (stessi nomi). Non serve altro.

### 15.3 CSS Modules vs Tailwind

Restare su **CSS Modules** per coerenza con `CaseApp.module.css` esistente. Un modulo per componente, e tutti consumano i tokens di `globals.css` via `var(--token)`.

Esempio `Stamp.module.css`:
```css
.stamp {
  display: inline-block;
  padding: 4px 10px 3px;
  border: 2.5px solid var(--accent-blood);
  color: var(--accent-blood);
  font-family: var(--font-typewriter);
  font-size: var(--fs-md);
  font-weight: 700;
  letter-spacing: var(--tracking-wider);
  text-transform: uppercase;
  transform: rotate(var(--tilt, -8deg));
  box-shadow: inset 0 0 0 1px var(--accent-blood);
}
```

### 15.4 Stati e persistenza

`CaseApp.tsx` gestisce già lo stato in `localStorage`. **Non toccare**. I nuovi componenti UI consumano lo stato esistente via prop drilling o un context leggero `CaseContext` se necessario:

```ts
type CaseState = {
  screen: 'gate' | 'intro' | 'dashboard' | 'finale';
  activeDocId: string | null;
  score: number;
  hintsUnlocked: number;
  attempts: number;
  highlightedRows: number[];
  startedAt: number;
};
```

### 15.5 Animazioni

Usare **Framer Motion** per:
- Transizioni di schermata (gate → intro → dashboard).
- Typewriter dell'Archivista (`<motion.span>` con stagger 28ms).
- Fade-in documenti.
- Shake del Terminale su errore.
- Sequenza finale "Anomalia confermata".

```tsx
<motion.div
  initial={{ opacity: 0, y: 24 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
>
  …
</motion.div>
```

Per il blink del cursore e le scanlines, **CSS puro** (più performante).

### 15.6 Accessibilità

- `aria-live="polite"` sul body del Terminale, così screen reader leggono le risposte.
- `aria-modal="true"` + focus-trap su Hint Panel e Terminale (libreria `focus-trap-react`).
- Tutti i bottoni hanno `:focus-visible` con outline ottone 2px offset 2px.
- Ridurre animazioni con `@media (prefers-reduced-motion: reduce)`: typewriter disattivato, transizioni a 0ms.
- Contrasto: testo su carta WCAG AA (≥ 4.5:1) — tutti i token testati.

### 15.7 Responsive breakpoints

```css
/* mobile-first */
@media (min-width: 640px) { /* tablet portrait */ }
@media (min-width: 880px) { /* tablet landscape — desktop layout starts */ }
@media (min-width: 1200px) { /* desktop comfort */ }
@media (min-width: 1600px) { /* large screens — capare max-width */ }
```

### 15.8 Texture statiche

Inserire in `public/textures/`:
- `grain.svg` — feTurbulence baseFrequency 0.85 (vedi attuale prototipo, già pronto).
- `paper-grain.svg` — feTurbulence baseFrequency 0.6 + feColorMatrix marrone tenue.

Questi vengono referenziati via `url('/textures/grain.svg')` — non vanno importati in JS.

---

## 16. Esempi di riferimento (HTML/CSS/React)

> Solo come **reference**, non da copiare letteralmente.

### 16.1 PaperSheet

```tsx
// components/ui/PaperSheet.tsx
import styles from './PaperSheet.module.css';

type Props = {
  aged?: boolean;
  tilt?: number;
  paperClip?: boolean;
  children: React.ReactNode;
};

export function PaperSheet({ aged, tilt = 0, paperClip, children }: Props) {
  return (
    <div
      className={`${styles.paper} ${aged ? styles.aged : ''}`}
      style={{ '--tilt': `${tilt}deg` } as React.CSSProperties}
    >
      {paperClip && <span className={styles.clip} aria-hidden />}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
```

```css
/* PaperSheet.module.css */
.paper {
  background: var(--paper);
  background-image: url('/textures/paper-grain.svg');
  background-blend-mode: multiply;
  color: var(--text-on-paper);
  padding: var(--space-7) var(--space-7) var(--space-6);
  box-shadow: var(--shadow-paper);
  transform: rotate(var(--tilt, 0deg));
  border-radius: var(--radius-sm);
  position: relative;
  max-width: 760px;
  margin: 0 auto;
}
.aged { background-color: var(--paper-aged); }
.clip {
  position: absolute;
  top: -16px; left: 24px;
  width: 28px; height: 60px;
  background: linear-gradient(135deg, #c9c5b8, #6b6759);
  border-radius: 14px 14px 4px 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.4);
  transform: rotate(-12deg);
}
```

### 16.2 Pill

```tsx
// components/ui/Pill.tsx
export function Pill({ label, value, accent = 'brass' }: {
  label: string; value: string | number; accent?: 'brass' | 'phosphor' | 'blood';
}) {
  return (
    <div className={styles.pill} data-accent={accent}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}
```

```css
.pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 12px;
  border: var(--border-soft);
  font-family: var(--font-ui);
  font-size: var(--fs-sm);
  letter-spacing: var(--tracking-wider);
}
.label { color: var(--text-secondary); }
.value { color: var(--accent-brass); font-weight: 600; font-size: var(--fs-md); }
.pill[data-accent="phosphor"] .value { color: var(--accent-phosphor); }
.pill[data-accent="blood"] .value { color: var(--accent-blood); }
```

### 16.3 Terminal screen (CRT)

```tsx
<div className={styles.terminal} role="dialog" aria-modal="true">
  <div className={styles.bezel}>
    <header className={styles.head}>
      <span className={styles.led} aria-hidden />
      <h2 className={styles.title}>TERMINALE 01 — VALIDAZIONE</h2>
      <button className={styles.close} onClick={onClose}>chiudere</button>
    </header>
    <div className={styles.screen} aria-live="polite">
      {bootLines.map((l, i) => <p key={i}>{l}</p>)}
      {feedback.map((l, i) => <p key={`f${i}`}>{l}</p>)}
      <form onSubmit={onSubmit} className={styles.prompt}>
        <label>{step === 0 ? 'NOME' : 'PROFESSIONE'}&nbsp;&gt;&nbsp;</label>
        <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)} autoFocus />
        <span className={styles.cursor} aria-hidden>█</span>
      </form>
    </div>
    <footer className={styles.foot}>
      <span>F1 chiudere</span><span>↵ inviare</span>
      <span>PUNTEGGIO {score}</span><span>TENTATIVI {attempts}</span>
    </footer>
  </div>
</div>
```

```css
.bezel {
  background: linear-gradient(180deg, #2A2519 0%, #1A160E 100%);
  border-radius: var(--radius-lg);
  padding: 14px;
  box-shadow: var(--shadow-modal), inset 0 2px 0 rgba(255,255,255,0.08);
  border: 1px solid rgba(255, 220, 150, 0.1);
  width: min(720px, 92vw);
}
.screen {
  background: var(--crt-bg);
  background-image:
    repeating-linear-gradient(180deg, rgba(124,255,142,0.04) 0 2px, transparent 2px 4px),
    radial-gradient(ellipse at 50% 50%, rgba(124,255,142,0.06) 0%, transparent 70%);
  border-radius: var(--radius-md);
  padding: var(--space-5) var(--space-6);
  height: 380px;
  overflow-y: auto;
  font-family: var(--font-mono);
  font-size: var(--fs-md);
  color: var(--accent-phosphor);
  text-shadow: 0 0 6px rgba(124,255,142,0.5);
}
.cursor { animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0; } }
```

### 16.4 Sequenza finale (Framer Motion)

```tsx
<motion.section className={styles.finale}
  initial="hidden" animate="show"
  variants={{ show: { transition: { staggerChildren: 0.18 } } }}
>
  <motion.div variants={fadeUp}><Stamp tilt={-4}>ANOMALIA CONFERMATA</Stamp></motion.div>
  <motion.h1 variants={fadeUp} className={styles.title}>« Identità confermata. »</motion.h1>
  <motion.div variants={fadeUp} className={styles.idGrid}>
    <div><label>NOME</label><strong>{solution.nome}</strong></div>
    <div><label>PROFESSIONE</label><strong>{solution.professione}</strong></div>
  </motion.div>
  <motion.p variants={fadeUp} className={styles.explain}>{solution.explanation}</motion.p>
  <motion.div variants={fadeUp}><ScoreCard {...stats} /></motion.div>
  <motion.div variants={fadeUp} className={styles.actions}>
    <Button variant="ghost" onClick={onReset}>↺ Azzerare e ricominciare</Button>
    <Button variant="primary" onClick={onClose}>Chiudere il fascicolo →</Button>
  </motion.div>
</motion.section>
```

```ts
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};
```

---

## Checklist di handoff

- [ ] Tokens `:root` di §14 in `globals.css`, vecchie variabili rimosse.
- [ ] 4 famiglie font caricate via `next/font/google` con `variable:`.
- [ ] Layout 280/1fr desktop, breakpoint 880px per mobile.
- [ ] Tutti i componenti UI di §15.1 creati come CSS Modules.
- [ ] Texture `grain.svg` e `paper-grain.svg` in `public/textures/`.
- [ ] Vignettatura applicata al body via classe `.vignette`.
- [ ] Framer Motion per transizioni di scena e finale.
- [ ] `prefers-reduced-motion` rispettato.
- [ ] Focus-trap su Hint Panel e Terminale.
- [ ] `aria-live` sul Terminale per screen reader.
- [ ] Logica di `CaseApp.tsx` e `case.json` **non modificate**.

— *fine handoff* —
