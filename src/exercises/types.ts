export interface Landmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
}

export type ExerciseType = 'pushup' | 'squat' | 'pullup';

const EXERCISE_LABELS: Record<ExerciseType, string> = {
    pushup: 'Push-ups',
    squat: 'Squats',
    pullup: 'Tractions',
};

/** Human-readable label: 'Push-ups', 'Squats' */
export function getExerciseLabel(type: ExerciseType): string {
    return EXERCISE_LABELS[type];
}

export type ExercisePhase = 'idle' | 'up' | 'down' | 'transition';

export interface RepResult {
    /** Score 0–100 for this rep */
    score: number;
    /** Score breakdown */
    amplitudeScore: number;
    alignmentScore: number;
    /** Minimum angle reached (elbow) during this rep */
    minAngle: number;
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
}
