import { useEffect, useRef, useState } from 'react';
import {
    PoseLandmarker,
    FilesetResolver,
    type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';
import type { Landmark } from '@exercises/types';
import { isMobile } from '@infra/device';
import { LandmarkSmoother } from '@infra/oneEuroFilter';

// Cap detection at ~30fps on all platforms (saves CPU/GPU), 20fps on mobile
const DETECTION_INTERVAL_MS = isMobile ? 50 : 33;

interface UsePoseDetectionProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isVideoReady: boolean;
    isActive: boolean;
    /** Gate for the WASM download. Flip to true when the user has signalled
     *  intent to start a workout — load is one-shot and the model stays in
     *  memory afterwards even if this flips back to false. */
    shouldLoadModel: boolean;
    /** Called on every frame with fresh landmarks — use a ref-stable callback */
    onFrame: (landmarks: Landmark[], rawResult: PoseLandmarkerResult) => void;
}

interface UsePoseDetectionReturn {
    isModelReady: boolean;
    modelError: string | null;
}

export function usePoseDetection({
    videoRef,
    isVideoReady,
    isActive,
    shouldLoadModel,
    onFrame,
}: UsePoseDetectionProps): UsePoseDetectionReturn {
    const [isModelReady, setIsModelReady] = useState(false);
    const [modelError, setModelError] = useState<string | null>(null);
    const hasStartedLoadRef = useRef(false);

    const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
    const animFrameRef = useRef<number>(0);
    const lastVideoTimeRef = useRef<number>(-1);
    const lastDetectionTimeRef = useRef<number>(0);
    const onFrameRef = useRef(onFrame);
    const smootherRef = useRef(new LandmarkSmoother());

    // Keep callback ref fresh without re-triggering the detection loop
    useEffect(() => { onFrameRef.current = onFrame; }, [onFrame]);

    // Load model (with GPU → CPU fallback) — gated on shouldLoadModel.
    // One-shot: once the load begins we never tear it down until unmount, even
    // if shouldLoadModel flips back to false (user returning to idle).
    useEffect(() => {
        if (!shouldLoadModel || hasStartedLoadRef.current) return;
        hasStartedLoadRef.current = true;
        let cancelled = false;

        async function createLandmarker(delegate: 'GPU' | 'CPU'): Promise<PoseLandmarker> {
            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
            );
            const model = 'pose_landmarker_full';
            return PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        `https://storage.googleapis.com/mediapipe-models/pose_landmarker/${model}/float16/1/${model}.task`,
                    delegate,
                },
                runningMode: 'VIDEO',
                numPoses: 1,
                minPoseDetectionConfidence: 0.6,
                minPosePresenceConfidence: 0.6,
                minTrackingConfidence: 0.6,
            });
        }

        async function loadModel() {
            try {
                const preferredDelegate = isMobile ? 'CPU' : 'GPU';
                poseLandmarkerRef.current = await createLandmarker(preferredDelegate);
                if (!cancelled) setIsModelReady(true);
            } catch (firstErr) {
                console.warn('MediaPipe: primary delegate failed, trying fallback…', firstErr);
                try {
                    const fallback = isMobile ? 'GPU' : 'CPU';
                    poseLandmarkerRef.current = await createLandmarker(fallback);
                    if (!cancelled) setIsModelReady(true);
                } catch (secondErr) {
                    console.error('MediaPipe: all delegates failed', secondErr);
                    if (!cancelled) setModelError('Failed to load AI model. Please refresh.');
                }
            }
        }
        loadModel();
        return () => { cancelled = true; };
    }, [shouldLoadModel]);

    // Release the landmarker only on full unmount
    useEffect(() => {
        return () => { poseLandmarkerRef.current?.close(); };
    }, []);

    // Detection loop — never causes React re-renders on its own
    const detectRef = useRef<() => void>(() => {});

    // Empty deps: the closure only reads refs (videoRef, poseLandmarkerRef,
    // *Ref.current) and module constants (DETECTION_INTERVAL_MS). Without [],
    // this effect re-runs every render and reallocates the closure — 2-5 MB of
    // heap churn on a 10-min workout.
    useEffect(() => {
        detectRef.current = () => {
            const video = videoRef.current;
            const landmarker = poseLandmarkerRef.current;
            if (!video || !landmarker) return;

            // Throttle to ~30fps (desktop) / ~20fps (mobile)
            const now = performance.now();
            if (now - lastDetectionTimeRef.current < DETECTION_INTERVAL_MS) {
                animFrameRef.current = requestAnimationFrame(() => detectRef.current());
                return;
            }
            lastDetectionTimeRef.current = now;

            if (video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) {
                animFrameRef.current = requestAnimationFrame(() => detectRef.current());
                return;
            }

            const currentTime = video.currentTime;
            if (currentTime !== lastVideoTimeRef.current) {
                lastVideoTimeRef.current = currentTime;
                const result = landmarker.detectForVideo(video, performance.now());
                const lms = result.landmarks?.[0] as Landmark[] | undefined;
                if (lms && lms.length > 0) {
                    const smoothed = smootherRef.current.smooth(lms, performance.now());
                    onFrameRef.current(smoothed, result);
                }
            }
            animFrameRef.current = requestAnimationFrame(() => detectRef.current());
        };
    }, [videoRef]);

    useEffect(() => {
        if (!isModelReady || !isVideoReady || !isActive) {
            cancelAnimationFrame(animFrameRef.current);
            smootherRef.current.reset();
            return;
        }
        animFrameRef.current = requestAnimationFrame(() => detectRef.current());
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [isModelReady, isVideoReady, isActive]);

    return { isModelReady, modelError };
}
