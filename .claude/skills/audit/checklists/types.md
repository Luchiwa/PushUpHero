# Checklist — Type safety

Tu audites le typage comme un outil d'architecture. Les types ne sont pas de la documentation — ils sont les **contrats entre modules**. Un type faible = une boundary qui fuit.

## Ce que tu cherches

### 1. Domain types — le coeur
- Les concepts metier sont-ils modelises par des types riches ou c'est du `string` et `number` partout ?
  - `ExerciseType` : union type ou string libre ?
  - `Grade` : type precis ou `string` ?
  - `XP`, `Level` : branded types ou `number` nu ?
  - `Rep`, `Set`, `Duration` : types semantiques ou primitives ?
- Y a-t-il un fichier central de domain types ou les types sont disperses ?
- Les types domain dependent-ils de React ou Firebase ? (violation de layer)

**Ou chercher:** `src/exercises/types.ts`, `src/lib/`, tous les fichiers qui definissent des `type` ou `interface`

### 2. Contract types entre modules
- Les services (`userService`, `authService`, etc.) ont-ils des types d'entree/sortie clairs ?
- Les hooks ont-ils des return types explicites ou c'est de l'inference ?
- Les props de composants sont-ils types avec des interfaces nommees ou inline ?
- Les types des services leakent-ils des types Firebase (`Timestamp`, `DocumentReference`) ?

### 3. `any` explicites et implicites
- Grep `: any`, `as any`, `<any>` dans tout le code
- Fonctions exportees sans type de retour explicite
- Event handlers avec `e: any` au lieu du bon event type
- Callbacks non-types dans les hooks et composants

**Methode:** Grep `any` dans `*.ts` et `*.tsx`, classe par criticite (domain vs UI)

### 4. Assertions dangereuses
- `as` casts qui pourraient etre faux a runtime (surtout sur les donnees Firestore)
- Non-null assertions (`!`) sur des valeurs potentiellement null
- `as unknown as X` — double cast = red flag
- Type guards custom : sont-ils corrects et exhaustifs ?

### 5. Firestore types
- Les documents Firestore ont-ils des types/interfaces dedies ?
- La serialization/deserialization est-elle typee (Timestamp → Date, etc.) ?
- Les queries retournent-elles des types precis ou `any` / `DocumentData` ?

### 6. Coherence et DRY
- Meme concept type differemment dans differents fichiers
- Types dupliques au lieu d'etre partages via un module de types
- Union types repetes au lieu d'etre definis une fois (`'pushup' | 'squat' | 'pullup'` repete partout ?)

### 7. Error types
- `catch(e)` : l'erreur est-elle typee ou `unknown` ?
- Promises sans `.catch()` (fire-and-forget non-gere)
- Les services retournent-ils des Result types ou lancent-ils des exceptions ?
- La gestion d'erreur est-elle structuree ou ad-hoc ?

## Criteres de severity

- **CRITICAL** : `as any` qui masque un type mismatch sur des donnees Firestore (runtime crash potentiel)
- **HIGH** : Types domain qui dependent de Firebase types (layer violation), absence de types pour les documents Firestore
- **MEDIUM** : `any` explicites qui pourraient etre types, non-null assertions risquees
- **LOW** : Types de retour implicites, types qui pourraient etre plus precis, DRY violations mineures
