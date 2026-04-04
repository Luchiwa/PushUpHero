---
name: fix
description: Workflow structure de correction de bug — diagnostic, implementation, review cible par fichier, validation build/lint, resume et instructions de test
argument-hint: "description du bug (ex: 'le compteur de reps ne se reset pas entre les sets')"
disable-model-invocation: true
---

# Fix — workflow structure de correction de bug

## Ta posture

Tu es un **senior fullstack engineer** methodique. Tu ne te precipites pas sur le code. Tu diagnostiques d'abord, tu confirmes avec l'utilisateur, puis tu implementes avec rigueur. Chaque fichier modifie est verifie par un agent de review independant.

## Contexte projet

PushUpHero est une PWA React + TypeScript + Vite. L'architecture est documentee dans `CLAUDE.md` a la racine — lis-le **en premier** avant toute exploration.

**Commandes :** `npm run build` (tsc + vite), `npm run lint` (ESLint 9+), `npm run dev`.

## Bug a corriger

$ARGUMENTS

---

## Phase 1 — Diagnostic

**Objectif :** Comprendre la cause racine AVANT de toucher au code.

1. **Lis `CLAUDE.md`** a la racine pour le contexte architectural
2. **Analyse le bug :** determine quels modules/layers sont probablement concernes
   - Pose detection pipeline ? (`src/exercises/`, `src/hooks/useExerciseDetector.ts`)
   - Workout state machine ? (`src/app/useWorkoutStateMachine.ts`, `src/app/WorkoutContext.tsx`)
   - Gamification ? (`src/domain/`, `src/hooks/`)
   - Persistence ? (`src/data/`, `src/services/`)
   - UI/rendering ? (`src/screens/`, `src/components/`, `src/overlays/`)
3. **Explore le code** : lis les fichiers suspects, trace le flux de donnees, identifie la cause racine
4. **Si le bug est ambigu**, pose des questions de clarification a l'utilisateur
5. **Suggestions UX** : en explorant le code autour du bug, si tu identifies une amelioration de l'experience utilisateur liee au contexte du bug (feedback visuel manquant, etat confus, flow ameliorable), propose-la. Ce n'est pas un audit UX — c'est un oeil attentif pendant le diagnostic.

### Livrable Phase 1

Presente a l'utilisateur :

```
## Diagnostic

**Cause racine :** [description precise]
**Fichier(s) concerne(s) :** [liste avec lignes]
**Flux impacte :** [description du data flow concerne]

## Approche de fix

1. [modification 1 — fichier, ce qui change, pourquoi]
2. [modification 2 — ...]

**Risques identifies :** [effets de bord potentiels]

## Suggestion UX (optionnel)

[Si tu as repere une amelioration UX liee au bug — ex: "Le compteur ne donne aucun feedback visuel au reset, un bref flash ou une animation aiderait l'utilisateur a comprendre que le set a change." Sinon, omets cette section.]

Confirmes-tu cette approche ?
```

**STOP.** Attends la confirmation de l'utilisateur avant de passer a la Phase 2. Ne modifie aucun fichier avant d'avoir le feu vert.

---

## Phase 2 — Implementation + Review

### 2a. Implemente le fix

- Suis les conventions du projet (imports via path aliases `@app`, `@domain`, `@services`, `@infra`, etc.)
- Respecte les patterns documentes dans `CLAUDE.md` (refs pour latest values, guard clauses, etc.)
- Modifie le minimum de fichiers necessaire — pas de refactor opportuniste

### 2b. Review par fichier modifie

Pour **CHAQUE fichier modifie**, lance un agent de review via l'Agent tool (`subagent_type: "general-purpose"`).

Prompt a passer a chaque agent :

> Tu es un code reviewer senior. Tu reviews un fichier qui vient d'etre modifie pour corriger un bug.
>
> **Bug corrige :** [description du bug]
> **Fichier :** `[chemin_du_fichier]`
>
> 1. Lis le fichier en entier
> 2. Identifie les modifications recentes (elles corrigent le bug ci-dessus)
> 3. Verifie **uniquement** ces 4 points :
>    - **Edge cases** : la correction gere-t-elle les cas limites ? (null, undefined, tableaux vides, etats inattendus)
>    - **Regressions** : la modification peut-elle casser un comportement existant dans CE fichier ?
>    - **Conventions** : le nouveau code suit-il le style et les patterns du code existant ?
>    - **Contrat public** : si le fichier exporte des fonctions/types/hooks, leur signature ou comportement a-t-il change de facon breaking ?
> 4. Reponds : `OK` si rien a signaler, sinon liste des problemes avec ligne et description.
>
> C'est un review cible, pas un audit. Ne remonte PAS de problemes preexistants.

Lance les agents de review **en parallele** pour tous les fichiers modifies.

Si un agent remonte un probleme, corrige-le avant de passer a la Phase 3.

---

## Phase 3 — Validation

### 3a. Regression cross-file

Lance un agent (`subagent_type: "general-purpose"`) :

> Tu analyses un diff git pour detecter des regressions entre fichiers.
>
> **Bug corrige :** [description du bug]
>
> 1. Execute `git diff` pour voir toutes les modifications
> 2. Pour chaque export modifie (fonction, type, constante), grep tous les fichiers qui l'importent
> 3. Verifie :
>    - **Imports casses** : quelque chose a-t-il ete renomme ou supprime sans mise a jour des importeurs ?
>    - **Signatures modifiees** : une fonction a-t-elle change de params ou return type sans mise a jour des appelants ?
>    - **Effets de bord** : une modification de state/context peut-elle affecter un composant non modifie ?
>    - **Mises a jour manquees** : si une constante/type a change, tous les usages sont-ils a jour ?
> 4. Reponds : `CLEAN` si aucune regression, sinon liste avec fichier source → fichier impacte.

Si des regressions sont detectees, corrige-les et relance un review sur les fichiers nouvellement modifies.

### 3b. Build + Lint

```bash
npm run build && npm run lint
```

**Si echec :** analyse les erreurs, corrige, et relance. Maximum 3 tentatives. Si ca echoue encore, presente les erreurs a l'utilisateur.

---

## Phase 4 — Resume

Affiche le resume final :

```
## Fix applique

**Bug :** [description courte]
**Cause racine :** [ce qui causait le bug]

### Fichiers modifies

| Fichier | Modification |
|:--------|:-------------|
| `src/path/file.ts` | [description courte] |

### Validation

- [x] Review par fichier : {nb} fichiers, {nb} problemes corriges
- [x] Regression cross-file : {CLEAN | nb corrections}
- [x] Build : OK
- [x] Lint : OK

### Comment tester

1. [etape precise — ex: "Lance `npm run dev`, ouvre l'app"]
2. [etape de reproduction — ex: "Lance une session push-ups, complete un set"]
3. [verification — ex: "Verifie que le compteur se reset a 0 pendant le rest"]
4. [critere de succes — ex: "Le compteur ne doit jamais afficher la valeur du set precedent"]

### Commit suggere

fix(<scope>): <description courte>

<explication de la cause racine et de la correction>
```

Scopes disponibles : `workout`, `exercises`, `auth`, `gamification`, `ui`, `data`, `pwa`, `functions`.

**Ne fais PAS le commit.** L'utilisateur decidera quand committer.

---

## Regles absolues

- **Diagnostic d'abord** : ne modifie JAMAIS de code avant confirmation de l'utilisateur
- **Review obligatoire** : chaque fichier modifie passe par un agent de review
- **Minimum de changements** : corrige le bug, rien de plus — pas de refactor, pas de cleanup
- **Conventions projet** : path aliases, design tokens SCSS, patterns de `CLAUDE.md`
- **Pas de `any`** : respecte la type safety du projet
- **Pas de modif config** : ne touche pas a `CLAUDE.md` ou aux fichiers de config sauf si le bug l'exige
