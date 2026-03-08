export interface Landmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
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
