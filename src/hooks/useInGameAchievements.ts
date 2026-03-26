/**
 * useInGameAchievements — Evaluates rep-based achievements in real time
 * during an active workout session. When a new achievement unlocks,
 * it's queued for the in-game toast overlay + a sound is played.
 *
 * Only checks achievements whose statKey is rep-based (session reps + lifetime reps),
 * since those are the only values that change mid-session.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { ExerciseType, ExerciseState } from '@exercises/types';
import type { AchievementDef } from '@lib/achievements';
import { ACHIEVEMENTS } from '@lib/achievements';
import type { AchievementMap } from '@lib/achievementEngine';
import { useAuthCore } from './useAuth';
import { playAchievementSound } from '@lib/soundEngine';
import { getGuestAchievements, getGuestLifetimeReps } from '@lib/guestStatsStore';

/** statKeys that change with every rep */
const LIVE_STAT_KEYS = new Set([
    'pushup_lifetime_reps', 'squat_lifetime_reps', 'pullup_lifetime_reps',
    'pushup_session_reps', 'squat_session_reps', 'pullup_session_reps',
]);

/** Achievements that CAN be unlocked mid-session */
const LIVE_ACHIEVEMENTS = ACHIEVEMENTS.filter(a => LIVE_STAT_KEYS.has(a.statKey));

interface UseInGameAchievementsProps {
    exerciseType: ExerciseType;
    exerciseState: ExerciseState;
    /** Total reps completed in previous sets/blocks of the current workout */
    completedSetsReps: number;
    isActive: boolean;
    soundEnabled: boolean;
}

export function useInGameAchievements({
    exerciseType,
    exerciseState,
    completedSetsReps,
    isActive,
    soundEnabled,
}: UseInGameAchievementsProps) {
    const { dbUser } = useAuthCore();
    const [queue, setQueue] = useState<AchievementDef[]>([]);

    // Track which achievements we've already surfaced this session to avoid duplicates
    const shownThisSessionRef = useRef<Set<string>>(new Set());
    const prevRepCountRef = useRef(0);

    // Reset when a new session starts
    useEffect(() => {
        if (isActive) {
            shownThisSessionRef.current = new Set();
            setQueue([]);
            prevRepCountRef.current = 0;
        }
    }, [isActive]);

    // Evaluate on every rep change
    useEffect(() => {
        if (!isActive) return;

        const currentReps = exerciseState.repCount;
        // Only evaluate when reps actually increase
        if (currentReps <= prevRepCountRef.current) return;
        prevRepCountRef.current = currentReps;

        const totalSessionReps = completedSetsReps + currentReps;

        // Build lifetime reps from either dbUser (logged in) or localStorage (guest)
        const lifetimeReps: Partial<Record<ExerciseType, number>> = dbUser
            ? { ...dbUser.lifetimeReps }
            : { ...getGuestLifetimeReps() };
        // Add current session reps to the lifetime count
        lifetimeReps[exerciseType] = (lifetimeReps[exerciseType] ?? 0) + totalSessionReps;

        const sessionRepsByExercise: Partial<Record<ExerciseType, number>> = {
            [exerciseType]: totalSessionReps,
        };

        // Build already-unlocked map from either dbUser or localStorage
        const alreadyUnlocked: AchievementMap = dbUser
            ? { ...dbUser.achievements }
            : { ...getGuestAchievements() };

        // Also mark achievements already shown this session as "unlocked" so we don't re-queue
        for (const id of shownThisSessionRef.current) {
            if (!alreadyUnlocked[id]) alreadyUnlocked[id] = Date.now();
        }

        const newlyUnlocked: AchievementDef[] = [];

        for (const ach of LIVE_ACHIEVEMENTS) {
            if (alreadyUnlocked[ach.id]) continue;

            let value = 0;
            switch (ach.statKey) {
                case 'pushup_lifetime_reps':  value = lifetimeReps.pushup ?? 0; break;
                case 'squat_lifetime_reps':   value = lifetimeReps.squat ?? 0; break;
                case 'pullup_lifetime_reps':  value = lifetimeReps.pullup ?? 0; break;
                case 'pushup_session_reps':   value = sessionRepsByExercise.pushup ?? 0; break;
                case 'squat_session_reps':    value = sessionRepsByExercise.squat ?? 0; break;
                case 'pullup_session_reps':   value = sessionRepsByExercise.pullup ?? 0; break;
            }

            if (value >= ach.threshold) {
                newlyUnlocked.push(ach);
                shownThisSessionRef.current.add(ach.id);
            }
        }

        if (newlyUnlocked.length > 0) {
            if (soundEnabled) playAchievementSound();
            setQueue(prev => [...prev, ...newlyUnlocked]);
        }
    }, [exerciseState.repCount, isActive, dbUser, exerciseType, completedSetsReps, soundEnabled]);

    /** Called by the toast queue when a toast finishes animating */
    const dismissFirst = useCallback(() => {
        setQueue(prev => prev.slice(1));
    }, []);

    return {
        /** The currently queued achievements (first one = currently displayed) */
        achievementQueue: queue,
        /** Call when the current toast is done animating */
        dismissFirst,
        /** Set of achievement IDs already shown in-game (to filter from SummaryScreen) */
        shownIdsRef: shownThisSessionRef,
    };
}
