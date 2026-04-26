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
import type { AchievementDef } from '@domain/achievements';
import { ACHIEVEMENTS } from '@domain/achievements';
import type { AchievementMap, UserStats } from '@domain/achievementEngine';
import { getStatValue, isLiveStatKey } from '@domain/achievementEngine';
import { useAuthCore } from './useAuth';
import { playAchievementSound } from '@infra/soundEngine';
import { getGuestAchievements, getGuestLifetimeReps } from '@services/guestStatsStore';

/** Achievements that CAN be unlocked mid-session (rep-based stat keys). */
const LIVE_ACHIEVEMENTS = ACHIEVEMENTS.filter(a => isLiveStatKey(a.statKey));

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
    const [shownIds, setShownIds] = useState<Set<string>>(new Set());
    const [prevActive, setPrevActive] = useState(false);
    const [prevEvalRepCount, setPrevEvalRepCount] = useState(0);
    const [soundTrigger, setSoundTrigger] = useState(0);

    // Reset when a new session starts (derived state during render)
    if (isActive && !prevActive) {
        setPrevActive(true);
        setQueue([]);
        setShownIds(new Set());
        setPrevEvalRepCount(0);
        setSoundTrigger(0);
    }
    if (!isActive && prevActive) {
        setPrevActive(false);
    }

    // Evaluate on every rep increase (derived state during render)
    if (isActive && exerciseState.repCount > prevEvalRepCount) {
        setPrevEvalRepCount(exerciseState.repCount);

        const totalSessionReps = completedSetsReps + exerciseState.repCount;

        // Build lifetime reps from either dbUser (logged in) or localStorage (guest)
        const lifetimeReps: Partial<Record<ExerciseType, number>> = dbUser
            ? { ...dbUser.progression.lifetimeReps }
            : { ...getGuestLifetimeReps() };
        lifetimeReps[exerciseType] = (lifetimeReps[exerciseType] ?? 0) + totalSessionReps;

        const stats: UserStats = {
            lifetimeRepsByExercise: lifetimeReps,
            sessionRepsByExercise: { [exerciseType]: totalSessionReps },
            totalSessions: 0, bestStreak: 0, friendsCount: 0,
            totalEncouragementsSent: 0, sGradeCount: 0, sessionXp: 0,
            globalLevel: 0, lifetimeTrainingTime: 0, sessionDuration: 0,
        };

        // Build already-unlocked map from either dbUser or localStorage
        const alreadyUnlocked: AchievementMap = dbUser
            ? { ...dbUser.achievements }
            : { ...getGuestAchievements() };

        // Also mark achievements already shown this session as "unlocked" so we don't re-queue
        for (const id of shownIds) {
            if (!alreadyUnlocked[id]) alreadyUnlocked[id] = 1;
        }

        const newlyUnlocked: AchievementDef[] = [];

        for (const ach of LIVE_ACHIEVEMENTS) {
            if (alreadyUnlocked[ach.id]) continue;
            if (getStatValue(stats, ach) >= ach.threshold) {
                newlyUnlocked.push(ach);
            }
        }

        if (newlyUnlocked.length > 0) {
            const newShown = new Set(shownIds);
            for (const a of newlyUnlocked) newShown.add(a.id);
            setShownIds(newShown);
            setQueue(prev => [...prev, ...newlyUnlocked]);
            setSoundTrigger(c => c + 1);
        }
    }

    // Play achievement sound (external side effect, no setState)
    const prevSoundTriggerRef = useRef(0);
    useEffect(() => {
        if (soundTrigger > prevSoundTriggerRef.current && soundEnabled) {
            playAchievementSound();
        }
        prevSoundTriggerRef.current = soundTrigger;
    }, [soundTrigger, soundEnabled]);

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
        shownIds,
    };
}
