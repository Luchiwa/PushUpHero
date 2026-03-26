export interface Landmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
}

export type ExerciseType = 'pushup' | 'squat' | 'pullup';

/** All exercise types in display order. Single source of truth. */
export const EXERCISE_TYPES: ExerciseType[] = ['pushup', 'squat', 'pullup'];

export interface ExerciseMeta {
    type: ExerciseType;
    label: string;
    emoji: string;
    /** Banner shown when user leaves the valid position mid-session */
    invalidPositionMessage: string;
    /** Tagline for the share card */
    shareTagline: string;
}

/** Display metadata per exercise — drives pickers, filters, etc. */
export const EXERCISE_META: ExerciseMeta[] = [
    { type: 'pushup', label: 'Push-ups', emoji: '💪', invalidPositionMessage: '⚠️ Get back into push-up position',  shareTagline: 'Track your push-ups with Push-Up Hero 💪' },
    { type: 'squat',  label: 'Squats',   emoji: '🦵', invalidPositionMessage: '⚠️ Stand upright facing the camera',  shareTagline: 'Track your squats with Push-Up Hero 💪' },
    { type: 'pullup', label: 'Pull-ups', emoji: '🏋️', invalidPositionMessage: '⚠️ Get back into hang position',     shareTagline: 'Track your pull-ups with Push-Up Hero 💪' },
];

const META_MAP: Record<ExerciseType, ExerciseMeta> = Object.fromEntries(
    EXERCISE_META.map(m => [m.type, m]),
) as Record<ExerciseType, ExerciseMeta>;

/** Human-readable label: 'Push-ups', 'Squats', 'Pull-ups' */
export function getExerciseLabel(type: ExerciseType): string {
    return META_MAP[type].label;
}

/** Emoji for an exercise: '💪', '🦵', '🏋️' */
export function getExerciseEmoji(type: ExerciseType): string {
    return META_MAP[type].emoji;
}

/** Banner text when user leaves valid position: '⚠️ Get back into push-up position' etc. */
export function getInvalidPositionMessage(type: ExerciseType): string {
    return META_MAP[type].invalidPositionMessage;
}

/** Tagline for share cards */
export function getShareTagline(type: ExerciseType): string {
    return META_MAP[type].shareTagline;
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
