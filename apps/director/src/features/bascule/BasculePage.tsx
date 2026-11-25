import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Field, Select, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import type { ClassGroup, PromotionReport, UnplacedStudent } from '@/types/domain';

/**
 * S3 — Assistant de bascule N → N+1.
 *
 * Trois temps, dans l'ordre : (1) instancier les classes de la nouvelle année
 * à partir du gabarit de l'année précédente ; (2) appliquer les décisions de
 * passage (academic → class-service) ; (3) orienter à la main les élèves qu'aucune
 * classe n'a accueillis (palier 2nde → 1ère, ou classe manquante).
 *
 * Les classes de l'année source ne sont jamais modifiées : la bascule ne crée
 * que de nouvelles classes-années et déplace les élèves vers elles.
 */

const REASON_LABEL: Record<UnplacedStudent['reason'], string> = {
  ORIENTATION_NEEDED: 'À orienter (palier)',
  NO_TARGET_CLASS: 'Classe cible manquante',
  LAST_LEVEL: 'Fin de cycle',
};

export default function BasculePage() {
  const { school, classes, academicResults, students } = useServices();

  const years = useQuery({ queryKey: ['academic-years'], queryFn: () => school.listAcademicYears() });
  const studentsQuery = useQuery({ queryKey: ['students'], queryFn: () => students.list() });

  const [fromYearId, setFromYearId] = useState('');
  const [toYearId, setToYearId] = useState('');

  // Pré-sélection : source = dernière clôturée, cible = année ouverte.
  const yearsData = years.data ?? [];
  const defaultFrom = yearsData.find((y) => y.statut === 'cloturee')?.id ?? '';
  const defaultTo = yearsData.find((y) => y.statut === 'ouverte')?.id ?? '';
  const srcYear = fromYearId || defaultFrom;
  const dstYear = toYearId || defaultTo;

  const nameOf = useMemo(() => {
    const map = new Map((studentsQuery.data ?? []).map((s) => [s.id, `${s.prenom} ${s.nom}`] as const));
    return (id: string) => map.get(id) ?? id;
  }, [studentsQuery.data]);

  // ── Étape 1 : gabarit + instanciation ────────────────────────────
  const [template, setTemplate] = useState<ClassGroup[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [instantiated, setInstantiated] = useState<ClassGroup[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadTemplate = useMutation({
    mutationFn: () => classes.listByYear(srcYear),
    onSuccess: (cls) => {
      setTemplate(cls);
      setSelected(new Set(cls.map((c) => c.id)));
      setErr(null);
    },
    onError: (e: unknown) => setErr(e instanceof AppError ? e.message : 'Chargement du gabarit impossible.'),
  });

  const instantiate = useMutation({
    mutationFn: () => {
      const defs = (template ?? [])
        .filter((c) => selected.has(c.id))
        .map((c) => ({ level: c.level, series: c.series, tag: c.tag, capacite: c.capacite, homeroomTeacherId: c.homeroomTeacherId }));
      return classes.instantiateYear(dstYear, defs);
    },
    onSuccess: (cls) => {
      setInstantiated(cls);
      setMsg(`${cls.length} classe(s) dans la nouvelle année.`);
      setErr(null);
    },
    onError: (e: unknown) => setErr(e instanceof AppError ? e.message : 'Instanciation impossible.'),
  });

  // ── Étape 2 : application des décisions ───────────────────────────
  const [report, setReport] = useState<PromotionReport | null>(null);
  const apply = useMutation({
    mutationFn: async () => {
      const decisions = await academicResults.getPromotionDecisions(srcYear);
      return classes.applyPromotion({ fromYearId: srcYear, toYearId: dstYear, results: decisions });
    },
    onSuccess: (r) => {
      setReport(r);
      setMsg(`Décisions appliquées : ${r.promotedCount} promu(s), ${r.retainedCount} redoublant(s), ${r.unplacedCount} à orienter.`);
      setErr(null);
    },
    onError: (e: unknown) => setErr(e instanceof AppError ? e.message : 'Application des décisions impossible.'),
  });

  // ── Étape 3 : orientation manuelle ────────────────────────────────
  const targetClasses = useQuery({
    queryKey: ['classes-by-year', dstYear],
    queryFn: () => classes.listByYear(dstYear),
    enabled: Boolean(report && report.unplacedCount > 0 && dstYear),
  });
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());

  const assign = useMutation({
    mutationFn: ({ studentId, classId }: { studentId: string; classId: string }) =>
      classes.enroll(classId, studentId),
    onSuccess: (_void, vars) => {
      setAssignedIds((prev) => new Set(prev).add(vars.studentId));
      setErr(null);
    },
    onError: (e: unknown) => setErr(e instanceof AppError ? e.message : 'Affectation impossible.'),
  });

  const pendingUnplaced = (report?.unplaced ?? []).filter((u) => !assignedIds.has(u.studentId));

  const unplacedCols: Column<UnplacedStudent>[] = [
    { key: 'eleve', header: 'Élève', render: (u) => <strong>{nameOf(u.studentId)}</strong> },
    { key: 'origine', header: 'Classe d’origine', render: (u) => u.fromClassName },
    { key: 'motif', header: 'Motif', render: (u) => <Badge tone="warning">{REASON_LABEL[u.reason]}</Badge> },
    {
      key: 'cible',
      header: 'Classe N+1',
      render: (u) => (
        <Select
          value={picked[u.studentId] ?? ''}
          onChange={(e) => setPicked((prev) => ({ ...prev, [u.studentId]: e.target.value }))}
        >
          <option value="">— choisir —</option>
          {(targetClasses.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (u) => (
        <Button
          size="sm"
          variant="primary"
          disabled={!picked[u.studentId]}
          loading={assign.isPending && assign.variables?.studentId === u.studentId}
          onClick={() => assign.mutate({ studentId: u.studentId, classId: picked[u.studentId] })}
        >
          Affecter
        </Button>
      ),
    },
  ];

  const yearOptions = (
    <>
      <option value="">— choisir —</option>
      {yearsData.map((y) => (
        <option key={y.id} value={y.id}>{y.label} ({y.statut})</option>
      ))}
    </>
  );

  return (
    <div>
      <PageHeader
        title="Bascule vers la nouvelle année"
        subtitle="Instanciez les classes, appliquez les décisions de passage, puis orientez les élèves des paliers."
      />

      {err ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 12 }}>{err}</p> : null}
      {msg ? <p style={{ color: 'var(--color-success)', fontSize: 13, marginBottom: 12 }}>{msg}</p> : null}

      <Card style={{ marginBottom: 16 }}>
        <CardHeader title="Années" />
        <StateView loading={years.isLoading} error={years.error}>
          <div style={{ display: 'flex', gap: 16, padding: '12px 24px', flexWrap: 'wrap' }}>
            <Field label="Année source (clôturée)">
              <Select value={srcYear} onChange={(e) => setFromYearId(e.target.value)}>{yearOptions}</Select>
            </Field>
            <Field label="Année cible (nouvelle)">
              <Select value={dstYear} onChange={(e) => setToYearId(e.target.value)}>{yearOptions}</Select>
            </Field>
          </div>
        </StateView>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <CardHeader
          title="1. Classes de la nouvelle année"
          action={
            <Button variant="ghost" size="sm" disabled={!srcYear} loading={loadTemplate.isPending} onClick={() => loadTemplate.mutate()}>
              Charger le gabarit
            </Button>
          }
        />
        <div style={{ padding: '4px 24px 16px' }}>
          {template === null ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Chargez les classes de l’année source : elles serviront de modèle pour créer les classes de l’année cible.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {template.map((c) => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id);
                          else next.add(c.id);
                          return next;
                        })
                      }
                    />
                    {c.name} <span style={{ color: 'var(--color-text-muted)' }}>· capacité {c.capacite}</span>
                  </label>
                ))}
              </div>
              <Button
                variant="primary"
                disabled={!dstYear || selected.size === 0}
                loading={instantiate.isPending}
                onClick={() => instantiate.mutate()}
              >
                Instancier {selected.size} classe(s) dans la nouvelle année
              </Button>
              {instantiated ? (
                <p style={{ fontSize: 12.5, color: 'var(--color-success)', marginTop: 10 }}>
                  {instantiated.length} classe(s) prête(s) dans l’année cible.
                </p>
              ) : null}
            </>
          )}
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <CardHeader title="2. Décisions de passage" />
        <div style={{ padding: '4px 24px 16px' }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Déplace chaque élève promu vers la classe correspondante de la nouvelle année. Les redoublants
            restent au même niveau ; les élèves d’un palier (2nde → 1ère) sont listés ci-dessous pour orientation.
          </p>
          <Button
            variant="primary"
            disabled={!srcYear || !dstYear || !instantiated}
            loading={apply.isPending}
            onClick={() => apply.mutate()}
          >
            Appliquer les décisions
          </Button>
          {report ? (
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <Badge tone="success">{report.promotedCount} promus</Badge>
              <Badge tone="info">{report.retainedCount} redoublants</Badge>
              <Badge tone={report.unplacedCount > 0 ? 'warning' : 'neutral'}>{report.unplacedCount} à orienter</Badge>
            </div>
          ) : null}
        </div>
      </Card>

      {report && report.unplacedCount > 0 ? (
        <Card>
          <CardHeader title="3. Orientation" />
          <StateView loading={targetClasses.isLoading} error={targetClasses.error} empty={pendingUnplaced.length === 0}>
            <Table columns={unplacedCols} rows={pendingUnplaced} rowKey={(u) => u.studentId} />
          </StateView>
        </Card>
      ) : null}
    </div>
  );
}
