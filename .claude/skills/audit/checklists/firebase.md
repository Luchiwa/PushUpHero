# Checklist — Couplage Firebase

Tu audites le couplage entre le code applicatif et Firebase. La question n'est pas "est-ce que Firebase marche ?" mais "si je remplace Firebase par Supabase demain, quel est le blast radius ?"

## Le modele cible

```
UI / Hooks → Service interfaces (types) → Service implementations (Firebase)
```

L'infra Firebase doit etre **contenue** dans `src/lib/` (ou un futur `src/infra/`). Aucun autre module ne devrait savoir que Firebase existe.

## Ce que tu cherches

### 1. Imports Firebase hors de l'infra layer
- Tout import de `firebase/firestore`, `firebase/auth`, `firebase/storage`, `firebase/messaging` en dehors de `src/lib/`
- Composants ou hooks qui importent directement ces packages

**Methode:** Grep `from ['"]firebase/` dans tout `src/` et classe chaque occurrence par dossier

### 2. Primitives Firebase qui fuient dans l'API publique
- Types `Timestamp`, `DocumentReference`, `DocumentSnapshot` dans les signatures de fonctions hors services
- `serverTimestamp()` appele en dehors du service layer
- `FieldValue` utilise dans les hooks ou composants
- Les hooks retournent-ils des types Firebase ou des types domain ?

### 3. Operations Firestore hors services
- `doc()`, `collection()`, `getDoc()`, `setDoc()`, `updateDoc()`, `deleteDoc()` en dehors de `src/lib/`
- `query()`, `where()`, `orderBy()`, `limit()`, `onSnapshot()` dans les hooks
- Refs Firestore construites a la main au lieu d'utiliser `src/lib/refs.ts`

**Methode:** Grep chaque fonction Firestore dans `src/hooks/` et `src/components/`

### 4. Auth Firebase dispersee
- `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signOut`, `onAuthStateChanged` hors du auth service
- Logique de gestion d'erreur auth (`auth/wrong-password`, `auth/email-already-in-use`) dans les composants

### 5. Blast radius analysis
- Compte le nombre de fichiers qui importent directement depuis `firebase.ts` ou les packages Firebase
- Trace le graphe : si `firebase.ts` change de signature, combien de fichiers cassent ?
- Les services dans `src/lib/` (userService, authService, friendService) exposent-ils une interface stable ou leakent-ils l'implementation ?

### 6. Error handling
- Les erreurs Firebase sont-elles traduites en erreurs domain avant de remonter ?
- Les codes d'erreur Firebase (`auth/wrong-password`) sont-ils geres dans le service ou exposes aux composants ?
- Les erreurs reseau/offline sont-elles gerees de facon centralisee ?

### 7. Centralisation des refs
- `src/lib/refs.ts` est-il utilise systematiquement ?
- Y a-t-il des `doc(db, 'users', uid)` ou `collection(db, 'sessions')` faits a la main ailleurs ?

## Criteres de severity

- **CRITICAL** : Composant React qui importe `firebase/*` directement — violation complete de la separation
- **HIGH** : Hook qui fait du CRUD Firestore sans passer par un service (couplage infra dans l'application layer)
- **MEDIUM** : Types Firebase qui leakent dans les signatures publiques, refs construites manuellement
- **LOW** : Service qui pourrait mieux encapsuler ses erreurs, nommage qui expose l'implementation
