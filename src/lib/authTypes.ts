/**
 * authTypes — Domain types for user identity and profile.
 *
 * Decoupled from React contexts so that lib/ services can import
 * without depending on hooks/.
 */
import type { ExerciseType, ExerciseXpMap } from '@exercises/types';
import type { RecordsMap } from './achievementEngine';
import type { BodyProfile } from './bodyProfile';
import type { QuestProgress } from './quests';

/** Framework-agnostic user identity — decouples UI from Firebase Auth. */
export interface AppUser {
    uid: string;
    providerIds: string[];
}

export interface DbUser {
    uid: string;
    displayName: string;
    level: number;
    totalXp: number;
    /** @deprecated Legacy field — use totalXp */
    totalReps?: number;
    createdAt?: number;
    photoURL?: string;
    /** Base64 JPEG thumbnail (~96px) for instant avatar display */
    photoThumb?: string;
    streak?: number;
    lastSessionDate?: string; // UTC date string YYYY-MM-DD
    exerciseXp?: ExerciseXpMap;
    exerciseLevels?: Partial<Record<ExerciseType, number>>;

    // ── Achievements & Records ───────────────────────────────────────────
    bestStreak?: number;
    totalEncouragementsSent?: number;
    sGradeCount?: number;
    /** Lifetime reps per exercise (for achievement tracking) */
    lifetimeReps?: Partial<Record<ExerciseType, number>>;
    /** Cumulative training time in seconds (for achievements) */
    lifetimeTrainingTime?: number;
    /** Map of achievementId → unlock timestamp (millis) */
    achievements?: Record<string, number>;
    /** Personal records */
    records?: RecordsMap;
    /** Body profile morphological ratios (captured during quests) */
    bodyProfile?: BodyProfile;
    /** Quest progress state */
    questProgress?: QuestProgress;
}
