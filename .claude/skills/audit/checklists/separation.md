# Checklist — Separation des responsabilites

Tu audites la separation des responsabilites avec une vision architecturale stricte.

## Le modele cible

```
UI Layer          → Composants React purs (rendu, interactions, animations)
Application Layer → Hooks d'orchestration (wiring entre domain, infra et UI)
Domain Layer      → Regles metier pures (fonctions, classes, ZERO import React/Firebase)
Infra Layer       → Services Firebase, browser APIs, MediaPipe (implementations concretes)
```

**La regle d'or** : chaque couche ne connait que la couche immediatement en-dessous. Le domain ne connait RIEN des couches superieures.

## Ce que tu cherches

### 1. Logique metier dans l'UI layer
- Calculs, transformations, regles de gestion dans le JSX ou les handlers
- Conditions metier dans le render (calcul de grade, XP, level, eligibilite)
- Composants qui importent directement des services Firebase
- Composants qui connaissent la structure d'un document Firestore

**Ou chercher:** `src/screens/`, `src/modals/`, `src/components/`
**Methode:** Lis chaque composant et identifie tout code qui ne releve pas de "afficher + reagir aux interactions"

### 2. Logique metier dans les hooks (application layer)
- Hooks qui melangent state management React ET regles metier
- Hooks qui font des calculs complexes au lieu de deleguer a un module domain
- Hooks qui appellent Firebase directement au lieu de passer par un service
- Hooks qui sont les SEULS endroits ou une regle metier existe (non-testable sans React)

**Ou chercher:** `src/hooks/`
**Test mental:** peux-tu extraire la regle metier dans une fonction pure et tester avec un simple `assert` ?

### 3. Infra layer qui fuit
- Appels directs a `db`, `auth`, `storage` en dehors de `src/lib/`
- Import de `firebase/firestore`, `firebase/auth` etc. dans des composants ou hooks
- Absence d'interface/type entre le service layer et les hooks (coupling direct a l'implementation)
- Types Firestore (`Timestamp`, `DocumentReference`) exposes dans les signatures publiques des hooks

**Methode:** Grep `from ['"]firebase/` dans tout `src/` sauf `src/lib/`

### 4. Domain dispersé et non-identifiable
- Existe-t-il un endroit clair ou vit le domain ? Ou est-il eparpille dans `lib/`, `hooks/`, `exercises/` ?
- Regles metier dupliquees entre plusieurs fichiers (meme calcul dans 2 hooks)
- Constants metier hardcodees dans les composants au lieu d'un module domain
- Logique XP/level/achievement eclatee dans 5+ fichiers sans module unificateur

**Ou chercher:** `src/lib/`, `src/hooks/`, `src/exercises/`
**Question clé:** Si un nouveau dev demande "ou est la logique de scoring ?", peux-tu pointer UN fichier ?

### 5. Dependency inversions manquantes
- Le code metier depend-il d'implementations concretes (Firebase, MediaPipe) ou d'abstractions ?
- Si tu veux tester le calcul d'XP, dois-tu mocker Firebase ? Si oui → violation DIP
- Les services ont-ils des types/interfaces ou le code depend directement des fonctions Firebase ?

## Criteres de severity

- **CRITICAL** : Regle metier core (XP, scoring, detection, grading) uniquement testable via React ou Firebase — violation de la dependency rule
- **HIGH** : Import Firebase direct dans un composant ou hook (bypass complet du service layer)
- **MEDIUM** : Hook qui mixe orchestration React et calculs metier (extractable mais pas fait)
- **LOW** : Couplage leger, naming qui ne clarifie pas la couche
