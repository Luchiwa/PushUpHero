import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';

// ─── Pure level-formula functions (no React, importable anywhere) ─────────────

export function calculateLevelFromTotalReps(totalReps: number): number {
    if (totalReps <= 0) return 0;
    const n = (-1 + Math.sqrt(1 + 8 * totalReps)) / 2;
    return Math.floor(n);
}

export function calculateTotalRepsForLevel(level: number): number {
    return (level * (level + 1)) / 2;
}

// ─── Hook: derived level state ─────────────────────────────────────────────────

const STORAGE_KEY = 'pushup_game_total_reps';

export function useLevelSystem() {
    const { user, dbUser } = useAuth();

    const [totalLifetimeReps, setTotalLifetimeRepsState] = useState<number>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? parseInt(stored, 10) : 0;
    });

    // Exposed so AppServices can wire useSyncCloud into this setter
    const setTotalLifetimeReps = useCallback((reps: number) => {
        setTotalLifetimeRepsState(reps);
    }, []);

    // For guest mode: update totalReps in state + localStorage atomically
    const addGuestReps = useCallback((repsToAdd: number) => {
        if (user) return;
        setTotalLifetimeRepsState(prev => {
            const next = prev + repsToAdd;
            localStorage.setItem(STORAGE_KEY, next.toString());
            return next;
        });
    }, [user]);

    const level = user ? (dbUser?.level ?? calculateLevelFromTotalReps(totalLifetimeReps)) : calculateLevelFromTotalReps(totalLifetimeReps);
    const currentLevelBaseReps = calculateTotalRepsForLevel(level);
    const nextLevelTotalReq = calculateTotalRepsForLevel(level + 1);
    const repsIntoCurrentLevel = totalLifetimeReps - currentLevelBaseReps;
    const repsNeededForNextLevel = nextLevelTotalReq - currentLevelBaseReps;
    const levelProgressPct = (repsIntoCurrentLevel / repsNeededForNextLevel) * 100;

    return {
        totalLifetimeReps,
        setTotalLifetimeReps,
        level,
        repsIntoCurrentLevel,
        repsNeededForNextLevel,
        levelProgressPct,
        addGuestReps,
    };
}
