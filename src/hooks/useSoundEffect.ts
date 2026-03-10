import { useRef, useCallback } from 'react';

export function useSoundEffect() {
    const audioCtxRef = useRef<AudioContext | null>(null);

    const initAudio = useCallback(() => {
        if (!audioCtxRef.current) {
            const AudioCtx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? AudioContext;
            audioCtxRef.current = new AudioCtx();
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
    }, []);

    const playRepSound = useCallback(() => {
        if (!audioCtxRef.current) return;

        // "Arcade Pop" - More arcade and snappy with a playful tone
        const ctx = audioCtxRef.current;

        // Main pop sound: quick upward pitch then quick drop
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();

        osc1.type = 'sine';
        // Quick sweep from mid-high to low (arcade-like)
        osc1.frequency.setValueAtTime(600, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.03);

        // Snappy envelope
        gain1.gain.setValueAtTime(0.6, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.04);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);

        osc1.start();
        osc1.stop(ctx.currentTime + 0.045);

        // Add a second layer for that "ding" feel - a triangle wave harmonically above
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(900, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.035);

        gain2.gain.setValueAtTime(0.3, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.02, ctx.currentTime + 0.04);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc2.start();
        osc2.stop(ctx.currentTime + 0.05);
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

    const playStartReadySound = useCallback(() => {
        if (!audioCtxRef.current) return;

        // "Ready to Start" - Ascending 3-note jingle with a "start" feel
        const ctx = audioCtxRef.current;

        const playNote = (freq: number, delay: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = ctx.currentTime + delay;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);

            // Quick attack, sustained, quick release
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.2, start + 0.05);
            gain.gain.linearRampToValueAtTime(0.2, start + duration - 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, start + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(start + duration);
        };

        // Ascending melody: G4 → B4 → D5 (happy, ready-to-go feel)
        playNote(392, 0, 0.2);    // G4
        playNote(493.88, 0.15, 0.2);  // B4
        playNote(587.33, 0.3, 0.3);   // D5 (slightly longer for emphasis)
    }, []);

    return { initAudio, playRepSound, playLevelUpSound, playVictorySound, playStartReadySound };
}