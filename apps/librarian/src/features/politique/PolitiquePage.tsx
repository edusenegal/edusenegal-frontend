import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Field, Input, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import type { LibraryPolicy } from '@/types/domain';

export default function PolitiquePage() {
  const { library } = useServices();
  const queryClient = useQueryClient();
  const policyQuery = useQuery({ queryKey: ['policy'], queryFn: () => library.getPolicy() });

  const [form, setForm] = useState<LibraryPolicy | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (policyQuery.data) setForm(policyQuery.data);
  }, [policyQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => library.updatePolicy(form ?? {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy'] });
      setSaved(true);
      setError(null);
    },
    onError: (err: unknown) => {
      setSaved(false);
      setError(err instanceof AppError ? err.message : "Enregistrement impossible.");
    },
  });

  function set<K extends keyof LibraryPolicy>(key: K, value: number) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveMutation.mutate();
  }

  return (
    <div>
      <PageHeader title="Politique de prêt" subtitle="Durées, quotas et pénalités appliqués aux emprunts." />
      <StateView loading={policyQuery.isLoading} error={policyQuery.error} onRetry={() => policyQuery.refetch()}>
        {form ? (
          <Card padded style={{ maxWidth: 520 }}>
            <CardHeader title="Paramètres" />
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Durée d'emprunt (jours)">
                <Input type="number" min={1} value={String(form.dureeEmpruntJours)} onChange={(e) => set('dureeEmpruntJours', Number(e.target.value))} />
              </Field>
              <Field label="Quota élève (emprunts simultanés)">
                <Input type="number" min={0} value={String(form.quotaEleve)} onChange={(e) => set('quotaEleve', Number(e.target.value))} />
              </Field>
              <Field label="Quota enseignant (emprunts simultanés)">
                <Input type="number" min={0} value={String(form.quotaEnseignant)} onChange={(e) => set('quotaEnseignant', Number(e.target.value))} />
              </Field>
              <Field label="Renouvellements maximum">
                <Input type="number" min={0} value={String(form.renouvellementsMax)} onChange={(e) => set('renouvellementsMax', Number(e.target.value))} />
              </Field>
              <Field label="Pénalité de retard (FCFA / jour)">
                <Input type="number" min={0} value={String(form.penaliteRetardParJour)} onChange={(e) => set('penaliteRetardParJour', Number(e.target.value))} />
              </Field>
              {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p> : null}
              {saved ? <p style={{ color: 'var(--color-success)', fontSize: 13 }}>Politique enregistrée.</p> : null}
              <div>
                <Button type="submit" variant="primary" loading={saveMutation.isPending}>
                  Enregistrer
                </Button>
              </div>
            </form>
          </Card>
        ) : null}
      </StateView>
    </div>
  );
}
