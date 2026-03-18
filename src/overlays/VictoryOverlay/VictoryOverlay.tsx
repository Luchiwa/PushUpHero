/**
 * VictoryOverlay — Full-screen celebration shown when the user reaches their goal.
 * Shows for up to DURATION_MS, then auto-transitions. User can also skip immediately.
 */
import { useEffect, useRef } from 'react';
import type { ExerciseType } from '@exercises/types';
import { getExerciseLabel } from '@exercises/types';
import { useSoundEffect } from '@hooks/useSoundEffect';
import './VictoryOverlay.scss';

const DURATION_MS = 10_000; // 10 seconds auto-transition
const PARTICLE_COUNT = 60;

interface VictoryOverlayProps {
    exerciseType: ExerciseType;
    repCount: number;
    soundEnabled: boolean;
    onComplete: () => void;
    sessionMode?: 'reps' | 'time';
    elapsedTime?: number;
    totalSets?: number;
}

function createParticles(canvas: HTMLCanvasElement) {
    const W = canvas.width;
    const H = canvas.height;
    return Array.from({ length: PARTICLE_COUNT }, () => ({
        x: W / 2 + (Math.random() - 0.5) * W * 0.5,
        y: H / 2 + (Math.random() - 0.5) * H * 0.3,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 14 - 4,
        size: Math.random() * 8 + 4,
        color: ['#f59e0b', '#6366f1', '#22c55e', '#ef4444', '#a5f3fc', '#fbbf24'][Math.floor(Math.random() * 6)],
        gravity: 0.4,
        opacity: 1,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
    }));
}

export function VictoryOverlay({ exerciseType, repCount, soundEnabled, onComplete, sessionMode, elapsedTime, totalSets }: VictoryOverlayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number | null>(null);
    const { initAudio, playVictorySound } = useSoundEffect();

    const formattedTime = elapsedTime
        ? `${String(Math.floor(elapsedTime / 60)).padStart(2, '0')}:${String(elapsedTime % 60).padStart(2, '0')}`
        : null;

    // Play sound immediately on mount — before Dashboard is gone
    useEffect(() => {
        initAudio();
        if (soundEnabled) playVictorySound();
    }, [initAudio, playVictorySound, soundEnabled]);

    // Confetti canvas animation (runs independently of the auto-transition timer)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = createParticles(canvas);
        let elapsed = 0;
        let lastTime = performance.now();

        function animate(now: number) {
            const dt = Math.min((now - lastTime) / 16.67, 3);
            lastTime = now;
            elapsed += dt * 16.67;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (const p of particles) {
                p.x += p.vx * dt;
                p.vy += p.gravity * dt;
                p.y += p.vy * dt;
                p.rotation += p.rotationSpeed * dt;
                // Confetti fades out in the first 3s, then canvas is cleared
                p.opacity = Math.max(0, 1 - elapsed / 3000);

                ctx.save();
                ctx.globalAlpha = p.opacity;
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                ctx.restore();
            }

            animRef.current = requestAnimationFrame(animate);
        }

        animRef.current = requestAnimationFrame(animate);
        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, []);

    // Auto-transition after DURATION_MS
    useEffect(() => {
        const timer = setTimeout(onComplete, DURATION_MS);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div className="victory-overlay">
            <canvas ref={canvasRef} className="victory-canvas" />
            <div className="victory-content">
                <div className="victory-emoji">🏆</div>
                <h1 className="victory-title">
                    {totalSets != null && totalSets > 1 ? 'WORKOUT COMPLETE!' : 'GOAL REACHED!'}
                </h1>
                {sessionMode === 'time' ? (
                    <>
                        <p className="victory-reps">{formattedTime}</p>
                        <p className="victory-subtitle">{repCount} {getExerciseLabel(exerciseType).toLowerCase()}{totalSets != null && totalSets > 1 ? ` · ${totalSets} sets` : ''}</p>
                    </>
                ) : (
                    <>
                        <p className="victory-reps">{repCount} {getExerciseLabel(exerciseType).toUpperCase()}</p>
                        <p className="victory-subtitle">
                            {totalSets != null && totalSets > 1 ? `${totalSets} sets completed` : 'Session complete'}
                        </p>
                    </>
                )}
                <button type="button" className="btn-victory-skip" onClick={onComplete}>
                    View summary →
                </button>
            </div>
        </div>
    );
}
