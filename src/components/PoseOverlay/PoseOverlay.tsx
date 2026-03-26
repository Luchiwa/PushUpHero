/**
 * PoseOverlay — Draws the skeleton overlay on top of the camera feed.
 *
 * Uses an OffscreenCanvas Web Worker when supported (Chrome, Edge, Firefox 105+)
 * so that all 2D drawing happens off the main thread.
 * Falls back to main-thread canvas drawing when OffscreenCanvas is unavailable (Safari < 16.4).
 */
import { useRef, useImperativeHandle, forwardRef, useEffect, memo } from 'react';
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import type { ExerciseType } from '@exercises/types';

// ── Fallback constants (used when OffscreenCanvas is unavailable) ──
const POSE_CONNECTIONS: [number, number][] = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24],
    [23, 25], [25, 27], [24, 26], [26, 28],
];

const KEY_JOINTS_MAP: Record<ExerciseType, Set<number>> = {
    pushup: new Set([11, 12, 13, 14, 15, 16, 23, 24]),
    squat: new Set([11, 12, 23, 24, 25, 26, 27, 28]),
    pullup: new Set([11, 12, 13, 14, 15, 16, 23, 24]),
};

export interface PoseOverlayHandle {
    drawResult: (result: PoseLandmarkerResult, phase: string, isValidPosition: boolean) => void;
}

interface PoseOverlayProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    exerciseType: ExerciseType;
}

const supportsOffscreen = typeof HTMLCanvasElement !== 'undefined'
    && 'transferControlToOffscreen' in HTMLCanvasElement.prototype;

export const PoseOverlay = memo(forwardRef<PoseOverlayHandle, PoseOverlayProps>(
    function PoseOverlay({ videoRef, exerciseType }, ref) {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const workerRef = useRef<Worker | null>(null);
        const offscreenTransferred = useRef(false);
        const exerciseTypeRef = useRef(exerciseType);
        exerciseTypeRef.current = exerciseType;

        // ── Init OffscreenCanvas worker ──────────────────────────────
        // NOTE: We must NOT terminate the worker on cleanup because
        // transferControlToOffscreen is irreversible — once transferred
        // the canvas can never get a 2D context again. In React StrictMode
        // (dev) effects run twice; terminating the worker on the first
        // cleanup leaves workerRef null while the canvas is transferred,
        // causing the fallback getContext('2d') to throw.
        useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas || !supportsOffscreen || offscreenTransferred.current) return;

            try {
                const offscreen = canvas.transferControlToOffscreen();
                const worker = new Worker(
                    new URL('../../workers/poseOverlay.worker.ts', import.meta.url),
                    { type: 'module' },
                );
                worker.postMessage({ type: 'init', canvas: offscreen }, [offscreen]);
                workerRef.current = worker;
                offscreenTransferred.current = true;
            } catch {
                // Fallback — will use main-thread drawing
                console.warn('PoseOverlay: OffscreenCanvas transfer failed, using main thread');
            }

            // No cleanup: worker + transferred canvas must persist for the
            // lifetime of this canvas element.
        }, []);

        // ── Imperative draw handle ───────────────────────────────────
        useImperativeHandle(ref, () => ({
            drawResult(result: PoseLandmarkerResult, phase: string, isValidPosition: boolean) {
                const video = videoRef.current;
                if (!video) return;

                const w = video.videoWidth || 640;
                const h = video.videoHeight || 480;
                const lms = result?.landmarks?.[0];

                // ── Worker path ──────────────────────────────────────
                if (workerRef.current) {
                    workerRef.current.postMessage({
                        type: 'draw',
                        landmarks: lms ? lms.map(l => ({ x: l.x, y: l.y, z: l.z })) : null,
                        width: w,
                        height: h,
                        phase,
                        isValidPosition,
                        exerciseType: exerciseTypeRef.current,
                    });
                    return;
                }

                // ── Fallback: main-thread drawing ────────────────────
                // If canvas was transferred to offscreen, we can't draw on it
                if (offscreenTransferred.current) return;
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                canvas.width = w;
                canvas.height = h;
                ctx.clearRect(0, 0, w, h);

                if (!lms || lms.length === 0) return;

                const phaseColor = !isValidPosition
                    ? '#ef4444'
                    : phase === 'down' ? '#22c55e'
                    : phase === 'up' ? '#3b82f6'
                    : '#f59e0b';

                ctx.lineWidth = 3;
                ctx.strokeStyle = `${phaseColor}cc`;
                ctx.lineCap = 'round';
                for (const [a, b] of POSE_CONNECTIONS) {
                    if (lms[a] && lms[b]) {
                        ctx.beginPath();
                        ctx.moveTo(lms[a].x * w, lms[a].y * h);
                        ctx.lineTo(lms[b].x * w, lms[b].y * h);
                        ctx.stroke();
                    }
                }

                const keyJoints = KEY_JOINTS_MAP[exerciseTypeRef.current];
                for (let i = 0; i < lms.length; i++) {
                    const lm = lms[i];
                    if (!lm) continue;
                    const x = lm.x * w;
                    const y = lm.y * h;
                    const isKey = keyJoints.has(i);
                    ctx.beginPath();
                    ctx.arc(x, y, isKey ? 8 : 4, 0, Math.PI * 2);
                    ctx.fillStyle = isKey ? phaseColor : '#ffffff88';
                    ctx.fill();
                    if (isKey) {
                        ctx.strokeStyle = '#000000aa';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                }
            },
        }));

        return <canvas ref={canvasRef} className="pose-overlay-canvas" />;
    },
));
