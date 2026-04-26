import { useCallback } from 'react';
import { useAuthCore, useLevel, useSessions } from './useAuth';
import { saveSession, localDateString, yesterdayDateString } from '@services/sessionService';
import type { SaveSessionResult } from '@services/sessionService';
import { calculateSessionXp } from '@domain';
import type { BonusContext, SessionXpResult } from '@domain';
import { MAX_LOCAL_SESSIONS, getGradeLetter } from '@domain';
import type { SetRecord, ExerciseType, SessionRecord } from '@exercises/types';
import { evaluateAchievements, evaluateRecords, buildSessionRepsMap } from '@domain';
import type { AchievementMap, UserStats } from '@domain';
import {
    getGuestStatsSnapshot,
    setGuestAchievements,
    setGuestRecords,
    setGuestLifetimeReps,
    setGuestBestStreak,
    setGuestStreak,
    setGuestLastSessionDate,
    setGuestSGradeCount,
    setGuestLifetimeTrainingTime,
} from '@services/guestStatsStore';
import { write, STORAGE_KEYS } from '@infra/storage';

export function useSessionHistory() {
    const { user, dbUser } = useAuthCore();
    const { totalXp, exerciseXp, addGuestXp } = useLevel();
    const { sessions, setSessions, totalSessionCount, setTotalSessionCount } = useSessions();

    /**
     * Save a completed session.
     * - Logged in: one atomic writeBatch (session + profile stats + activity feed + achievements)
     * - Guest: localStorage only
     *
     * @param bonusCtx - Context for XP bonus calculation
     * @param friendsCount - Current number of friends (for social achievements)
     * @returns The computed XP result + newly unlocked achievements/records
     */
    const addSession = useCallback(async (
        entry: Omit<SessionRecord, 'id' | 'date' | 'xpEarned' | 'xpRaw' | 'xpMultiplier' | 'xpBonuses' | 'xpPerExercise'>,
        bonusCtx: BonusContext,
        friendsCount: number = 0,
    ): Promise<SessionXpResult & Partial<SaveSessionResult>> => {
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
            const allSessions = [newSession, ...sessions];
            const { newAchievements, brokenRecords } = await saveSession({
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
                allSessions,
                friendsCount,
                currentTotalSessions: totalSessionCount,
            });
            return { ...xpResult, newAchievements, brokenRecords };
        } else {
            const updated = [newSession, ...sessions].slice(0, MAX_LOCAL_SESSIONS);
            setSessions(updated);
            write(STORAGE_KEYS.sessions, updated);
            const newCount = totalSessionCount + 1;
            setTotalSessionCount(newCount);
            write(STORAGE_KEYS.totalSessions, newCount);
            addGuestXp(
                xpResult.totalXp,
                xpResult.perExercise.map(e => ({ exerciseType: e.exerciseType, xp: e.finalXp })),
            );

            // ── Guest achievement & record evaluation ────────────────────
            const guest = getGuestStatsSnapshot();

            // Build session reps map
            const sessionRepsMap = buildSessionRepsMap(newSession);

            // Update lifetime reps
            const newLifetimeReps = { ...guest.lifetimeReps };
            for (const [ex, reps] of Object.entries(sessionRepsMap)) {
                newLifetimeReps[ex as ExerciseType] = (newLifetimeReps[ex as ExerciseType] ?? 0) + reps;
            }

            // Streak
            const todayLocal = localDateString();
            let newStreak: number;
            if (guest.lastSessionDate === todayLocal) {
                newStreak = guest.streak;
            } else if (guest.lastSessionDate === yesterdayDateString()) {
                newStreak = guest.streak + 1;
            } else {
                newStreak = 1;
            }
            const newBestStreak = Math.max(guest.bestStreak, newStreak);

            // S-grade count
            const isS = getGradeLetter(newSession.averageScore) === 'S';
            const newSGradeCount = guest.sGradeCount + (isS ? 1 : 0);

            // Training time
            const sessionDuration = newSession.totalDuration ?? newSession.elapsedTime ?? 0;
            const newTrainingTime = guest.lifetimeTrainingTime + sessionDuration;

            // Evaluate achievements
            const currentAchievements: AchievementMap = { ...guest.achievements };
            const stats: UserStats = {
                lifetimeRepsByExercise: newLifetimeReps,
                sessionRepsByExercise: sessionRepsMap,
                totalSessions: newCount,
                bestStreak: newBestStreak,
                friendsCount: 0,
                totalEncouragementsSent: 0,
                sGradeCount: newSGradeCount,
                sessionXp: newSession.xpEarned ?? 0,
                globalLevel: 0,
                lifetimeTrainingTime: newTrainingTime,
                sessionDuration,
            };
            const newAchievements = evaluateAchievements(stats, currentAchievements);

            // Evaluate records
            const { records: updatedRecords, broken: brokenRecords } = evaluateRecords(
                guest.records, newSession, updated, newBestStreak,
            );

            // Persist guest stats to localStorage
            setGuestAchievements(currentAchievements); // mutated in-place by evaluateAchievements
            setGuestRecords(updatedRecords);
            setGuestLifetimeReps(newLifetimeReps);
            setGuestStreak(newStreak);
            setGuestBestStreak(newBestStreak);
            setGuestLastSessionDate(todayLocal);
            setGuestSGradeCount(newSGradeCount);
            setGuestLifetimeTrainingTime(newTrainingTime);

            return { ...xpResult, newAchievements, brokenRecords };
        }
    }, [user, dbUser, totalXp, exerciseXp, sessions, totalSessionCount, addGuestXp, setSessions, setTotalSessionCount]);

    return { sessions, addSession, totalSessionCount };
}