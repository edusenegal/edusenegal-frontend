import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <h1>Page introuvable</h1>
      <p>Cette page n’existe pas ou a été déplacée.</p>
      <Link to="/">Retour au tableau de bord</Link>
    </div>
  );
}
