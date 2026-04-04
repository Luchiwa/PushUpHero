/**
 * poseOverlay.worker.ts
 *
 * Draws the skeleton overlay on an OffscreenCanvas, completely off the main thread.
 * Receives:
 *   { type: 'init', canvas }
 *   { type: 'set-key-joints', keyJoints: Record<string, number[]> }
 *   { type: 'draw', landmarks, width, height, phase, isValidPosition, exerciseType }
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

/** Key joints to highlight per exercise type — sent from main thread via 'set-key-joints' */
let keyJointsMap: Record<string, Set<number>> = {};

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

/** Previous frame's core center — used to detect skeleton teleportation */
let prevCoreCenter: { x: number; y: number } | null = null;

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

    // Only resize when dimensions change (avoids expensive GPU texture reallocation)
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    } else {
        ctx.clearRect(0, 0, width, height);
    }

    if (!landmarks || landmarks.length === 0) return;

    const w = width;
    const h = height;
    const MIN_VIS = 0.35;

    // Skip drawing if the skeleton looks "exploded" (incoherent landmark spread).
    // Check that core landmarks (shoulders + hips) are visible and form a plausible body.
    const core = [11, 12, 23, 24].map(i => landmarks[i]).filter(l => l && (l.visibility ?? 0) > MIN_VIS);
    if (core.length < 3) return; // not enough visible core landmarks
    const xs = core.map(l => l.x), ys = core.map(l => l.y);
    const coreW = Math.max(...xs) - Math.min(...xs);
    const coreH = Math.max(...ys) - Math.min(...ys);
    // If the core bounding box is unreasonably large (>60% of frame) or tiny (<1%), skip
    if (coreW > 0.6 || coreH > 0.6 || (coreW < 0.01 && coreH < 0.01)) return;

    // Inter-frame consistency: reject skeleton teleportation (hallucination artifact)
    const coreCX = xs.reduce((s, v) => s + v, 0) / xs.length;
    const coreCY = ys.reduce((s, v) => s + v, 0) / ys.length;
    if (prevCoreCenter) {
        const jump = Math.hypot(coreCX - prevCoreCenter.x, coreCY - prevCoreCenter.y);
        if (jump > 0.15) {
            // Skeleton center jumped >15% of frame in one step — skip this frame
            prevCoreCenter = { x: coreCX, y: coreCY };
            return;
        }
    }
    prevCoreCenter = { x: coreCX, y: coreCY };

    const phaseColor = getPhaseColor(phase, isValidPosition);

    // Draw connections (skip if either endpoint has low visibility)
    ctx.lineWidth = 3;
    ctx.strokeStyle = `${phaseColor}cc`;
    ctx.lineCap = 'round';
    for (const [a, b] of POSE_CONNECTIONS) {
        const la = landmarks[a];
        const lb = landmarks[b];
        if (la && lb && (la.visibility ?? 0) > MIN_VIS && (lb.visibility ?? 0) > MIN_VIS) {
            ctx.beginPath();
            ctx.moveTo(la.x * w, la.y * h);
            ctx.lineTo(lb.x * w, lb.y * h);
            ctx.stroke();
        }
    }

    // Draw joints (skip low-visibility landmarks)
    const keyJoints = keyJointsMap[exerciseType];
    for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        if (!lm || (lm.visibility ?? 0) < MIN_VIS) continue;
        const x = lm.x * w;
        const y = lm.y * h;
        const isKey = keyJoints ? keyJoints.has(i) : false;

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
    } else if (msg.type === 'set-key-joints') {
        const raw = msg.keyJoints as Record<string, number[]>;
        keyJointsMap = {};
        for (const [key, arr] of Object.entries(raw)) {
            keyJointsMap[key] = new Set(arr);
        }
    } else if (msg.type === 'draw') {
        draw(msg.landmarks, msg.width, msg.height, msg.phase, msg.isValidPosition, msg.exerciseType);
    }
};
