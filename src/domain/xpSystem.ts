/**
 * xpSystem.ts
 *
 * Pure XP / level-design functions — no React, importable anywhere.
 * Single source of truth for all XP calculations, bonus logic, and level curves.
 *
 * See LEVEL_DESIGN.md in this folder for the full design document.
 */

import type { ExerciseType, SetRecord, WorkoutPlan } from '@exercises/types';
import { EXERCISE_DIFFICULTY, difficultyFor } from '@exercises/exerciseDifficulty';
import { getGradeLetter, type GradeLetter } from './constants';
import { createLevel, createXpAmount, type Level, type XpAmount } from './brands';

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

// ─── Level curve ─────────────────────────────────────────────────────────────
// Soft-exponential: XP_required(L) = 100 × L^1.5  (per level, cumulative)

/** Total cumulative XP required to REACH a given level. Level 0 = 0 XP. */
export function totalXpForLevel(level: Level): XpAmount {
    if (level <= 0) return createXpAmount(0);
    // Sum of 100 * i^1.5 for i = 1..level
    let total = 0;
    for (let i = 1; i <= level; i++) {
        total += Math.round(100 * Math.pow(i, 1.5));
    }
    return createXpAmount(total);
}

/** XP required for one specific level (i.e. the gap between level-1 and level). */
export function xpForSingleLevel(level: Level): XpAmount {
    if (level <= 0) return createXpAmount(0);
    return createXpAmount(Math.round(100 * Math.pow(level, 1.5)));
}

/** Derive the level from a total cumulative XP amount. */
export function levelFromTotalXp(totalXp: XpAmount): Level {
    if (totalXp <= 0) return createLevel(0);
    let lvl = 0;
    while (totalXpForLevel(createLevel(lvl + 1)) <= totalXp) {
        lvl++;
    }
    return createLevel(lvl);
}

// ─── Level progress (for HUD/level bars) ────────────────────────────────────

export interface XpProgress {
    /** XP still needed to reach the next level. */
    xpRemaining: number;
    /** Progress toward the next level as a 0..1 ratio. */
    progressRatio: number;
}

/** XP remaining + progress ratio toward the next level. */
export function computeXpProgress(xpInto: number, xpNeeded: number): XpProgress {
    return {
        xpRemaining: Math.max(0, xpNeeded - xpInto),
        progressRatio: xpInto / Math.max(1, xpNeeded),
    };
}

// ─── Tier (cosmetic rank) ───────────────────────────────────────────────────

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

/** Cosmetic rank tier derived from the player's level. */
export function getTier(level: Level): Tier {
    if (level >= 35) return 'platinum';
    if (level >= 20) return 'gold';
    if (level >= 10) return 'silver';
    return 'bronze';
}

// ─── Bonus multipliers ──────────────────────────────────────────────────────

export interface XpBonusDetail {
    key: string;
    /** i18next key for the display label. Resolve via `t(labelKey, labelParams)` at the call site. */
    labelKey: string;
    /** Optional interpolation values (e.g. streak day count). */
    labelParams?: Record<string, string | number>;
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
            labelKey: 'workout:summary.bonus.streak',
            labelParams: { count: ctx.streak },
            emoji: '🔥',
            pct: streakPct,
        });
    }

    // ⏱️ Endurance / Marathon (mutually exclusive, marathon wins)
    if (ctx.elapsedTime >= 1200) {
        bonuses.push({ key: 'marathon', labelKey: 'workout:summary.bonus.marathon', emoji: '⏱️', pct: 25 });
    } else if (ctx.elapsedTime >= 600) {
        bonuses.push({ key: 'endurance', labelKey: 'workout:summary.bonus.endurance', emoji: '⏱️', pct: 15 });
    }

    // 💯 Perfection: average score ≥ 90
    if (ctx.averageScore >= 90) {
        bonuses.push({ key: 'perfection', labelKey: 'workout:summary.bonus.perfection', emoji: '💯', pct: 20 });
    }

    // 🎯 Goal met: all sets reached their target
    if (ctx.allGoalsMet) {
        bonuses.push({ key: 'goal', labelKey: 'workout:summary.bonus.goal', emoji: '🎯', pct: 10 });
    }

    // 🏋️ Multi-exercise
    if (ctx.isMultiExercise) {
        bonuses.push({ key: 'multi', labelKey: 'workout:summary.bonus.multi', emoji: '🏋️', pct: 10 });
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
    rawXp: XpAmount;
    /** Final XP after multiplier */
    totalXp: XpAmount;
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
    const totalRawXp = createXpAmount(Math.round(totalWeightedXp)); // rawXp exposed in result = weighted sum

    // 3. Calculate session bonuses on weighted XP
    const { bonuses, multiplier } = calculateBonuses(bonusCtx);

    // 4. Final XP = weighted × multiplier
    const totalXp = createXpAmount(Math.round(totalWeightedXp * multiplier));

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

// ─── Plan baseline XP estimate (pre-workout) ───────────────────────────────

export interface PlanXpBaseline {
    /** Sum of grade-C XP × difficulty across rep-mode blocks. */
    baselineXp: number;
    /** True when at least one block is in time mode and was excluded from the sum. */
    isPartial: boolean;
}

/**
 * Pre-workout estimate of the minimum XP a user will earn for completing
 * a plan. Assumes grade C (10 XP/rep) for every rep × per-exercise difficulty.
 * Time-mode blocks are excluded — they raise `isPartial` instead of being
 * extrapolated from a rep/sec assumption.
 *
 * No session bonuses (streak, duration, perfection, multi-exercise) — those
 * are surfaced on the SummaryScreen as a positive surprise.
 */
export function estimatePlanXpBaseline(plan: WorkoutPlan): PlanXpBaseline {
    let baselineXp = 0;
    let isPartial = false;
    for (const block of plan.blocks) {
        if (block.sessionMode !== 'reps') {
            isPartial = true;
            continue;
        }
        baselineXp += block.numberOfSets * block.goalReps * 10 * difficultyFor(block.exerciseType);
    }
    return { baselineXp: Math.round(baselineXp), isPartial };
}

// ─── Live XP Projection ────────────────────────────────────────────────────

/** Estimate XP earned from completed sets (exact per-rep scoring when available) */
export function estimateCompletedXp(completedSets: Pick<SetRecord, 'reps' | 'averageScore' | 'repHistory' | 'exerciseType'>[]): number {
    return completedSets.reduce((sum, set) => {
        const diff = EXERCISE_DIFFICULTY[(set.exerciseType ?? 'pushup') as ExerciseType] ?? 1.0;
        if (set.repHistory.length > 0) {
            return sum + set.repHistory.reduce((s, r) => s + xpForRep(r.score), 0) * diff;
        }
        return sum + set.reps * xpForRep(set.averageScore) * diff;
    }, 0);
}

export interface LiveXpProjection {
    liveXpEstimate: XpAmount;
    liveLevel: Level;
    liveProgressPct: number;
}

/**
 * Project the user's live XP/level during an active workout.
 * Uses actual per-rep scores for completed sets and a C-grade estimate for the current set.
 */
export function projectLiveXp(
    totalXp: XpAmount,
    completedSets: Pick<SetRecord, 'reps' | 'averageScore' | 'repHistory' | 'exerciseType'>[],
    currentSetReps: number,
    activeExerciseType: ExerciseType,
): LiveXpProjection {
    const completedXp = estimateCompletedXp(completedSets);
    const currentExDifficulty = EXERCISE_DIFFICULTY[activeExerciseType] ?? 1.0;
    const currentSetEstimate = currentSetReps * 10 * currentExDifficulty;
    const liveXpEstimate = createXpAmount(totalXp + Math.round(completedXp + currentSetEstimate));
    const liveLevel = levelFromTotalXp(liveXpEstimate);
    const liveLevelBase = totalXpForLevel(liveLevel);
    const liveLevelNext = totalXpForLevel(createLevel(liveLevel + 1));
    const liveProgressPct = liveLevelNext > liveLevelBase
        ? ((liveXpEstimate - liveLevelBase) / (liveLevelNext - liveLevelBase)) * 100
        : 0;
    return { liveXpEstimate, liveLevel, liveProgressPct };
}
