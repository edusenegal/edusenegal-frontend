import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Segmented, Select, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { fmtXOF } from '@/utils/format';
import { TeacherFormSheet } from './TeacherFormSheet';
import styles from './TeacherDetailPage.module.css';

type Tab = 'profil' | 'classes' | 'documents' | 'paie';

export default function TeacherDetailPage() {
  const { teacherId = '' } = useParams();
  const navigate = useNavigate();
  const { teachers, classes, school } = useServices();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('profil');
  const [editOpen, setEditOpen] = useState(false);
  const [classToAdd, setClassToAdd] = useState('');

  const teacherQuery = useQuery({ queryKey: ['teacher', teacherId], queryFn: () => teachers.get(teacherId) });
  const schoolQuery = useQuery({ queryKey: ['school'], queryFn: () => school.getSchool() });
  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });
  const documents = useQuery({
    queryKey: ['teacher-documents', teacherId],
    queryFn: () => teachers.listDocuments(teacherId),
    enabled: tab === 'documents',
  });
  const payslips = useQuery({
    queryKey: ['teacher-payslips', teacherId],
    queryFn: () => teachers.listPayslips(teacherId),
    enabled: tab === 'paie',
  });

  const isPrivate = schoolQuery.data?.type === 'prive';
  const t = teacherQuery.data;

  const addClassMutation = useMutation({
    mutationFn: (className: string) => teachers.addClass(teacherId, className),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', teacherId] });
      setClassToAdd('');
    },
  });
  const removeClassMutation = useMutation({
    mutationFn: (className: string) => teachers.removeClass(teacherId, className),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teacher', teacherId] }),
  });

  const availableClasses = (classList.data ?? []).filter((c) => !(t?.classes ?? []).includes(c.name));

  const tabs: { value: Tab; label: string }[] = [
    { value: 'profil', label: 'Profil' },
    { value: 'classes', label: 'Classes' },
    { value: 'documents', label: 'Documents' },
    ...(isPrivate ? [{ value: 'paie' as Tab, label: 'Bulletins de paie' }] : []),
  ];

  return (
    <div>
      <Link to="/enseignants" className={styles.back}>
        ← Enseignants
      </Link>
      <PageHeader
        title={t?.nom ?? '…'}
        subtitle={t ? `${t.matiere} · ${t.classes.join(', ') || 'Aucune classe'}` : undefined}
        action={
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            ✎ Modifier
          </Button>
        }
      />

      <StateView loading={teacherQuery.isLoading} error={teacherQuery.error}>
        <Card>
          <Segmented<Tab> options={tabs} value={tab} onChange={setTab} />
          <div className={styles.body}>
            {tab === 'profil' && t ? (
              <div className={styles.rows}>
                <Row k="Nom complet" v={t.nom} />
                <Row k="Matière" v={t.matiere} />
                <Row k="Téléphone" v={t.tel} />
                <Row k="E-mail" v={t.email} />
                <Row k="Statut" v={t.statut === 'actif' ? 'Actif' : 'En congé'} />
                <Row k="Classes" v={t.classes.join(', ') || 'Aucune'} />
              </div>
            ) : null}

            {tab === 'classes' ? (
              <>
                <p className={styles.hint}>
                  Les classes de cet enseignant se gèrent uniquement depuis cette liste — choisissez une classe existante de
                  l’établissement pour l’ajouter.
                </p>
                <div className={styles.classList}>
                  {(t?.classes ?? []).length === 0 ? (
                    <p className={styles.muted}>Aucune classe assignée pour le moment.</p>
                  ) : (
                    t?.classes.map((cn) => (
                      <div key={cn} className={styles.classRow}>
                        <strong>{cn}</strong>
                        <Button variant="ghost" size="sm" onClick={() => removeClassMutation.mutate(cn)}>
                          ✕ Retirer
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <div className={styles.addRow}>
                  <Select id="tc-add-select" value={classToAdd} onChange={(e) => setClassToAdd(e.target.value)}>
                    <option value="">— Choisir une classe —</option>
                    {availableClasses.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="secondary"
                    disabled={!classToAdd}
                    loading={addClassMutation.isPending}
                    onClick={() => addClassMutation.mutate(classToAdd)}
                  >
                    + Ajouter
                  </Button>
                </div>
              </>
            ) : null}

            {tab === 'documents' ? (
              <>
                <div className={styles.calHead}>
                  <h3 className={styles.sectionTitle}>Documents administratifs</h3>
                  <Button variant="secondary" size="sm" onClick={() => navigate('/signatures')}>
                    🖊 Signer un document
                  </Button>
                </div>
                <StateView
                  loading={documents.isLoading}
                  error={documents.error}
                  empty={(documents.data?.length ?? 0) === 0}
                  emptyLabel="Aucun document signé pour cet enseignant pour le moment."
                >
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Série</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Signataire</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.data?.map((d) => (
                        <tr key={d.serie}>
                          <td className={styles.mono}>{d.serie}</td>
                          <td>{d.type}</td>
                          <td className={styles.mono}>{d.date}</td>
                          <td>{d.signataire}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </StateView>
              </>
            ) : null}

            {tab === 'paie' ? (
              <StateView
                loading={payslips.isLoading}
                error={payslips.error}
                empty={(payslips.data?.length ?? 0) === 0}
                emptyLabel="Aucun bulletin de paie disponible pour cet enseignant."
              >
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Mois</th>
                      <th>Montant net</th>
                      <th>Date de versement</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payslips.data?.map((s) => (
                      <tr key={s.id}>
                        <td>{s.mois}</td>
                        <td className={styles.mono}>{fmtXOF(s.montant)}</td>
                        <td className={styles.mono}>{s.datePaiement}</td>
                        <td>{s.statut === 'payé' ? 'Payé' : 'En attente'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </StateView>
            ) : null}
          </div>
        </Card>
      </StateView>

      <TeacherFormSheet open={editOpen} onClose={() => setEditOpen(false)} teacher={t} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.muted}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
