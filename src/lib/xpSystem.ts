/**
 * xpSystem.ts
 *
 * Pure XP / level-design functions — no React, importable anywhere.
 * Single source of truth for all XP calculations, bonus logic, and level curves.
 *
 * See LEVEL_DESIGN.md in this folder for the full design document.
 */

import type { ExerciseType, SetRecord } from '@exercises/types';
import { EXERCISE_REGISTRY } from '@exercises/registry';
import { getGradeLetter } from './constants';
import type { GradeLetter } from './constants';

// ─── XP per rep, by grade ────────────────────────────────────────────────────

const XP_PER_GRADE: Record<GradeLetter, number> = {
    S: 20,
    A: 15,
    B: 12,
    C: 10,
    D: 8,
};

/** XP earned by a single rep based on its score (0–100). */
export function xpForRep(score: number): number {
    const grade = getGradeLetter(score);
    return XP_PER_GRADE[grade];
}

// ─── Exercise difficulty coefficients ────────────────────────────────────────
// Applied as a multiplier on raw XP *before* session bonuses.
// Squat is the baseline (×1.0). Add a new entry here when adding an exercise.
//
// Rationale:
//   squat   ×1.0  – most accessible, large muscle group, easy to do many reps
//   pushup  ×1.3  – full upper body, requires strict form, more demanding
//   pullup  ×2.5  – bodyweight compound, very few people can do 20+

/** Difficulty coefficients derived from the exercise registry. */
export const EXERCISE_DIFFICULTY: Record<ExerciseType, number> = Object.fromEntries(
    (Object.keys(EXERCISE_REGISTRY) as ExerciseType[]).map(t => [t, EXERCISE_REGISTRY[t].difficulty]),
) as Record<ExerciseType, number>;

/**
 * Returns the difficulty coefficient for a given exercise type.
 * Falls back to 1.0 for unknown types so new exercises are safe by default.
 */
export function difficultyFor(type: ExerciseType): number {
    return EXERCISE_REGISTRY[type]?.difficulty ?? 1.0;
}

// ─── Level curve ─────────────────────────────────────────────────────────────
// Soft-exponential: XP_required(L) = 100 × L^1.5  (per level, cumulative)

/** Total cumulative XP required to REACH a given level. Level 0 = 0 XP. */
export function totalXpForLevel(level: number): number {
    if (level <= 0) return 0;
    // Sum of 100 * i^1.5 for i = 1..level
    let total = 0;
    for (let i = 1; i <= level; i++) {
        total += Math.round(100 * Math.pow(i, 1.5));
    }
    return total;
}

/** XP required for one specific level (i.e. the gap between level-1 and level). */
export function xpForSingleLevel(level: number): number {
    if (level <= 0) return 0;
    return Math.round(100 * Math.pow(level, 1.5));
}

/** Derive the level from a total cumulative XP amount. */
export function levelFromTotalXp(totalXp: number): number {
    if (totalXp <= 0) return 0;
    let lvl = 0;
    while (totalXpForLevel(lvl + 1) <= totalXp) {
        lvl++;
    }
    return lvl;
}

// ─── Tier (cosmetic rank) ───────────────────────────────────────────────────

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

/** Cosmetic rank tier derived from the player's level. */
export function getTier(level: number): Tier {
    if (level >= 35) return 'platinum';
    if (level >= 20) return 'gold';
    if (level >= 10) return 'silver';
    return 'bronze';
}

// ─── Bonus multipliers ──────────────────────────────────────────────────────

export interface XpBonusDetail {
    key: string;
    label: string;
    emoji: string;
    /** Additive percentage (e.g. 15 means +15%). Streak is special: value is already the full pct. */
    pct: number;
}

export interface XpBonusResult {
    bonuses: XpBonusDetail[];
    /** Final multiplier (e.g. 1.55) */
    multiplier: number;
}

export interface BonusContext {
    /** Current streak (days), 0 if none */
    streak: number;
    /** Total session duration in seconds */
    elapsedTime: number;
    /** Weighted average score across all sets */
    averageScore: number;
    /** Whether ALL goals (reps or time) were met for every set */
    allGoalsMet: boolean;
    /** Whether the workout has 2+ exercise types */
    isMultiExercise: boolean;
}

/**
 * Calculate bonus multipliers based on the session context.
 * Bonuses are additive percentages, then combined: multiplier = 1 + sum(pct)/100.
 */
export function calculateBonuses(ctx: BonusContext): XpBonusResult {
    const bonuses: XpBonusDetail[] = [];

    // 🔥 Streak bonus: +5% per day, cap at +50% (10 days)
    if (ctx.streak > 0) {
        const streakPct = Math.min(ctx.streak * 5, 50);
        bonuses.push({
            key: 'streak',
            label: `Streak ${ctx.streak}j`,
            emoji: '🔥',
            pct: streakPct,
        });
    }

    // ⏱️ Endurance / Marathon (mutually exclusive, marathon wins)
    if (ctx.elapsedTime >= 1200) {
        bonuses.push({ key: 'marathon', label: 'Marathon', emoji: '⏱️', pct: 25 });
    } else if (ctx.elapsedTime >= 600) {
        bonuses.push({ key: 'endurance', label: 'Endurance', emoji: '⏱️', pct: 15 });
    }

    // 💯 Perfection: average score ≥ 90
    if (ctx.averageScore >= 90) {
        bonuses.push({ key: 'perfection', label: 'Perfection', emoji: '💯', pct: 20 });
    }

    // 🎯 Goal met: all sets reached their target
    if (ctx.allGoalsMet) {
        bonuses.push({ key: 'goal', label: 'Objectif atteint', emoji: '🎯', pct: 10 });
    }

    // 🏋️ Multi-exercise
    if (ctx.isMultiExercise) {
        bonuses.push({ key: 'multi', label: 'Multi-exercice', emoji: '🏋️', pct: 10 });
    }

    const totalPct = bonuses.reduce((sum, b) => sum + b.pct, 0);
    const multiplier = 1 + totalPct / 100;

    return { bonuses, multiplier };
}

// ─── Session XP calculation ─────────────────────────────────────────────────

export interface XpPerExercise {
    exerciseType: ExerciseType;
    /** XP before difficulty coefficient and bonuses */
    rawXp: number;
    /** XP after difficulty coefficient but before session bonuses */
    weightedXp: number;
    /** XP after difficulty coefficient AND session bonuses */
    finalXp: number;
    /** The difficulty coefficient applied (e.g. 1.3 for pushup) */
    difficultyCoefficient: number;
}

export interface SessionXpResult {
    /** Raw XP before bonuses (sum of all reps) */
    rawXp: number;
    /** Final XP after multiplier */
    totalXp: number;
    /** Bonus breakdown */
    bonuses: XpBonusDetail[];
    /** Multiplier applied */
    multiplier: number;
    /** XP per exercise type (after multiplier) */
    perExercise: XpPerExercise[];
}

/**
 * Calculate the total XP earned for a completed session.
 *
 * @param sets - All completed sets (with repHistory and exerciseType)
 * @param bonusCtx - Context for bonus calculation
 */
export function calculateSessionXp(sets: SetRecord[], bonusCtx: BonusContext): SessionXpResult {
    // 1. Raw XP per exercise type (grade-based, no difficulty yet)
    const rawByType: Partial<Record<ExerciseType, number>> = {};

    for (const set of sets) {
        const exType = set.exerciseType ?? 'pushup';
        let setRawXp = 0;

        if (set.repHistory && set.repHistory.length > 0) {
            for (const rep of set.repHistory) {
                setRawXp += xpForRep(rep.score);
            }
        } else {
            // Fallback: if no per-rep data, use averageScore × reps
            setRawXp = set.reps * xpForRep(set.averageScore);
        }

        rawByType[exType] = (rawByType[exType] ?? 0) + setRawXp;
    }

    // 2. Apply difficulty coefficient per exercise → weighted XP
    //    This is the XP that enters the bonus calculation.
    let totalWeightedXp = 0;
    const weightedByType: Partial<Record<ExerciseType, number>> = {};
    for (const [type, raw] of Object.entries(rawByType) as [ExerciseType, number][]) {
        const weighted = (raw ?? 0) * difficultyFor(type);
        weightedByType[type] = weighted;
        totalWeightedXp += weighted;
    }
    const totalRawXp = Math.round(totalWeightedXp); // rawXp exposed in result = weighted sum

    // 3. Calculate session bonuses on weighted XP
    const { bonuses, multiplier } = calculateBonuses(bonusCtx);

    // 4. Final XP = weighted × multiplier
    const totalXp = Math.round(totalWeightedXp * multiplier);

    // 5. Per-exercise breakdown
    const perExercise: XpPerExercise[] = (Object.entries(rawByType) as [ExerciseType, number][]).map(([type, raw]) => {
        const coeff = difficultyFor(type);
        const weighted = (raw ?? 0) * coeff;
        return {
            exerciseType: type,
            rawXp: raw ?? 0,
            weightedXp: Math.round(weighted),
            finalXp: Math.round(weighted * multiplier),
            difficultyCoefficient: coeff,
        };
    });

    return { rawXp: totalRawXp, totalXp, bonuses, multiplier, perExercise };
}
