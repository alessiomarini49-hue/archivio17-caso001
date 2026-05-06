import Image from 'next/image';
import styles from '@/styles/CaseApp.module.css';

type CaseDocument = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  transcript?: string;
  keyPoints?: string[];
};

export default function DocumentViewer({ doc }: { doc: CaseDocument | undefined }) {
  if (!doc) return null;

  return (
    <article className={styles.viewerCard}>
      <h3>Document viewer</h3>
      <h4>{doc.id} — {doc.title}</h4>

      {doc.imageUrl ? (
        <>
          <div className={styles.imageWrap}>
            <Image src={doc.imageUrl} alt={`${doc.id} ${doc.title}`} fill className={styles.image} />
          </div>
          <a href={doc.imageUrl} target="_blank" rel="noreferrer" className={styles.openImageButton}>Apri immagine</a>
        </>
      ) : null}

      <section className={styles.viewerSection}>
        <h5>Trascrizione leggibile</h5>
        <p>{doc.transcript || doc.content}</p>
      </section>

      <section className={styles.viewerSection}>
        <h5>Punti chiave osservabili</h5>
        <ul className={styles.scoreList}>
          {(doc.keyPoints && doc.keyPoints.length > 0 ? doc.keyPoints : [doc.content]).map((point, idx) => (
            <li key={`${doc.id}-kp-${idx}`}>{point}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
