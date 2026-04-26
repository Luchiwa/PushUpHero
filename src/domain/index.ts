/**
 * Domain layer — public API.
 *
 * Pure business logic. No React, no Firebase, no browser APIs.
 *
 * **Consumers outside `src/domain/` MUST import from `@domain` (this barrel),
 * not from `@domain/<file>` directly.** This barrel is the canonical entry
 * point for the domain module — one path per symbol. Inside `src/domain/`,
 * file-to-file imports are normal (no barrel hop).
 */

// ── Brands (identity & scalar primitives) ──────────────────────────────────
export {
    createUserId, createLevel, createXpAmount,
    type UserId, type Level, type XpAmount,
} from './brands';

// ── Auth & user shape ──────────────────────────────────────────────────────
export type { AppUser, DbUser } from './authTypes';

// ── XP & levels ────────────────────────────────────────────────────────────
export {
    totalXpForLevel,
    xpForSingleLevel,
    levelFromTotalXp,
    getTier,
    calculateBonuses,
    calculateSessionXp,
    estimateCompletedXp,
    projectLiveXp,
    computeXpProgress,
    type Tier,
    type XpBonusDetail,
    type XpBonusResult,
    type BonusContext,
    type XpPerExercise,
    type SessionXpResult,
    type LiveXpProjection,
    type XpProgress,
} from './xpSystem';

// ── Scoring ────────────────────────────────────────────────────────────────
export {
    COMBO_THRESHOLD,
    nextCombo,
    computeGoalProgress,
    weightedAverageScore,
    type GoalProgress,
} from './scoring';

// ── Constants & grades ─────────────────────────────────────────────────────
export {
    getGradeLetter,
    getGradeColor,
    getGradeBackground,
    getGradeClass,
    formatElapsedTime,
    CALIBRATION_FRAMES_REQUIRED,
    MAX_LOCAL_SESSIONS,
    EVENTS_PER_FRIEND,
    FEED_PRUNE_AGE_MS,
    ENCOURAGE_COOLDOWN_MS,
    MIN_SETS,
    MAX_SETS,
    MIN_REST_SECONDS,
    MAX_REST_SECONDS,
    DEFAULT_REST_SECONDS,
    MAX_EXERCISE_REST_SECONDS,
    DEFAULT_EXERCISE_REST_SECONDS,
    type GradeLetter,
} from './constants';

// ── Achievements (definitions & evaluator) ─────────────────────────────────
export {
    ACHIEVEMENTS,
    ACHIEVEMENTS_BY_CATEGORY,
    CATEGORY_META,
    RECORDS,
    TIER_COLORS,
    getAchievementTitle,
    getAchievementDescription,
    getRecordLabel,
    type AchievementDef,
    type RecordDef,
    type AchievementCategory,
    type AchievementTier,
} from './achievements';
export {
    evaluateAchievements,
    evaluateRecords,
    bulkEvaluateRecords,
    getAchievementProgress,
    getStatValue,
    isLiveStatKey,
    buildSessionRepsMap,
    computeLifetimeReps,
    countSGrades,
    emptyRecords,
    type UserStats,
    type AchievementMap,
    type RecordsMap,
    type RecordUpdate,
} from './achievementEngine';

// ── Quests ─────────────────────────────────────────────────────────────────
export {
    QUESTS,
    QUEST_CATEGORY_META,
    MAX_ACCEPTED_QUESTS,
    getQuestById,
    getQuestStatus,
    getQuestStats,
    getQuestsByCategory,
    getActiveQuest,
    getAvailableQuests,
    getAcceptedQuests,
    getFeaturedQuest,
    getQuestProgressCount,
    getSessionQuestContribution,
    getComplexQuestHint,
    isQuestAccepted,
    isQuestGoalMet,
    isQuestQuickStartable,
    isSingleSessionQuest,
    isBodyProfileQuest,
    computeQuestProgressPct,
    emptyQuestProgress,
    getQuestTitle,
    getQuestDescription,
    getQuestCategoryLabel,
    type ComplexQuestHint,
    type QuestDef,
    type QuestProgress,
    type QuestGoal,
    type QuestStatus,
    type QuestCategory,
} from './quests';

// ── Body profile (morphological calibration) ───────────────────────────────
export {
    BODY_PROFILE_VERSION,
    emptyBodyProfile,
    getPushupThresholds,
    getSquatThresholds,
    getPullupThresholds,
    getLegRaiseThresholds,
    type BodyProfile,
    type PushupThresholds,
    type SquatThresholds,
    type PullupThresholds,
    type LegRaiseThresholds,
} from './bodyProfile';

// ── Stats helpers (charts, KPIs) ───────────────────────────────────────────
export {
    buildDayTotals,
    buildDayTotalsXp,
    niceMax,
    pctChange,
    compactNum,
    type ExerciseFilter,
} from './stats';
