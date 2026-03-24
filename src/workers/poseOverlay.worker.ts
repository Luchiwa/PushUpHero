/**
 * poseOverlay.worker.ts
 *
 * Draws the skeleton overlay on an OffscreenCanvas, completely off the main thread.
 * Receives: { type: 'init', canvas } | { type: 'draw', landmarks, width, height, phase, isValidPosition, exerciseType }
 */

type LandmarkData = { x: number; y: number; z: number; visibility?: number };

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
const KEY_JOINTS: Record<string, Set<number>> = {
    pushup: new Set([11, 12, 13, 14, 15, 16, 23, 24]),
    squat: new Set([11, 12, 23, 24, 25, 26, 27, 28]),
    pullup: new Set([11, 12, 13, 14, 15, 16, 23, 24]),
};

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

function getPhaseColor(phase: string, isValidPosition: boolean): string {
    if (!isValidPosition) return '#ef4444';
    if (phase === 'down') return '#22c55e';
    if (phase === 'up') return '#3b82f6';
    return '#f59e0b';
}

function draw(
    landmarks: LandmarkData[],
    width: number,
    height: number,
    phase: string,
    isValidPosition: boolean,
    exerciseType: string,
) {
    if (!ctx || !canvas) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    if (!landmarks || landmarks.length === 0) return;

    const w = width;
    const h = height;
    const phaseColor = getPhaseColor(phase, isValidPosition);

    // Draw connections
    ctx.lineWidth = 3;
    ctx.strokeStyle = `${phaseColor}cc`;
    ctx.lineCap = 'round';
    for (const [a, b] of POSE_CONNECTIONS) {
        const la = landmarks[a];
        const lb = landmarks[b];
        if (la && lb) {
            ctx.beginPath();
            ctx.moveTo(la.x * w, la.y * h);
            ctx.lineTo(lb.x * w, lb.y * h);
            ctx.stroke();
        }
    }

    // Draw joints
    const keyJoints = KEY_JOINTS[exerciseType] ?? KEY_JOINTS.pushup;
    for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
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
}

// ── Message handler ──────────────────────────────────────────────
self.onmessage = (e: MessageEvent) => {
    const msg = e.data;
    if (msg.type === 'init') {
        canvas = msg.canvas as OffscreenCanvas;
        ctx = canvas.getContext('2d');
    } else if (msg.type === 'draw') {
        draw(msg.landmarks, msg.width, msg.height, msg.phase, msg.isValidPosition, msg.exerciseType);
    }
};
