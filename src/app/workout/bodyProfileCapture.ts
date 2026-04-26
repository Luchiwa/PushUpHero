/**
 * bodyProfileCapture — Pure body-profile-merge helper for session save.
 *
 * If the session completed a body-profile quest, derive the updated profile
 * from captured ratios. Returns null when no merge applies, so the caller
 * can stay one branch deep.
 */
import type { ExerciseType } from '@exercises/types';
import type { CapturedRatios } from '@exercises/BaseExerciseDetector';
import type { QuestDef } from '@domain/quests';
import { isBodyProfileQuest } from '@domain/quests';
import type { BodyProfile } from '@domain/bodyProfile';
import { BODY_PROFILE_VERSION } from '@domain/bodyProfile';
import { BODY_PROFILE_MERGE } from '@exercises/registry';

export interface CaptureBodyProfileInput {
    completedQuests: QuestDef[];
    primaryExercise: ExerciseType;
    bodyProfile: BodyProfile;
    getCapturedRatios: () => CapturedRatios;
}

/**
 * Returns a fresh BodyProfile to persist if a body-profile quest was completed
 * and the per-exercise merge produced a non-empty patch. Returns null otherwise.
 */
export function maybeCaptureBodyProfile(input: CaptureBodyProfileInput): BodyProfile | null {
    const { completedQuests, primaryExercise, bodyProfile, getCapturedRatios } = input;

    const profileQuest = completedQuests.find(q => isBodyProfileQuest(q));
    if (!profileQuest) return null;

    const mergeForExercise = BODY_PROFILE_MERGE[primaryExercise];
    if (!mergeForExercise) return null;

    const captured = getCapturedRatios();
    const patch = mergeForExercise(captured, captured.dynamicCalibration);
    if (Object.keys(patch).length === 0) return null;

    return {
        ...bodyProfile,
        ...patch,
        capturedAt: Date.now(),
        version: BODY_PROFILE_VERSION,
    };
}
