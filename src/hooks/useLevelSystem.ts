import { useState, useCallback } from 'react';
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from '@lib/firebase';
import { useAuth } from './useAuth';
import { useSyncCloud } from './useSyncCloud';

// The formula for total reps required to reach a specific level:
export function calculateLevelFromTotalReps(totalReps: number): number {
    if (totalReps <= 0) return 0;
    const n = (-1 + Math.sqrt(1 + 8 * totalReps)) / 2;
    return Math.floor(n);
}

export function calculateTotalRepsForLevel(level: number): number {
    return (level * (level + 1)) / 2;
}

const STORAGE_KEY = 'pushup_game_total_reps';

export function useLevelSystem() {
    const { user } = useAuth();

    // Internal state that holds EITHER local reps or cloud reps
    const [totalLifetimeReps, setTotalLifetimeReps] = useState<number>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? parseInt(stored, 10) : 0;
    });

    // Cloud listener
    useSyncCloud(
        setTotalLifetimeReps,
        undefined
    );

    const level = calculateLevelFromTotalReps(totalLifetimeReps);
    const currentLevelBaseReps = calculateTotalRepsForLevel(level);
    const nextLevelTotalReq = calculateTotalRepsForLevel(level + 1);

    // Progress within the current level
    const repsIntoCurrentLevel = totalLifetimeReps - currentLevelBaseReps;
    const repsNeededForNextLevel = nextLevelTotalReq - currentLevelBaseReps;
    const levelProgressPct = (repsIntoCurrentLevel / repsNeededForNextLevel) * 100;

    const addRepsToLifetime = useCallback(async (repsToAdd: number) => {
        if (user) {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { totalReps: increment(repsToAdd) });
            // Re-read to get the accurate updated total, then persist the computed level
            const snap = await getDoc(userRef);
            if (snap.exists()) {
                const data = snap.data();
                const updatedTotal = data.totalReps as number;
                const updatedLevel = calculateLevelFromTotalReps(updatedTotal);

                // ── Streak logic (local calendar days) ───────────────
                const now = new Date();
                const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const lastDate: string | undefined = data.lastSessionDate;

                let newStreak: number;
                if (lastDate === todayLocal) {
                    // Already logged a session today — keep streak unchanged
                    newStreak = data.streak ?? 1;
                } else if (lastDate) {
                    // Check if lastDate was exactly yesterday (local time)
                    const yesterday = new Date(now);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayLocal = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
                    newStreak = lastDate === yesterdayLocal ? (data.streak ?? 0) + 1 : 1;
                } else {
                    newStreak = 1;
                }

                await updateDoc(userRef, {
                    level: updatedLevel,
                    streak: newStreak,
                    lastSessionDate: todayLocal,
                });
            }
        } else {
            // Write to Local State
            setTotalLifetimeReps(prev => {
                const nextReps = prev + repsToAdd;
                localStorage.setItem(STORAGE_KEY, nextReps.toString());
                return nextReps;
            });
        }
    }, [user]);

    return {
        level,
        totalLifetimeReps,
        repsIntoCurrentLevel,
        repsNeededForNextLevel,
        levelProgressPct,
        addRepsToLifetime,
    };
}
