import { useEffect, useRef, useState } from 'react';
import {
    PoseLandmarker,
    FilesetResolver,
} from '@mediapipe/tasks-vision';
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import type { Landmark } from '../exercises/types';


interface UsePoseDetectionProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isVideoReady: boolean;
    isActive: boolean;
}

interface UsePoseDetectionReturn {
    landmarks: Landmark[];
    rawResult: PoseLandmarkerResult | null;
    isModelReady: boolean;
}

export function usePoseDetection({
    videoRef,
    isVideoReady,
    isActive,
}: UsePoseDetectionProps): UsePoseDetectionReturn {
    const [isModelReady, setIsModelReady] = useState(false);
    const [landmarks, setLandmarks] = useState<Landmark[]>([]);
    const [rawResult, setRawResult] = useState<PoseLandmarkerResult | null>(null);

    const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
    const animFrameRef = useRef<number>(0);
    const lastVideoTimeRef = useRef<number>(-1);

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
                        delegate: 'GPU',
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

        return () => {
            poseLandmarkerRef.current?.close();
        };
    }, []);

    // Detection loop
    useEffect(() => {
        if (!isModelReady || !isVideoReady || !isActive) {
            cancelAnimationFrame(animFrameRef.current);
            return;
        }

        function detect() {
            const video = videoRef.current;
            const landmarker = poseLandmarkerRef.current;
            if (!video || !landmarker) return;

            const currentTime = video.currentTime;
            // Guard: skip if video hasn't loaded its dimensions yet
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                animFrameRef.current = requestAnimationFrame(detect);
                return;
            }
            if (currentTime !== lastVideoTimeRef.current) {
                lastVideoTimeRef.current = currentTime;
                const result = landmarker.detectForVideo(video, performance.now());
                setRawResult(result);
                if (result.landmarks && result.landmarks.length > 0) {
                    setLandmarks(result.landmarks[0] as Landmark[]);
                } else {
                    setLandmarks([]);
                }
            }
            animFrameRef.current = requestAnimationFrame(detect);
        }

        animFrameRef.current = requestAnimationFrame(detect);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [isModelReady, isVideoReady, isActive, videoRef]);

    return { landmarks, rawResult, isModelReady };
}
