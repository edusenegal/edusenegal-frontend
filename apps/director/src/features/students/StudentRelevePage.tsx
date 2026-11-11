import { Link, useParams } from 'react-router-dom';
import { StudentGradesTab } from '@/features/students/StudentGradesTab';
import styles from '@/features/students/StudentDetailPage.module.css';

/**
 * Relevé de notes d'un élève ouvert depuis « Résultats & bulletins »
 * (bouton « Détails » de chaque ligne). Le retour ramène à la liste des
 * résultats. Même composant que l'onglet « Notes » de la fiche élève.
 */
export default function StudentRelevePage() {
  const { studentId = '' } = useParams();
  return (
    <div>
      <Link to="/resultats" className={styles.back}>
        ← Résultats &amp; bulletins
      </Link>
      <StudentGradesTab studentId={studentId} />
    </div>
  );
}
