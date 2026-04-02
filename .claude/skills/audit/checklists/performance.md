# Checklist — Performance

Tu audites la performance avec un regard d'architecte. Le probleme n'est pas "ce composant est lent" mais "l'architecture cause-t-elle des problemes de performance structurels ?"

## Contexte specifique PushUpHero

L'app a un **hot path critique** : le pipeline de pose detection qui tourne a 30fps pendant le workout. Tout ce qui bloque le main thread pendant ce pipeline degrade l'UX.

```
Camera (30fps) → MediaPipe WASM → Landmarks → Detector → State update → UI render
```

## Ce que tu cherches

### 1. Main thread contention
- Travail lourd sur le main thread pendant le workout (calculs, DOM, serialization)
- Le worker (`poseOverlay.worker.ts`) est-il utilise pour tout ce qui est lourd ?
- Y a-t-il des calculs synchrones dans le pipeline qui devraient etre dans le worker ?
- `requestAnimationFrame` gestion — frame drops possibles ?

**Ou chercher:** `src/hooks/usePoseDetection.ts`, `src/hooks/useCamera.ts`, `src/workers/`, `src/exercises/`

### 2. Re-renders architecturaux
- Contexts trop larges → un changement de state re-render tous les consumers
- `AuthProvider` / `WorkoutContext` : quel est le blast radius d'un state update ?
- Objets/arrays recrees a chaque render qui causent des re-renders en cascade
- Composants dans l'arbre du workout qui re-render a chaque frame de detection

**Methode:** Trace l'arbre des contexts et identifie les composants qui souscrivent a des contexts trop larges

### 3. Memory leaks
- Subscriptions Firestore (`onSnapshot`) : cleanup dans le `useEffect` return ?
- Event listeners : added dans effect, removed dans cleanup ?
- Timers (`setInterval`, `setTimeout`) : cleared dans cleanup ?
- References a des elements DOM ou des callbacks apres unmount ?
- MediaPipe / camera stream : release propre ?

**Methode:** Grep `onSnapshot`, `addEventListener`, `setInterval`, `setTimeout` et verifie chaque cleanup

### 4. Firebase performance
- Queries sans `limit()` qui pourraient ramener beaucoup de documents
- Listeners actifs quand l'utilisateur n'est pas sur l'ecran concerne
- Writes sequentiels qui devraient etre batches (`writeBatch`)
- Absence de cache/offline persistence strategy

### 5. Bundle et loading
- Imports non-tree-shakeable (package entier au lieu de sub-path)
- Code qui pourrait etre lazy-loaded (modals, screens non-initiales)
- MediaPipe WASM : strategie de chargement ? (blocking ou async ?)

### 6. State management inefficace
- State global (context) pour du state local
- State derive recalcule a chaque render au lieu de `useMemo`
- Trop d'updates de state en cascade (state A → effect → state B → effect → state C)
- Pattern "update state then read from state in next render" au lieu de "compute and use directly"

## Criteres de severity

- **CRITICAL** : Memory leak (subscription/listener non-cleanup) ou main thread bloque pendant le hot path (pose detection)
- **HIGH** : Context trop large qui cause des re-renders sur tout l'arbre pendant le workout
- **MEDIUM** : Optimisation manquante sur du code non-critique, Firebase queries non-optimisees
- **LOW** : Bundle size ameliorable, lazy loading possible sur des chemins non-critiques
