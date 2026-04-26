/**
 * useQuestEvaluation — Owns the per-session quest completion state.
 *
 * Receives the post-save session summary, walks the available quests,
 * accumulates cross-session progress, and surfaces which quests just
 * completed so the orchestrator can branch on body-profile capture.
 */
import { useState, useCallback } from 'react';
import type { ExerciseType } from '@exercises/types';
import type { QuestDef, QuestProgress } from '@domain/quests';
import { isSingleSessionQuest, getSessionQuestContribution } from '@domain/quests';

export interface SessionQuestData {
    totalReps: number;
    avgScore: number;
    exerciseType: ExerciseType;
    isMultiSet: boolean;
    isMultiExercise: boolean;
    repsByExercise: Partial<Record<ExerciseType, number>>;
}

interface UseQuestEvaluationProps {
    availableQuests: QuestDef[];
    questProgress: QuestProgress;
    onCompleteQuests: (questIds: string[]) => void;
    onAddProgress: (questId: string, contribution: number) => number;
}

export interface UseQuestEvaluationReturn {
    questCompletedThisSession: QuestDef[];
    evaluate: (sessionData: SessionQuestData) => QuestDef[];
    resetQuestState: () => void;
}

export function useQuestEvaluation({
    availableQuests,
    questProgress,
    onCompleteQuests,
    onAddProgress,
}: UseQuestEvaluationProps): UseQuestEvaluationReturn {
    const [questCompletedThisSession, setQuestCompletedThisSession] = useState<QuestDef[]>([]);

    const evaluate = useCallback((sessionData: SessionQuestData): QuestDef[] => {
        const completedQuests: QuestDef[] = [];
        for (const quest of availableQuests) {
            const contribution = getSessionQuestContribution(quest, sessionData);
            if (contribution <= 0) continue;

            if (isSingleSessionQuest(quest)) {
                completedQuests.push(quest);
            } else {
                const currentProgress = questProgress.progress[quest.id] ?? 0;
                const newTotal = currentProgress + contribution;
                onAddProgress(quest.id, contribution);
                if (newTotal >= quest.goal.reps) completedQuests.push(quest);
            }
        }

        if (completedQuests.length > 0) {
            onCompleteQuests(completedQuests.map(q => q.id));
            setQuestCompletedThisSession(completedQuests);
        }
        return completedQuests;
    }, [availableQuests, questProgress, onAddProgress, onCompleteQuests]);

    const resetQuestState = useCallback(() => {
        setQuestCompletedThisSession([]);
    }, []);

    return { questCompletedThisSession, evaluate, resetQuestState };
}
