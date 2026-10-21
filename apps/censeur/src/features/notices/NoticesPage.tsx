import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, DateInput, Field, Input, Select, Sheet, StateView, Textarea } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { isoToFR, todayISO } from '@/utils/format';
import type { BadgeTone } from '@/components/ui';
import type { Notice, NoticeDestType } from '@/types/domain';

const DEST_TONE: Record<NoticeDestType, BadgeTone> = { ecole: 'info', classe: 'success', personnel: 'warning', eleve: 'neutral' };
const DEST_PREFIX: Record<NoticeDestType, string> = { ecole: '', classe: 'Classe ', personnel: '', eleve: 'Élève ' };

export default function NoticesPage() {
  const { notices, classes, students } = useServices();
  const queryClient = useQueryClient();

  const list = useQuery({ queryKey: ['notices'], queryFn: () => notices.list() });
  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });

  const [open, setOpen] = useState(false);
  const [titre, setTitre] = useState('');
  const [corps, setCorps] = useState('');
  const [destType, setDestType] = useState<NoticeDestType>('ecole');
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);

  const studentsOfClass = useQuery({
    queryKey: ['students', classId],
    queryFn: () => students.list(classId),
    enabled: destType === 'eleve' && !!classId,
  });

  const mutation = useMutation({
    mutationFn: () => {
      let destLabel = "Toute l’école";
      if (destType === 'classe') destLabel = classList.data?.find((c) => c.id === classId)?.name ?? '';
      if (destType === 'personnel') destLabel = 'Personnel';
      if (destType === 'eleve') {
        const s = studentsOfClass.data?.find((x) => x.id === studentId);
        destLabel = s ? `${s.prenom} ${s.nom} (${s.classe})` : '';
      }
      return notices.create({ titre: titre.trim(), corps: corps.trim(), destType, destLabel, date: isoToFR(date) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      reset();
      setOpen(false);
    },
  });

  function reset() {
    setTitre('');
    setCorps('');
    setDestType('ecole');
    setClassId('');
    setStudentId('');
    setDate(todayISO());
    setError(null);
  }

  function onSubmit() {
    if (!titre.trim() || !corps.trim()) {
      setError('Le titre et le contenu sont obligatoires.');
      return;
    }
    if (destType === 'classe' && !classId) {
      setError('Choisissez une classe.');
      return;
    }
    if (destType === 'eleve' && (!classId || !studentId)) {
      setError('Choisissez la classe puis l’élève concerné.');
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <div>
      <PageHeader
        title="Notes de service"
        subtitle="Notes de service et annonces — un seul système, un destinataire au choix."
        action={
          <Button id="btn-new-notice" variant="primary" onClick={() => setOpen(true)}>
            + Nouvelle note
          </Button>
        }
      />
      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <div>
            {list.data?.map((n: Notice) => (
              <div key={n.id} style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <strong>{n.titre}</strong>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <Badge tone={DEST_TONE[n.destType]}>
                      {DEST_PREFIX[n.destType]}
                      {n.destLabel}
                    </Badge>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{n.date}</span>
                  </div>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--color-text-muted)' }}>{n.corps}</p>
              </div>
            ))}
          </div>
        </StateView>
      </Card>

      <Sheet
        title="Nouvelle note de service"
        open={open}
        onClose={() => {
          reset();
          setOpen(false);
        }}
        width="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button id="n-save" variant="primary" loading={mutation.isPending} onClick={onSubmit}>
              Publier
            </Button>
          </>
        }
      >
        <Field label="Titre" required>
          <Input id="n-titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
        </Field>
        <Field label="Contenu" required>
          <Textarea id="n-corps" value={corps} onChange={(e) => setCorps(e.target.value)} rows={4} />
        </Field>
        <Field label="Destinataire" required>
          <Select
            id="n-desttype"
            value={destType}
            onChange={(e) => {
              setDestType(e.target.value as NoticeDestType);
              setClassId('');
              setStudentId('');
            }}
          >
            <option value="ecole">Toute l’école</option>
            <option value="classe">Une classe</option>
            <option value="personnel">Personnel</option>
            <option value="eleve">Un élève spécifique</option>
          </Select>
        </Field>
        {destType === 'classe' || destType === 'eleve' ? (
          <Field label="Classe" required>
            <Select id="n-classe" value={classId} onChange={(e) => { setClassId(e.target.value); setStudentId(''); }}>
              <option value="">— Choisir une classe —</option>
              {classList.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {destType === 'eleve' && classId ? (
          <Field label="Élève" required>
            <Select id="n-eleve" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">— Choisir un élève —</option>
              {studentsOfClass.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.prenom} {s.nom}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Date" required>
          <DateInput id="n-date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p> : null}
      </Sheet>
    </div>
  );
}
