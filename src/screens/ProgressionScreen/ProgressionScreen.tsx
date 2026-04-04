import { useMemo, useEffect, useRef } from 'react';
import { useAuthCore, useLevel } from '@hooks/useAuth';
import { useSessionHistory } from '@hooks/useSessionHistory';
import { useFriends } from '@hooks/useFriends';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { ACHIEVEMENTS_BY_CATEGORY } from '@domain/achievements';
import { computeLifetimeReps, countSGrades } from '@domain/achievementEngine';
import type { UserStats, AchievementMap, RecordsMap } from '@domain/achievementEngine';
import { emptyRecords } from '@domain/achievementEngine';
import { checkLiveAchievements } from '@services/achievementService';
import { getGuestStatsSnapshot } from '@services/guestStatsStore';
import { LevelsSection } from './LevelsSection/LevelsSection';
import { AchievementsGrid } from './AchievementsGrid/AchievementsGrid';
import { RecordsSection } from './RecordsSection/RecordsSection';
import './ProgressionScreen.scss';

interface ProgressionScreenProps {
    onClose: () => void;
}

export function ProgressionScreen({ onClose }: ProgressionScreenProps) {
    const { dbUser } = useAuthCore();
    const { level, xpIntoCurrentLevel, xpNeededForNextLevel, levelProgressPct, getExerciseLevelProgress } = useLevel();
    const { sessions, totalSessionCount } = useSessionHistory();
    const { friends } = useFriends();

    // Build user stats for achievement progress
    const guestSnapshot = useMemo(() => dbUser ? null : getGuestStatsSnapshot(), [dbUser]);
    const stats: UserStats = useMemo(() => {
        const lifetimeReps = dbUser?.lifetimeReps
            ?? guestSnapshot?.lifetimeReps
            ?? computeLifetimeReps(sessions);
        const lifetimeTrainingTime = dbUser?.lifetimeTrainingTime
            ?? guestSnapshot?.lifetimeTrainingTime
            ?? sessions.reduce((sum, s) => sum + (s.totalDuration ?? s.elapsedTime ?? 0), 0);
        return {
            lifetimeRepsByExercise: lifetimeReps,
            sessionRepsByExercise: {},
            totalSessions: totalSessionCount,
            bestStreak: dbUser?.bestStreak ?? guestSnapshot?.bestStreak ?? 0,
            friendsCount: friends.length,
            totalEncouragementsSent: dbUser?.totalEncouragementsSent ?? 0,
            sGradeCount: dbUser?.sGradeCount ?? guestSnapshot?.sGradeCount ?? countSGrades(sessions),
            sessionXp: 0,
            globalLevel: level,
            lifetimeTrainingTime,
            sessionDuration: 0,
        };
    }, [dbUser, guestSnapshot, sessions, totalSessionCount, friends.length, level]);

    const achievements: AchievementMap = useMemo(
        () => dbUser?.achievements ?? guestSnapshot?.achievements ?? {},
        [dbUser?.achievements, guestSnapshot?.achievements],
    );
    const records: RecordsMap = useMemo(
        () => dbUser?.records ?? guestSnapshot?.records ?? emptyRecords(),
        [dbUser?.records, guestSnapshot?.records],
    );

    // ── Evaluate live (non-session) achievements on mount / when stats change ──
    const liveCheckedRef = useRef('');
    useEffect(() => {
        const uid = dbUser?.uid;
        if (!uid) return;
        const fingerprint = `${stats.friendsCount}|${stats.totalEncouragementsSent}|${stats.globalLevel}|${Object.keys(achievements).length}`;
        if (liveCheckedRef.current === fingerprint) return;
        liveCheckedRef.current = fingerprint;

        checkLiveAchievements(uid, stats, { ...achievements });
    }, [dbUser?.uid, stats, achievements]);

    // Achievement stats
    const totalAchievements = Object.values(ACHIEVEMENTS_BY_CATEGORY).reduce((s, a) => s + a.length, 0);
    const unlockedCount = Object.keys(achievements).length;

    return (
        <PageLayout title="Progression" onClose={onClose} zIndex={200} bodyClassName="progression-body">
            <LevelsSection
                level={level}
                levelProgressPct={levelProgressPct}
                xpIntoCurrentLevel={xpIntoCurrentLevel}
                xpNeededForNextLevel={xpNeededForNextLevel}
                getExerciseLevelProgress={getExerciseLevelProgress}
            />
            <AchievementsGrid
                stats={stats}
                achievements={achievements}
                unlockedCount={unlockedCount}
                totalAchievements={totalAchievements}
            />
            <RecordsSection records={records} />
        </PageLayout>
    );
}
