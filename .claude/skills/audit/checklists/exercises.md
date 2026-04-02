# Checklist — Systeme d'exercices

Tu audites le systeme de detection d'exercices comme un sous-systeme architectural a part entiere. C'est le coeur metier de l'app.

## Le modele cible

```
ExerciseRegistry (config centralisee)
  → ExerciseDetector interface (contrat commun)
    → PushUpDetector, SquatDetector, PullUpDetector (implementations strategy)
      → BaseExerciseDetector (logique partagee : calibration, bounding box, scoring)
```

Le systeme doit etre **open for extension, closed for modification** : ajouter un exercice = ajouter 1 fichier detector + 1 entree dans le registry. Rien d'autre.

## Ce que tu cherches

### 1. Duplication entre detectors
- Compare `PushUpDetector`, `SquatDetector`, `PullUpDetector` ligne par ligne
- Code copie-colle entre eux (phase detection, scoring, validation, transitions)
- Logique qui devrait etre dans `BaseExerciseDetector` mais est dupliquee dans chaque detector
- Meme pattern de code avec des valeurs differentes → candidat pour extraction dans la base class

**Ou chercher:** `src/exercises/pushup/`, `src/exercises/squat/`, `src/exercises/pullup/`

### 2. BaseExerciseDetector — qualite de l'abstraction
- Le contrat (methodes abstraites) est-il clair et minimal ?
- Y a-t-il trop de logique dans la base class (god class) ou pas assez (sous-classes trop lourdes) ?
- Les sous-classes respectent-elles le contrat LSP ? (sont-elles interchangeables ?)
- La calibration, le bounding box lock, le scoring de base sont-ils bien dans la base ?

### 3. Open-Closed principle
- Ajouter un nouvel exercice (ex: `dips`) : combien de fichiers faut-il creer/modifier ?
- Le registry est-il le seul point d'enregistrement ?
- Y a-t-il de la config d'exercice eparpillee dans :
  - Les hooks (`useExerciseDetector`, `usePoseDetection`)
  - Les composants (`PositionGuide`, `PoseOverlay`)
  - Le worker (`poseOverlay.worker.ts`)
  - Les constantes (`constants.ts`)
  - Le systeme d'XP/scoring

**Methode:** Grep les exercise types (`pushup`, `squat`, `pullup`) dans tout `src/` hors `src/exercises/` — chaque occurrence est un point de modification potentiel

### 4. Couplage avec le pipeline
- Les detectors dependent-ils directement des structures MediaPipe ou d'une abstraction ?
- Le format des landmarks est-il type proprement ?
- Le worker duplique-t-il de la config qui est dans le registry ? (key joints, etc.)
- Le pipeline camera → pose → detector est-il clean ou les boundaries sont floues ?

### 5. Domain richness
- Les concepts metier (Rep, Phase, Grade, FormQuality) sont-ils modelises par des types riches ?
- Ou sont-ils de simples `number` et `string` ? (primitive obsession)
- Le scoring est-il une responsabilite du detector ou est-il externe ? Coherence ?

### 6. Calibration et body profile
- La calibration est-elle une phase bien isolee avec son propre state ?
- `setBodyProfile()` lifecycle est-il propre (quand set, quand reset) ?
- Le bounding box lock est-il testable independamment ?

## Criteres de severity

- **CRITICAL** : Logique de detection dupliquee ET divergente entre detectors (bug source)
- **HIGH** : Ajouter un exercice necessite de modifier > 3 fichiers hors de `src/exercises/`
- **MEDIUM** : Config d'exercice non centralisee dans le registry, abstraction base class floue
- **LOW** : Optimisations de detection possibles, naming ameliorable
