import { useState } from 'react';
import { useAuth } from './useAuth';
import { useSyncCloud } from './useSyncCloud';

// ─── Pure level-formula functions (no React, importable anywhere) ─────────────

export function calculateLevelFromTotalReps(totalReps: number): number {
    if (totalReps <= 0) return 0;
    const n = (-1 + Math.sqrt(1 + 8 * totalReps)) / 2;
    return Math.floor(n);
}

export function calculateTotalRepsForLevel(level: number): number {
    return (level * (level + 1)) / 2;
}

// ─── Hook: derived level state, synced from Firestore via useSyncCloud ────────

const STORAGE_KEY = 'pushup_game_total_reps';

export function useLevelSystem() {
    const { user, dbUser } = useAuth();

    const [totalLifetimeReps, setTotalLifetimeReps] = useState<number>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? parseInt(stored, 10) : 0;
    });

    // Single cloud listener for totalReps — feeds all derived level values below
    const { addGuestReps } = useSyncCloud(setTotalLifetimeReps);

    // Level: read from Firestore (dbUser.level) for logged-in users so it always
    // matches the stored value. Calculated locally for guests.
    const level = user ? (dbUser?.level ?? calculateLevelFromTotalReps(totalLifetimeReps)) : calculateLevelFromTotalReps(totalLifetimeReps);
    const currentLevelBaseReps = calculateTotalRepsForLevel(level);
    const nextLevelTotalReq = calculateTotalRepsForLevel(level + 1);
    const repsIntoCurrentLevel = totalLifetimeReps - currentLevelBaseReps;
    const repsNeededForNextLevel = nextLevelTotalReq - currentLevelBaseReps;
    const levelProgressPct = (repsIntoCurrentLevel / repsNeededForNextLevel) * 100;

    return {
        totalLifetimeReps,
        level,
        repsIntoCurrentLevel,
        repsNeededForNextLevel,
        levelProgressPct,
        addGuestReps,
    };
}
