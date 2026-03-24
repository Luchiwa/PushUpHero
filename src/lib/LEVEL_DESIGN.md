# 🎮 PushUpHero — Level Design

> Ce document est la **source de vérité** pour le système d'expérience et de niveaux de PushUpHero.
> Code de référence : `src/lib/xpSystem.ts`

---

## 1. XP de base (par répétition)

Chaque rep rapporte de l'XP en fonction de son **score de qualité** (0–100) :

| Grade | Score requis | XP par rep |
| ----- | ------------ | ---------- |
| **S** | ≥ 90        | **20 XP**  |
| **A** | ≥ 75        | **15 XP**  |
| **B** | ≥ 60        | **12 XP**  |
| **C** | ≥ 45        | **10 XP**  |
| **D** | < 45        | **8 XP**   |

> Une rep parfaite (Grade S) vaut **2.5×** une rep faible (Grade D).
> L'unité mentale de référence : 1 rep "moyenne" (Grade C) = **10 XP**.

---

## 2. Coefficient de difficulté par exercice

Appliqué **après** le calcul d'XP par grade, **avant** les bonus de session.
Le squat est la référence (×1.0).

| Exercice | Coefficient | Raisonnement |
| -------- | ----------- | ------------ |
| **Squat**  | ×1.0 | Référence — grand groupe musculaire, accessible |
| **Push-up** | ×1.3 | Haut du corps complet, technique plus stricte |
| **Traction** | ×2.5 | Poids du corps complet, très peu de gens en font 20+ |

### Exemples comparatifs (Grade C, pas de bonus)

| Exercice | 20 reps × 10 XP × coeff | XP gagnée |
| -------- | ----------------------- | --------- |
| Squat   | 20 × 10 × 1.0 | **200 XP** |
| Push-up | 20 × 10 × 1.3 | **260 XP** |
| Traction | 20 × 10 × 2.5 | **500 XP** |

> **Ordre des calculs :** XP grade → × coefficient difficulté → × multiplicateur bonus session

---

## 2. Courbe de niveau

### Formule

XP requis pour passer du niveau `L-1` au niveau `L` :

$$XP_{niveau}(L) = 100 \times L^{1.5}$$

XP total cumulé pour **atteindre** le niveau `L` :

$$XP_{total}(L) = \sum_{i=1}^{L} \lfloor 100 \times i^{1.5} \rceil$$

### Table de référence

| Niveau | XP pour ce niveau | XP total cumulé | ≈ Reps Grade C |
| ------ | ----------------- | --------------- | --------------- |
| 1      | 100               | 100             | 10              |
| 2      | 283               | 383             | ~28             |
| 3      | 520               | 903             | ~52             |
| 5      | 1 118             | 2 735           | ~112            |
| 10     | 3 162             | 14 604          | ~316            |
| 15     | 5 809             | 36 949          | ~581            |
| 20     | 8 944             | 70 862          | ~894            |
| 30     | 16 432            | 173 205         | ~1 643          |
| 50     | 35 355            | 530 338         | ~3 536          |
| 100    | 100 000           | 2 026 760       | ~10 000         |

> **Pas de niveau max.** La progression est infinie.

---

## 4. Niveaux par exercice (sous-niveaux)

Chaque type d'exercice possède **son propre niveau** avec **la même courbe** :

- **Niveau Push-up** — alimenté par les reps push-up
- **Niveau Squat** — alimenté par les reps squat
- *(futur : Lunges, Plank, Sit-ups…)*

### Double alimentation

L'XP gagnée dans un exercice alimente **deux jauges** :

1. ✅ Jauge du **sous-niveau** de l'exercice (+100% de l'XP)
2. ✅ Jauge du **niveau global** (+100% de l'XP)

> Exemple : 1 rep de push-up Grade A = **+15 XP Push-up** ET **+15 XP Global**.

---

## 5. Bonus d'XP (multiplicateurs de session)

Les bonus sont calculés en **fin de session** et s'appliquent à l'XP brute totale.

| Bonus | Condition | Bonus |
| ----- | --------- | ----- |
| 🔥 **Streak** | Streak actif (jours consécutifs) | +5% par jour (cap **+50%** à 10j) |
| ⏱️ **Endurance** | Session ≥ 10 minutes | **+15%** |
| ⏱️ **Marathon** | Session ≥ 20 minutes | **+25%** *(remplace Endurance)* |
| 💯 **Perfection** | Score moyen ≥ 90 (Grade S) | **+20%** |
| 🎯 **Objectif atteint** | 100% des goals complétés | **+10%** |
| 🏋️ **Multi-exercice** | Workout avec 2+ types d'exercice | **+10%** |
| 👥 **Défi ami** *(futur)* | Compléter un défi d'un ami | **+25%** |

### Calcul

Les bonus s'**additionnent** puis se multiplient en une seule fois :

```
XP finale = XP brute × (1 + somme des bonus%)
```

### Exemple concret

> Session : 30 push-ups (score moyen 82, Grade A), streak de 5 jours, 12 minutes, tous goals atteints.
>
> - XP brute : 30 × 15 = **450 XP**
> - Streak 5j : +25%
> - Endurance : +15%
> - Objectif atteint : +10%
> - Multiplicateur total : ×1.50
> - **XP finale : 450 × 1.50 = 675 XP**

---

## 6. Flux XP d'une session

```
Session terminée
  │
  ├─ Pour chaque rep → XP de base selon grade (8/10/12/15/20)
  │
  ├─ × Coefficient de difficulté de l'exercice (squat×1.0 / pushup×1.3 / pullup×2.5)
  │
  ├─ Somme = XP pondérée de la session (= rawXp exposé)
  │
  ├─ Calcul des bonus actifs → multiplicateur total
  │
  ├─ XP finale = XP pondérée × multiplicateur (arrondi)
  │
  ├─ Ventilation par exercice :
  │    ├─ XP Push-up += XP pondérée push-up × multiplicateur
  │    ├─ XP Squat  += XP pondérée squat × multiplicateur
  │    └─ XP Traction += XP pondérée traction × multiplicateur
  │
  └─ XP Global += XP finale totale
```

---

## 7. Stockage des données

### Profil utilisateur Firestore (`users/{uid}`)

| Champ | Type | Description |
| ----- | ---- | ----------- |
| `totalXp` | `number` | XP global cumulé (lifetime) |
| `level` | `number` | Niveau global (dérivé, dénormalisé) |
| `exerciseXp` | `Record<ExerciseType, number>` | XP par exercice (`{ pushup: 1200, squat: 800 }`) |
| `exerciseLevels` | `Record<ExerciseType, number>` | Niveau par exercice (dénormalisé) |

### Session (`users/{uid}/sessions/{id}`)

| Champ additionnel | Type | Description |
| ----- | ---- | ----------- |
| `xpEarned` | `number` | XP totale gagnée (après bonus) |
| `xpRaw` | `number` | XP brute (avant bonus) |
| `xpMultiplier` | `number` | Multiplicateur appliqué |
| `xpBonuses` | `XpBonusDetail[]` | Détail des bonus actifs |
| `xpPerExercise` | `XpPerExercise[]` | Ventilation XP par exercice |

### Guest mode (localStorage)

| Clé | Valeur |
| --- | ------ |
| `pushup_hero_total_xp` | XP global cumulé |
| `pushup_hero_exercise_xp` | JSON `Record<ExerciseType, number>` |

---

## 8. Historique des changements

| Date | Changement |
| ---- | ---------- |
| 2026-03-22 | Création du système XP (remplacement du système reps→level) |
| 2026-03-23 | Ajout des coefficients de difficulté par exercice (squat×1.0 / pushup×1.3 / pullup×2.5) |
