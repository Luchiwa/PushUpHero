/**
 * coachEngine — Vocal coaching logic.
 *
 * Responsibilities:
 * 1. Map RepFeedback → short spoken phrase
 * 2. Enforce a cooldown between vocal cues (~5 s)
 * 3. Occasionally inject encouragement for streaks of good reps
 * 4. Priority: corrective feedback > encouragement > silence
 *
 * Phrases live in the `coach` i18n namespace. Anti-repeat rotation tracks
 * by category key (RepFeedback / ExerciseType), so it survives a language
 * switch mid-session.
 */

import i18n from 'i18next';
import type { RepFeedback, ExerciseType } from '@exercises/types';
import { speak } from './speechEngine';

// ── Configuration ────────────────────────────────────────────────
/** Minimum gap between two vocal cues (ms). */
const VOCAL_COOLDOWN_MS = 5_000;
/** How many consecutive "good" or "perfect" reps before encouragement fires. */
const ENCOURAGEMENT_STREAK = 4;
/** Minimum gap between calibration guide cues (ms). */
const CALIBRATION_COOLDOWN_MS = 8_000;

// ── Phrase pool resolver ─────────────────────────────────────────

function getPhrasePool(key: string): string[] {
    const result = i18n.t(key, { returnObjects: true });
    return Array.isArray(result) ? (result as string[]) : [];
}

// ── Internal state ───────────────────────────────────────────────
let lastVocalTimestamp = 0;
let goodStreak = 0;
const phraseIndex: Partial<Record<RepFeedback, number>> = {};
let encourageIndex = 0;
const calibrationPhraseIndex: Partial<Record<ExerciseType, number>> = {};
let lastCalibrationVocalTimestamp = 0;
const incompleteRepPhraseIndex: Partial<Record<ExerciseType, number>> = {};

/** Reset coach state (call on session start / exercise change). */
export function resetCoach(): void {
    lastVocalTimestamp = 0;
    goodStreak = 0;
    for (const k of Object.keys(phraseIndex)) delete phraseIndex[k as RepFeedback];
    encourageIndex = 0;
    for (const k of Object.keys(calibrationPhraseIndex)) delete calibrationPhraseIndex[k as ExerciseType];
    lastCalibrationVocalTimestamp = 0;
    for (const k of Object.keys(incompleteRepPhraseIndex)) delete incompleteRepPhraseIndex[k as ExerciseType];
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
        if (phrase) {
            speak(phrase);
            lastVocalTimestamp = now;
        }
        return phrase;
    }

    // ── 2. Perfect rep — occasional praise (every other perfect, if cooldown ok) ──
    if (feedback === 'perfect' && cooldownOk && repScore >= 90) {
        const phrase = pickPhrase('perfect');
        if (phrase) {
            speak(phrase, { pitch: 1.15 });
            lastVocalTimestamp = now;
        }
        return phrase;
    }

    // ── 3. Streak encouragement ──
    if (goodStreak > 0 && goodStreak % ENCOURAGEMENT_STREAK === 0 && cooldownOk) {
        const encouragements = getPhrasePool('coach:encouragement');
        if (encouragements.length === 0) return null;
        const phrase = encouragements[encourageIndex % encouragements.length];
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

    const phrases = getPhrasePool(`coach:calibration.${exerciseType}`);
    if (phrases.length === 0) return null;

    const idx = calibrationPhraseIndex[exerciseType] ?? 0;
    const phrase = phrases[idx % phrases.length];
    calibrationPhraseIndex[exerciseType] = idx + 1;

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

    const phrases = getPhrasePool(`coach:incomplete_rep.${exerciseType}`);
    if (phrases.length === 0) return null;

    const idx = incompleteRepPhraseIndex[exerciseType] ?? 0;
    const phrase = phrases[idx % phrases.length];
    incompleteRepPhraseIndex[exerciseType] = idx + 1;

    speak(phrase);
    lastVocalTimestamp = now;
    return phrase;
}

// ── Helpers ──────────────────────────────────────────────────────
function pickPhrase(feedback: RepFeedback): string | null {
    const phrases = getPhrasePool(`coach:feedback.${feedback}`);
    if (phrases.length === 0) return null;
    const idx = phraseIndex[feedback] ?? 0;
    const phrase = phrases[idx % phrases.length];
    phraseIndex[feedback] = idx + 1;
    return phrase;
}
