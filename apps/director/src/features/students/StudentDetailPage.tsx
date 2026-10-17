import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { PersonalDocumentsSection } from '@/components/documents/PersonalDocumentsSection';
import { StudentEditSheet } from './StudentEditSheet';
import styles from './StudentDetailPage.module.css';

const STATUS_TONE = { actif: 'success', suspendu: 'danger', transfere: 'neutral' } as const;
const STATUS_LABEL = { actif: 'Actif', suspendu: 'Suspendu', transfere: 'Transféré' } as const;

export default function StudentDetailPage() {
  const { studentId = '' } = useParams();
  const navigate = useNavigate();
  const { students } = useServices();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const studentQuery = useQuery({ queryKey: ['student', studentId], queryFn: () => students.get(studentId) });
  const s = studentQuery.data;

  const removeMutation = useMutation({
    mutationFn: () => students.remove(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      navigate('/eleves');
    },
  });

  function onDelete() {
    if (!s) return;
    if (confirm(`Supprimer ${s.prenom} ${s.nom} de l’établissement ? Cette action est définitive.`)) {
      removeMutation.mutate();
    }
  }

  function onTransfer() {
    if (!s) return;
    navigate('/transferts', { state: { studentId: s.id } });
  }

  return (
    <div>
      <Link to="/eleves" className={styles.back}>
        ← Élèves
      </Link>
      <PageHeader
        title={s ? `${s.prenom} ${s.nom}` : '…'}
        subtitle={s ? `${s.classe} · ${STATUS_LABEL[s.statut]}` : undefined}
        action={
          <div className={styles.actions}>
            <Button variant="secondary" onClick={onTransfer} disabled={!s}>
              ⇄ Transférer
            </Button>
            <Button variant="secondary" onClick={() => setEditOpen(true)} disabled={!s}>
              ✎ Modifier
            </Button>
            <Button variant="ghost" onClick={onDelete} disabled={!s} loading={removeMutation.isPending}>
              ✕ Supprimer
            </Button>
          </div>
        }
      />

      <StateView loading={studentQuery.isLoading} error={studentQuery.error}>
        {s ? (
          <Card>
            <div className={styles.body}>
              <div className={styles.rows}>
                <Row k="Prénom" v={s.prenom} />
                <Row k="Nom" v={s.nom} />
                <Row k="Classe" v={s.classe} />
                <Row k="Sexe" v={s.sexe === 'F' ? 'Féminin' : 'Masculin'} />
                <Row k="Date de naissance" v={s.dateNaissance} />
                <Row k="Parent / tuteur" v={s.parent} />
                <Row k="Téléphone" v={s.tel} />
                <Row k="Statut" v={<Badge tone={STATUS_TONE[s.statut]}>{STATUS_LABEL[s.statut]}</Badge>} />
                <Row k="Moyenne" v={`${s.moyenne.toFixed(1)}/20`} />
                <Row k="Absences" v={String(s.absences)} />
                <Row k="Retards" v={String(s.retards)} />
                <Row k="Taux de paiement" v={`${s.tauxPaiement}%`} />
              </div>
            </div>
          </Card>
        ) : null}

        {s ? (
          <Card style={{ marginTop: 'var(--space-md)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Pièces personnelles</h3>
            <p className={styles.muted} style={{ fontSize: 12.5, margin: '0 0 10px' }}>
              CNI de l’élève, acte de naissance, CNI des parents.
            </p>
            <PersonalDocumentsSection ownerId={s.id} ownerType="eleve" />
          </Card>
        ) : null}
      </StateView>

      <StudentEditSheet open={editOpen} onClose={() => setEditOpen(false)} student={s ?? null} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.muted}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
