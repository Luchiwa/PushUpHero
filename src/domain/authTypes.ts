/**
 * authTypes — Domain types for user identity and profile.
 *
 * Decoupled from React contexts so that lib/ services can import
 * without depending on hooks/.
 *
 * `DbUser` is the **domain** shape: nested sections for profile, stats,
 * and per-exercise progression. The Firestore wire format is flat
 * (`FlatUserDoc` in `@infra/firestoreValidators`); the repo unfolds
 * flat → nested at the read boundary, and writes assemble flat field
 * literals at the write boundary.
 */
import type { ExerciseType, ExerciseXpMap } from '@exercises/types';
import type { RecordsMap } from './achievementEngine';
import type { BodyProfile } from './bodyProfile';
import type { QuestProgress } from './quests';
import type { UserId, Level, XpAmount } from './brands';

/** Framework-agnostic user identity — decouples UI from Firebase Auth. */
export interface AppUser {
    uid: UserId;
    providerIds: string[];
}

export interface DbUser {
    uid: UserId;
    profile: {
        displayName: string;
        photoURL?: string;
        /** Base64 JPEG thumbnail (~96px) for instant avatar display */
        photoThumb?: string;
        createdAt?: number;
        /** UI language preference (BCP-47 prefix). Mirrors localStorage; synced
         *  Firestore → client at sign-in by useSyncCloud. */
        preferredLanguage?: 'fr' | 'en';
    };
    stats: {
        level: Level;
        totalXp: XpAmount;
        /** @deprecated Legacy field — use totalXp */
        totalReps?: number;
        totalSessions?: number;
        streak?: number;
        bestStreak?: number;
        /** UTC date string YYYY-MM-DD */
        lastSessionDate?: string;
        /** Cumulative training time in seconds (for achievements) */
        lifetimeTrainingTime?: number;
        sGradeCount?: number;
        totalEncouragementsSent?: number;
    };
    /** Per-exercise breakdowns — XP, level, lifetime reps. */
    progression: {
        exerciseXp?: ExerciseXpMap;
        exerciseLevels?: Partial<Record<ExerciseType, number>>;
        /** Lifetime reps per exercise (for achievement tracking) */
        lifetimeReps?: Partial<Record<ExerciseType, number>>;
    };
    /** Map of achievementId → unlock timestamp (millis) */
    achievements?: Record<string, number>;
    /** Personal records */
    records?: RecordsMap;
    /** Body profile morphological ratios (captured during quests) */
    bodyProfile?: BodyProfile;
    /** Quest progress state */
    questProgress?: QuestProgress;
}
