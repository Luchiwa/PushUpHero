/**
 * useBodyProfile — Persists BodyProfile + QuestProgress in localStorage
 * and syncs to Firestore when logged in.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthCore } from './useAuth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@lib/firebase';
import type { BodyProfile } from '@lib/bodyProfile';
import { emptyBodyProfile, BODY_PROFILE_VERSION } from '@lib/bodyProfile';
import type { QuestProgress } from '@lib/quests';
import { emptyQuestProgress } from '@lib/quests';

const LS_PROFILE_KEY = 'pushup-hero-body-profile';
const LS_QUEST_KEY = 'pushup-hero-quest-progress';

function loadProfile(): BodyProfile {
    try {
        const raw = localStorage.getItem(LS_PROFILE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as BodyProfile;
            if (parsed.version === BODY_PROFILE_VERSION) return parsed;
        }
    } catch { /* corrupt data, ignore */ }
    return emptyBodyProfile();
}

function loadQuestProgress(): QuestProgress {
    try {
        const raw = localStorage.getItem(LS_QUEST_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as QuestProgress;
            // Ensure `accepted` exists (backwards compat with old data)
            if (!parsed.accepted) parsed.accepted = {};
            return parsed;
        }
    } catch { /* corrupt data, ignore */ }
    return emptyQuestProgress();
}

export function useBodyProfile() {
    const { user, dbUser } = useAuthCore();
    const [bodyProfile, setBodyProfileState] = useState<BodyProfile>(loadProfile);
    const [questProgress, setQuestProgressState] = useState<QuestProgress>(loadQuestProgress);
    const initialLoadDone = useRef(false);

    // Hydrate from Firestore on login (cloud takes priority)
    // If cloud is empty but local has data (guest → sign-up), push local to cloud.
    useEffect(() => {
        if (!dbUser || !user || initialLoadDone.current) return;
        initialLoadDone.current = true;

        const localProfile = loadProfile();
        const localQuests = loadQuestProgress();

        // ── Body Profile ──
        if (dbUser.bodyProfile && dbUser.bodyProfile.version === BODY_PROFILE_VERSION) {
            // Cloud has data → use cloud
            setBodyProfileState(dbUser.bodyProfile);
            localStorage.setItem(LS_PROFILE_KEY, JSON.stringify(dbUser.bodyProfile));
        } else if (localProfile.capturedAt > 0) {
            // Cloud empty, local has data (guest → sign-up) → push local to cloud
            const userRef = doc(db, 'users', user.uid);
            updateDoc(userRef, { bodyProfile: localProfile }).catch(console.error);
        }

        // ── Quest Progress ──
        if (dbUser.questProgress && Object.keys(dbUser.questProgress.completed ?? {}).length > 0) {
            // Cloud has data → use cloud
            const cloud = { ...dbUser.questProgress, accepted: dbUser.questProgress.accepted ?? {} };
            setQuestProgressState(cloud);
            localStorage.setItem(LS_QUEST_KEY, JSON.stringify(cloud));
        } else if (Object.keys(localQuests.completed).length > 0 || Object.keys(localQuests.accepted).length > 0) {
            // Cloud empty, local has data (guest → sign-up) → push local to cloud
            const userRef = doc(db, 'users', user.uid);
            updateDoc(userRef, { questProgress: localQuests }).catch(console.error);
        }
    }, [dbUser, user]);

    // Reset state + cloud sync flag on logout
    useEffect(() => {
        if (!user) {
            initialLoadDone.current = false;
            setBodyProfileState(emptyBodyProfile());
            setQuestProgressState(emptyQuestProgress());
        }
    }, [user]);

    const saveBodyProfile = useCallback((profile: BodyProfile) => {
        setBodyProfileState(profile);
        localStorage.setItem(LS_PROFILE_KEY, JSON.stringify(profile));

        // Sync to Firestore
        if (user) {
            const userRef = doc(db, 'users', user.uid);
            updateDoc(userRef, { bodyProfile: profile }).catch(console.error);
        }
    }, [user]);

    const saveQuestProgress = useCallback((progress: QuestProgress) => {
        setQuestProgressState(progress);
        localStorage.setItem(LS_QUEST_KEY, JSON.stringify(progress));

        // Sync to Firestore
        if (user) {
            const userRef = doc(db, 'users', user.uid);
            updateDoc(userRef, { questProgress: progress }).catch(console.error);
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

    return {
        bodyProfile,
        questProgress,
        saveBodyProfile,
        saveQuestProgress,
        completeQuest,
        completeQuests,
        acceptQuest,
    };
}
