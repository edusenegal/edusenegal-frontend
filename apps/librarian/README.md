# EduSénégal — Espace enseignant (web)

Application web complète pour les professeurs et instituteurs : emploi du
temps, appel, saisie des notes, réclamations de notes, résultats &
bulletins, devoirs/examens, cours & ressources, quiz IA, congés, fiche de
paie, documents personnels, messagerie, notifications et réclamations.

Un seul fichier, `src/services/index.ts`, assemble l'implémentation des
services — c'est le seul qui change d'une branche à l'autre (voir "Les
deux branches" ci-dessous) :
- branche `api` : implémentations HTTP réelles (`src/api/`), sur
  l'api-gateway — même convention que `apps/comptable` ;
- branche `mock-api` (celle-ci) : implémentations de démonstration en
  mémoire (`src/services/mock/`), sans aucun appel réseau — pour tester
  tout le flux de l'application sans backend réel.

## Sommaire

- [Les deux branches](#les-deux-branches)
- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Lancer en local](#lancer-en-local)
- [Tests](#tests)
- [Build](#build)
- [Rôles](#rôles)
- [Couverture backend](#couverture-backend)
- [Limites connues](#limites-connues)

## Les deux branches

| | `api` | `mock-api` |
|---|---|---|
| Données | Backend réel (api-gateway + microservices) | En mémoire, amorcées depuis `services/mock/fixtures.ts` |
| Appels réseau | Oui (`src/api/*.api.ts`, client Axios) | Aucun |
| Session | Jetons JWT, restauration/rafraîchissement silencieux (`AuthProvider`) | Pas de jeton ; `AuthProvider` fait simplement sortir l'état `idle` vers `anonymous` — une page rechargée revient à l'écran de connexion |
| Compte de connexion | Un compte `TEACHER`/`INSTITUTEUR` réel de l'établissement | N'importe quel identifiant non vide + mot de passe ≥ 4 caractères (voir `services/mock/index.ts#login`) |
| Écrans | Identiques | Identiques |

Les écrans, composants et types ne changent jamais d'une branche à
l'autre — seuls `src/services/index.ts` et `src/features/auth/AuthProvider.tsx`
diffèrent (ce dernier parce que la restauration de session par jeton n'a
pas de sens sans backend). `src/services/mock/` reproduit fidèlement les
mêmes formes de données que `src/api/` (y compris certaines bizarreries du
contrat réel, comme `deposePar`/`remplacant` qui sont des identifiants et
non des noms), afin que tester sur `mock-api` ressemble vraiment à tester
sur `api`.

Pour rebrancher les vraies API depuis cette branche : dans
`src/services/index.ts`, remplacer `createMockServices()` par
`createApiServices()` (import depuis `@/api`), et restaurer
`AuthProvider.tsx` depuis la branche `api` (restauration/rafraîchissement
par jeton).

## Architecture

```
src/
├── app/            configuration, routeur, fournisseurs, arborescence de navigation
├── components/
│   ├── ui/         primitives : Button, Card, Badge, Field, Sheet, StateView, Table…
│   ├── layout/     AppLayout (sidebar + topbar), PageHeader
│   └── documents/  CourseDocumentsSection / PersonalDocumentsSection (réutilisés tels quels)
├── features/       un dossier par écran (auth, dashboard, my-classes, grades, …)
├── hooks/          useServices() — accès aux services par contexte
├── services/       ports (interfaces) + assemblage ; mock/ (branche mock-api) : implémentations en mémoire + données de démonstration
├── api/            implémentation HTTP de chaque port, + client Axios (client.ts) — branche api, inutilisé sur mock-api
├── stores/         état d'authentification (Zustand)
├── styles/         jetons de design et styles globaux
├── types/          DTO du backend (api.ts) et modèle métier (domain.ts)
└── utils/          formatage (devises, dates), couleur de marque
```

Chaque écran ne connaît que les interfaces de `services/ports.ts` — jamais
`api/*.api.ts` directement — pour qu'un test puisse injecter des doubles
(`test/doubles.ts`) sans toucher au reste de l'application.

Le responsive (sidebar en tiroir sous 1024px, topbar avec hamburger,
padding réduit sous 480px) vient de `components/layout/AppLayout` —
identique à `apps/director`/`apps/comptable`, aucun code spécifique à cette
application.

## Prérequis

- Node.js ≥ 20.19
- Le backend EduSénégal (api-gateway + microservices) démarré localement,
  ou une URL d'API accessible (voir `.env.development`).

## Installation

```bash
npm install
```

## Lancer en local

```bash
npm run dev
```

Par défaut sur `http://localhost:5176` (ports 5174/5175 déjà pris par
`apps/director`/`apps/comptable`). Le proxy Vite relaie `/api` vers
`VITE_PROXY_TARGET` (`.env.development`, `http://localhost:8000` par
défaut) — ajustez-le si votre api-gateway écoute ailleurs.

Sur la branche `api` : connectez-vous avec un compte dont le rôle est
`TEACHER` ou `INSTITUTEUR` ; tout autre rôle est refusé explicitement à la
connexion (voir `api/auth.api.ts#fetchTeacherProfile`).

Sur la branche `mock-api` : n'importe quel identifiant non vide et un mot
de passe d'au moins 4 caractères suffisent — vous êtes toujours connecté
en tant que Moussa Ndiaye (`services/mock/fixtures.ts#TEACHER`).

## Tests

```bash
npm run test
npm run typecheck
npm run lint
```

Sur `mock-api`, `src/services/mock/services.test.ts` exerce chaque port
(connexion, saisie de notes en masse, décision sur une réclamation, appel,
congé, réclamation, messagerie, notifications) directement contre
`createMockServices()`, en plus des tests d'écran existants.

## Build

```bash
npm run build
```

## Rôles

`TEACHER` (professeur, secondaire/université) et `INSTITUTEUR` (maître du
primaire, une classe unique, toutes matières) partagent cette application —
le backend les traite de façon identique sur l'ensemble des routes
pédagogiques (voir les commentaires `F-USR-14` côté backend).

## Couverture backend

Tous les ports sont réels dès la première version :

| Port | Backend |
|---|---|
| `auth` | `user-service` (login/refresh/changement de mot de passe) |
| `school` | `school-service` (lecture seule) |
| `subjects` | `subject-service` (matières du professeur connecté) |
| `myClasses` | `class-service` + `user-service` (classes et roster) |
| `timetable` | `schedule-service` (emploi du temps) |
| `grades` | `academic-service` (saisie, saisie en masse, modification, lecture classe) |
| `gradeDisputes` | `academic-service` (décision niveau 1) |
| `results` | `academic-service` (moyennes semestrielles, PDF du bulletin) |
| `attendance` | `attendance-service` (appel, feuille déjà saisie) |
| `courseDocuments` | `document-service` (cours/exercices/corrigés/sujets) |
| `personalDocuments` | `document-service` (CNI, diplôme, certification) |
| `exams` | `schedule-service` (devoirs/examens planifiés) |
| `leaves` | `schedule-service` (congés) |
| `payslips` | `payment-service` (lecture seule, `/payslips/me`) |
| `quiz` | `ai-service` (génération, publication) |
| `messaging` | `messaging-service` (groupes, messages) |
| `notifications` | `notification-service` |
| `complaints` | `complaint-service` |

## Limites connues

- **Roster d'une classe sans route "bulk"** : `GET /users/class/{classId}/students`
  (user-service) ne renvoie que des ids ; chaque nom est résolu par un appel
  séparé à `GET /users/{id}` (voir `api/myClasses.api.ts`). Acceptable pour
  des classes de taille courante ; une route dédiée côté backend éviterait
  le N+1 pour de très gros effectifs.
- **Pas d'agrégat "tableau de bord enseignant"** côté backend (contrairement
  à `DashboardPort` chez `apps/director`, task #236) — le tableau de bord
  est composé ici depuis les ports déjà réels (classes, examens à venir,
  réclamations, notifications).
- **`POST /academic/bulletins/student/{id}/semester/{sem}`** (génération de
  bulletin) a son `@PreAuthorize` commenté côté backend — ouvert à tout
  utilisateur authentifié, pas seulement à la direction. Cette application
  n'expose volontairement **que le téléchargement** du bulletin déjà généré
  (`GET .../pdf`, correctement protégé), jamais la génération elle-même —
  qui reste un acte de direction (`apps/director`).
- **`GET /academic/results/class/{classId}/semester/{semester}`** (liste des
  résultats de toute une classe en un appel) est réservé à `DIRECTOR`/
  `SUPERVISOR` côté backend. Cette application consulte donc les résultats
  **élève par élève** (`GET /results/student/{studentId}/semester/{semester}`,
  ouvert à l'enseignant), depuis l'écran "Résultats & bulletins".
