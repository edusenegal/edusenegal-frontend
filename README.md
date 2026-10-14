# EduSénégal — Espace direction (web)

Application web de l'espace direction : classes, enseignants, élèves,
promotions, transferts, année scolaire, congés du personnel, demandes de
salaire, signature électronique des bulletins et documents administratifs,
et notes de service.

Cette branche (`mock`) ne contient **que des données de démonstration pour
un lycée** — primaire, collège et université sont hors périmètre de cette
application. Elle ne parle à aucun backend réel ; voir
[Les deux branches](#les-deux-branches) pour la suite.

## Sommaire

- [Architecture](#architecture)
- [Les deux branches](#les-deux-branches)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Lancer en local](#lancer-en-local)
- [Tests](#tests)
- [Build](#build)
- [Build de référence](#build-de-référence)
- [Périmètre de cette version](#périmètre-de-cette-version)
- [Préparer la branche `api`](#préparer-la-branche-api)

## Architecture

```
src/
├── app/            configuration, routeur, fournisseurs, arborescence de navigation
├── components/
│   ├── ui/         primitives : Button, Card, Badge, Field, Sheet, StateView, Table…
│   └── layout/     AppLayout (sidebar + topbar), PageHeader
├── features/       un dossier par écran (auth, dashboard, classes, teachers, …)
├── hooks/          useServices() — accès aux services par contexte
├── services/       ports (interfaces), erreurs, implémentation mock
├── stores/         état d'authentification (Zustand)
├── styles/         jetons de design et styles globaux
├── types/          DTO du backend (api.ts) et modèle métier (domain.ts)
└── utils/          formatage (devises, dates), couleur de marque
```

Trois principes portent le reste — repris tels quels de `student/web`, le
frontend élève du même projet, pour que les deux applications s'ouvrent de
la même façon :

**Les écrans ne connaissent que des interfaces.** `src/services/ports.ts`
décrit ce dont chaque écran a besoin (`ClassesPort`, `TeachersPort`,
`SignaturesPort`…) ; `src/services/index.ts` choisit l'implémentation.
Aucun composant n'appelle `fetch` directement, et aucun composant n'importe
`src/services/mock` : ils reçoivent les services via `useServices()`
(`src/hooks/useServices.ts`), qui les lit d'un contexte React — c'est ce qui
permet aux tests de fournir des doubles sans toucher au module, et à une
future branche `api` de ne changer qu'un seul fichier.

**Les DTO ne remontent jamais jusqu'aux composants.** `src/types/api.ts`
recopie les formes réelles déjà posées côté backend (`ClassResponse` de
class-service, `UserResponse` de user-service, `LeaveRequestResponse` de
schedule-service, `SignatureRecordResponse` de signature-service…) — champs
et enums à l'identique — pour qu'une future branche `api` n'ait qu'à écrire
l'appel HTTP et la traduction, sans redessiner le modèle métier
(`src/types/domain.ts`) ni les écrans.

**Le style passe par des jetons.** `src/styles/tokens.css` définit les
couleurs, espacements et rayons — mêmes noms que `edusenegal-web` et
`student/web` (`--brand-*`, `--color-*`, `--space-*`…), avec les valeurs du
prototype Direction déjà validé (vert `#1D9E75`, sidebar vert foncé). La
couleur de marque (`--brand-primary`) est écrasée à l'exécution par
`applyBranding()` (`src/utils/branding.ts`) depuis `Paramètres` : aucun
composant n'écrit une couleur en dur.

## Les deux branches

| Branche | Source des données | Usage |
| --- | --- | --- |
| `mock` | `src/services/mock/` — données de démonstration en mémoire, un seul lycée | Développement de l'interface, démonstrations, tests — **cette branche** |
| `api` *(à créer)* | `src/api/` — appels HTTP sur l'api-gateway | Intégration réelle |

Les deux branches partagent la totalité de l'interface. Ce qui changerait,
le jour où une branche `api` est créée à partir de celle-ci :

- `src/services/index.ts` — le seul fichier qui importe `createMockServices`
  aujourd'hui ; il importerait `createApiServices` depuis `src/api/` à la
  place.
- `src/api/*.api.ts` — un fichier par port (`classes.api.ts`,
  `teachers.api.ts`…), chacun implémentant l'interface correspondante de
  `src/services/ports.ts` avec de vrais appels `fetch` vers l'api-gateway.
- Rien d'autre : aucun écran, aucun composant, aucun type ne change.

Voir [Préparer la branche `api`](#préparer-la-branche-api) pour le détail
service par service.

## Prérequis

- Node.js ≥ 20.19
- npm

## Installation

```bash
npm install
```

## Lancer en local

```bash
npm run dev
```

L'application s'ouvre sur `http://localhost:5174`. Connexion : n'importe
quelle adresse e-mail, mot de passe d'au moins 4 caractères (branche
`mock` — voir `src/services/mock/index.ts`, méthode `auth.login`).

## Tests

```bash
npm run test          # une passe
npm run test:watch    # mode watch
npm run test:coverage # avec couverture
```

Les tests couvrent en particulier les deux règles de promotion (classe
entière vs élève seul — `src/services/mock/services.test.ts`) et l'écran de
connexion (`src/features/auth/LoginPage.test.tsx`). `src/test/doubles.ts`
fournit un double de `Services` qui échoue bruyamment sur toute méthode non
explicitement fournie par le test, pour qu'un appel de service oublié se
voie tout de suite plutôt que de renvoyer `undefined`.

## Build

```bash
npm run build     # tsc -b && vite build → dist/
npm run lint       # eslint . --max-warnings 0
npm run typecheck  # tsc -b --noEmit
npm run preview    # sert dist/ localement
```

## Build de référence

Avant publication, cette version a été vérifiée avec :

- `npm run lint` et `npm run typecheck` — aucune erreur ;
- `npm run test` — 9/9 tests passés ;
- `npm run build` — build de production sans erreur ;
- un parcours bout en bout dans un vrai navigateur (Playwright) sur
  l'ensemble des écrans : connexion, les 12 routes, fiche de classe (les
  trois onglets, planification d'une échéance avec une vraie date), fiche
  enseignant (ajout/retrait de classe, documents, bulletins de paie),
  promotions, demande de salaire groupée, bascule élève/personnel de la
  signature, et le destinataire en cascade des notes de service — 0 erreur
  console, 0 erreur page.

## Périmètre de cette version

- **Un seul établissement, un seul niveau** : un lycée privé fictif (« Lycée
  Privé Les Flamboyants »), 8 classes de la Seconde à la Terminale, 10
  enseignants, ~80 élèves générés de façon déterministe
  (`src/services/mock/fixtures.ts`). Primaire, collège et université ne
  sont pas couverts.
- **Année scolaire** : la version prototype proposait un assistant en 6
  étapes ; cette version expose un formulaire en une seule page (libellé,
  dates réelles, classes à ouvrir) qui appelle le même port
  (`SchoolPort.openAcademicYear`) — l'assistant à étapes peut être
  reconstruit par-dessus sans toucher au service.
- **Demandes de salaire** : le backend (`payment-service`) n'a pas
  aujourd'hui de DTO dédié « demande de salaire » — seulement une catégorie
  de dépense `SALAIRES` (voir `src/types/api.ts`). Ce module restera mock
  jusqu'à ce que ce DTO existe côté backend, ou sera branché sur l'endpoint
  de dépense le jour venu.
- **Congés — pièce jointe** : le backend porte bien plusieurs URLs de
  documents par demande (`LeaveRequestResponse.documentUrls`). Cette
  version affiche le nom du fichier déclaré ; le téléchargement réel
  arrivera avec la branche `api`, une fois ces URLs résolues en vrais
  fichiers.

## Préparer la branche `api`

Dans l'ordre, pour chaque port de `src/services/ports.ts` :

1. Créer `src/api/<domaine>.api.ts` exportant `create<Domaine>Api(): <Domaine>Port`,
   à l'image de `student/web/src/api/grades.api.ts` — un client HTTP minimal
   (`fetch`, gestion des erreurs via `src/services/errors.ts`), traduisant
   les DTO de `src/types/api.ts` vers `src/types/domain.ts`.
2. Une fois tous les ports couverts, remplacer le contenu de
   `src/services/index.ts` :

   ```ts
   import { createApiServices } from '@/api';
   export const services: Services = createApiServices();
   export const SERVICES_MODE = 'api' as const;
   ```

3. Renseigner `VITE_API_BASE_URL` (voir `.env.example`) et vérifier le
   proxy `/api` de `vite.config.ts` en développement.

Aucun écran, aucun composant, aucun test de composant n'a besoin de changer
— seuls les tests qui testent `src/services/mock/` directement
deviendraient spécifiques à la branche `mock`.
