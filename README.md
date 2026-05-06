# Archivio 17 — Caso 001: Il Caso Marini

Prototipo web investigativo (vertical slice) per beta testing interno.

## Stack
- Next.js + React + TypeScript
- CSS Modules
- Dati in JSON (`src/data/case.json`)
- Salvataggio progresso in `localStorage`

## Accesso beta
- Codice: `A17-BETA`

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

## Risposte corrette Terminale 01
### Campo 1 (anomalia fisica)
Valide:
- `MANCINO`
- `MANO SINISTRA`
- `MANO DOMINANTE`
- `PISTOLA DESTRA`
- `PISTOLA NELLA MANO DESTRA`

### Campo 2 (iniziale/persona)
Valide:
- `S`
- `STEFANO`

### Campo 3 (sintesi investigativa)
Valida se contiene almeno 2 concetti tra:
- suicidio non semplice
- scena non coerente
- presenza di terzi
- timeline incompleta
- accesso da chiarire
- messa in scena
- pistola nella mano sbagliata

## Procedura test manuale (v0.3 QA)
1. Inserire codice `A17-BETA` e accedere.
2. Navigare da barra rapida: Intro, Fascicolo, Hint, Terminale, Esito.
3. Aprire almeno 2 documenti nel viewer.
4. Richiedere hint e verificare decremento punteggio (-5 per hint).
5. Inserire risposte errate in Terminale 01 e verificare penalità (-10 per errore).
6. Inserire risposte corrette e completare Atto 1.
7. Verificare breakdown punteggio finale e classificazione.
8. Verificare messaggio feedback placeholder quando link non configurato.
9. Testare “Resetta sessione beta” con conferma e ritorno alla schermata accesso.
10. Ricaricare pagina e verificare persistenza/reset localStorage.

## Checklist beta test
- [ ] Accesso beta funzionante con `A17-BETA`
- [ ] Viewer documenti consultabile
- [ ] Hint system a 3 livelli
- [ ] Scoring corretto (100 base, -5 hint, -10 errore, minimo 0)
- [ ] Classificazioni finali corrette
- [ ] Terminale 01 valida risposte corrette
- [ ] Reset sessione beta funzionante
- [ ] UI leggibile su mobile (<768px)
- [ ] Build deployabile su Vercel
