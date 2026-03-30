/**
 * speechEngine — Web Speech API wrapper for workout coaching.
 * Selects a clean, energetic English voice (Google US English on Chrome,
 * or the best available alternative). Zero dependencies, zero bundle cost.
 *
 * Includes workarounds for Chrome's speechSynthesis bugs:
 * - Queue corruption: cancel() before every speak() to prevent stuck queue
 * - GC kill: strong utterance reference prevents garbage collection mid-play
 * - Stuck state: watchdog timer detects unresponsive engine and force-resets
 * - Tab blur: resume() handles Chrome auto-pausing on tab focus loss
 */

let enabled = true;

// Keep a strong reference to the current utterance so it doesn't get
// garbage-collected before it finishes playing (Chrome/WebKit bug).
const utteranceHolder: { current: SpeechSynthesisUtterance | null } = { current: null };

// Watchdog timer ID — detects stuck utterances that never fire onend/onerror.
let watchdogTimer: ReturnType<typeof setTimeout> | undefined;

// Track consecutive failures to detect a fully dead engine.
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

// ── Voice selection ──────────────────────────────────────────────
let cachedVoice: SpeechSynthesisVoice | null = null;
let voiceResolved = false;

// Ordered by preference — first match wins.
// "Google US English" is Chrome's built-in: clear, crisp, NOT breathy.
// Avoid macOS "Samantha" which sounds aspirated/tired.
const PREFERRED_VOICES: [RegExp, boolean][] = [
    [/google us english/i,           false],  // Chrome built-in, best quality
    [/google uk english female/i,    false],  // Chrome alternative
    [/microsoft aria/i,              false],  // Edge — clear female
    [/microsoft guy/i,               false],  // Edge — clear male
    [/alex/i,                        true ],  // macOS — clear male (not breathy)
    [/karen/i,                       true ],  // macOS — Australian, clear
    [/daniel/i,                      true ],  // macOS — UK male, clear
    [/tessa/i,                       true ],  // macOS — South African, clear
];

function resolveVoice(): SpeechSynthesisVoice | null {
    if (voiceResolved) return cachedVoice;

    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    for (const [pattern, mustBeLocal] of PREFERRED_VOICES) {
        const match = voices.find(v =>
            pattern.test(v.name) &&
            v.lang.startsWith('en') &&
            (!mustBeLocal || v.localService)
        );
        if (match) {
            cachedVoice = match;
            voiceResolved = true;
            return cachedVoice;
        }
    }

    // Fallback: any English voice, prefer non-local (Google remote voices
    // are generally better than macOS local ones on Chrome)
    const anyRemote = voices.find(v => v.lang.startsWith('en') && !v.localService);
    const anyLocal  = voices.find(v => v.lang.startsWith('en') && v.localService);
    cachedVoice = anyRemote ?? anyLocal ?? null;
    voiceResolved = true;
    return cachedVoice;
}

// Voices load asynchronously — re-resolve when they change.
// Guard: only clear cache if voices are actually available (prevents
// clearing during a transient unload/reload cycle).
if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.addEventListener('voiceschanged', () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            voiceResolved = false;
            cachedVoice = null;
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
    utt.lang = 'en-US';
    utteranceHolder.current = utt;
    utt.onend = () => { if (utteranceHolder.current === utt) utteranceHolder.current = null; };
    utt.onerror = () => { if (utteranceHolder.current === utt) utteranceHolder.current = null; };
    speechSynthesis.speak(utt);
}

/**
 * Speak a phrase with energetic coaching tone.
 * Short utterances (2-6 words) to avoid overlap.
 *
 * Chrome workaround: cancel() before every speak() prevents queue corruption.
 * A watchdog timer force-resets if the utterance never completes.
 */
export function speak(text: string, options?: { rate?: number; pitch?: number }): void {
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

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-US';
    utt.rate  = options?.rate  ?? 1.2;   // punchy pace
    utt.pitch = options?.pitch ?? 1.15;  // bright, not monotone
    utt.volume = 1.0;

    const voice = resolveVoice();
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
