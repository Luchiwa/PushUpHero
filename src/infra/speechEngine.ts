/**
 * speechEngine — Web Speech API wrapper for workout coaching.
 *
 * Voice resolution is per-language (BCP-47): each lang has a curated list
 * of preferred voices, with the same fallback to "any voice in this lang".
 * The lang itself is sourced from `i18next.language` (mapped to BCP-47 via
 * `mapToBcp47`) unless an explicit `lang` option is passed to `speak`.
 *
 * Includes workarounds for Chrome's speechSynthesis bugs:
 * - Queue corruption: cancel() before every speak() to prevent stuck queue
 * - GC kill: strong utterance reference prevents garbage collection mid-play
 * - Stuck state: watchdog timer detects unresponsive engine and force-resets
 * - Tab blur: resume() handles Chrome auto-pausing on tab focus loss
 */

import i18n from 'i18next';

let enabled = true;

// Keep a strong reference to the current utterance so it doesn't get
// garbage-collected before it finishes playing (Chrome/WebKit bug).
const utteranceHolder: { current: SpeechSynthesisUtterance | null } = { current: null };

// Watchdog timer ID — detects stuck utterances that never fire onend/onerror.
let watchdogTimer: ReturnType<typeof setTimeout> | undefined;

// Track consecutive failures to detect a fully dead engine.
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

// ── Lang mapping ─────────────────────────────────────────────────

/** Map an i18next lang code (`'fr'`, `'en'`) to a BCP-47 tag for the speech engine.
 *  Add a branch + voice preferences when introducing a new locale — the
 *  warning surfaces the omission instead of silently falling back to EN. */
function mapToBcp47(lang: string): string {
    if (lang.startsWith('fr')) return 'fr-FR';
    if (lang.startsWith('en')) return 'en-US';
    console.warn('[speechEngine] No BCP-47 mapping for lang:', lang, '— defaulting to en-US');
    return 'en-US';
}

// ── Voice selection ──────────────────────────────────────────────

// Per-BCP-47 voice cache — voices vary by language.
const voiceCache: Record<string, SpeechSynthesisVoice | null | undefined> = {};

// Ordered preferences per language prefix. First match wins.
// EN: avoid macOS "Samantha" (breathy/tired); prefer Google US English.
// FR: prefer cloud voices over older macOS local voices.
const VOICE_PREFERENCES: Record<string, [RegExp, boolean][]> = {
    en: [
        [/google us english/i,           false],  // Chrome built-in, best quality
        [/google uk english female/i,    false],  // Chrome alternative
        [/microsoft aria/i,              false],  // Edge — clear female
        [/microsoft guy/i,               false],  // Edge — clear male
        [/alex/i,                        true ],  // macOS — clear male (not breathy)
        [/karen/i,                       true ],  // macOS — Australian, clear
        [/daniel/i,                      true ],  // macOS — UK male, clear
        [/tessa/i,                       true ],  // macOS — South African, clear
    ],
    fr: [
        [/google français/i,             false],  // Chrome built-in
        [/microsoft denise/i,            false],  // Edge — clear female
        [/microsoft henri/i,             false],  // Edge — clear male
        [/amelie/i,                      true ],  // macOS — clear female
        [/thomas/i,                      true ],  // macOS — clear male
    ],
};

function resolveVoice(bcp47: string): SpeechSynthesisVoice | null {
    if (bcp47 in voiceCache) return voiceCache[bcp47] ?? null;

    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    const langPrefix = bcp47.split('-')[0];
    const preferences = VOICE_PREFERENCES[langPrefix] ?? [];

    for (const [pattern, mustBeLocal] of preferences) {
        const match = voices.find(v =>
            pattern.test(v.name) &&
            v.lang.startsWith(langPrefix) &&
            (!mustBeLocal || v.localService)
        );
        if (match) {
            voiceCache[bcp47] = match;
            return match;
        }
    }

    // Fallback: any voice in the right language. Prefer non-local (cloud
    // voices are generally better on Chrome than the older macOS locals).
    const anyRemote = voices.find(v => v.lang.startsWith(langPrefix) && !v.localService);
    const anyLocal  = voices.find(v => v.lang.startsWith(langPrefix) && v.localService);
    voiceCache[bcp47] = anyRemote ?? anyLocal ?? null;
    return voiceCache[bcp47] ?? null;
}

// Voices load asynchronously — clear the per-lang cache when they change.
// Guard: only clear cache if voices are actually available (prevents
// clearing during a transient unload/reload cycle).
if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.addEventListener('voiceschanged', () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            for (const k of Object.keys(voiceCache)) delete voiceCache[k];
        }
    });
    speechSynthesis.getVoices();
}

// ── Internal helpers ─────────────────────────────────────────────

/** Force-reset the speech engine to a clean state. */
function forceReset(): void {
    clearTimeout(watchdogTimer);
    watchdogTimer = undefined;
    utteranceHolder.current = null;
    if (typeof speechSynthesis !== 'undefined') {
        speechSynthesis.cancel();
    }
}

// ── Public API ───────────────────────────────────────────────────

/** Enable / disable the speech engine globally. */
export function setSpeechEnabled(value: boolean): void {
    enabled = value;
    if (!value) cancelSpeech();
}

export function isSpeechEnabled(): boolean {
    return enabled;
}

/**
 * Warm up the speech synthesis engine.
 * Call from a user gesture (click) to unlock the audio session.
 */
export function warmUpSpeech(): void {
    if (typeof speechSynthesis === 'undefined') return;

    // Clear any stuck state from a previous session
    forceReset();
    consecutiveFailures = 0;

    const utt = new SpeechSynthesisUtterance(' ');
    utt.volume = 0.01;
    utt.lang = mapToBcp47(i18n.language);
    utteranceHolder.current = utt;
    utt.onend = () => { if (utteranceHolder.current === utt) utteranceHolder.current = null; };
    utt.onerror = () => { if (utteranceHolder.current === utt) utteranceHolder.current = null; };
    speechSynthesis.speak(utt);
}

export interface SpeakOptions {
    rate?: number;
    pitch?: number;
    /** Override the BCP-47 lang. Defaults to `mapToBcp47(i18next.language)`. */
    lang?: string;
}

/**
 * Speak a phrase with energetic coaching tone.
 * Short utterances (2-6 words) to avoid overlap.
 *
 * Chrome workaround: cancel() before every speak() prevents queue corruption.
 * A watchdog timer force-resets if the utterance never completes.
 */
export function speak(text: string, options?: SpeakOptions): void {
    if (!enabled) return;
    if (typeof speechSynthesis === 'undefined') return;

    // If engine failed too many times in a row, it's likely dead at the OS level.
    // Skip silently rather than piling up stuck calls.
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) return;

    // ── Chrome bug workaround: clear any stuck/pending speech ──
    forceReset();

    // Resume if Chrome auto-paused speech (e.g., tab lost focus then regained)
    if (speechSynthesis.paused) {
        speechSynthesis.resume();
    }

    const lang = options?.lang ?? mapToBcp47(i18n.language);

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    utt.rate  = options?.rate  ?? 1.2;   // punchy pace
    utt.pitch = options?.pitch ?? 1.15;  // bright, not monotone
    utt.volume = 1.0;

    const voice = resolveVoice(lang);
    if (voice) utt.voice = voice;

    utteranceHolder.current = utt;

    // Watchdog: if utterance doesn't complete within 5s, the engine is stuck.
    // Force-reset so the next speak() call has a chance of working.
    watchdogTimer = setTimeout(() => {
        if (utteranceHolder.current === utt) {
            consecutiveFailures++;
            forceReset();
        }
    }, 5_000);

    utt.onend = () => {
        if (utteranceHolder.current === utt) {
            clearTimeout(watchdogTimer);
            watchdogTimer = undefined;
            utteranceHolder.current = null;
            consecutiveFailures = 0; // engine is healthy
        }
    };
    utt.onerror = () => {
        if (utteranceHolder.current === utt) {
            clearTimeout(watchdogTimer);
            watchdogTimer = undefined;
            utteranceHolder.current = null;
            consecutiveFailures++;
        }
    };

    speechSynthesis.speak(utt);
}

/** Cancel all queued / ongoing speech and reset engine state. */
export function cancelSpeech(): void {
    forceReset();
}
