# Checklist — Architecture logicielle

Tu es un principal engineer qui audite l'architecture de PushUpHero. Tu ne cherches pas des bugs — tu cherches des defauts de design qui rendront le projet inmaintenable.

Commence par lire `CLAUDE.md` a la racine pour comprendre l'architecture documentee.

## 1. Dependency graph et layer violations

### Layers attendues (de l'exterieur vers l'interieur)
```
UI (screens, modals, components)
  → Application (hooks d'orchestration, contexts, state machines)
    → Domain (regles metier pures : XP, scoring, grading, achievements, workout logic)
      → Infrastructure (Firebase, MediaPipe, localStorage, browser APIs)
```

**La regle** : les dependances ne pointent que vers l'interieur. Le domain ne connait PAS React. Le domain ne connait PAS Firebase. L'UI ne connait PAS Firestore.

### Ce que tu cherches
- **Trace le graph reel** : pour chaque dossier de `src/`, liste ses imports et determine a quelle layer il appartient
- **Identifie chaque fleche inversee** : un fichier domain qui importe React, un composant qui importe Firebase, etc.
- **Mesure le couplage** : combien de fichiers importent directement `firebase.ts` ou les packages Firebase ?
- Grep `from ['"]firebase/` dans tout `src/` et classe chaque import par layer
- Grep `from ['"]react['"]` dans `src/lib/` et `src/exercises/` (ne devrait PAS exister)

**Ou chercher:** Tout `src/`, en partant de l'index des imports de chaque fichier

## 2. Module boundaries et encapsulation

### Ce que tu cherches
- **Barrel exports** : chaque dossier module a-t-il un point d'entree clair (`index.ts`) ou tout le monde importe des fichiers internes ?
- **API de surface** : les modules exposent-ils un contrat minimal ou exportent-ils tout ?
- **Leaky abstractions** : un module expose-t-il des details d'implementation (types Firestore, structures MediaPipe) dans son interface publique ?
- **Circular dependencies** : y a-t-il des imports circulaires entre modules ?

### Questions de design
- Si tu remplaces Firebase par Supabase, combien de fichiers touches-tu ?
- Si tu ajoutes un exercice (ex: `dips`), combien de fichiers hors de `src/exercises/` touches-tu ?
- Si tu changes le systeme de scoring, combien de fichiers touches-tu ?

## 3. Domain modeling

### Ce que tu cherches
- **Le domain est-il explicite ?** Existe-t-il un dossier/module clairement identifie comme "domain" avec des regles metier pures ?
- **Value objects** : les concepts metier (Grade, XP, Level, Rep, Set, ExerciseType) sont-ils modelises par des types riches ou ce sont juste des `number` et `string` ?
- **Business rules** : ou vivent les regles ?
  - Calcul d'XP → dans quel fichier ? Est-ce pur ?
  - Scoring / grading → dans quel fichier ? Est-ce pur ?
  - Achievement eligibility → dans quel fichier ? Est-ce pur ?
  - Workout plan validation → dans quel fichier ? Est-ce pur ?
- **Testabilite** : peux-tu instancier et tester une regle metier avec un simple `assert` sans setup React/Firebase ?

**Ou chercher:** `src/lib/` (c'est probablement la que le domain est, melange avec l'infra)

## 4. SOLID violations

### Single Responsibility (SRP)
- Fichiers qui font plus d'une chose (fetch + transform + render, auth + persistence + UI)
- Hooks qui sont des "god objects" (> 5 responsabilites)
- Le fichier `AuthProvider.tsx` gere-t-il uniquement l'auth ou fait-il plus ?

### Open-Closed (OCP)
- Ajouter un exercice necessite-t-il de modifier du code existant ou juste d'ajouter ?
- Ajouter un achievement necessite-t-il de toucher au moteur ou juste aux definitions ?
- Le registry pattern est-il bien applique ?

### Liskov Substitution (LSP)
- Les exercise detectors sont-ils interchangeables via leur interface commune ?
- `BaseExerciseDetector` impose-t-il un contrat que les sous-classes respectent reellement ?

### Interface Segregation (ISP)
- Les contexts React exposent-ils des interfaces trop larges ?
- Les hooks retournent-ils trop de choses (l'appelant n'utilise que 2 valeurs sur 10) ?

### Dependency Inversion (DIP)
- Le code metier depend-il d'abstractions ou d'implementations concretes ?
- Les services Firebase sont-ils derriere des interfaces (au moins des types) ou le code depend de l'implementation directe ?
- Le systeme de detection depend-il de MediaPipe directement ou d'une abstraction de pose data ?

## 5. Patterns et anti-patterns

### Patterns attendus
- **Strategy** : les exercise detectors utilisent-ils un vrai pattern strategy ?
- **Registry** : `registry.ts` est-il un bon registry ou un simple objet de config ?
- **State machine** : le workout state machine est-il modelise proprement (etats explicites, transitions valides) ?
- **Observer** : les subscriptions Firestore/auth utilisent-elles un pattern clean ?

### Anti-patterns a detecter
- **God component** : un composant/hook qui orchestre tout
- **Shotgun surgery** : un changement metier necessite de toucher 5+ fichiers dans 3+ dossiers
- **Feature envy** : un module qui manipule plus les donnees d'un autre module que les siennes
- **Primitive obsession** : des `number`, `string`, `boolean` partout au lieu de types metier
- **Anemic domain** : les "modeles" ne sont que des types/interfaces sans comportement, la logique est dans les hooks

## 6. Organisation des fichiers vs architecture

### Ce que tu cherches
- L'arborescence `src/` reflete-t-elle l'architecture ou la techno ?
  - **Mauvais** : `components/`, `hooks/`, `lib/`, `utils/` (organise par type technique)
  - **Bon** : `domain/`, `features/`, `infra/`, `ui/` (organise par responsabilite architecturale)
- Les fichiers qui changent ensemble sont-ils proches ? (principe de cohesion)
- Un nouveau dev peut-il comprendre ce que fait l'app en lisant la structure de `src/` ?

### Questions
- `src/lib/` contient quoi exactement ? Est-ce coherent ou c'est un fourre-tout ?
- `src/hooks/` est-il organise par feature ou c'est un sac de hooks ?
- `src/exercises/` a-t-il des boundaries claires avec le reste ?

## 7. Scalabilite architecturale

- **+10 exercices** : l'architecture le supporte-t-elle sans modification structurelle ?
- **+50 achievements** : le moteur scale-t-il ou faudra tout revoir ?
- **Mode multijoueur** : l'architecture le permet-elle ou tout est couple au single-user ?
- **Changement de backend** (Firebase → Supabase) : quel est le blast radius ?
- **Tests unitaires** : si tu voulais couvrir le domain a 90%, est-ce possible aujourd'hui ?

## Criteres de severity

- **CRITICAL** : Violation de la dependency rule qui rend le domain untestable, ou anti-pattern structurel qui bloque l'evolution
- **HIGH** : Module boundary floue qui cause du shotgun surgery, domain logic dispersee
- **MEDIUM** : SOLID violation qui complique la maintenance sans bloquer
- **LOW** : Organisation de fichiers ameliorable, naming qui ne reflete pas la responsabilite
