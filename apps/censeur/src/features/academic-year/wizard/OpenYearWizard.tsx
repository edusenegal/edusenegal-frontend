import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Segmented, StateView } from '@/components/ui';
import type { SegmentedOption } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import { syncLevelPricingsByLevel } from '@/features/payments/pricing';
import { frToISO, isoToFR, todayISO } from '@/utils/format';
import { ClassesStep } from './ClassesStep';
import { SubjectsStep } from './SubjectsStep';
import { PaymentsStep } from './PaymentsStep';
import { ConfirmationStep } from './ConfirmationStep';
import { defaultCoefficientFor, levelSeriesKey, LYCEE_LEVEL_SERIES } from './catalog';
import type { ClassDraftRow, PaymentDraft, SubjectDraftRow } from './types';
import type { ClassLevel } from '@/types/domain';

type StepKey = 'classes' | 'matieres' | 'paiements' | 'confirmation';

const LEVELS: ClassLevel[] = ['Seconde', 'Première', 'Terminale'];

const STEPS: SegmentedOption<StepKey>[] = [
  { value: 'classes', label: '1. Classes' },
  { value: 'matieres', label: '2. Matières' },
  { value: 'paiements', label: '3. Paiements' },
  { value: 'confirmation', label: '4. Confirmation' },
];

function isoPlusDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoPlusOneYearMinusOneDay(iso: string): string {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Déduit « 2028-2029 » de « 2027-2028 » ; chaîne vide si le libellé ne suit pas ce format. */
function nextLabel(current?: string): string {
  const match = current?.match(/^(\d{4})-(\d{4})$/);
  if (!match) return '';
  const start = Number(match[1]) + 1;
  return `${start}-${start + 1}`;
}

function emptyPaymentDraft(): PaymentDraft {
  return {
    type: 'inscription_trimestriel',
    levelPricings: [],
    installmentAllowed: false,
    maxInstallments: 3,
    deferredAllowed: false,
    maxDeferDays: 30,
    alertDaysBefore: 3,
    enabledChannels: [],
  };
}

/**
 * Assistant « Ouvrir une nouvelle année scolaire » — porte, pour la branche
 * lycée de cette application, les étapes Classes / Matières & coefficients /
 * Paiements de l'assistant d'onboarding de référence
 * (`10_onboarding_v2_updated.html`), comme demandé explicitement : le flux
 * commence par les Classes, puis les Matières, puis les Paiements — la
 * rubrique Paiements vit donc ici plutôt qu'être un sujet séparé.
 *
 * Différence volontaire avec l'onboarding de référence : celui-ci configure
 * une ÉCOLE QUI N'EXISTE PAS ENCORE, donc repart de catalogues par défaut.
 * Ici, l'école existe déjà (ses classes, matières et paiements réels sont
 * déjà en service) — chaque étape est donc préremplie avec les données
 * réelles actuelles (`classes.list()`, `subjects.list()`,
 * `paymentConfig.get()`) plutôt que réinitialisée, et l'envoi final ne fait
 * qu'un upsert sur ces mêmes données (voir `SchoolPort.openAcademicYear`) —
 * jamais une recréation depuis zéro.
 */
export default function OpenYearWizard() {
  const { school, classes, subjects, paymentConfig } = useServices();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: () => school.listAcademicYears() });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: () => subjects.list() });
  const paymentQuery = useQuery({ queryKey: ['payment-config'], queryFn: () => paymentConfig.get() });

  const [initialized, setInitialized] = useState(false);
  const [step, setStep] = useState<StepKey>('classes');
  const [label, setLabel] = useState('');
  const [dateDebut, setDateDebut] = useState(todayISO());
  const [dateFin, setDateFin] = useState('');
  const [classRows, setClassRows] = useState<ClassDraftRow[]>([]);
  const [subjectRows, setSubjectRows] = useState<SubjectDraftRow[]>([]);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(emptyPaymentDraft());
  const [error, setError] = useState<string | null>(null);

  // Reconstruit le brouillon une seule fois, dès que les trois sources
  // réelles ont chargé — jamais ensuite, pour ne pas écraser les
  // modifications en cours de l'utilisateur à chaque refetch.
  useEffect(() => {
    if (initialized) return;
    if (!classesQuery.data || !subjectsQuery.data || paymentQuery.isLoading || yearsQuery.isLoading) return;

    const realClasses = classesQuery.data;
    const classesById = new Map(realClasses.map((c) => [c.id, c]));

    setClassRows(
      realClasses.map((c) => ({ key: c.id, level: c.level, series: c.series, tag: c.tag, capacite: c.capacite, existing: true })),
    );

    setSubjectRows(
      subjectsQuery.data.map((s) => {
        const coefs: SubjectDraftRow['coefs'] = {};
        for (const coef of s.coefficients) {
          const cls = classesById.get(coef.classeId);
          if (!cls) continue;
          coefs[levelSeriesKey(cls.level, cls.series)] = { valeur: coef.valeur, enseignee: coef.enseignee };
        }
        for (const ls of LYCEE_LEVEL_SERIES) {
          const key = levelSeriesKey(ls.level, ls.series);
          if (key in coefs) continue;
          const coveredByRealClass = realClasses.some((c) => c.level === ls.level && c.series === ls.series);
          if (coveredByRealClass) {
            coefs[key] = { valeur: 0, enseignee: false };
          } else {
            const def = defaultCoefficientFor(s.code, ls.level, ls.series);
            coefs[key] = { valeur: def, enseignee: def > 0 };
          }
        }
        return { key: s.id, code: s.code, nom: s.nom, optionnelle: s.optionnelle, existing: true, coefs };
      }),
    );

    const config = paymentQuery.data;
    const activeLevelsAtInit = LEVELS.filter((lvl) => realClasses.some((c) => c.level === lvl));
    setPaymentDraft(
      config
        ? {
            type: config.type,
            levelPricings: syncLevelPricingsByLevel(config.levelPricings, activeLevelsAtInit),
            installmentAllowed: config.installmentAllowed,
            maxInstallments: config.maxInstallments,
            deferredAllowed: config.deferredAllowed,
            maxDeferDays: config.maxDeferDays,
            alertDaysBefore: config.alertDaysBefore,
            enabledChannels: config.enabledChannels,
          }
        : { ...emptyPaymentDraft(), levelPricings: syncLevelPricingsByLevel([], activeLevelsAtInit) },
    );

    const openYear = yearsQuery.data?.find((y) => y.statut === 'ouverte');
    const suggestedLabel = nextLabel(openYear?.label);
    const suggestedDebut = openYear ? isoPlusDays(frToISO(openYear.dateFin), 1) : todayISO();
    setLabel(suggestedLabel);
    setDateDebut(suggestedDebut);
    setDateFin(isoPlusOneYearMinusOneDay(suggestedDebut));
    setInitialized(true);
  }, [initialized, classesQuery.data, subjectsQuery.data, paymentQuery.data, paymentQuery.isLoading, yearsQuery.data, yearsQuery.isLoading]);

  // Garde les tarifs par niveau synchronisés avec les niveaux réellement
  // couverts par les classes du brouillon : un niveau ajouté à l'étape
  // Classes reçoit une ligne tarifaire (à 0), un niveau qui n'a plus aucune
  // classe perd sa ligne — jamais une ligne par classe ni par série.
  useEffect(() => {
    if (!initialized) return;
    const activeLevels = LEVELS.filter((lvl) => classRows.some((c) => c.level === lvl));
    setPaymentDraft((prev) => ({ ...prev, levelPricings: syncLevelPricingsByLevel(prev.levelPricings, activeLevels) }));
  }, [initialized, classRows]);

  const mutation = useMutation({
    mutationFn: () =>
      school.openAcademicYear({
        label,
        dateDebut: isoToFR(dateDebut),
        dateFin: isoToFR(dateFin),
        classes: classRows.map((r) => ({ level: r.level, series: r.series, tag: r.tag, capacite: r.capacite })),
        subjects: subjectRows
          .filter((r) => r.code.trim() && r.nom.trim())
          .map((r) => ({
            code: r.code.trim().toUpperCase(),
            nom: r.nom.trim(),
            optionnelle: r.optionnelle,
            coefficients: LYCEE_LEVEL_SERIES.map((ls) => ({
              level: ls.level,
              series: ls.series,
              valeur: r.coefs[levelSeriesKey(ls.level, ls.series)]?.valeur ?? 0,
              enseignee: r.coefs[levelSeriesKey(ls.level, ls.series)]?.enseignee ?? false,
            })),
          })),
        paymentConfig: paymentDraft,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['payment-config'] });
      navigate('/annee-scolaire');
    },
    onError: (err: unknown) => setError(err instanceof AppError ? err.message : "Impossible d'ouvrir l'année scolaire."),
  });

  function validateStep(target: StepKey): string | null {
    if (step === 'classes' && (target !== 'classes')) {
      if (!label.trim() || !dateDebut || !dateFin) return 'Le libellé et les dates sont obligatoires.';
      if (dateFin <= dateDebut) return 'La date de fin doit être après la date de début.';
      if (classRows.length === 0) return 'Ajoutez au moins une classe.';
    }
    if (step === 'paiements' && target === 'confirmation' && paymentDraft.type !== 'bourse') {
      if (paymentDraft.levelPricings.length === 0) return 'Ajoutez au moins un niveau tarifé.';
      if (paymentDraft.enabledChannels.length === 0) return 'Activez au moins un canal de paiement.';
    }
    return null;
  }

  function goTo(target: StepKey) {
    const currentIndex = STEPS.findIndex((s) => s.value === step);
    const targetIndex = STEPS.findIndex((s) => s.value === target);
    if (targetIndex > currentIndex) {
      const message = validateStep(target);
      if (message) {
        setError(message);
        return;
      }
    }
    setError(null);
    setStep(target);
  }

  const currentIndex = STEPS.findIndex((s) => s.value === step);

  return (
    <div>
      <PageHeader
        title="Ouvrir une nouvelle année scolaire"
        subtitle="Classes → Matières & coefficients → Paiements, préremplis avec les données actuelles de l'établissement."
      />
      <StateView loading={!initialized} error={classesQuery.error ?? subjectsQuery.error ?? paymentQuery.error ?? yearsQuery.error}>
        <div style={{ marginBottom: 20 }}>
          <Segmented options={STEPS} value={step} onChange={goTo} />
        </div>

        {step === 'classes' ? (
          <ClassesStep
            label={label}
            onLabel={setLabel}
            dateDebut={dateDebut}
            onDateDebut={setDateDebut}
            dateFin={dateFin}
            onDateFin={setDateFin}
            rows={classRows}
            onRows={setClassRows}
          />
        ) : null}
        {step === 'matieres' ? <SubjectsStep classRows={classRows} rows={subjectRows} onRows={setSubjectRows} /> : null}
        {step === 'paiements' ? <PaymentsStep classRows={classRows} draft={paymentDraft} onDraft={setPaymentDraft} /> : null}
        {step === 'confirmation' ? (
          <ConfirmationStep
            label={label}
            dateDebut={isoToFR(dateDebut)}
            dateFin={isoToFR(dateFin)}
            classRows={classRows}
            subjectRows={subjectRows}
            payment={paymentDraft}
          />
        ) : null}

        {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 16 }}>{error}</p> : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <Button variant="secondary" disabled={currentIndex === 0} onClick={() => goTo(STEPS[currentIndex - 1]!.value)}>
            ← Précédent
          </Button>
          {step === 'confirmation' ? (
            <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
              Confirmer et ouvrir l'année
            </Button>
          ) : (
            <Button variant="primary" onClick={() => goTo(STEPS[currentIndex + 1]!.value)}>
              Suivant →
            </Button>
          )}
        </div>
      </StateView>
    </div>
  );
}
