import { useRef, useImperativeHandle, forwardRef } from 'react';
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import type { ExerciseType } from '@exercises/types';

/** MediaPipe Pose connections for skeleton drawing */
const POSE_CONNECTIONS: [number, number][] = [
    [11, 12], // shoulders
    [11, 13], [13, 15], // left arm
    [12, 14], [14, 16], // right arm
    [11, 23], [12, 24], // torso sides
    [23, 24], // hips
    [23, 25], [25, 27], // left leg
    [24, 26], [26, 28], // right leg
];

/** Key joints to highlight per exercise type */
const KEY_JOINTS_MAP: Record<ExerciseType, Set<number>> = {
    pushup: new Set([11, 12, 13, 14, 15, 16, 23, 24]),        // shoulders, elbows, wrists, hips
    squat: new Set([11, 12, 23, 24, 25, 26, 27, 28]),          // shoulders, hips, knees, ankles
    pullup: new Set([11, 12, 13, 14, 15, 16, 23, 24]),         // same as pushup — arms & shoulders
};

export interface PoseOverlayHandle {
    drawResult: (result: PoseLandmarkerResult, phase: string, isValidPosition: boolean) => void;
}

interface PoseOverlayProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    exerciseType: ExerciseType;
}

export const PoseOverlay = forwardRef<PoseOverlayHandle, PoseOverlayProps>(
    function PoseOverlay({ videoRef, exerciseType }, ref) {
        const canvasRef = useRef<HTMLCanvasElement>(null);

        useImperativeHandle(ref, () => ({
            drawResult(result: PoseLandmarkerResult, phase: string, isValidPosition: boolean) {
                const canvas = canvasRef.current;
                const video = videoRef.current;
                if (!canvas || !video) return;

                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                canvas.width = video.videoWidth || canvas.offsetWidth;
                canvas.height = video.videoHeight || canvas.offsetHeight;
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (!result?.landmarks?.[0]) return;

                const lms = result.landmarks[0];
                const w = canvas.width;
                const h = canvas.height;

                const phaseColor = !isValidPosition
                    ? '#ef4444'
                    : phase === 'down'
                        ? '#22c55e'
                        : phase === 'up'
                            ? '#3b82f6'
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

                const keyJoints = KEY_JOINTS_MAP[exerciseType];

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
    }
);
