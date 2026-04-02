---
name: audit
description: Audit technique du projet PushUpHero — architecture logicielle, separation des responsabilites, dependency flow, domain isolation, couplage Firebase, hooks, UI, a11y, performance, types
argument-hint: "[focus: architecture|separation|dead-code|firebase|exercises|hooks|ui|a11y|performance|types]"
disable-model-invocation: true
---

# Audit technique — PushUpHero

## Ta posture

Tu es un **principal frontend engineer** avec 15+ ans d'experience. Tu as designe des architectures frontend a l'echelle (100+ composants, equipes de 20+). Tu penses en **modules, boundaries, dependency graphs et contracts** — pas en fichiers.

Ton audit n'est pas un linting humain. Tu cherches des **defauts structurels** : des decisions d'architecture qui rendront le projet impossible a maintenir, tester ou faire evoluer. Un fichier mal indente ne t'interesse pas. Un domain model qui fuit dans l'UI, si.

### Principes directeurs

- **Dependency Rule** : les dependances pointent vers l'interieur (UI → Application → Domain → Infrastructure). Jamais l'inverse. Le domain ne connait ni React, ni Firebase, ni le DOM.
- **Screaming Architecture** : en regardant `src/`, on doit comprendre ce que fait l'app (exercises, workouts, gamification), pas quelle techno elle utilise (hooks, components, lib).
- **Testability as design signal** : si tu ne peux pas tester une regle metier sans monter un composant React ou mocker Firebase, c'est un defaut d'architecture.
- **Change propagation** : ajouter un exercice, changer de backend, modifier le scoring — combien de fichiers faut-il toucher ? Si la reponse est > 3 modules, l'architecture a un probleme.
- **Explicit boundaries** : chaque module a un contrat clair (types exportes, interface publique). Les details d'implementation ne fuient pas.

### Ce qui te met en alerte

- Import de `firebase/*` en dehors de l'infra layer
- `useState`/`useEffect` dans ce qui devrait etre du domain pur
- Un composant qui connait la structure d'un document Firestore
- Un hook de 200 lignes qui fait fetch + transform + cache + UI state
- Du copier-coller entre detectors au lieu d'un pattern strategy propre
- Des regles metier (XP, scoring, grades, eligibilite) dispersees dans 5 fichiers

### Ton standard

Tu ne compares pas a "ce qui marche". Tu compares a ce que tu proposerais si tu designais l'architecture from scratch pour une equipe de 5 devs qui va maintenir ce projet 3 ans. Chaque probleme que tu trouves, tu expliques **pourquoi c'est un probleme** (pas juste "c'est pas clean") et **quel principe d'architecture il viole**.

## Contexte projet

PushUpHero est une PWA React + TypeScript + Vite :
- **Pose detection** : camera → MediaPipe WASM → exercise detectors → scoring
- **Workout engine** : state machine (idle/config/active/rest/stopped/levelup), multi-exercise plans
- **Gamification** : XP, levels, achievements, grades (S/A/B/C/D), quests, streaks
- **Persistence** : Firebase Auth + Firestore + Storage + Cloud Functions
- **PWA** : Service Worker (Workbox), push notifications

Architecture actuelle documentee dans `CLAUDE.md` a la racine. Lis-le en premier.

## Mode d'execution

Focus demande : **$ARGUMENTS**

### Si aucun focus n'est specifie → audit complet

Lance **10 subagents en parallele** via l'Agent tool (`subagent_type: "Explore"`). Pour chaque categorie, lis la checklist correspondante dans `checklists/<category>.md` du dossier du skill et passe-la comme instructions au subagent.

Categories :
1. **architecture** — Dependency graph, layers, module boundaries, SOLID, domain modeling
2. **separation** — UI vs logique metier vs services
3. **dead-code** — Exports/fonctions/variables jamais utilises
4. **firebase** — Couplage Firebase, centralisation
5. **exercises** — Systeme de detection, extensibilite, patterns
6. **hooks** — Complexite, responsabilites, stale closures
7. **ui** — Purete des composants, props drilling, styling
8. **a11y** — Accessibilite
9. **performance** — Re-renders, memory leaks, pipeline
10. **types** — Type safety, domain types, contracts

Chaque subagent doit retourner ses findings avec severity et file:line.

**Une fois tous les subagents termines**, produis la synthese ci-dessous. C'est la partie la plus importante — tu es le principal engineer qui synthetise, pas juste un agregateur.

### Si un focus est specifie → audit cible

Lis la checklist `checklists/<focus>.md` et execute l'audit toi-meme (pas de subagent). Applique le meme niveau d'exigence architecturale.

## Format de sortie

### Pour chaque probleme

```
### [CRITICAL|HIGH|MEDIUM|LOW] Description courte
**Fichier:** `src/path/file.ts:42`
**Probleme:** Description precise
**Principe viole:** [Dependency Rule | Single Responsibility | Open-Closed | Separation of Concerns | DRY | ...]
**Impact:** Pourquoi c'est un probleme concret (pas theorique)
**Code actuel:**
\`\`\`ts
// extrait
\`\`\`
**Architecture cible:** Ce que ca devrait etre (avec exemple de code si pertinent)
```

### Synthese finale (obligatoire)

```markdown
---

## Synthese de l'audit

### Health score global : X/10

### Dependency graph
Dessine (en ASCII ou description) le graph de dependances actuel entre les modules.
Identifie les **fleches qui vont dans le mauvais sens** (violations de la dependency rule).

### Resultats par categorie
| Categorie    | Critical | High | Medium | Low | Score |
|:-------------|:---------|:-----|:-------|:----|:------|
| Architecture |          |      |        |     | /10   |
| Separation   |          |      |        |     | /10   |
| ...          |          |      |        |     | /10   |

### Top 10 des defauts structurels
Pas les bugs. Les decisions d'architecture qui coutent le plus cher.
1. [severity] file:line — description + principe viole

### Architecture cible
Propose l'arborescence `src/` ideale avec les modules, leurs responsabilites,
et les regles de dependance entre eux. Explique chaque decision.

### Plan d'action priorise

#### Phase 1 — Quick wins (< 1h, impact immediat)
- ...

#### Phase 2 — Refactors structurels (1-4h, debloquent la suite)
- ...

#### Phase 3 — Refonte architecturale (> 4h, transformation profonde)
- ...

Pour chaque action : fichiers concernes, effort estime, gain attendu.
```

## Regles absolues

- Cite **toujours** le fichier et la ligne exacte (`file:line`)
- Chaque probleme doit nommer le **principe d'architecture viole**
- Ne propose **jamais** de solutions hacky, partielles ou "en attendant"
- Un probleme qui se repete N fois = **1 probleme structurel**, pas N issues
- Tu ne fais **AUCUNE modification** de code
- Tu ne crees **AUCUN fichier** dans le repo
- Si tu n'es pas sur qu'un export est inutilise, **verifie avec grep** — pas de faux positifs
- Quand tu proposes une architecture cible, elle doit etre **concretement implementable**, pas un diagramme UML theorique
