/**
 * coachEngine — Vocal coaching logic.
 *
 * Responsibilities:
 * 1. Map RepFeedback → short spoken phrase
 * 2. Enforce a cooldown between vocal cues (~5 s)
 * 3. Occasionally inject encouragement for streaks of good reps
 * 4. Priority: corrective feedback > encouragement > silence
 */

import type { RepFeedback, ExerciseType } from '@exercises/types';
import { EXERCISE_REGISTRY } from '@exercises/registry';
import { speak } from './speechEngine';

// ── Configuration ────────────────────────────────────────────────
/** Minimum gap between two vocal cues (ms). */
const VOCAL_COOLDOWN_MS = 5_000;
/** How many consecutive "good" or "perfect" reps before encouragement fires. */
const ENCOURAGEMENT_STREAK = 4;
/** Minimum gap between calibration guide cues (ms). */
const CALIBRATION_COOLDOWN_MS = 8_000;

// ── Feedback → spoken phrases ────────────────────────────────────
// Each key maps to an array so we can rotate and avoid repetition.
const FEEDBACK_PHRASES: Record<RepFeedback, string[]> = {
    perfect:       ['Perfect!', 'Flawless!', 'Nailed it!'],
    good:          ['Nice rep', 'Good one', 'Solid'],
    go_lower:      ['Go lower', 'Deeper!', 'Full range'],
    arms_uneven:   ['Even arms', 'Balance your arms'],
    body_sagging:  ['Hips up!', 'Tighten your core'],
    body_piking:   ['Lower your hips', 'Flatten out'],
    too_fast:      ['Slow down', 'Control the rep'],
    lean_forward:  ['Stay upright', 'Chest up!'],
    knees_caving:  ['Push knees out', 'Knees over toes'],
    torso_lean:    ['Keep your torso up', 'Stay vertical'],
    kipping:       ['No kipping', 'Strict form!'],
    body_sway:     ['Stay still', 'Minimize sway'],
    raise_higher:      ['Raise higher', 'Legs up!', 'Higher!'],
    keep_legs_straight: ['Straighten your legs', 'Keep legs straight'],
    keep_back_flat:     ['Keep your back flat', 'Back on the ground'],
};

const ENCOURAGEMENTS = [
    'Keep it up!',
    'You\'re on fire!',
    'Great streak!',
    'Looking strong!',
    'Beast mode!',
];

// Calibration & incomplete-rep phrases are defined in the exercise registry.
// Local aliases for readability:
const calibrationPhrasesFor = (type: ExerciseType) => EXERCISE_REGISTRY[type].calibrationPhrases;
const incompleteRepPhrasesFor = (type: ExerciseType) => EXERCISE_REGISTRY[type].incompleteRepPhrases;

// ── Internal state ───────────────────────────────────────────────
let lastVocalTimestamp = 0;
let goodStreak = 0;
let phraseIndex: Partial<Record<RepFeedback, number>> = {};
let encourageIndex = 0;
let calibrationPhraseIndex = 0;
let lastCalibrationVocalTimestamp = 0;
let incompleteRepPhraseIndex: Partial<Record<ExerciseType, number>> = {};

/** Reset coach state (call on session start / exercise change). */
export function resetCoach(): void {
    lastVocalTimestamp = 0;
    goodStreak = 0;
    phraseIndex = {};
    encourageIndex = 0;
    calibrationPhraseIndex = 0;
    lastCalibrationVocalTimestamp = 0;
    incompleteRepPhraseIndex = {};
}

/**
 * Called after every rep with the feedback from the detector.
 * Decides whether to speak and what to say.
 *
 * Returns the phrase spoken (or null if silent) — useful for UI display.
 */
export function processRepFeedback(feedback: RepFeedback, repScore: number): string | null {
    const now = Date.now();
    const cooldownOk = now - lastVocalTimestamp >= VOCAL_COOLDOWN_MS;

    // Track streak
    if (feedback === 'good' || feedback === 'perfect') {
        goodStreak++;
    } else {
        goodStreak = 0;
    }

    // ── 1. Corrective feedback (always takes priority if cooldown allows) ──
    const isCorrective = feedback !== 'good' && feedback !== 'perfect';
    if (isCorrective && cooldownOk) {
        const phrase = pickPhrase(feedback);
        speak(phrase);
        lastVocalTimestamp = now;
        return phrase;
    }

    // ── 2. Perfect rep — occasional praise (every other perfect, if cooldown ok) ──
    if (feedback === 'perfect' && cooldownOk && repScore >= 90) {
        const phrase = pickPhrase('perfect');
        speak(phrase, { pitch: 1.15 });
        lastVocalTimestamp = now;
        return phrase;
    }

    // ── 3. Streak encouragement ──
    if (goodStreak > 0 && goodStreak % ENCOURAGEMENT_STREAK === 0 && cooldownOk) {
        const phrase = ENCOURAGEMENTS[encourageIndex % ENCOURAGEMENTS.length];
        encourageIndex++;
        speak(phrase, { rate: 1.15 });
        lastVocalTimestamp = now;
        return phrase;
    }

    return null;
}

/**
 * Called periodically during calibration to guide the user into position.
 * Respects its own cooldown so it doesn't spam.
 * Returns the phrase spoken (or null if silent).
 */
export function speakCalibrationGuide(exerciseType: ExerciseType): string | null {
    const now = Date.now();
    if (now - lastCalibrationVocalTimestamp < CALIBRATION_COOLDOWN_MS) return null;

    const phrases = calibrationPhrasesFor(exerciseType);
    const phrase = phrases[calibrationPhraseIndex % phrases.length];
    calibrationPhraseIndex++;
    speak(phrase, { rate: 1.0, pitch: 1.05 }); // calm, instructional tone
    lastCalibrationVocalTimestamp = now;
    return phrase;
}

/**
 * Called when a detector signals an incomplete rep (user descended but
 * came back up without reaching full depth). Uses exercise-specific
 * phrases ("Go deeper" for squats vs "Pull higher" for pull-ups).
 * Respects the main vocal cooldown.
 */
export function processIncompleteRep(exerciseType: ExerciseType): string | null {
    const now = Date.now();
    if (now - lastVocalTimestamp < VOCAL_COOLDOWN_MS) return null;

    const phrases = incompleteRepPhrasesFor(exerciseType);
    const idx = incompleteRepPhraseIndex[exerciseType] ?? 0;
    const phrase = phrases[idx % phrases.length];
    incompleteRepPhraseIndex[exerciseType] = idx + 1;

    speak(phrase);
    lastVocalTimestamp = now;
    return phrase;
}

// ── Helpers ──────────────────────────────────────────────────────
function pickPhrase(feedback: RepFeedback): string {
    const phrases = FEEDBACK_PHRASES[feedback];
    const idx = phraseIndex[feedback] ?? 0;
    const phrase = phrases[idx % phrases.length];
    phraseIndex[feedback] = idx + 1;
    return phrase;
}
