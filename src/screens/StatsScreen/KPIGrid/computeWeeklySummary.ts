import type { SessionRecord } from '@exercises/types';

type ExerciseFilter = 'all' | import('@exercises/types').ExerciseType;

export interface WeeklySummary {
    totalXp: number;
    totalReps: number;
    sessionCount: number;
    activeDays: number;
    bestSession: number;
}

export function computeWeeklySummary(
    sessions: SessionRecord[],
    exerciseFilter: ExerciseFilter,
): WeeklySummary {
    let totalXp = 0;
    let totalReps = 0;
    let bestXp = 0;
    let bestReps = 0;
    const activeDaysSet = new Set<number>();

    for (const s of sessions) {
        const day = new Date(s.date).getDay();
        activeDaysSet.add(day);

        if (exerciseFilter !== 'all' && s.xpPerExercise) {
            const match = s.xpPerExercise.find(e => e.exerciseType === exerciseFilter);
            if (match) totalXp += match.finalXp;
            if (match && match.finalXp > bestXp) bestXp = match.finalXp;
        } else {
            totalXp += s.xpEarned ?? 0;
            if ((s.xpEarned ?? 0) > bestXp) bestXp = s.xpEarned ?? 0;
        }

        if (exerciseFilter !== 'all' && s.isMultiExercise && s.blocks && s.sets) {
            let setIdx = 0;
            let sessionReps = 0;
            for (const block of s.blocks) {
                const blockSets = s.sets.slice(setIdx, setIdx + block.numberOfSets);
                setIdx += block.numberOfSets;
                if (block.exerciseType === exerciseFilter) {
                    sessionReps += blockSets.reduce((sum, st) => sum + st.reps, 0);
                }
            }
            totalReps += sessionReps;
            if (sessionReps > bestReps) bestReps = sessionReps;
        } else {
            totalReps += s.reps;
            if (s.reps > bestReps) bestReps = s.reps;
        }
    }

    return {
        totalXp,
        totalReps,
        sessionCount: sessions.length,
        activeDays: activeDaysSet.size,
        bestSession: bestReps,
    };
}
