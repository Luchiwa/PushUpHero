import { useRef, useCallback } from 'react';

export function useSoundEffect() {
    const audioCtxRef = useRef<AudioContext | null>(null);

    const initAudio = useCallback(() => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
    }, []);

    const playRepSound = useCallback(() => {
        if (!audioCtxRef.current) return;

        // "Modern UI Pop" - A clean, snappy, high-quality "tick" or "pop"
        const ctx = audioCtxRef.current;

        // We use a sine wave with an extremely fast envelope
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';

        // Pitch envelope: starts high (like a water drop) and drops instantly
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.05);

        // Amplitude envelope: instant attack, very rapid fade
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.06);
    }, []);

    const playLevelUpSound = useCallback(() => {
        if (!audioCtxRef.current) return;

        // "Aura Power Up" - A rising power chord (Root, 5th, Octave) swelling up
        const ctx = audioCtxRef.current;

        const playChargeNote = (baseFreq: number, type: OscillatorType, delay: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = type;
            const start = ctx.currentTime + delay;

            // Sweep the frequency up slightly like energy building
            osc.frequency.setValueAtTime(baseFreq, start);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, start + duration);

            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.15, start + 0.1);            // Swell up
            gain.gain.linearRampToValueAtTime(0.15, start + duration - 0.2); // Hold
            gain.gain.exponentialRampToValueAtTime(0.01, start + duration);  // Fade out

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(start + duration);
        };

        // Delay ~350ms to let the push-up impact finish
        const delay = 0.35;
        const duration = 0.8;

        playChargeNote(110, 'sawtooth', delay, duration); // A2 (Root, gritty)
        playChargeNote(164.81, 'square', delay, duration); // E3 (Fifth, hollow)
        playChargeNote(220, 'sawtooth', delay, duration); // A3 (Octave, gritty)
    }, []);

    const playVictorySound = useCallback(() => {
        if (!audioCtxRef.current) return;
        const ctx = audioCtxRef.current;

        // Triumphant ascending fanfare: C4 → E4 → G4 → C5
        const notes = [261.63, 329.63, 392.00, 523.25];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = ctx.currentTime + i * 0.12;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, start);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.02, start + 0.2);

            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.25, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, start + 0.5);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.55);
        });

        // Shimmer — high-frequency sparkle
        const shimmer = ctx.createOscillator();
        const shimGain = ctx.createGain();
        shimmer.type = 'sine';
        shimmer.frequency.setValueAtTime(1046, ctx.currentTime + 0.4);
        shimmer.frequency.exponentialRampToValueAtTime(2093, ctx.currentTime + 1.0);
        shimGain.gain.setValueAtTime(0, ctx.currentTime + 0.4);
        shimGain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.5);
        shimGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        shimmer.connect(shimGain);
        shimGain.connect(ctx.destination);
        shimmer.start(ctx.currentTime + 0.4);
        shimmer.stop(ctx.currentTime + 1.3);
    }, []);

    return { initAudio, playRepSound, playLevelUpSound, playVictorySound };
}
