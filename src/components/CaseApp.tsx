'use client';

import { useEffect, useMemo, useState } from 'react';
import caseData from '@/data/case.json';
import styles from '@/styles/CaseApp.module.css';

type PuzzleHintState = Record<string, number>;

type TerminalState = {
  anomaly: string;
  timeline: string;
  synthesis: string;
};

type AppState = {
  accessGranted: boolean;
  activeDoc: string;
  hintLevels: PuzzleHintState;
  terminal: TerminalState;
  errors: number;
  completed: boolean;
};

const STORAGE_KEY = 'archivio17-caso001-progress';
const DEFAULT_TERMINAL: TerminalState = { anomaly: '', timeline: '', synthesis: '' };
const BASE_SCORE = 100;
const HINT_PENALTY = 5;
const ERROR_PENALTY = 10;
const FEEDBACK_URL = '#';

const validAnomaly = ['MANCINO', 'MANO SINISTRA', 'MANO DOMINANTE', 'PISTOLA DESTRA', 'PISTOLA NELLA MANO DESTRA'];
const validTimeline = ['S', 'STEFANO'];
const concepts = ['suicidio non semplice', 'scena non coerente', 'presenza di terzi', 'timeline incompleta', 'accesso da chiarire', 'messa in scena', 'pistola nella mano sbagliata'];

export default function CaseApp() {
  const [accessGranted, setAccessGranted] = useState(false);
  const [betaInput, setBetaInput] = useState('');
  const [betaError, setBetaError] = useState('');
  const [activeDoc, setActiveDoc] = useState(caseData.documents[0].id);
  const [hintLevels, setHintLevels] = useState<PuzzleHintState>({});
  const [terminal, setTerminal] = useState<TerminalState>(DEFAULT_TERMINAL);
  const [errors, setErrors] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Partial<AppState>;
      setAccessGranted(parsed.accessGranted ?? false);
      setActiveDoc(parsed.activeDoc ?? caseData.documents[0].id);
      setHintLevels(parsed.hintLevels ?? {});
      setTerminal(parsed.terminal ?? DEFAULT_TERMINAL);
      setErrors(parsed.errors ?? 0);
      setCompleted(parsed.completed ?? false);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessGranted, activeDoc, hintLevels, terminal, errors, completed }));
  }, [accessGranted, activeDoc, hintLevels, terminal, errors, completed]);

  const hintsUsed = useMemo(() => Object.values(hintLevels).reduce((sum, lvl) => sum + lvl, 0), [hintLevels]);
  const hintPenaltyTotal = hintsUsed * HINT_PENALTY;
  const errorPenaltyTotal = errors * ERROR_PENALTY;
  const score = Math.max(0, BASE_SCORE - hintPenaltyTotal - errorPenaltyTotal);

  const rank = score >= 90 ? 'Archivista in formazione' : score >= 75 ? 'Investigatore' : score >= 60 ? 'Collaboratore' : 'Osservatore esterno';
  const currentDoc = caseData.documents.find((d) => d.id === activeDoc);

  const revealHint = (puzzleId: string) => {
    setHintLevels((prev) => ({ ...prev, [puzzleId]: Math.min((prev[puzzleId] ?? 0) + 1, 3) }));
  };

  const handleValidate = () => {
    let localErrors = 0;
    const anomalyOk = validAnomaly.includes(terminal.anomaly.trim().toUpperCase());
    const timelineOk = validTimeline.includes(terminal.timeline.trim().toUpperCase());
    const synth = terminal.synthesis.toLowerCase();
    const synthHits = concepts.filter((c) => synth.includes(c)).length;
    const synthesisOk = synthHits >= 2;

    if (!anomalyOk) localErrors += 1;
    if (!timelineOk) localErrors += 1;
    if (!synthesisOk) localErrors += 1;

    if (localErrors > 0) {
      setErrors((prev) => prev + localErrors);
      setValidationMessage('Validazione incompleta. Rivedi gli elementi investigativi nel fascicolo.');
      return;
    }

    setValidationMessage('Terminale 01 validato correttamente.');
    setCompleted(true);
  };

  const handleBetaAccess = () => {
    if (betaInput.trim().toUpperCase() === caseData.betaCode) {
      setAccessGranted(true);
      setBetaError('');
      return;
    }
    setBetaError('Codice non valido. Usa il codice beta fornito dal team Archivio 17.');
  };

  const handleReset = () => {
    const confirmed = window.confirm('Confermi il reset della sessione beta? I progressi locali verranno cancellati.');
    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);
    setAccessGranted(false);
    setBetaInput('');
    setBetaError('');
    setActiveDoc(caseData.documents[0].id);
    setHintLevels({});
    setTerminal(DEFAULT_TERMINAL);
    setErrors(0);
    setCompleted(false);
    setValidationMessage('');
  };

  if (!accessGranted) {
    return (
      <main className={styles.wrapper}>
        <section className={styles.card} id="intro">
          <h1>{caseData.title}</h1>
          <h2>{caseData.subtitle}</h2>
          <p>Accesso beta riservato. Inserisci il codice.</p>
          <input value={betaInput} onChange={(e) => setBetaInput(e.target.value)} placeholder="Codice beta" className={styles.input} />
          <button className={styles.button} onClick={handleBetaAccess}>Accedi</button>
          {betaError && <p className={styles.error}>{betaError}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className={styles.wrapper}>
      <header className={styles.header}>
        <h1>{caseData.title}</h1>
        <p>{caseData.subtitle}</p>
      </header>

      <nav className={styles.quickNav}>
        <a href="#intro" className={styles.navLink}>Intro</a>
        <a href="#fascicolo" className={styles.navLink}>Fascicolo</a>
        <a href="#hint" className={styles.navLink}>Hint</a>
        <a href="#terminale" className={styles.navLink}>Terminale</a>
        <a href="#esito" className={styles.navLink}>Esito</a>
      </nav>

      <section className={styles.card} id="intro">
        <h3>Email dell’Archivista</h3>
        <p>Agente, il Fascicolo Marini presenta incongruenze incompatibili con una chiusura rapida. Esamina i documenti, annota le anomalie e completa il Terminale 01. L’Archivio osserva.</p>
      </section>

      <section className={styles.grid} id="fascicolo">
        <aside className={styles.card}>
          <h3>Dashboard fascicolo</h3>
          {caseData.documents.map((doc) => (
            <button key={doc.id} className={`${styles.button} ${activeDoc === doc.id ? styles.active : ''}`.trim()} onClick={() => setActiveDoc(doc.id)}>
              {doc.id} — {doc.title}
            </button>
          ))}
        </aside>

        <article className={styles.card}>
          <h3>Document viewer</h3>
          <h4>{currentDoc?.id} — {currentDoc?.title}</h4>
          <p>{currentDoc?.content}</p>
        </article>
      </section>

      <section className={styles.card} id="hint">
        <h3>Hint System</h3>
        {caseData.puzzles.map((p) => (
          <div key={p.id} className={styles.hintBlock}>
            <strong>{p.id} — {p.title}</strong>
            <p>{p.hints.slice(0, hintLevels[p.id] ?? 0).join(' ') || 'Nessun hint richiesto.'}</p>
            <button className={styles.button} onClick={() => revealHint(p.id)} disabled={(hintLevels[p.id] ?? 0) >= 3}>Richiedi hint</button>
          </div>
        ))}
      </section>

      <section className={styles.card} id="terminale">
        <h3>Terminale 01</h3>
        <label>Qual è l’anomalia fisica principale della scena?</label>
        <input className={styles.input} value={terminal.anomaly} onChange={(e) => setTerminal({ ...terminal, anomaly: e.target.value })} />
        <label>Quale iniziale/persona rompe la timeline?</label>
        <input className={styles.input} value={terminal.timeline} onChange={(e) => setTerminal({ ...terminal, timeline: e.target.value })} />
        <label>Scrivi una sintesi investigativa dell’Atto 1.</label>
        <textarea className={styles.textarea} value={terminal.synthesis} onChange={(e) => setTerminal({ ...terminal, synthesis: e.target.value })} />
        <button className={styles.button} onClick={handleValidate}>Valida risposte</button>
        {validationMessage && <p className={styles.message}>{validationMessage}</p>}
      </section>

      <section className={styles.card} id="esito">
        <h3>Punteggio</h3>
        <ul className={styles.scoreList}>
          <li>Punteggio base: {BASE_SCORE}</li>
          <li>Hint usati: {hintsUsed} (penalità: -{hintPenaltyTotal})</li>
          <li>Errori Terminale 01: {errors} (penalità: -{errorPenaltyTotal})</li>
          <li>Punteggio finale: {score}</li>
          <li>Classificazione finale: {rank}</li>
        </ul>
        <button className={styles.button} onClick={handleReset}>Resetta sessione beta</button>
      </section>

      {completed && (
        <section className={styles.final}>
          <p>“Anomalia confermata. La morte di Andrea Marini non può essere trattata come suicidio semplice. L’Archivio autorizza l’accesso all’Atto 2.”</p>
          <p>“Il prossimo fascicolo non riguarda la morte. Riguarda il denaro.”</p>
          {FEEDBACK_URL === '#' ? (
            <p className={styles.message}>Link feedback non ancora configurato</p>
          ) : (
            <a href={FEEDBACK_URL} target="_blank" rel="noreferrer">Invia feedback beta</a>
          )}
        </section>
      )}
    </main>
  );
}
