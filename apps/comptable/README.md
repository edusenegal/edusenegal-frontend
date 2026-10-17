# EduSénégal — Espace comptabilité (web)

Application web de l'espace comptable : saisie et suivi des demandes de
paiement générales de l'établissement (dépenses), soumission au circuit de
validation et décision finale (approbation/rejet), justificatifs.

Parle directement à l'api-gateway (`VITE_PROXY_TARGET` en développement) —
`user-service` pour l'authentification, `payment-service` pour les dépenses
(`ExpenseController`, `/api/v1/accounting/expenses`) et `school-service`
pour le branding de l'établissement.

## Démarrage

```bash
npm install
npm run dev       # http://localhost:5175
npm run typecheck
npm run lint
npm run test -- --run
```

## Architecture

Même squelette que `apps/director` (React + Vite + React Query + Zustand +
React Router, alias `@/*` → `src/*`) : `app/` pour le routage et la
configuration, `components/ui` pour le design system partagé,
`features/auth` pour la connexion (téléphone ou matricule, même passerelle),
`services/ports.ts` pour les contrats, `api/` pour l'implémentation HTTP
réelle.

## Rôles et circuit de validation

`ExpenseController` répartit les étapes ainsi (voir ses `@PreAuthorize`) :

- **Création** (`POST /expenses`) : comptable, directeur ou super-admin.
- **Soumission** (`POST /expenses/{id}/submit`) : comptable ou super-admin
  seulement — un directeur qui crée une dépense doit la faire soumettre par
  le comptable.
- **Décision** (`POST /expenses/{id}/validate`) : directeur, comptable ou
  super-admin.
- **Annulation / justificatifs** : comptable ou super-admin.

Cette application (le comptable) couvre donc l'intégralité du circuit ;
`apps/director` n'expose que la création.

Une dépense de catégorie **salaires** est refusée à la création pour un
établissement **public** (les enseignants y sont payés par l'État) — même
règle que le circuit dédié `SalaryPaymentController`, mais limitée à cette
seule catégorie : les autres catégories restent ouvertes à toute école.
