import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Field, Input } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { applyBranding } from '@/utils/branding';

export default function SettingsPage() {
  const { school } = useServices();
  const queryClient = useQueryClient();
  const schoolQuery = useQuery({ queryKey: ['school'], queryFn: () => school.getSchool() });

  const [brandColor, setBrandColor] = useState('#1D9E75');

  useEffect(() => {
    if (schoolQuery.data) setBrandColor(schoolQuery.data.brandColor);
  }, [schoolQuery.data]);

  const mutation = useMutation({
    mutationFn: () => school.updateBranding({ brandColor }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['school'], updated);
      applyBranding(updated);
    },
  });

  const s = schoolQuery.data;

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Informations de l’établissement et apparence." />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <Card padded>
          <CardHeader title="Établissement" />
          {s ? (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
              <Row k="Nom" v={s.name} />
              <Row k="Type" v={s.type === 'prive' ? 'Privé' : 'Public'} />
              <Row k="Niveau" v="Lycée" />
              <Row k="Région" v={s.region} />
              <Row k="Adresse" v={s.adresse} />
              <Row k="Téléphone" v={s.telephone} />
              <Row k="E-mail" v={s.email} />
            </div>
          ) : null}
        </Card>

        <Card padded>
          <CardHeader title="Apparence" />
          <div style={{ marginTop: 16 }}>
            <Field label="Couleur de marque" hint="Utilisée pour la barre latérale et les accents de l’interface.">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  style={{ width: 44, height: 36, border: '1px solid var(--color-border-strong)', borderRadius: 8, padding: 2 }}
                />
                <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} style={{ maxWidth: 140 }} />
              </div>
            </Field>
            <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
              Enregistrer
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
