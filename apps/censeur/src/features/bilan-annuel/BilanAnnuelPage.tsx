import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { StateView, StatTile } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { AnnualFigure } from '@/types/domain';
import styles from './BilanAnnuelPage.module.css';

/** "+" devant un nombre positif, jamais devant "0" ou un nombre déjà négatif. */
function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** `null` → "première année suivie" plutôt qu'un "0%" qui suggérerait une stagnation. */
function deltaLabel(figure: AnnualFigure, suffix: string): string | undefined {
  if (figure.variationPct === null) return undefined;
  return `${signed(figure.variationPct)}% vs année précédente${suffix}`;
}

function tone(figure: AnnualFigure): 'success' | 'warning' | 'neutral' {
  if (figure.variationPct === null) return 'neutral';
  return figure.variationPct >= 0 ? 'success' : 'warning';
}

export default function BilanAnnuelPage() {
  const { bilanAnnuel } = useServices();
  const bilan = useQuery({ queryKey: ['bilan-annuel'], queryFn: () => bilanAnnuel.getBilan() });
  const b = bilan.data;

  return (
    <div>
      <PageHeader
        title="Bilan annuel"
        subtitle={
          b
            ? b.anneePrecedente
              ? `${b.anneeActuelle}, comparée à ${b.anneePrecedente}.`
              : `${b.anneeActuelle} — pas encore d’année précédente pour cet établissement.`
            : 'Vue d’ensemble de l’année en cours, comparée à l’année précédente.'
        }
      />

      <StateView loading={bilan.isLoading} error={bilan.error} onRetry={() => bilan.refetch()}>
        {b ? (
          <div className={styles.grid}>
            <StatTile label="Effectif" value={String(b.effectif.valeurActuelle)} delta={deltaLabel(b.effectif, '')} tone={tone(b.effectif)} />
            <StatTile
              label="Taux de réussite"
              value={`${b.tauxReussite.valeurActuelle}%`}
              delta={deltaLabel(b.tauxReussite, ' (points)')}
              tone={tone(b.tauxReussite)}
            />
            <StatTile
              label="Taux de présence"
              value={`${b.tauxPresence.valeurActuelle}%`}
              delta={deltaLabel(b.tauxPresence, ' (points)')}
              tone={tone(b.tauxPresence)}
            />
          </div>
        ) : null}
      </StateView>
    </div>
  );
}
