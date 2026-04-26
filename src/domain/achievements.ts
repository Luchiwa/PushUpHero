/**
 * achievements.ts
 *
 * Static registry of every achievement and record in PushUpHero.
 * Pure data — no React, no Firestore. Importable anywhere.
 *
 * Display strings live in the i18n bundles (`stats.json` →
 * `stats.achievements.*` and `stats.records.*`). Each def carries the
 * i18next `titleKey` / `descriptionKey` (or `labelKey` for records) and
 * optional interpolation params. Resolve via `getAchievementTitle()` /
 * `getAchievementDescription()` / `getRecordLabel()`.
 *
 * @see ACHIEVEMENTS.md for the full design document.
 */

import type { TFunction } from 'i18next';
import { EXERCISE_TYPES, getExerciseEmoji, getExerciseLabelKey, type ExerciseType } from '@exercises/types';

// ─── Rarity tiers ────────────────────────────────────────────────────────────

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

// Keep in sync with $tier-* in _variables.scss (Arena palette)
export const TIER_COLORS: Record<AchievementTier, string> = {
    bronze: 'var(--tier-bronze)',
    silver: 'var(--tier-silver)',
    gold: 'var(--tier-gold)',
    platinum: 'var(--tier-platinum)',
};

// ─── Categories ──────────────────────────────────────────────────────────────

export type AchievementCategory = 'strength' | 'discipline' | 'social' | 'performance';

// Keep in sync with Arena semantic tokens on :root.
export const CATEGORY_META: Record<AchievementCategory, { labelKey: string; emoji: string; color: string }> = {
    strength:    { labelKey: 'stats:achievements.category.strength',    emoji: '🏋️', color: 'var(--blood)' },
    discipline:  { labelKey: 'stats:achievements.category.discipline',  emoji: '📅',  color: 'var(--good)' },
    social:      { labelKey: 'stats:achievements.category.social',      emoji: '👥',  color: 'var(--ice)' },
    performance: { labelKey: 'stats:achievements.category.performance', emoji: '⚡',  color: 'var(--purple)' },
};

// ─── Achievement definition ──────────────────────────────────────────────────

export interface AchievementDef {
    id: string;
    category: AchievementCategory;
    tier: AchievementTier;
    /** i18next key for the display title. Resolve via `getAchievementTitle(def, t)`. */
    titleKey: string;
    /** i18next key for the description. Resolve via `getAchievementDescription(def, t)`. */
    descriptionKey: string;
    /** Optional interpolation values for the title key. */
    titleParams?: Record<string, string | number>;
    /** Optional interpolation values for the description key. */
    descriptionParams?: Record<string, string | number>;
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
            titleKey: 'stats:achievements.lifetime_reps.title',
            titleParams: { count: threshold >= 1000 ? `${threshold / 1000}K` : `${threshold}` },
            descriptionKey: 'stats:achievements.lifetime_reps.description',
            descriptionParams: { count: threshold },
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
            titleKey: 'stats:achievements.session_reps.title',
            titleParams: { count: threshold },
            descriptionKey: 'stats:achievements.session_reps.description',
            descriptionParams: { count: threshold },
            statKey: `${ex}_session_reps`,
            threshold,
            exerciseType: ex,
        })),
    );
}

function byIdDef(id: string, category: AchievementCategory, tier: AchievementTier, statKey: string, threshold: number): AchievementDef {
    return {
        id,
        category,
        tier,
        titleKey: `stats:achievements.by_id.${id}.title`,
        descriptionKey: `stats:achievements.by_id.${id}.description`,
        statKey,
        threshold,
    };
}

function sessionsCountAchievements(): AchievementDef[] {
    const tiers: { threshold: number; tier: AchievementTier }[] = [
        { threshold: 1,   tier: 'bronze' },
        { threshold: 10,  tier: 'bronze' },
        { threshold: 25,  tier: 'silver' },
        { threshold: 50,  tier: 'silver' },
        { threshold: 100, tier: 'gold' },
        { threshold: 250, tier: 'gold' },
        { threshold: 500, tier: 'platinum' },
    ];
    return tiers.map(({ threshold, tier }) =>
        byIdDef(`sessions_${threshold}`, 'discipline', tier, 'totalSessions', threshold),
    );
}

function streakAchievements(): AchievementDef[] {
    const tiers: { threshold: number; tier: AchievementTier }[] = [
        { threshold: 3,   tier: 'bronze' },
        { threshold: 7,   tier: 'silver' },
        { threshold: 14,  tier: 'silver' },
        { threshold: 30,  tier: 'gold' },
        { threshold: 60,  tier: 'gold' },
        { threshold: 100, tier: 'platinum' },
    ];
    return tiers.map(({ threshold, tier }) =>
        byIdDef(`streak_${threshold}`, 'discipline', tier, 'bestStreak', threshold),
    );
}

function friendsAchievements(): AchievementDef[] {
    const tiers: { threshold: number; tier: AchievementTier }[] = [
        { threshold: 1,  tier: 'bronze' },
        { threshold: 5,  tier: 'silver' },
        { threshold: 10, tier: 'gold' },
        { threshold: 25, tier: 'platinum' },
    ];
    return tiers.map(({ threshold, tier }) =>
        byIdDef(`friends_${threshold}`, 'social', tier, 'friendsCount', threshold),
    );
}

function encouragementsAchievements(): AchievementDef[] {
    const tiers: { threshold: number; tier: AchievementTier }[] = [
        { threshold: 1,   tier: 'bronze' },
        { threshold: 10,  tier: 'silver' },
        { threshold: 50,  tier: 'gold' },
        { threshold: 100, tier: 'platinum' },
    ];
    return tiers.map(({ threshold, tier }) =>
        byIdDef(`encouragements_${threshold}`, 'social', tier, 'totalEncouragementsSent', threshold),
    );
}

function trainingTimeAchievements(): AchievementDef[] {
    const tiers: { threshold: number; tier: AchievementTier }[] = [
        { threshold: 1800,   tier: 'bronze' },
        { threshold: 3600,   tier: 'bronze' },
        { threshold: 10800,  tier: 'silver' },
        { threshold: 36000,  tier: 'silver' },
        { threshold: 86400,  tier: 'gold' },
        { threshold: 180000, tier: 'gold' },
        { threshold: 360000, tier: 'platinum' },
    ];
    return tiers.map(({ threshold, tier }) =>
        byIdDef(`training_time_${threshold}`, 'discipline', tier, 'lifetimeTrainingTime', threshold),
    );
}

function sessionDurationAchievements(): AchievementDef[] {
    const tiers: { threshold: number; tier: AchievementTier }[] = [
        { threshold: 300,  tier: 'bronze' },
        { threshold: 600,  tier: 'bronze' },
        { threshold: 1200, tier: 'silver' },
        { threshold: 1800, tier: 'silver' },
        { threshold: 3600, tier: 'gold' },
        { threshold: 5400, tier: 'platinum' },
    ];
    return tiers.map(({ threshold, tier }) =>
        byIdDef(`session_duration_${threshold}`, 'discipline', tier, 'sessionDuration', threshold),
    );
}

function performanceAchievements(): AchievementDef[] {
    const performanceTiers: { id: string; tier: AchievementTier; statKey: string; threshold: number }[] = [
        { id: 'grade_s',         tier: 'bronze',   statKey: 'sGradeCount', threshold: 1 },
        { id: 'grade_s_10',      tier: 'silver',   statKey: 'sGradeCount', threshold: 10 },
        { id: 'grade_s_50',      tier: 'gold',     statKey: 'sGradeCount', threshold: 50 },
        { id: 'xp_session_100',  tier: 'bronze',   statKey: 'sessionXp',   threshold: 100 },
        { id: 'xp_session_500',  tier: 'silver',   statKey: 'sessionXp',   threshold: 500 },
        { id: 'xp_session_1000', tier: 'gold',     statKey: 'sessionXp',   threshold: 1000 },
        { id: 'level_5',         tier: 'bronze',   statKey: 'globalLevel', threshold: 5 },
        { id: 'level_10',        tier: 'silver',   statKey: 'globalLevel', threshold: 10 },
        { id: 'level_25',        tier: 'gold',     statKey: 'globalLevel', threshold: 25 },
        { id: 'level_50',        tier: 'platinum', statKey: 'globalLevel', threshold: 50 },
    ];
    return performanceTiers.map(({ id, tier, statKey, threshold }) =>
        byIdDef(id, 'performance', tier, statKey, threshold),
    );
}

// ─── Full registry ───────────────────────────────────────────────────────────

export const ACHIEVEMENTS: AchievementDef[] = [
    ...lifetimeRepsAchievements(),
    ...sessionRepsAchievements(),
    ...sessionsCountAchievements(),
    ...streakAchievements(),
    ...trainingTimeAchievements(),
    ...sessionDurationAchievements(),
    ...friendsAchievements(),
    ...encouragementsAchievements(),
    ...performanceAchievements(),
];

/** Grouped by category (preserves insertion order) */
export const ACHIEVEMENTS_BY_CATEGORY: Record<AchievementCategory, AchievementDef[]> = {
    strength:    ACHIEVEMENTS.filter(a => a.category === 'strength'),
    discipline:  ACHIEVEMENTS.filter(a => a.category === 'discipline'),
    social:      ACHIEVEMENTS.filter(a => a.category === 'social'),
    performance: ACHIEVEMENTS.filter(a => a.category === 'performance'),
};

// ─── Display helpers ────────────────────────────────────────────────────────

function buildAchievementParams(
    def: AchievementDef,
    explicit: Record<string, string | number> | undefined,
    t: TFunction,
): Record<string, string | number> {
    const params: Record<string, string | number> = { ...explicit };
    if (def.exerciseType && params.exercise === undefined) {
        params.exercise = t(getExerciseLabelKey(def.exerciseType));
    }
    return params;
}

/** Resolve the localized title for an achievement. */
export function getAchievementTitle(def: AchievementDef, t: TFunction): string {
    return t(def.titleKey, buildAchievementParams(def, def.titleParams, t));
}

/** Resolve the localized description for an achievement. */
export function getAchievementDescription(def: AchievementDef, t: TFunction): string {
    return t(def.descriptionKey, buildAchievementParams(def, def.descriptionParams, t));
}

// ─── Records ─────────────────────────────────────────────────────────────────

export interface RecordDef {
    key: string;
    /** i18next key for the display label. Resolve via `getRecordLabel(def, t)`. */
    labelKey: string;
    unit: string;
    emoji: string;
    /** If set, this record is per-exercise (the label key receives `{{exercise}}`). */
    exerciseType?: ExerciseType;
}

export const RECORDS: RecordDef[] = [
    // Per-exercise max reps in a session
    ...EXERCISE_TYPES.map(ex => ({
        key: `maxRepsInSession.${ex}`,
        labelKey: 'stats:records.max_reps_in_session_label',
        unit: 'reps',
        emoji: getExerciseEmoji(ex),
        exerciseType: ex,
    })),
    // Global records
    { key: 'longestWorkout',     labelKey: 'stats:records.longest_workout_label',         unit: 'time',  emoji: '⏱️' },
    { key: 'bestGrade',          labelKey: 'stats:records.best_grade_label',              unit: 'score', emoji: '🎯' },
    { key: 'mostXpInSession',    labelKey: 'stats:records.most_xp_label',                 unit: 'xp',    emoji: '✨' },
    { key: 'mostSessionsInWeek', labelKey: 'stats:records.most_sessions_in_week_label',   unit: 'count', emoji: '📆' },
    { key: 'longestStreak',      labelKey: 'stats:records.longest_streak_label',          unit: 'days',  emoji: '🔥' },
];

/** Resolve the localized label for a record. */
export function getRecordLabel(def: RecordDef, t: TFunction): string {
    const params: Record<string, string> = {};
    if (def.exerciseType) {
        params.exercise = t(getExerciseLabelKey(def.exerciseType));
    }
    return t(def.labelKey, params);
}
