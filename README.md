# Archivio 17 — Caso 001: Il Caso Marini

Prototipo web investigativo (vertical slice) per beta testing.

## Stack
- Next.js + React + TypeScript
- CSS Modules
- Dati in JSON (`src/data/case.json`)
- Salvataggio progresso in `localStorage`

## Avvio locale
1. Installa dipendenze:
   ```bash
   npm install
   ```
2. Avvia in sviluppo:
   ```bash
   npm run dev
   ```
3. Apri `http://localhost:3000`

## Build produzione
```bash
npm run build
npm run start
```

## Deploy su Vercel
1. Pusha il repository su GitHub.
2. Importa il repo su Vercel.
3. Framework preset: **Next.js**.
4. Build command: `npm run build`.
5. Output: gestito automaticamente da Next.js.
6. Deploy.

## Flusso giocabile
- Accesso beta con codice: `A17-BETA`
- Intro narrativa con email Archivista
- Dashboard fascicolo + viewer documenti
- Hint system a 3 livelli per puzzle
- Terminale 01 con validazione risposte
- Sistema punteggio e titolo finale
- Salvataggio progresso in localStorage
- Micro-sblocco Atto 2 + pulsante feedback beta
