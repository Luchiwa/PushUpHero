/**
 * quests.ts
 *
 * Quest system — gamified onboarding and progression goals.
 * Quests are ordered objectives that guide the user through features
 * while silently capturing body profile data and encouraging exploration.
 *
 * ── Unlock conditions ──
 * Each quest can declare:
 *   - prerequisites: IDs of quests that must be completed first
 *   - requiredLevel: minimum global level needed
 *
 * ── Completion conditions ──
 * Each quest has a `goal` that describes what the user must achieve:
 *   - reps:           minimum total reps (accumulated across sessions by default)
 *   - exerciseType:   restrict to a specific exercise (optional)
 *   - minAvgScore:    minimum session avg score to count reps (0–100, optional)
 *   - multiSet:       session must be multi-set — implies single-session (optional)
 *   - multiExercise:  session must be multi-exercise — implies single-session (optional)
 *   - singleSession:  all conditions must be met in one session (optional)
 *
 * By default, reps accumulate across sessions. For quests with minAvgScore,
 * only reps from sessions where the average score meets the threshold count.
 * Endurance quests and structural quests (multiSet/multiExercise) are
 * single-session by design.
 *
 * Design: quests are evaluated client-side. Completion state is stored
 * alongside the body profile in localStorage + Firestore.
 */

import type { ExerciseType } from '@exercises/types';

// ── Quest types ──────────────────────────────────────────────────

export type QuestStatus = 'locked' | 'available' | 'accepted' | 'completed';

/** What the user must achieve to complete the quest */
export interface QuestGoal {
    /** Minimum total reps */
    reps: number;
    /** If set, reps must come from this exercise */
    exerciseType?: ExerciseType;
    /** Minimum average score (0–100) */
    minAvgScore?: number;
    /** Must be a multi-set session (≥2 sets) — implies single-session */
    multiSet?: boolean;
    /** Must be a multi-exercise session (≥2 exercises) — implies single-session */
    multiExercise?: boolean;
    /** If true, all conditions must be met in a single session (no cross-session accumulation) */
    singleSession?: boolean;
}

export interface QuestDef {
    id: string;
    /** Display order (lower = first) */
    order: number;
    /** Short category label shown as a colored badge */
    category: QuestCategory;
    title: string;
    description: string;
    emoji: string;
    /** XP rewarded on completion */
    xpReward: number;
    /** Completion conditions */
    goal: QuestGoal;
    /**
     * IDs of quests that must be completed before this one is available.
     * Empty = no quest prerequisite.
     */
    prerequisites: string[];
    /** Minimum global level required (0 = none) */
    requiredLevel: number;
    /** Side-effect tag — tells the system what to capture during this quest */
    captures?: 'body_profile';
}

export type QuestCategory =
    | 'onboarding'
    | 'exercise'
    | 'mastery'
    | 'endurance'
    | 'variety';

export const QUEST_CATEGORY_META: Record<QuestCategory, { label: string; color: string }> = {
    onboarding: { label: 'Getting Started', color: 'var(--ember)' },
    exercise:   { label: 'Exercise',        color: 'var(--good)' },
    mastery:    { label: 'Mastery',         color: 'var(--gold)' },
    endurance:  { label: 'Endurance',       color: 'var(--blood)' },
    variety:    { label: 'Variety',         color: 'var(--ice)' },
};

// ── Quest definitions ────────────────────────────────────────────

export const QUESTS: QuestDef[] = [
    // ── Onboarding ──
    {
        id: 'first_steps',
        order: 0,
        category: 'onboarding',
        title: 'First Steps',
        description: 'Complete 5 reps of any exercise to calibrate your body profile.',
        emoji: '🎯',
        xpReward: 50,
        goal: { reps: 5 },
        prerequisites: [],
        requiredLevel: 0,
        captures: 'body_profile',
    },
    {
        id: 'warm_up',
        order: 1,
        category: 'onboarding',
        title: 'Warm Up',
        description: 'Complete 10 reps of any exercise.',
        emoji: '🔥',
        xpReward: 75,
        goal: { reps: 10 },
        prerequisites: ['first_steps'],
        requiredLevel: 0,
    },

    // ── Exercise-specific ──
    {
        id: 'pushup_initiate',
        order: 10,
        category: 'exercise',
        title: 'Push-Up Initiate',
        description: 'Complete 15 push-ups.',
        emoji: '💪',
        xpReward: 100,
        goal: { reps: 15, exerciseType: 'pushup' },
        prerequisites: ['warm_up'],
        requiredLevel: 0,
    },
    {
        id: 'squat_initiate',
        order: 11,
        category: 'exercise',
        title: 'Squat Initiate',
        description: 'Complete 15 squats.',
        emoji: '🦵',
        xpReward: 100,
        goal: { reps: 15, exerciseType: 'squat' },
        prerequisites: ['warm_up'],
        requiredLevel: 0,
    },
    {
        id: 'legraise_initiate',
        order: 12,
        category: 'exercise',
        title: 'Leg Raise Initiate',
        description: 'Complete 15 leg raises.',
        emoji: '🧘',
        xpReward: 100,
        goal: { reps: 15, exerciseType: 'legraise' },
        prerequisites: ['warm_up'],
        requiredLevel: 0,
    },
    {
        id: 'pullup_initiate',
        order: 13,
        category: 'exercise',
        title: 'Pull-Up Initiate',
        description: 'Complete 5 pull-ups.',
        emoji: '🏋️',
        xpReward: 150,
        goal: { reps: 5, exerciseType: 'pullup' },
        prerequisites: ['warm_up'],
        requiredLevel: 0,
    },

    // ── Mastery ──
    {
        id: 'quality_over_quantity',
        order: 20,
        category: 'mastery',
        title: 'Quality Over Quantity',
        description: 'Complete 10 reps with an average score of A (75+).',
        emoji: '⭐',
        xpReward: 150,
        goal: { reps: 10, minAvgScore: 75 },
        prerequisites: ['warm_up'],
        requiredLevel: 3,
    },
    {
        id: 'perfect_ten',
        order: 21,
        category: 'mastery',
        title: 'Perfect Ten',
        description: 'Complete 10 reps with an average score of S (90+).',
        emoji: '💎',
        xpReward: 300,
        goal: { reps: 10, minAvgScore: 90 },
        prerequisites: ['quality_over_quantity'],
        requiredLevel: 5,
    },
    {
        id: 'pushup_master',
        order: 22,
        category: 'mastery',
        title: 'Push-Up Master',
        description: 'Complete 30 push-ups with an average A grade.',
        emoji: '🏅',
        xpReward: 250,
        goal: { reps: 30, exerciseType: 'pushup', minAvgScore: 75 },
        prerequisites: ['pushup_initiate', 'quality_over_quantity'],
        requiredLevel: 8,
    },
    {
        id: 'legraise_master',
        order: 24,
        category: 'mastery',
        title: 'Leg Raise Master',
        description: 'Complete 30 leg raises with an average A grade.',
        emoji: '🏅',
        xpReward: 250,
        goal: { reps: 30, exerciseType: 'legraise', minAvgScore: 75 },
        prerequisites: ['legraise_initiate', 'quality_over_quantity'],
        requiredLevel: 8,
    },
    {
        id: 'squat_master',
        order: 25,
        category: 'mastery',
        title: 'Squat Master',
        description: 'Complete 30 squats with an average A grade.',
        emoji: '🏅',
        xpReward: 250,
        goal: { reps: 30, exerciseType: 'squat', minAvgScore: 75 },
        prerequisites: ['squat_initiate', 'quality_over_quantity'],
        requiredLevel: 8,
    },

    // ── Endurance ──
    {
        id: 'marathon_starter',
        order: 30,
        category: 'endurance',
        title: 'Marathon Starter',
        description: 'Complete 25 reps in a single session.',
        emoji: '🏃',
        xpReward: 125,
        goal: { reps: 25, singleSession: true },
        prerequisites: ['warm_up'],
        requiredLevel: 2,
    },
    {
        id: 'iron_will',
        order: 31,
        category: 'endurance',
        title: 'Iron Will',
        description: 'Complete 50 reps in a single session.',
        emoji: '🔩',
        xpReward: 250,
        goal: { reps: 50, singleSession: true },
        prerequisites: ['marathon_starter'],
        requiredLevel: 5,
    },
    {
        id: 'centurion',
        order: 32,
        category: 'endurance',
        title: 'Centurion',
        description: 'Complete 100 reps in a single session.',
        emoji: '💯',
        xpReward: 500,
        goal: { reps: 100, singleSession: true },
        prerequisites: ['iron_will'],
        requiredLevel: 10,
    },

    // ── Variety ──
    {
        id: 'multi_set_warrior',
        order: 40,
        category: 'variety',
        title: 'Multi-Set Warrior',
        description: 'Complete a multi-set workout (2+ sets).',
        emoji: '🔄',
        xpReward: 100,
        goal: { reps: 1, multiSet: true },
        prerequisites: ['warm_up'],
        requiredLevel: 2,
    },
    {
        id: 'cross_trainer',
        order: 41,
        category: 'variety',
        title: 'Cross-Trainer',
        description: 'Complete a multi-exercise workout.',
        emoji: '🎭',
        xpReward: 200,
        goal: { reps: 1, multiExercise: true },
        prerequisites: ['multi_set_warrior'],
        requiredLevel: 4,
    },
    {
        id: 'versatile_athlete',
        order: 42,
        category: 'variety',
        title: 'Versatile Athlete',
        description: 'Complete 20+ reps in a multi-exercise workout with A grade.',
        emoji: '🌟',
        xpReward: 350,
        goal: { reps: 20, multiExercise: true, minAvgScore: 75 },
        prerequisites: ['cross_trainer'],
        requiredLevel: 7,
    },
];

// ── Quest lookup map (perf) ──────────────────────────────────────

const QUEST_MAP: Map<string, QuestDef> = new Map(QUESTS.map(q => [q.id, q]));

export function getQuestById(id: string): QuestDef | undefined {
    return QUEST_MAP.get(id);
}

// ── Quest state (persisted) ──────────────────────────────────────

export interface QuestProgress {
    /** Map of questId → completion timestamp (millis). Absent = not completed. */
    completed: Record<string, number>;
    /** Map of questId → acceptance timestamp (millis). Absent = not accepted yet. */
    accepted: Record<string, number>;
    /** Map of questId → accumulated qualifying reps (cross-session quests only). */
    progress: Record<string, number>;
}

export function emptyQuestProgress(): QuestProgress {
    return { completed: {}, accepted: {}, progress: {} };
}

// ── Quest evaluation ─────────────────────────────────────────────

/** Get the status of a quest given the user's progress + level */
export function getQuestStatus(
    quest: QuestDef,
    progress: QuestProgress,
    userLevel: number = 0,
): QuestStatus {
    if (progress.completed[quest.id]) return 'completed';

    // Check prerequisites (quests)
    const prereqsMet = quest.prerequisites.every(id => progress.completed[id]);
    // Check level requirement
    const levelMet = userLevel >= quest.requiredLevel;

    if (!prereqsMet || !levelMet) return 'locked';

    return progress.accepted[quest.id] ? 'accepted' : 'available';
}

/** Get all quests that can be worked on (available or accepted, not yet completed) */
export function getAvailableQuests(progress: QuestProgress, userLevel: number = 0): QuestDef[] {
    return QUESTS.filter(q => {
        const s = getQuestStatus(q, progress, userLevel);
        return s === 'available' || s === 'accepted';
    });
}

/** Get the accepted quest the user is actively pursuing (first accepted, or first available) */
export function getActiveQuest(progress: QuestProgress, userLevel: number = 0): QuestDef | null {
    // Prioritize accepted quests
    const accepted = QUESTS.find(q => getQuestStatus(q, progress, userLevel) === 'accepted');
    if (accepted) return accepted;
    // Fall back to first available
    return QUESTS.find(q => getQuestStatus(q, progress, userLevel) === 'available') ?? null;
}

/** Check if a quest has been explicitly accepted by the user */
export function isQuestAccepted(quest: QuestDef, progress: QuestProgress): boolean {
    return !!progress.accepted[quest.id];
}

/** Check if a quest is a body profile capture quest */
export function isBodyProfileQuest(quest: QuestDef): boolean {
    return quest.captures === 'body_profile';
}

/** Session data shape used for quest evaluation */
export interface QuestSessionData {
    totalReps: number;
    avgScore: number;
    exerciseType: ExerciseType;
    isMultiSet: boolean;
    isMultiExercise: boolean;
    /** For multi-exercise: reps per exercise type */
    repsByExercise?: Partial<Record<ExerciseType, number>>;
}

/** Whether a quest must be completed in a single session (no cross-session accumulation) */
export function isSingleSessionQuest(quest: QuestDef): boolean {
    return !!quest.goal.singleSession || !!quest.goal.multiSet || !!quest.goal.multiExercise;
}

/**
 * Compute how many qualifying reps a session contributes toward a quest.
 *
 * - Single-session quests: returns goal.reps if ALL conditions met, 0 otherwise.
 * - Cross-session quests: returns the number of qualifying reps from this session.
 *   For quests with minAvgScore, reps only count if the session avgScore meets the threshold.
 */
export function getSessionQuestContribution(quest: QuestDef, sessionData: QuestSessionData): number {
    const { goal } = quest;

    // Single-session quests: all-or-nothing
    if (isSingleSessionQuest(quest)) {
        return isQuestGoalMetSingleSession(quest, sessionData) ? goal.reps : 0;
    }

    // Cross-session: check quality gate
    if (goal.minAvgScore && sessionData.avgScore < goal.minAvgScore) return 0;

    // Count qualifying reps
    if (goal.exerciseType) {
        return sessionData.repsByExercise?.[goal.exerciseType]
            ?? (sessionData.exerciseType === goal.exerciseType ? sessionData.totalReps : 0);
    }
    return sessionData.totalReps;
}

/** Get accumulated progress toward a quest (0 if not started) */
export function getQuestProgressCount(quest: QuestDef, progress: QuestProgress): number {
    return progress.progress[quest.id] ?? 0;
}

/** Check if a quest's accumulated progress meets its goal */
export function isQuestProgressComplete(quest: QuestDef, progress: QuestProgress): boolean {
    return getQuestProgressCount(quest, progress) >= quest.goal.reps;
}

/** Check if a single-session quest's goal is met by the given session */
function isQuestGoalMetSingleSession(quest: QuestDef, sessionData: QuestSessionData): boolean {
    const { goal } = quest;

    if (goal.exerciseType) {
        const exerciseReps = sessionData.repsByExercise?.[goal.exerciseType]
            ?? (sessionData.exerciseType === goal.exerciseType ? sessionData.totalReps : 0);
        if (exerciseReps < goal.reps) return false;
    } else {
        if (sessionData.totalReps < goal.reps) return false;
    }

    if (goal.minAvgScore && sessionData.avgScore < goal.minAvgScore) return false;
    if (goal.multiSet && !sessionData.isMultiSet) return false;
    if (goal.multiExercise && !sessionData.isMultiExercise) return false;

    return true;
}

/**
 * @deprecated Use getSessionQuestContribution + getQuestProgressCount instead.
 * Kept for backward compatibility during migration.
 */
export function isQuestGoalMet(quest: QuestDef, sessionData: QuestSessionData): boolean {
    return isQuestGoalMetSingleSession(quest, sessionData);
}

/** Group quests by category for display */
export function getQuestsByCategory(): Map<QuestCategory, QuestDef[]> {
    const map = new Map<QuestCategory, QuestDef[]>();
    for (const q of QUESTS) {
        const arr = map.get(q.category) ?? [];
        arr.push(q);
        map.set(q.category, arr);
    }
    return map;
}

// ── Quick-start & featured quest logic ──────────────────────────

/** Maximum number of quests a user can have accepted at the same time */
export const MAX_ACCEPTED_QUESTS = 3;

/** A quest is quick-startable if it can be launched as a simple Quick Session (no multi-set/multi-exercise) */
export function isQuestQuickStartable(quest: QuestDef): boolean {
    return !quest.goal.multiSet && !quest.goal.multiExercise;
}

/**
 * Get the quest to feature as a hero card on the StartScreen.
 * Returns null when no quest deserves the prominent placement.
 *
 * Rules:
 * - Onboarding quests (first_steps, warm_up) are always featured if not completed
 * - Post-onboarding: only an accepted + quick-startable quest is featured
 */
export function getFeaturedQuest(progress: QuestProgress, userLevel: number = 0): QuestDef | null {
    // Onboarding: always feature the active onboarding quest
    for (const quest of QUESTS) {
        if (quest.category !== 'onboarding') continue;
        const status = getQuestStatus(quest, progress, userLevel);
        if (status === 'available' || status === 'accepted') return quest;
    }

    // Post-onboarding: feature the first accepted quest that is quick-startable
    for (const quest of QUESTS) {
        const status = getQuestStatus(quest, progress, userLevel);
        if (status === 'accepted' && isQuestQuickStartable(quest)) return quest;
    }

    return null;
}

/** Get all currently accepted (not yet completed) quests */
export function getAcceptedQuests(progress: QuestProgress, userLevel: number = 0): QuestDef[] {
    return QUESTS.filter(q => getQuestStatus(q, progress, userLevel) === 'accepted');
}

/** Return a contextual hint for complex (non-quick-startable) quests */
export function getComplexQuestHint(quest: QuestDef): string | null {
    if (isQuestQuickStartable(quest)) return null;
    if (quest.goal.multiExercise) return 'Use Multi-Set Workout with 2+ exercises';
    if (quest.goal.multiSet) return 'Use Multi-Set Workout with 2+ sets';
    return null;
}

/** Stats summary for the quests screen header */
export function getQuestStats(progress: QuestProgress): {
    total: number;
    completed: number;
    available: number;
} {
    const completedCount = Object.keys(progress.completed).length;
    return {
        total: QUESTS.length,
        completed: completedCount,
        available: QUESTS.length - completedCount,
    };
}
