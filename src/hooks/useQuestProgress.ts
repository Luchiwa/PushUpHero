/**
 * useQuestProgress — Persists QuestProgress in localStorage
 * and syncs to Firestore when logged in.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthCore } from './useAuth';
import { updateQuestProgress } from '@services/profileService';
import { read, write, STORAGE_KEYS } from '@infra/storage';
import type { QuestProgress } from '@domain/quests';
import { emptyQuestProgress } from '@domain/quests';

function loadQuestProgress(): QuestProgress {
    const stored = read<QuestProgress | null>(STORAGE_KEYS.questProgress, null);
    if (!stored) return emptyQuestProgress();
    if (!stored.accepted) stored.accepted = {};
    if (!stored.progress) stored.progress = {};
    return stored;
}

export function useQuestProgress() {
    const { user, dbUser } = useAuthCore();
    const [questProgress, setQuestProgressState] = useState<QuestProgress>(loadQuestProgress);
    const initialLoadDone = useRef(false);

    // Hydrate from Firestore on login (cloud takes priority)
    useEffect(() => {
        if (!dbUser || !user || initialLoadDone.current) return;
        initialLoadDone.current = true;

        const localQuests = loadQuestProgress();

        if (dbUser.questProgress && Object.keys(dbUser.questProgress.completed ?? {}).length > 0) {
            const cloud = {
                ...dbUser.questProgress,
                accepted: dbUser.questProgress.accepted ?? {},
                progress: dbUser.questProgress.progress ?? {},
            };
            setQuestProgressState(cloud);
            write(STORAGE_KEYS.questProgress, cloud);
        } else if (Object.keys(localQuests.completed).length > 0 || Object.keys(localQuests.accepted).length > 0) {
            updateQuestProgress(user.uid, localQuests).catch(console.error);
        }
    }, [dbUser, user]);

    // Reset on logout
    const prevUserRef = useRef(user);
    useEffect(() => {
        if (!user && prevUserRef.current) {
            initialLoadDone.current = false;
            setQuestProgressState(emptyQuestProgress());
        }
        prevUserRef.current = user;
    }, [user]);

    const saveQuestProgress = useCallback((progress: QuestProgress) => {
        setQuestProgressState(progress);
        write(STORAGE_KEYS.questProgress, progress);
        if (user) {
            updateQuestProgress(user.uid, progress).catch(console.error);
        }
    }, [user]);

    const completeQuest = useCallback((questId: string) => {
        const updated: QuestProgress = {
            ...questProgress,
            completed: { ...questProgress.completed, [questId]: Date.now() },
        };
        saveQuestProgress(updated);
        return updated;
    }, [questProgress, saveQuestProgress]);

    const completeQuests = useCallback((questIds: string[]) => {
        const now = Date.now();
        const newCompleted = { ...questProgress.completed };
        for (const id of questIds) {
            newCompleted[id] = now;
        }
        const updated: QuestProgress = { ...questProgress, completed: newCompleted };
        saveQuestProgress(updated);
        return updated;
    }, [questProgress, saveQuestProgress]);

    const acceptQuest = useCallback((questId: string) => {
        const updated: QuestProgress = {
            ...questProgress,
            accepted: { ...questProgress.accepted, [questId]: Date.now() },
        };
        saveQuestProgress(updated);
        return updated;
    }, [questProgress, saveQuestProgress]);

    const abandonQuest = useCallback((questId: string) => {
        const { [questId]: _removed, ...rest } = questProgress.accepted;
        void _removed;
        const { [questId]: _removedProgress, ...restProgress } = questProgress.progress;
        void _removedProgress;
        const updated: QuestProgress = { ...questProgress, accepted: rest, progress: restProgress };
        saveQuestProgress(updated);
        return updated;
    }, [questProgress, saveQuestProgress]);

    /** Add qualifying reps to quest progress. Returns the new total for that quest. */
    const addProgress = useCallback((questId: string, contribution: number): number => {
        const current = questProgress.progress[questId] ?? 0;
        const newTotal = current + contribution;
        const updated: QuestProgress = {
            ...questProgress,
            progress: { ...questProgress.progress, [questId]: newTotal },
        };
        saveQuestProgress(updated);
        return newTotal;
    }, [questProgress, saveQuestProgress]);

    return {
        questProgress,
        saveQuestProgress,
        completeQuest,
        completeQuests,
        acceptQuest,
        abandonQuest,
        addProgress,
    };
}
