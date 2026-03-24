import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { saveSession } from '@lib/userService';
import { calculateSessionXp } from '@lib/xpSystem';
import type { BonusContext, SessionXpResult } from '@lib/xpSystem';
import { MAX_LOCAL_SESSIONS } from '@lib/constants';
import type { SetRecord, WorkoutBlock, ExerciseType } from '@exercises/types';

const STORAGE_KEY = 'pushup-sessions';
const STORAGE_TOTAL_KEY = 'pushup_game_total_sessions';

export interface SessionRecord {
    id: string;
    date: number;        // Unix timestamp (ms)
    reps: number;        // total reps across all sets (aggregate)
    averageScore: number;
    goalReps: number;
    sessionMode?: 'reps' | 'time';
    elapsedTime?: number;          // seconds — total duration
    exerciseType?: ExerciseType; // defaults to 'pushup' for legacy sessions

    // ── Multi-set fields ──
    numberOfSets?: number;         // configured sets count (1 = legacy single-set)
    restDuration?: number;         // configured rest between sets (seconds)
    sets?: SetRecord[];            // per-set breakdown
    totalDuration?: number;        // total workout duration including rest (seconds)

    // ── Multi-exercise fields ──
    /** Workout plan blocks (present when workout has multiple exercises) */
    blocks?: WorkoutBlock[];
    /** True when the workout contains more than one exercise type */
    isMultiExercise?: boolean;

    // ── XP fields ──
    xpEarned?: number;             // Total XP earned (after bonuses)
    xpRaw?: number;                // XP before bonuses
    xpMultiplier?: number;         // Multiplier applied
    xpBonuses?: { key: string; label: string; emoji: string; pct: number }[];
    xpPerExercise?: { exerciseType: string; rawXp: number; finalXp: number }[];
}

function saveLocalSessions(sessions: SessionRecord[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch { /* localStorage not available */ }
}

export function useSessionHistory() {
    const {
        user, dbUser, totalXp, exerciseXp,
        addGuestXp, sessions, setSessions, totalSessionCount, setTotalSessionCount,
    } = useAuth();

    /**
     * Save a completed session.
     * - Logged in: one atomic writeBatch (session + profile stats + activity feed)
     * - Guest: localStorage only
     *
     * @param bonusCtx - Context for XP bonus calculation
     * @returns The computed XP result for display on SummaryScreen
     */
    const addSession = useCallback(async (
        entry: Omit<SessionRecord, 'id' | 'date' | 'xpEarned' | 'xpRaw' | 'xpMultiplier' | 'xpBonuses' | 'xpPerExercise'>,
        bonusCtx: BonusContext,
    ): Promise<SessionXpResult> => {
        // Build sets for XP calculation — use per-set breakdown or fake a single set
        const setsForXp: SetRecord[] = entry.sets ?? [{
            reps: entry.reps,
            averageScore: entry.averageScore,
            repHistory: [],
            duration: entry.elapsedTime ?? 0,
            setMode: entry.sessionMode ?? 'reps',
            exerciseType: entry.exerciseType ?? 'pushup',
        }];

        // Calculate XP
        const xpResult = calculateSessionXp(setsForXp, bonusCtx);

        const newSession: SessionRecord = {
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            date: Date.now(),
            xpEarned: xpResult.totalXp,
            xpRaw: xpResult.rawXp,
            xpMultiplier: xpResult.multiplier,
            xpBonuses: xpResult.bonuses,
            xpPerExercise: xpResult.perExercise,
        };

        // Firestore rejects undefined values — remove optional fields if absent
        if (newSession.elapsedTime === undefined) delete newSession.elapsedTime;
        if (newSession.sessionMode === undefined) delete newSession.sessionMode;
        if (newSession.exerciseType === undefined) delete newSession.exerciseType;
        if (newSession.numberOfSets === undefined) delete newSession.numberOfSets;
        if (newSession.restDuration === undefined) delete newSession.restDuration;
        if (newSession.sets === undefined) delete newSession.sets;
        if (newSession.totalDuration === undefined) delete newSession.totalDuration;
        if (newSession.blocks === undefined) delete newSession.blocks;
        if (newSession.isMultiExercise === undefined) delete newSession.isMultiExercise;

        if (user) {
            await saveSession({
                uid: user.uid,
                session: newSession,
                currentTotalXp: totalXp,
                sessionXp: xpResult.totalXp,
                exerciseXpDeltas: xpResult.perExercise.map(e => ({
                    exerciseType: e.exerciseType,
                    xp: e.finalXp,
                })),
                currentExerciseXp: exerciseXp,
                dbUser,
            });
        } else {
            const updated = [newSession, ...sessions].slice(0, MAX_LOCAL_SESSIONS);
            setSessions(updated);
            saveLocalSessions(updated);
            const newCount = totalSessionCount + 1;
            setTotalSessionCount(newCount);
            localStorage.setItem(STORAGE_TOTAL_KEY, newCount.toString());
            addGuestXp(
                xpResult.totalXp,
                xpResult.perExercise.map(e => ({ exerciseType: e.exerciseType, xp: e.finalXp })),
            );
        }

        return xpResult;
    }, [user, dbUser, totalXp, exerciseXp, sessions, totalSessionCount, addGuestXp, setSessions, setTotalSessionCount]);

    return { sessions, addSession, totalSessionCount };
}