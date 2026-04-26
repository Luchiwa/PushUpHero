export interface Landmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
}

export type ExerciseType = 'pushup' | 'squat' | 'pullup' | 'legraise';

/** Per-exercise XP map — single source of truth for all modules. */
export type ExerciseXpMap = Partial<Record<ExerciseType, number>>;

/** All exercise types in display order. Single source of truth. */
export const EXERCISE_TYPES: ExerciseType[] = ['pushup', 'squat', 'pullup', 'legraise'];

export interface ExerciseMeta {
    type: ExerciseType;
    label: string;
    emoji: string;
    /** Short editorial tag shown under the label in pickers, e.g. 'UPPER BODY' */
    category: string;
    /** Banner shown when user leaves the valid position mid-session */
    invalidPositionMessage: string;
}

/** Display metadata per exercise — drives pickers, filters, etc. */
export const EXERCISE_META: ExerciseMeta[] = [
    { type: 'pushup',   label: 'Push-ups',   emoji: '💪', category: 'Upper Body', invalidPositionMessage: '⚠️ Get back into push-up position' },
    { type: 'squat',    label: 'Squats',     emoji: '🦵', category: 'Lower Body', invalidPositionMessage: '⚠️ Stand upright facing the camera' },
    { type: 'pullup',   label: 'Pull-ups',   emoji: '🏋️', category: 'Pull',       invalidPositionMessage: '⚠️ Get back into hang position' },
    { type: 'legraise', label: 'Leg Raises', emoji: '🧘', category: 'Core',       invalidPositionMessage: '⚠️ Lie flat on your back' },
];

const META_MAP: Record<ExerciseType, ExerciseMeta> = Object.fromEntries(
    EXERCISE_META.map(m => [m.type, m]),
) as Record<ExerciseType, ExerciseMeta>;

/** Human-readable label: 'Push-ups', 'Squats', 'Pull-ups'.
 *  Prefer `getExerciseLabelKey` + `t(...)` in UI for i18n. This raw-string
 *  form is kept for callers that don't yet flow through useTranslation
 *  (services, activity feed strings, achievement title interpolation). */
export function getExerciseLabel(type: ExerciseType): string {
    return META_MAP[type].label;
}

/** Emoji for an exercise: '💪', '🦵', '🏋️' */
export function getExerciseEmoji(type: ExerciseType): string {
    return META_MAP[type].emoji;
}

/** Banner text when user leaves valid position: '⚠️ Get back into push-up position' etc.
 *  Prefer `getInvalidPositionMessageKey` + `t(...)` in UI for i18n. */
export function getInvalidPositionMessage(type: ExerciseType): string {
    return META_MAP[type].invalidPositionMessage;
}

// ── i18n keys (preferred for UI consumption) ─────────────────────

const CATEGORY_KEY_MAP: Record<ExerciseType, string> = {
    pushup:   'upper_body',
    squat:    'lower_body',
    pullup:   'pull',
    legraise: 'core',
};

/** i18next key for the exercise display name. Use as `t(getExerciseLabelKey(type))`. */
export function getExerciseLabelKey(type: ExerciseType): string {
    return `common:exercise.${type}`;
}

/** i18next key for the exercise category tag (UI groupings like "Upper Body"). */
export function getExerciseCategoryKey(type: ExerciseType): string {
    return `common:exercise_category.${CATEGORY_KEY_MAP[type]}`;
}

/** i18next key for the "lost the pose" warning shown over the camera. */
export function getInvalidPositionMessageKey(type: ExerciseType): string {
    return `common:exercise_invalid_position.${type}`;
}

export type ExercisePhase = 'idle' | 'up' | 'down' | 'transition';

/** Actionable feedback hint for a rep — used by the voice coach */
export type RepFeedback =
    | 'perfect'
    | 'go_lower'
    | 'arms_uneven'
    | 'body_sagging'
    | 'body_piking'
    | 'too_fast'
    | 'lean_forward'
    | 'knees_caving'
    | 'torso_lean'
    | 'kipping'
    | 'body_sway'
    | 'raise_higher'
    | 'keep_legs_straight'
    | 'keep_back_flat'
    | 'good';

export interface RepResult {
    /** Score 0–100 for this rep */
    score: number;
    /** Score breakdown */
    amplitudeScore: number;
    alignmentScore: number;
    /** Minimum angle reached (elbow/knee) during this rep */
    minAngle: number;
    /** Primary corrective feedback for this rep */
    feedback: RepFeedback;
}

/** A completed set within a multi-set session */
export interface SetRecord {
    reps: number;
    averageScore: number;
    repHistory: RepResult[];
    duration: number;           // seconds for this set
    setMode: 'reps' | 'time';
    goalReps?: number;          // if mode is reps
    timeGoal?: number;          // if mode is time (seconds)
    exerciseType?: ExerciseType; // exercise for this set (multi-exercise workouts)
}

// ── Multi-exercise workout plan ──────────────────────────────────

export interface TimeDuration {
    minutes: number;
    seconds: number;
}

/** A single exercise block in a workout plan */
export interface WorkoutBlock {
    exerciseType: ExerciseType;
    numberOfSets: number;
    sessionMode: 'reps' | 'time';
    goalReps: number;
    timeGoal: TimeDuration;
    restBetweenSets: TimeDuration;
    /** Rest AFTER this block, before the next exercise. Last block's value is ignored. */
    restAfterBlock: TimeDuration;
}

/** Full workout plan — ordered list of exercise blocks */
export interface WorkoutPlan {
    blocks: WorkoutBlock[];
}

/** Create a default WorkoutBlock for a given exercise */
export function createDefaultBlock(exerciseType: ExerciseType = 'pushup'): WorkoutBlock {
    return {
        exerciseType,
        numberOfSets: 3,
        sessionMode: 'reps',
        goalReps: 10,
        timeGoal: { minutes: 0, seconds: 30 },
        restBetweenSets: { minutes: 1, seconds: 0 },
        restAfterBlock: { minutes: 2, seconds: 0 },
    };
}

// ── Session record ──────────────────────────────────────────────

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
    xpBonuses?: { key: string; labelKey: string; labelParams?: Record<string, string | number>; emoji: string; pct: number }[];
    xpPerExercise?: { exerciseType: string; rawXp: number; finalXp: number }[];
}

// ── Exercise state ──────────────────────────────────────────────

export interface ExerciseState {
    repCount: number;
    averageScore: number;
    currentPhase: ExercisePhase;
    lastRepResult: RepResult | null;
    repHistory: RepResult[];
    /** True when the user's position passes the exercise validity checks */
    isValidPosition: boolean;
    /** Dynamic calibration flag */
    isCalibrated: boolean;
    /** 0 to 100 representing calibration progress */
    calibratingPercentage: number;
    /**
     * Set when the user starts a rep but comes back up without reaching
     * full depth. Cleared on the next frame. Allows the coach to give
     * real-time "go lower" feedback even when no rep is counted.
     */
    incompleteRepFeedback: RepFeedback | null;
    /**
     * True when the detected pose was rejected because its bounding box
     * doesn't match the locked user (e.g. someone walking behind in a gym).
     * Allows the UI to show a specific "wrong person" message.
     */
    poseRejectedByLock: boolean;
}
