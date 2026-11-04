import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, DateInput, Field, Input, Select, Sheet, StateView, Textarea } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { sendServiceNote } from '@/api/notifications.api';
import { isoToFR, todayISO } from '@/utils/format';
import { roleLabel } from '@/utils/roles';
import type { BadgeTone } from '@/components/ui';
import type { Notice, NoticeDestType } from '@/types/domain';

const DEST_TONE: Record<NoticeDestType, BadgeTone> = { ecole: 'info', classe: 'success', personnel: 'warning', eleve: 'neutral' };
const DEST_PREFIX: Record<NoticeDestType, string> = { ecole: '', classe: 'Classe ', personnel: '', eleve: 'Élève ' };

export default function NoticesPage() {
  const { notices, classes, students, personnel } = useServices();
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

  // Personnel pour la note de service (tout le personnel ou une sélection).
  const [personnelScope, setPersonnelScope] = useState<'all' | 'selection'>('all');
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const staffList = useQuery({
    queryKey: ['personnel'],
    queryFn: () => personnel.list(),
    enabled: destType === 'personnel' && personnelScope === 'selection',
  });
  const toggleStaff = (id: string) =>
    setSelectedStaff((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const sortedStaff = useMemo(
    () => [...(staffList.data ?? [])].sort((a, b) => (a.nom ?? '').localeCompare(b.nom ?? '', 'fr')),
    [staffList.data],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      let destLabel = "Toute l’école";
      if (destType === 'classe') destLabel = classList.data?.find((c) => c.id === classId)?.name ?? '';
      if (destType === 'personnel') {
        const allStaff = personnelScope === 'all';
        destLabel = allStaff ? 'Tout le personnel' : `${selectedStaff.length} agent(s)`;
        // Envoi réel des notifications (push + in-app) aux personnes concernées.
        await sendServiceNote({
          title: titre.trim(),
          body: corps.trim(),
          allStaff,
          recipientIds: allStaff ? undefined : selectedStaff,
        });
      }
      if (destType === 'eleve') {
        const s = studentsOfClass.data?.find((x) => x.id === studentId);
        destLabel = s ? `${s.prenom} ${s.nom} (${s.classe})` : '';
      }
      // Date ET heure d'émission : la date choisie + l'heure courante (une note
      // de service est émise maintenant), pour afficher "jj/mm/aaaa hh:mm".
      const now = new Date();
      const heure = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      return notices.create({
        titre: titre.trim(),
        corps: corps.trim(),
        destType,
        destLabel,
        date: `${isoToFR(date)} ${heure}`,
      });
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
    setPersonnelScope('all');
    setSelectedStaff([]);
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
    if (destType === 'personnel' && personnelScope === 'selection' && selectedStaff.length === 0) {
      setError('Sélectionnez au moins un membre du personnel.');
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
        {destType === 'personnel' ? (
          <Field label="Portée" required>
            <Select
              id="n-staff-scope"
              value={personnelScope}
              onChange={(e) => setPersonnelScope(e.target.value as 'all' | 'selection')}
            >
              <option value="all">Tout le personnel</option>
              <option value="selection">Une sélection</option>
            </Select>
          </Field>
        ) : null}
        {destType === 'personnel' && personnelScope === 'selection' ? (
          <Field label="Membres du personnel" required>
            <div
              style={{
                maxHeight: 220,
                overflowY: 'auto',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {staffList.isLoading ? (
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Chargement…</span>
              ) : sortedStaff.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Aucun membre du personnel.</span>
              ) : (
                sortedStaff.map((s) => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedStaff.includes(s.id)} onChange={() => toggleStaff(s.id)} />
                    <span>
                      {s.prenom} {s.nom} <span style={{ color: 'var(--color-text-muted)' }}>· {roleLabel(s.role)}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
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
