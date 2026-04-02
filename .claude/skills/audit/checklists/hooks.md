# Checklist — Hooks React

Tu audites les hooks avec un regard d'architecte. Les hooks sont l'**application layer** — ils orchestrent, ils ne calculent pas.

## Le role d'un hook bien designe

Un hook devrait faire UNE de ces choses :
- **Orchestrer** : connecter un service infra a du state React (ex: `useAuth` ecoute Firebase Auth et expose le user)
- **Composer** : combiner 2-3 hooks plus petits en un workflow (ex: `useWorkoutSession` compose state + persistence)
- **Adapter** : transformer une API imperative en API reactive React (ex: `useCamera` wrappe getUserMedia)

Un hook ne devrait PAS :
- Contenir des regles metier (calculs d'XP, scoring, grading)
- Faire des appels Firebase ET des transformations metier ET du state management
- Etre le SEUL endroit ou une regle metier existe

## Ce que tu cherches

### 1. God hooks
- Hooks > 100 lignes → suspect. > 200 lignes → quasi-certain qu'il fait trop
- Hooks avec > 3 `useEffect` → signale un melange de responsabilites
- Hooks qui retournent > 5 valeurs → l'interface est trop large (ISP violation)
- Compte les lignes de chaque hook dans `src/hooks/` et `src/app/`

### 2. Logique metier emprisonnee dans React
- Calculs d'XP, scoring, grading, eligibilite dans un hook
- Conditions de gameplay (quand passer en rest, quand level up) dans un hook
- Transformations de donnees complexes (aggregations, moyennes, classements) dans un hook
- **Test mental** : cette logique peut-elle etre testee avec un simple `assert(fn(input) === expected)` sans React ?

### 3. Hooks qui sont des services deguises
- Hooks qui appellent Firebase directement (Firestore queries, auth methods)
- Hooks qui font du CRUD sans deleguer a un service layer
- `onSnapshot` directement dans un hook au lieu d'un service qui expose un observable

**Methode:** Grep `from ['"]firebase` et `from.*refs` dans `src/hooks/`

### 4. Stale closures et ref patterns
- `useEffect` avec des deps manquantes ou trop larges
- Pattern `useRef` + sync `useEffect` — est-il utilise correctement et systematiquement ?
- Callbacks passes a des detectors/workers qui capturent du stale state
- Race conditions entre effects asynchrones

### 5. Cohesion et organisation
- `src/hooks/` est-il un sac de hooks ou y a-t-il une organisation par feature/domain ?
- Hooks utilitaires vs hooks domain vs hooks infra — la distinction est-elle claire ?
- Hooks dans `src/hooks/` vs hooks dans `src/app/` — quelle est la regle ?
- Y a-t-il des hooks qui devraient etre co-localises avec leur feature ?

### 6. Composabilite
- Des hooks qui pourraient etre composes de hooks plus petits mais qui sont monolithiques
- Des patterns repetes entre hooks qui devraient etre extraits (ex: pattern "fetch + cache + loading state")
- Des hooks trop couples a un composant specifique (pas reutilisables)

## Criteres de severity

- **CRITICAL** : Regle metier core qui n'existe QUE dans un hook (untestable sans React) — violation dependency rule
- **HIGH** : God hook (> 200 lignes, 4+ responsabilites) ou hook qui fait du Firebase direct sans service
- **MEDIUM** : Hook qui mixe orchestration et calcul metier mais pourrait etre splitte
- **LOW** : Naming imprecis, organisation perfectible, hook qui pourrait etre split
