import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Input, Pager, Select, StateView, useConfirm } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { StudentsTable } from './StudentsTable';
import { StudentFormSheet } from './StudentFormSheet';

/**
 * Semestre utilisé pour la moyenne affichée sur cette liste globale — même
 * valeur par défaut que le sélecteur de `ClassDetailPage` (tâche #209) ;
 * cet écran n'a pas (encore) son propre sélecteur de semestre.
 */
const DEFAULT_SEMESTER = 1;

/** Taille de page (nouvelle demande direction — voir `StudentsPort.listPage`). */
const PAGE_SIZE = 20;

export default function StudentsListPage() {
  const navigate = useNavigate();
  const { students, classes, paymentConfig, academicResults } = useServices();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  // Blocage/déblocage d'un élève directement depuis la liste (demande
  // direction) — même endpoint que la fiche élève (PATCH /users/{id}/block).
  const blockMutation = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) =>
      blocked ? students.block(id) : students.unblock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students-page'] });
    },
  });

  async function onToggleBlock(s: { id: string; prenom: string; nom: string; statut: string }) {
    const willBlock = s.statut !== 'suspendu';
    const msg = willBlock
      ? `Bloquer ${s.prenom} ${s.nom} ? L’élève ne pourra plus se connecter.`
      : `Débloquer ${s.prenom} ${s.nom} ? Son accès sera rétabli.`;
    if (await confirm({ title: willBlock ? 'Bloquer l’élève' : 'Débloquer l’élève', message: msg, danger: willBlock })) blockMutation.mutate({ id: s.id, blocked: willBlock });
  }
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [page, setPage] = useState(0);

  // CORRECTION (bug signalé) : la recherche sur la vue « Toutes les classes »
  // ne filtrait que les `PAGE_SIZE` lignes déjà chargées -- un élève tout
  // juste créé (ou simplement situé sur une autre page) restait introuvable
  // même en tapant son nom. `debouncedSearch` est envoyé au backend, qui
  // filtre sur l'ÉCOLE ENTIÈRE (voir `StudentsPort.listPage`).
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // La page revient à 0 dès qu'on change de classe ou de recherche — une
  // page de résultats précédente n'a plus de sens une fois le filtre changé.
  useEffect(() => {
    setPage(0);
  }, [classFilter, debouncedSearch]);

  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });

  /**
   * « Toutes les classes » : page serveur (nouvelle demande direction —
   * l'effectif complet de l'école se chargeait en un seul appel, voir le
   * commentaire de `StudentsPort.listPage`). Une classe choisie : effectif
   * réduit (une seule classe), `list` non paginé suffit toujours — ce
   * second cas ne pose pas de pagination (une seule page, voir `Pager`).
   */
  const pagedQuery = useQuery({
    queryKey: ['students-page', page, debouncedSearch],
    queryFn: () => students.listPage({ page, size: PAGE_SIZE, search: debouncedSearch || undefined }),
    enabled: !classFilter,
  });
  const classQuery = useQuery({
    queryKey: ['students', classFilter],
    queryFn: () => students.list(classFilter),
    enabled: Boolean(classFilter),
  });

  const baseStudents = classFilter ? classQuery.data ?? [] : pagedQuery.data?.items ?? [];
  const isLoading = classFilter ? classQuery.isLoading : pagedQuery.isLoading;
  const loadError = classFilter ? classQuery.error : pagedQuery.error;
  const totalPages = classFilter ? 1 : pagedQuery.data?.totalPages ?? 1;
  const totalElements = classFilter ? baseStudents.length : pagedQuery.data?.totalElements ?? 0;

  /**
   * Moyenne/absences/taux de paiement PAR ÉLÈVE — `students.list()`/`listPage()`
   * ne les renseignent jamais (voir le commentaire de `fromUserResponse` dans
   * `students.api.ts`) ; `Student.moyenne`/`absences`/`tauxPaiement` restent
   * donc à 0 tels que retournés par le port. `ClassDetailPage` (tâche #209)
   * contournait déjà ça avec trois appels bulk fusionnés dans les lignes de
   * `StudentsTable` — cette page (l'écran "Élèves" global) ne le faisait
   * pas, d'où les colonnes à 0 constatées en production. Même motif ici,
   * étendu à la PAGE courante (20 élèves au plus, potentiellement de
   * plusieurs classes) : absences/paiements sont déjà des routes bulk par
   * liste d'ids (attendance-service, payment-service), mais la moyenne
   * (academic-service) est scopée PAR CLASSE — une requête par classe
   * présente sur la page courante, fusionnées ci-dessous.
   */
  const studentIds = useMemo(() => baseStudents.map((s) => s.id), [baseStudents]);
  const classIds = useMemo(
    () => Array.from(new Set(baseStudents.map((s) => s.classeId).filter(Boolean))),
    [baseStudents],
  );

  const absenceCounts = useQuery({
    queryKey: ['student-absence-counts', studentIds],
    queryFn: () => students.getAbsenceCounts(studentIds),
    enabled: studentIds.length > 0,
  });
  const paymentRatesByStudent = useQuery({
    queryKey: ['student-payment-rates', studentIds, classFilter],
    // `classFilter` transmis quand une seule classe est affichée (montant dû
    // résolu sur sa grille tarifaire exacte) ; omis sur la vue multi-classes
    // paginée — voir le commentaire de `PaymentConfigPort.getPaymentRatesForStudents`.
    queryFn: () => paymentConfig.getPaymentRatesForStudents(studentIds, classFilter || undefined),
    enabled: studentIds.length > 0,
  });
  // `useQueries` plutôt que N appels de `useQuery` : `classIds` varie en
  // longueur selon la page/le filtre de classe courant.
  const semesterResultsQueries = useQueries({
    queries: classIds.map((classId) => ({
      queryKey: ['class-semester-results', classId, DEFAULT_SEMESTER],
      queryFn: () => academicResults.getClassSemesterResults(classId, DEFAULT_SEMESTER),
    })),
  });
  const moyenneByStudent = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of semesterResultsQueries) {
      for (const r of q.data ?? []) {
        map.set(r.studentId, r.moyenneGenerale);
      }
    }
    return map;
  }, [semesterResultsQueries]);

  const enriched = useMemo(
    () =>
      baseStudents.map((s) => ({
        ...s,
        moyenne: moyenneByStudent.get(s.id) ?? s.moyenne,
        absences: absenceCounts.data?.[s.id] ?? s.absences,
        tauxPaiement: paymentRatesByStudent.data?.[s.id] ?? s.tauxPaiement,
      })),
    [baseStudents, moyenneByStudent, absenceCounts.data, paymentRatesByStudent.data],
  );

  // Vue « une classe » : `students.list(classFilter)` charge toute la
  // classe en un seul appel (petit effectif), donc le filtre texte reste
  // local. Vue « toutes les classes » : déjà filtré côté serveur ci-dessus.
  const filtered = useMemo(() => {
    if (!classFilter) return enriched;
    const q = search.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter((s) => `${s.prenom} ${s.nom}`.toLowerCase().includes(q));
  }, [enriched, search, classFilter]);

  return (
    <div>
      <PageHeader
        title="Élèves"
        subtitle={
          classFilter
            ? `${filtered.length} élèves dans cette classe.`
            : `${totalElements} élève${totalElements === 1 ? '' : 's'}${search.trim() ? ' correspondant à la recherche' : ' sur l’ensemble de l’établissement'}.`
        }
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un élève…"
              style={{ maxWidth: 220 }}
            />
            <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="">Toutes les classes</option>
              {classList.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              + Ajouter un élève
            </Button>
          </div>
        }
      />
      <Card>
        <StateView loading={isLoading} error={loadError} empty={filtered.length === 0}>
          <StudentsTable
            students={filtered}
            showClass={!classFilter}
            onRowClick={(s) => navigate(`/eleves/${s.id}`)}
            onToggleBlock={onToggleBlock}
            blockPendingId={blockMutation.isPending ? (blockMutation.variables?.id ?? null) : null}
          />
        </StateView>
        {!classFilter ? (
          <Pager page={page} totalPages={totalPages} totalElements={totalElements} onChange={setPage} />
        ) : null}
      </Card>
      <StudentFormSheet open={formOpen} onClose={() => setFormOpen(false)} defaultClassId={classFilter || undefined} />
    </div>
  );
}
