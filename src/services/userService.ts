/**
 * userService.ts
 *
 * Guest data merge — merges local guest sessions into Firestore on first login.
 */

import {
    writeBatch,
} from 'firebase/firestore';
import { db } from '@infra/firebase';
import { userRef, sessionRef } from '@infra/refs';
import { levelFromTotalXp } from '@domain/xpSystem';
import type { SessionRecord } from '@exercises/types';
import type { ExerciseType } from '@exercises/types';
import { evaluateAchievements, emptyRecords, computeLifetimeReps, countSGrades, bulkEvaluateRecords } from '@domain/achievementEngine';
import type { UserStats, AchievementMap } from '@domain/achievementEngine';
import type { GuestStatsSnapshot } from './guestStatsStore';
import { localDateString, yesterdayDateString } from './sessionService';
import type { UserId, XpAmount, Level } from '@domain/brands';
import { createXpAmount } from '@domain/brands';

// ─── Merge local guest data into Firestore on first login ────────────────────

export interface MergeLocalDataParams {
    uid: UserId;
    localXp: XpAmount;
    localExerciseXp: Partial<Record<string, number>>;
    localSessions: SessionRecord[];
    cloudXp: XpAmount;
    cloudSessions: number;
    cloudExerciseXp: Partial<Record<string, number>>;
    /** Guest achievement stats accumulated while playing without an account */
    guestStats?: GuestStatsSnapshot;
}

export async function mergeLocalDataToCloud({
    uid,
    localXp,
    localExerciseXp,
    localSessions,
    cloudXp,
    cloudSessions,
    cloudExerciseXp,
    guestStats,
}: MergeLocalDataParams): Promise<void> {
    const batch = writeBatch(db);

    const newTotalXp = createXpAmount(cloudXp + localXp);
    const newLevel: Level = levelFromTotalXp(newTotalXp);

    // Merge per-exercise XP
    const mergedExerciseXp: Record<string, number> = {};
    for (const [type, xp] of Object.entries(cloudExerciseXp)) {
        if (xp !== undefined) mergedExerciseXp[type] = xp;
    }
    for (const [type, xp] of Object.entries(localExerciseXp)) {
        mergedExerciseXp[type] = (mergedExerciseXp[type] ?? 0) + (xp ?? 0);
    }
    const mergedExerciseLevels: Record<string, number> = {};
    for (const [type, xp] of Object.entries(mergedExerciseXp)) {
        mergedExerciseLevels[type] = levelFromTotalXp(createXpAmount(xp ?? 0));
    }

    // ── Compute streak from local sessions ─────────────────────────────────
    const profileUpdate: Record<string, unknown> = {
        totalXp: newTotalXp,
        totalSessions: cloudSessions + localSessions.length,
        level: newLevel,
        exerciseXp: mergedExerciseXp,
        exerciseLevels: mergedExerciseLevels,
    };

    if (localSessions.length > 0) {
        const todayLocal = localDateString();
        const yesterdayLocal = yesterdayDateString();

        // Sort sessions newest-first and get their local date strings
        const sortedDates = [...localSessions]
            .sort((a, b) => b.date - a.date)
            .map(s => localDateString(new Date(s.date)));

        const mostRecentDate = sortedDates[0];

        // Only grant streak if the most recent session was today or yesterday
        if (mostRecentDate === todayLocal || mostRecentDate === yesterdayLocal) {
            // Count consecutive unique days starting from mostRecentDate
            const uniqueDays = [...new Set(sortedDates)];
            let streak = 0;
            let expected = mostRecentDate;
            for (const day of uniqueDays) {
                if (day === expected) {
                    streak++;
                    const d = new Date(expected);
                    d.setDate(d.getDate() - 1);
                    expected = localDateString(d);
                } else {
                    break;
                }
            }
            profileUpdate.streak = streak;
            profileUpdate.bestStreak = streak;
            profileUpdate.lastSessionDate = mostRecentDate;
        }
    }

    // ── Bulk-evaluate achievements & records from merged sessions ────────
    const newTotalSessions = cloudSessions + localSessions.length;
    const lifetimeReps = computeLifetimeReps(localSessions);
    const sGradeCount = countSGrades(localSessions);
    const bestStreak = (profileUpdate.bestStreak as number) ?? 0;

    // Find max XP and max duration earned in any single session
    let maxSessionXp = 0;
    let maxSessionDuration = 0;
    for (const s of localSessions) {
        if ((s.xpEarned ?? 0) > maxSessionXp) maxSessionXp = s.xpEarned ?? 0;
        const dur = s.totalDuration ?? s.elapsedTime ?? 0;
        if (dur > maxSessionDuration) maxSessionDuration = dur;
    }

    // Compute total training time from local sessions
    const totalTrainingTime = localSessions.reduce(
        (sum, s) => sum + (s.totalDuration ?? s.elapsedTime ?? 0), 0,
    );

    // Seed achievement map with guest-tracked achievements (keeps earliest unlock timestamp)
    const achievementMap: AchievementMap = {};
    if (guestStats?.achievements) {
        for (const [id, ts] of Object.entries(guestStats.achievements)) {
            achievementMap[id] = ts;
        }
    }

    const stats: UserStats = {
        lifetimeRepsByExercise: lifetimeReps,
        sessionRepsByExercise: {}, // Will check per-session below
        totalSessions: newTotalSessions,
        bestStreak,
        friendsCount: 0, // No friends context during merge
        totalEncouragementsSent: 0,
        sGradeCount,
        sessionXp: maxSessionXp,
        globalLevel: newLevel,
        lifetimeTrainingTime: totalTrainingTime,
        sessionDuration: maxSessionDuration,
    };

    // Check single-session achievements by finding max reps per exercise across all sessions
    for (const s of localSessions) {
        const ex = (s.exerciseType ?? 'pushup') as ExerciseType;
        const currentMax = stats.sessionRepsByExercise[ex] ?? 0;
        if (s.reps > currentMax) {
            stats.sessionRepsByExercise[ex] = s.reps;
        }
    }

    evaluateAchievements(stats, achievementMap);

    // Seed records from guest stats, then bulk-evaluate from sessions on top
    const guestRecords = guestStats?.records ?? emptyRecords();
    const records = bulkEvaluateRecords(localSessions, bestStreak, guestRecords);

    profileUpdate.lifetimeReps = lifetimeReps;
    profileUpdate.sGradeCount = sGradeCount;
    profileUpdate.lifetimeTrainingTime = totalTrainingTime;
    profileUpdate.achievements = achievementMap;
    profileUpdate.records = records;

    batch.set(userRef(uid), profileUpdate, { merge: true });

    localSessions.forEach(session => {
        batch.set(sessionRef(uid, session.id), session);
    });

    await batch.commit();
}
