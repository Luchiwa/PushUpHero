/**
 * speechEngine — Web Speech API wrapper for workout coaching.
 * Selects a clean, energetic English voice (Google US English on Chrome,
 * or the best available alternative). Zero dependencies, zero bundle cost.
 */

let enabled = true;

// Keep a strong reference to the current utterance so it doesn't get
// garbage-collected before it finishes playing (Chrome/WebKit bug).
const utteranceHolder: { current: SpeechSynthesisUtterance | null } = { current: null };

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

// Voices load asynchronously — re-resolve when they change
if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.addEventListener('voiceschanged', () => {
        voiceResolved = false;
        cachedVoice = null;
    });
    speechSynthesis.getVoices();
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
    const utt = new SpeechSynthesisUtterance(' ');
    utt.volume = 0.01;
    utt.lang = 'en-US';
    utteranceHolder.current = utt;
    utt.onend = () => { utteranceHolder.current = null; };
    utt.onerror = () => { utteranceHolder.current = null; };
    speechSynthesis.speak(utt);
}

/**
 * Speak a phrase with energetic coaching tone.
 * Short utterances (2-6 words) to avoid overlap.
 */
export function speak(text: string, options?: { rate?: number; pitch?: number }): void {
    if (!enabled) return;
    if (typeof speechSynthesis === 'undefined') return;

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-US';
    utt.rate  = options?.rate  ?? 1.2;   // punchy pace
    utt.pitch = options?.pitch ?? 1.15;  // bright, not monotone
    utt.volume = 1.0;

    const voice = resolveVoice();
    if (voice) utt.voice = voice;

    utteranceHolder.current = utt;
    utt.onend = () => { utteranceHolder.current = null; };
    utt.onerror = () => { utteranceHolder.current = null; };

    speechSynthesis.speak(utt);
}

/** Cancel all queued / ongoing speech. */
export function cancelSpeech(): void {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
}
