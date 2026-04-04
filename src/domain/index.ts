/**
 * Domain layer — public API.
 * Pure business logic. No React, no Firebase, no browser APIs.
 */

// XP & levels
export { xpForRep, totalXpForLevel, xpForSingleLevel, levelFromTotalXp, getTier, calculateBonuses, calculateSessionXp, estimateCompletedXp, projectLiveXp, EXERCISE_DIFFICULTY, difficultyFor } from './xpSystem';
export type { Tier, XpBonusDetail, XpBonusResult, BonusContext, XpPerExercise, SessionXpResult, LiveXpProjection } from './xpSystem';

// Scoring
export { COMBO_THRESHOLD, nextCombo, computeGoalProgress, weightedAverageScore } from './scoring';
export type { GoalProgress } from './scoring';

// Constants & grades
export { getGradeLetter, getGradeColor, getGradeBackground, getGradeClass, formatElapsedTime, EVENTS_PER_FRIEND } from './constants';
export type { GradeLetter } from './constants';

// Achievements
export { evaluateAchievements, evaluateRecords, getAchievementProgress, getStatValue, buildSessionRepsMap } from './achievementEngine';
export { ACHIEVEMENTS, RECORDS, TIER_COLORS } from './achievements';
export type { AchievementDef, RecordDef, AchievementCategory, AchievementTier } from './achievements';

// Quests
export { QUESTS, getQuestById, getQuestStatus, getActiveQuest, isQuestGoalMet, isQuestQuickStartable } from './quests';
export type { QuestDef, QuestProgress, QuestGoal, QuestStatus } from './quests';

// Body profile
export { getPushupThresholds, getSquatThresholds, getPullupThresholds } from './bodyProfile';
export type { BodyProfile, PushupThresholds, SquatThresholds, PullupThresholds } from './bodyProfile';

// Auth types
export type { AppUser, DbUser } from './authTypes';
