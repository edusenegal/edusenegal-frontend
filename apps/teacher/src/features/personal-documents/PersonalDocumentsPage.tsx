import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui';
import { PersonalDocumentsSection } from '@/components/documents/PersonalDocumentsSection';
import { useAuthStore } from '@/stores/auth.store';

export default function PersonalDocumentsPage() {
  const teacherId = useAuthStore((s) => s.teacher?.id ?? '');

  return (
    <div>
      <PageHeader title="Mes documents" subtitle="CNI, diplômes et certifications liés à votre dossier personnel." />
      <Card padded>
        {teacherId ? <PersonalDocumentsSection ownerId={teacherId} ownerType="personnel" /> : null}
      </Card>
    </div>
  );
}
