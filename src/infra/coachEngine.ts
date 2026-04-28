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
 * the last-picked phrase per i18n key, so it survives a language switch
 * mid-session and never plays the same phrase twice in a row within a
 * category. Memory is cleared at workout start via `resetCoach()`.
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
let lastCalibrationVocalTimestamp = 0;
let goodStreak = 0;
/** Last phrase picked per i18n key — guarantees no adjacent duplicate. */
const lastPicked = new Map<string, string>();

/** Pick a non-repeating random phrase from the pool at `key`. */
function pickFromPool(key: string): string | null {
    const pool = getPhrasePool(key);
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0];
    const last = lastPicked.get(key);
    const candidates = last ? pool.filter(p => p !== last) : pool;
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    lastPicked.set(key, next);
    return next;
}

/** Reset coach state (call on workout start). */
export function resetCoach(): void {
    lastVocalTimestamp = 0;
    lastCalibrationVocalTimestamp = 0;
    goodStreak = 0;
    lastPicked.clear();
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
        const phrase = pickFromPool(`coach:feedback.${feedback}`);
        if (phrase) {
            speak(phrase);
            lastVocalTimestamp = now;
        }
        return phrase;
    }

    // ── 2. Perfect rep — occasional praise (every other perfect, if cooldown ok) ──
    if (feedback === 'perfect' && cooldownOk && repScore >= 90) {
        const phrase = pickFromPool('coach:feedback.perfect');
        if (phrase) {
            speak(phrase, { pitch: 1.15 });
            lastVocalTimestamp = now;
        }
        return phrase;
    }

    // ── 3. Streak encouragement ──
    if (goodStreak > 0 && goodStreak % ENCOURAGEMENT_STREAK === 0 && cooldownOk) {
        const phrase = pickFromPool('coach:encouragement');
        if (!phrase) return null;
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

    const phrase = pickFromPool(`coach:calibration.${exerciseType}`);
    if (!phrase) return null;

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

    const phrase = pickFromPool(`coach:incomplete_rep.${exerciseType}`);
    if (!phrase) return null;

    speak(phrase);
    lastVocalTimestamp = now;
    return phrase;
}

// ── Milestone speech (set boundary, rest boundary, level-up) ─────
//
// These fire on user-visible state transitions, not per-rep — they're
// inherently spaced by gameplay, so they bypass the 5 s vocal cooldown
// (don't touch lastVocalTimestamp). Each picks anti-repeat from its
// own pool and uses prosody tuned to the moment.

export function speakSetComplete(): string | null {
    const phrase = pickFromPool('coach:set_complete');
    if (!phrase) return null;
    speak(phrase);
    return phrase;
}

export function speakRestStart(): string | null {
    const phrase = pickFromPool('coach:rest_start');
    if (!phrase) return null;
    speak(phrase, { rate: 0.95 }); // calmer pace for a recovery cue
    return phrase;
}

export function speakRestEnding(): string | null {
    const phrase = pickFromPool('coach:rest_ending');
    if (!phrase) return null;
    speak(phrase, { rate: 1.15, pitch: 1.05 }); // punchier "get ready"
    return phrase;
}

export function speakLevelUp(): string | null {
    const phrase = pickFromPool('coach:level_up');
    if (!phrase) return null;
    speak(phrase, { pitch: 1.2 }); // celebratory
    return phrase;
}
