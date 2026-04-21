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
import { EXERCISE_REGISTRY } from '@exercises/registry';

// ── Fallback constants (used when OffscreenCanvas is unavailable) ──
const POSE_CONNECTIONS: [number, number][] = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24],
    [23, 25], [25, 27], [24, 26], [26, 28],
];

/** Serialize registry key joints (Set<number>) to a plain object for worker transfer */
function buildKeyJointsPayload(): Record<string, number[]> {
    const result: Record<string, number[]> = {};
    for (const [type, config] of Object.entries(EXERCISE_REGISTRY)) {
        result[type] = [...config.keyJoints];
    }
    return result;
}

/** Read Arena skeleton palette from CSS custom properties on :root. */
function readArenaPalette() {
    const root = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) => {
        const v = root.getPropertyValue(name).trim();
        return v || fallback;
    };
    return {
        invalid: read('--blood', '#ff5577'),
        down: read('--good', '#4ae8a0'),
        up: read('--ice', '#7fc5ff'),
        neutral: read('--ember', '#ff7a47'),
    };
}

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
        const prevCoreCenterRef = useRef<{ x: number; y: number } | null>(null);
        const exerciseTypeRef = useRef(exerciseType);
        useEffect(() => { exerciseTypeRef.current = exerciseType; }, [exerciseType]);

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
                worker.postMessage({ type: 'set-key-joints', keyJoints: buildKeyJointsPayload() });
                worker.postMessage({ type: 'set-palette', palette: readArenaPalette() });
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
                        landmarks: lms ? lms.map(l => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility ?? 0 })) : null,
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

                // Skip if skeleton is "exploded" (incoherent core landmarks)
                const MIN_VIS = 0.35;
                const core = [11, 12, 23, 24].map(i => lms[i]).filter(l => l && (l.visibility ?? 0) > MIN_VIS);
                if (core.length < 3) return;
                const cxs = core.map(l => l.x), cys = core.map(l => l.y);
                const coreW = Math.max(...cxs) - Math.min(...cxs);
                const coreH = Math.max(...cys) - Math.min(...cys);
                if (coreW > 0.6 || coreH > 0.6 || (coreW < 0.01 && coreH < 0.01)) return;

                // Inter-frame consistency: reject skeleton teleportation
                const coreCX = cxs.reduce((s, v) => s + v, 0) / cxs.length;
                const coreCY = cys.reduce((s, v) => s + v, 0) / cys.length;
                if (prevCoreCenterRef.current) {
                    const jump = Math.hypot(
                        coreCX - prevCoreCenterRef.current.x,
                        coreCY - prevCoreCenterRef.current.y,
                    );
                    if (jump > 0.15) {
                        prevCoreCenterRef.current = { x: coreCX, y: coreCY };
                        return;
                    }
                }
                prevCoreCenterRef.current = { x: coreCX, y: coreCY };

                const pal = readArenaPalette();
                const phaseColor = !isValidPosition
                    ? pal.invalid
                    : phase === 'down' ? pal.down
                    : phase === 'up' ? pal.up
                    : pal.neutral;

                ctx.lineWidth = 3;
                ctx.strokeStyle = `${phaseColor}cc`;
                ctx.lineCap = 'round';
                for (const [a, b] of POSE_CONNECTIONS) {
                    const la = lms[a], lb = lms[b];
                    if (la && lb && (la.visibility ?? 0) > MIN_VIS && (lb.visibility ?? 0) > MIN_VIS) {
                        ctx.beginPath();
                        ctx.moveTo(la.x * w, la.y * h);
                        ctx.lineTo(lb.x * w, lb.y * h);
                        ctx.stroke();
                    }
                }

                const keyJoints = EXERCISE_REGISTRY[exerciseTypeRef.current].keyJoints;
                for (let i = 0; i < lms.length; i++) {
                    const lm = lms[i];
                    if (!lm || (lm.visibility ?? 0) < MIN_VIS) continue;
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
