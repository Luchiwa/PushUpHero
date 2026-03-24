/**
 * achievements.ts
 *
 * Static registry of every achievement and record in PushUpHero.
 * Pure data — no React, no Firestore. Importable anywhere.
 *
 * @see ACHIEVEMENTS.md for the full design document.
 */

import type { ExerciseType } from '@exercises/types';
import { getExerciseLabel, EXERCISE_TYPES } from '@exercises/types';

// ─── Rarity tiers ────────────────────────────────────────────────────────────

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export const TIER_LABELS: Record<AchievementTier, string> = {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
};

export const TIER_COLORS: Record<AchievementTier, string> = {
    bronze: '#cd7f32',
    silver: '#c0c0c0',
    gold: '#ffd700',
    platinum: '#00e5ff',
};

// ─── Categories ──────────────────────────────────────────────────────────────

export type AchievementCategory = 'strength' | 'discipline' | 'social' | 'performance';

export const CATEGORY_META: Record<AchievementCategory, { label: string; emoji: string; color: string }> = {
    strength:    { label: 'Strength',    emoji: '🏋️', color: '#ef4444' },
    discipline:  { label: 'Discipline',  emoji: '📅',  color: '#3b82f6' },
    social:      { label: 'Social',      emoji: '👥',  color: '#f59e0b' },
    performance: { label: 'Performance', emoji: '⚡',  color: '#a855f7' },
};

// ─── Achievement definition ──────────────────────────────────────────────────

export interface AchievementDef {
    id: string;
    category: AchievementCategory;
    tier: AchievementTier;
    title: string;
    description: string;
    /** The stat key used to check progress (e.g. 'pushup_lifetime_reps', 'totalSessions', 'bestStreak') */
    statKey: string;
    /** Threshold value to unlock */
    threshold: number;
    /** Optional: exercise type (for per-exercise achievements) */
    exerciseType?: ExerciseType;
}

// ─── Helper builders ─────────────────────────────────────────────────────────

function lifetimeRepsAchievements(): AchievementDef[] {
    const tiers: { threshold: number; tier: AchievementTier }[] = [
        { threshold: 50,    tier: 'bronze' },
        { threshold: 100,   tier: 'bronze' },
        { threshold: 250,   tier: 'silver' },
        { threshold: 500,   tier: 'silver' },
        { threshold: 1000,  tier: 'gold' },
        { threshold: 2500,  tier: 'gold' },
        { threshold: 5000,  tier: 'platinum' },
        { threshold: 10000, tier: 'platinum' },
    ];
    return EXERCISE_TYPES.flatMap(ex =>
        tiers.map(({ threshold, tier }) => ({
            id: `${ex}_reps_${threshold}`,
            category: 'strength' as const,
            tier,
            title: `${threshold >= 1000 ? `${threshold / 1000}K` : threshold} ${getExerciseLabel(ex)}`,
            description: `Perform ${threshold.toLocaleString()} ${getExerciseLabel(ex).toLowerCase()} total`,
            statKey: `${ex}_lifetime_reps`,
            threshold,
            exerciseType: ex,
        })),
    );
}

function sessionRepsAchievements(): AchievementDef[] {
    const tiers: { threshold: number; tier: AchievementTier }[] = [
        { threshold: 10,  tier: 'bronze' },
        { threshold: 25,  tier: 'silver' },
        { threshold: 50,  tier: 'gold' },
        { threshold: 75,  tier: 'gold' },
        { threshold: 100, tier: 'platinum' },
    ];
    return EXERCISE_TYPES.flatMap(ex =>
        tiers.map(({ threshold, tier }) => ({
            id: `${ex}_session_${threshold}`,
            category: 'strength' as const,
            tier,
            title: `${threshold} ${getExerciseLabel(ex)} in one session`,
            description: `Complete ${threshold} ${getExerciseLabel(ex).toLowerCase()} in a single session`,
            statKey: `${ex}_session_reps`,
            threshold,
            exerciseType: ex,
        })),
    );
}

function sessionsCountAchievements(): AchievementDef[] {
    const tiers: { threshold: number; tier: AchievementTier; title: string }[] = [
        { threshold: 1,   tier: 'bronze',   title: 'First Sweat' },
        { threshold: 10,  tier: 'bronze',   title: 'Getting Started' },
        { threshold: 25,  tier: 'silver',   title: 'Regular' },
        { threshold: 50,  tier: 'silver',   title: 'Dedicated' },
        { threshold: 100, tier: 'gold',     title: 'Centurion' },
        { threshold: 250, tier: 'gold',     title: 'Machine' },
        { threshold: 500, tier: 'platinum', title: 'Living Legend' },
    ];
    return tiers.map(({ threshold, tier, title }) => ({
        id: `sessions_${threshold}`,
        category: 'discipline' as const,
        tier,
        title,
        description: `Complete ${threshold} workout session${threshold > 1 ? 's' : ''}`,
        statKey: 'totalSessions',
        threshold,
    }));
}

function streakAchievements(): AchievementDef[] {
    const tiers: { threshold: number; tier: AchievementTier; title: string }[] = [
        { threshold: 3,   tier: 'bronze',   title: 'Three-peat' },
        { threshold: 7,   tier: 'silver',   title: 'Full Week' },
        { threshold: 14,  tier: 'silver',   title: 'Fortnight' },
        { threshold: 30,  tier: 'gold',     title: 'Monthly Warrior' },
        { threshold: 60,  tier: 'gold',     title: 'Iron Will' },
        { threshold: 100, tier: 'platinum', title: 'Unstoppable' },
    ];
    return tiers.map(({ threshold, tier, title }) => ({
        id: `streak_${threshold}`,
        category: 'discipline' as const,
        tier,
        title,
        description: `Reach a ${threshold}-day streak`,
        statKey: 'bestStreak',
        threshold,
    }));
}

function friendsAchievements(): AchievementDef[] {
    const tiers: { threshold: number; tier: AchievementTier; title: string }[] = [
        { threshold: 1,  tier: 'bronze',   title: 'First Buddy' },
        { threshold: 5,  tier: 'silver',   title: 'Squad' },
        { threshold: 10, tier: 'gold',     title: 'Crew' },
        { threshold: 25, tier: 'platinum', title: 'Community Leader' },
    ];
    return tiers.map(({ threshold, tier, title }) => ({
        id: `friends_${threshold}`,
        category: 'social' as const,
        tier,
        title,
        description: `Have ${threshold} friend${threshold > 1 ? 's' : ''}`,
        statKey: 'friendsCount',
        threshold,
    }));
}

function encouragementsAchievements(): AchievementDef[] {
    const tiers: { threshold: number; tier: AchievementTier; title: string }[] = [
        { threshold: 1,   tier: 'bronze',   title: 'Cheerleader' },
        { threshold: 10,  tier: 'silver',   title: 'Motivator' },
        { threshold: 50,  tier: 'gold',     title: 'Hype Machine' },
        { threshold: 100, tier: 'platinum', title: 'Inspiration' },
    ];
    return tiers.map(({ threshold, tier, title }) => ({
        id: `encouragements_${threshold}`,
        category: 'social' as const,
        tier,
        title,
        description: `Send ${threshold} encouragement${threshold > 1 ? 's' : ''}`,
        statKey: 'totalEncouragementsSent',
        threshold,
    }));
}

function performanceAchievements(): AchievementDef[] {
    return [
        // Grade S
        { id: 'grade_s',    category: 'performance', tier: 'bronze', title: 'Perfectionist',         description: 'Get an S grade on a workout',       statKey: 'sGradeCount', threshold: 1 },
        { id: 'grade_s_10', category: 'performance', tier: 'silver', title: 'Consistent Excellence', description: 'Get S grade on 10 workouts',        statKey: 'sGradeCount', threshold: 10 },
        { id: 'grade_s_50', category: 'performance', tier: 'gold',   title: 'Master of Form',        description: 'Get S grade on 50 workouts',        statKey: 'sGradeCount', threshold: 50 },
        // XP in one session
        { id: 'xp_session_100',  category: 'performance', tier: 'bronze', title: 'XP Burst',   description: 'Earn 100+ XP in one session',   statKey: 'sessionXp', threshold: 100 },
        { id: 'xp_session_500',  category: 'performance', tier: 'silver', title: 'XP Storm',   description: 'Earn 500+ XP in one session',   statKey: 'sessionXp', threshold: 500 },
        { id: 'xp_session_1000', category: 'performance', tier: 'gold',   title: 'XP Tsunami', description: 'Earn 1,000+ XP in one session', statKey: 'sessionXp', threshold: 1000 },
        // Global level
        { id: 'level_5',  category: 'performance', tier: 'bronze',   title: 'Rising Star', description: 'Reach global level 5',  statKey: 'globalLevel', threshold: 5 },
        { id: 'level_10', category: 'performance', tier: 'silver',   title: 'Veteran',     description: 'Reach global level 10', statKey: 'globalLevel', threshold: 10 },
        { id: 'level_25', category: 'performance', tier: 'gold',     title: 'Elite',       description: 'Reach global level 25', statKey: 'globalLevel', threshold: 25 },
        { id: 'level_50', category: 'performance', tier: 'platinum', title: 'Legendary',   description: 'Reach global level 50', statKey: 'globalLevel', threshold: 50 },
    ];
}

// ─── Full registry ───────────────────────────────────────────────────────────

export const ACHIEVEMENTS: AchievementDef[] = [
    ...lifetimeRepsAchievements(),
    ...sessionRepsAchievements(),
    ...sessionsCountAchievements(),
    ...streakAchievements(),
    ...friendsAchievements(),
    ...encouragementsAchievements(),
    ...performanceAchievements(),
];

/** Fast lookup by ID */
export const ACHIEVEMENTS_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
    ACHIEVEMENTS.map(a => [a.id, a]),
);

/** Grouped by category (preserves insertion order) */
export const ACHIEVEMENTS_BY_CATEGORY: Record<AchievementCategory, AchievementDef[]> = {
    strength:    ACHIEVEMENTS.filter(a => a.category === 'strength'),
    discipline:  ACHIEVEMENTS.filter(a => a.category === 'discipline'),
    social:      ACHIEVEMENTS.filter(a => a.category === 'social'),
    performance: ACHIEVEMENTS.filter(a => a.category === 'performance'),
};

// ─── Records ─────────────────────────────────────────────────────────────────

export interface RecordDef {
    key: string;
    label: string;
    unit: string;
    emoji: string;
    /** If set, this record is per-exercise */
    exerciseType?: ExerciseType;
}

export const RECORDS: RecordDef[] = [
    // Per-exercise max reps in a session
    ...EXERCISE_TYPES.map(ex => ({
        key: `maxRepsInSession.${ex}`,
        label: `Best ${getExerciseLabel(ex)} in a session`,
        unit: 'reps',
        emoji: ex === 'pushup' ? '💪' : ex === 'squat' ? '🦵' : '🏋️',
        exerciseType: ex,
    })),
    // Global records
    { key: 'longestWorkout',    label: 'Longest Workout',         unit: 'time',  emoji: '⏱️' },
    { key: 'bestGrade',         label: 'Best Grade',              unit: 'score', emoji: '🎯' },
    { key: 'mostXpInSession',   label: 'Most XP in a Session',    unit: 'xp',    emoji: '✨' },
    { key: 'mostSessionsInWeek', label: 'Most Sessions in a Week', unit: 'count', emoji: '📆' },
    { key: 'longestStreak',     label: 'Longest Streak',          unit: 'days',  emoji: '🔥' },
];
