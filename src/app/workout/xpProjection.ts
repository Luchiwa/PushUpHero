/**
 * xpProjection — Pure session-XP helpers.
 *
 * Extracted from useWorkoutSession to keep the save callback focused on
 * orchestration. No state, no React, no Firebase.
 */
import type { ExerciseType, SetRecord } from '@exercises/types';
import { calculateSessionXp, levelFromTotalXp } from '@domain';
import type { BonusContext } from '@domain';
import { weightedAverageScore } from '@domain';
import type { Level, XpAmount } from '@domain';
import { createXpAmount } from '@domain';

export interface FinalXpInput {
    allSets: SetRecord[];
    totalWorkoutDuration: number;
    streak: number;
    isMultiExercise: boolean;
    totalXp: XpAmount;
}

export interface FinalXpResult {
    bonusCtx: BonusContext;
    computedLevel: Level;
    avgScore: number;
}

/** Build the bonus context, compute session XP and the post-save level. */
export function computeFinalXp(input: FinalXpInput): FinalXpResult {
    const { allSets, totalWorkoutDuration, streak, isMultiExercise, totalXp } = input;

    const avgScore = weightedAverageScore(allSets);

    const allGoalsMet = allSets.every(s => {
        if (s.setMode === 'time') return true;
        return s.goalReps !== undefined ? s.reps >= s.goalReps : true;
    });

    const bonusCtx: BonusContext = {
        streak,
        elapsedTime: totalWorkoutDuration,
        averageScore: avgScore,
        allGoalsMet,
        isMultiExercise,
    };

    const { totalXp: sessionXp } = calculateSessionXp(allSets, bonusCtx);
    const computedLevel = levelFromTotalXp(createXpAmount(totalXp + sessionXp));

    return { bonusCtx, computedLevel, avgScore };
}

export interface PrimaryExerciseResult {
    primaryExercise: ExerciseType;
    repsByType: Record<string, number>;
    hasMultipleExercises: boolean;
}

/** Find the exercise type with the most reps across the session. */
export function derivePrimaryExercise(allSets: SetRecord[]): PrimaryExerciseResult {
    const repsByType: Record<string, number> = {};
    for (const s of allSets) {
        const t = s.exerciseType ?? 'pushup';
        repsByType[t] = (repsByType[t] ?? 0) + s.reps;
    }
    const primaryExercise = (Object.entries(repsByType).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'pushup') as ExerciseType;
    const hasMultipleExercises = Object.keys(repsByType).length > 1;
    return { primaryExercise, repsByType, hasMultipleExercises };
}
