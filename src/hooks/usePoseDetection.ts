import { useEffect, useRef, useState } from 'react';
import {
    PoseLandmarker,
    FilesetResolver,
} from '@mediapipe/tasks-vision';
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import type { Landmark } from '../exercises/types';

// Mobile browsers (Android/iOS) struggle with GPU delegate — use CPU there
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
// Throttle detection on mobile: target ~20fps instead of 60fps
const MOBILE_DETECTION_INTERVAL_MS = 50; // ~20fps

interface UsePoseDetectionProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isVideoReady: boolean;
    isActive: boolean;
    /** Called on every frame with fresh landmarks — use a ref-stable callback */
    onFrame: (landmarks: Landmark[], rawResult: PoseLandmarkerResult) => void;
}

interface UsePoseDetectionReturn {
    isModelReady: boolean;
}

export function usePoseDetection({
    videoRef,
    isVideoReady,
    isActive,
    onFrame,
}: UsePoseDetectionProps): UsePoseDetectionReturn {
    const [isModelReady, setIsModelReady] = useState(false);

    const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
    const animFrameRef = useRef<number>(0);
    const lastVideoTimeRef = useRef<number>(-1);
    const lastDetectionTimeRef = useRef<number>(0);
    const onFrameRef = useRef(onFrame);

    // Keep callback ref fresh without re-triggering the detection loop
    useEffect(() => { onFrameRef.current = onFrame; }, [onFrame]);

    // Load model
    useEffect(() => {
        async function loadModel() {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
                );
                poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath:
                            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                        delegate: isMobile ? 'CPU' : 'GPU',
                    },
                    runningMode: 'VIDEO',
                    numPoses: 1,
                });
                setIsModelReady(true);
            } catch (err) {
                console.error('Failed to load MediaPipe model:', err);
            }
        }
        loadModel();
        return () => { poseLandmarkerRef.current?.close(); };
    }, []);

    // Detection loop — never causes React re-renders on its own
    const detectRef = useRef<() => void>(() => {});

    useEffect(() => {
        detectRef.current = () => {
            const video = videoRef.current;
            const landmarker = poseLandmarkerRef.current;
            if (!video || !landmarker) return;

            // Throttle on mobile
            if (isMobile) {
                const now = performance.now();
                if (now - lastDetectionTimeRef.current < MOBILE_DETECTION_INTERVAL_MS) {
                    animFrameRef.current = requestAnimationFrame(() => detectRef.current());
                    return;
                }
                lastDetectionTimeRef.current = now;
            }

            if (video.videoWidth === 0 || video.videoHeight === 0) {
                animFrameRef.current = requestAnimationFrame(() => detectRef.current());
                return;
            }

            const currentTime = video.currentTime;
            if (currentTime !== lastVideoTimeRef.current) {
                lastVideoTimeRef.current = currentTime;
                const result = landmarker.detectForVideo(video, performance.now());
                const lms = result.landmarks?.[0] as Landmark[] | undefined;
                if (lms && lms.length > 0) {
                    onFrameRef.current(lms, result);
                }
            }
            animFrameRef.current = requestAnimationFrame(() => detectRef.current());
        };
    });

    useEffect(() => {
        if (!isModelReady || !isVideoReady || !isActive) {
            cancelAnimationFrame(animFrameRef.current);
            return;
        }
        animFrameRef.current = requestAnimationFrame(() => detectRef.current());
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [isModelReady, isVideoReady, isActive]);

    return { isModelReady };
}
