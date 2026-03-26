/**
 * ProgressionScreen
 *
 * Full-screen page showing the user's progression:
 * - Global & per-exercise levels with XP bars
 * - Achievements grid (grouped by category, locked ones greyed with progress)
 * - Personal records cards
 */
import { useMemo, useEffect, useRef } from 'react';
import { useAuthCore, useLevel } from '@hooks/useAuth';
import { useSessionHistory } from '@hooks/useSessionHistory';
import { useFriends } from '@hooks/useFriends';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { ACHIEVEMENTS_BY_CATEGORY, CATEGORY_META, TIER_COLORS, RECORDS } from '@lib/achievements';
import type { AchievementCategory, AchievementDef } from '@lib/achievements';
import { getAchievementProgress, computeLifetimeReps, countSGrades } from '@lib/achievementEngine';
import type { UserStats, AchievementMap, RecordsMap } from '@lib/achievementEngine';
import { emptyRecords } from '@lib/achievementEngine';
import { checkLiveAchievements } from '@lib/userService';
import { getGuestStatsSnapshot } from '@lib/guestStatsStore';
import { getExerciseLabel, EXERCISE_TYPES, EXERCISE_META } from '@exercises/types';
import type { ExerciseType } from '@exercises/types';
import { formatElapsedTime, getGradeLetter } from '@lib/constants';
import './ProgressionScreen.scss';

interface ProgressionScreenProps {
    onClose: () => void;
}

const EXERCISE_EMOJIS: Record<ExerciseType, string> = Object.fromEntries(
    EXERCISE_META.map(m => [m.type, m.emoji]),
) as Record<ExerciseType, string>;

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
            sessionRepsByExercise: {}, // Not relevant for progression screen (no active session)
            totalSessions: totalSessionCount,
            bestStreak: dbUser?.bestStreak ?? guestSnapshot?.bestStreak ?? 0,
            friendsCount: friends.length,
            totalEncouragementsSent: dbUser?.totalEncouragementsSent ?? 0,
            sGradeCount: dbUser?.sGradeCount ?? guestSnapshot?.sGradeCount ?? countSGrades(sessions),
            sessionXp: 0,
            globalLevel: level,
            lifetimeTrainingTime,
        };
    }, [dbUser, guestSnapshot, sessions, totalSessionCount, friends.length, level]);

    const achievements: AchievementMap = dbUser?.achievements ?? guestSnapshot?.achievements ?? {};
    const records: RecordsMap = dbUser?.records ?? guestSnapshot?.records ?? emptyRecords();

    // ── Evaluate live (non-session) achievements on mount / when stats change ──
    const liveCheckedRef = useRef('');
    useEffect(() => {
        const uid = dbUser?.uid;
        if (!uid) return;
        // Build a fingerprint so we only re-check when relevant stats change
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
            {/* ── Levels section ──────────────────────────────────────── */}
            <section className="progression-section">
                <h3 className="progression-section-title">🎮 Levels</h3>

                {/* Global level */}
                <div className="level-card level-card--global">
                    <div className="level-card-header">
                        <span className="level-card-label">Global Level</span>
                        <span className="level-card-level">{level}</span>
                    </div>
                    <div className="level-progress-bar">
                        <div className="level-progress-fill" style={{ width: `${levelProgressPct}%` }} />
                    </div>
                    <span className="level-progress-text">
                        {xpIntoCurrentLevel.toLocaleString()} / {xpNeededForNextLevel.toLocaleString()} XP
                    </span>
                </div>

                {/* Per-exercise levels */}
                <div className="level-cards-grid">
                    {EXERCISE_TYPES.map(ex => {
                        const prog = getExerciseLevelProgress(ex);
                        return (
                            <div key={ex} className="level-card level-card--exercise">
                                <div className="level-card-header">
                                    <span className="level-card-emoji">{EXERCISE_EMOJIS[ex]}</span>
                                    <span className="level-card-label">{getExerciseLabel(ex)}</span>
                                    <span className="level-card-level">{prog.level}</span>
                                </div>
                                <div className="level-progress-bar">
                                    <div className="level-progress-fill" style={{ width: `${prog.progressPct}%` }} />
                                </div>
                                <span className="level-progress-text">
                                    {prog.xpIntoLevel.toLocaleString()} / {prog.xpNeeded.toLocaleString()} XP
                                </span>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── Achievements section ────────────────────────────────── */}
            <section className="progression-section">
                <div className="progression-section-header">
                    <h3 className="progression-section-title">🏆 Achievements</h3>
                    <span className="progression-section-count">{unlockedCount}/{totalAchievements}</span>
                </div>

                {(Object.entries(ACHIEVEMENTS_BY_CATEGORY) as [AchievementCategory, AchievementDef[]][]).map(
                    ([category, defs]) => {
                        const meta = CATEGORY_META[category];
                        const categoryUnlocked = defs.filter(a => achievements[a.id]).length;
                        return (
                            <div key={category} className="achievement-category">
                                <div className="achievement-category-header">
                                    <span className="achievement-category-emoji">{meta.emoji}</span>
                                    <span className="achievement-category-label">{meta.label}</span>
                                    <span className="achievement-category-count">{categoryUnlocked}/{defs.length}</span>
                                </div>
                                <div className="achievement-grid">
                                    {defs.map(ach => {
                                        const prog = getAchievementProgress(ach, stats, achievements);
                                        return (
                                            <div
                                                key={ach.id}
                                                className={`achievement-badge ${prog.unlocked ? 'achievement-badge--unlocked' : 'achievement-badge--locked'}`}
                                            >
                                                <div
                                                    className="achievement-badge-ring"
                                                    style={{
                                                        borderColor: prog.unlocked ? TIER_COLORS[ach.tier] : undefined,
                                                    }}
                                                >
                                                    <span className="achievement-badge-tier">{tierEmoji(ach.tier)}</span>
                                                </div>
                                                <span className="achievement-badge-title">{ach.title}</span>
                                                {!prog.unlocked && (
                                                    <div className="achievement-badge-progress">
                                                        <div className="achievement-badge-bar">
                                                            <div
                                                                className="achievement-badge-bar-fill"
                                                                style={{ width: `${prog.progressPct}%` }}
                                                            />
                                                        </div>
                                                        <span className="achievement-badge-progress-text">
                                                            {prog.current}/{ach.threshold}
                                                        </span>
                                                    </div>
                                                )}
                                                {prog.unlocked && prog.unlockedAt && (
                                                    <span className="achievement-badge-date">
                                                        {new Date(prog.unlockedAt).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    },
                )}
            </section>

            {/* ── Records section ─────────────────────────────────────── */}
            <section className="progression-section">
                <h3 className="progression-section-title">📊 Records</h3>
                <div className="records-grid">
                    {RECORDS.map(rec => {
                        const value = getRecordValue(records, rec.key);
                        return (
                            <div key={rec.key} className={`record-card ${value !== null ? '' : 'record-card--empty'}`}>
                                <span className="record-card-emoji">{rec.emoji}</span>
                                <span className="record-card-label">{rec.label}</span>
                                <span className="record-card-value">
                                    {value !== null ? formatRecordValue(value, rec.unit) : '—'}
                                </span>
                                {value !== null && (() => {
                                    const d = getRecordDate(records, rec.key);
                                    return d ? (
                                        <span className="record-card-date">
                                            {new Date(d).toLocaleDateString()}
                                        </span>
                                    ) : null;
                                })()}
                            </div>
                        );
                    })}
                </div>
            </section>
        </PageLayout>
    );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function tierEmoji(tier: string): string {
    switch (tier) {
        case 'bronze': return '🥉';
        case 'silver': return '🥈';
        case 'gold': return '🥇';
        case 'platinum': return '💎';
        default: return '🏅';
    }
}

function getRecordValue(records: RecordsMap, key: string): number | null {
    if (key.startsWith('maxRepsInSession.')) {
        const ex = key.split('.')[1] as ExerciseType;
        return records.maxRepsInSession[ex]?.value ?? null;
    }
    const rec = records[key as keyof RecordsMap];
    if (!rec) return null;
    if (typeof rec === 'object' && 'value' in rec) return rec.value;
    return null;
}

function getRecordDate(records: RecordsMap, key: string): number | null {
    if (key.startsWith('maxRepsInSession.')) {
        const ex = key.split('.')[1] as ExerciseType;
        return records.maxRepsInSession[ex]?.date ?? null;
    }
    const rec = records[key as keyof RecordsMap];
    if (!rec) return null;
    if (typeof rec === 'object' && 'date' in rec) return rec.date;
    return null;
}

function formatRecordValue(value: number, unit: string): string {
    switch (unit) {
        case 'time': return formatElapsedTime(value) || '0s';
        case 'score': {
            const grade = getGradeLetter(value);
            return `${grade} (${Math.round(value)}%)`;
        }
        case 'xp': return `${value.toLocaleString()} XP`;
        case 'days': return `${value} day${value > 1 ? 's' : ''}`;
        case 'reps': return value.toLocaleString();
        case 'count': return value.toString();
        default: return value.toString();
    }
}
