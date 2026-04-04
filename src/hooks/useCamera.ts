import { useEffect, useRef, useState, useCallback } from 'react';
import { isMobile } from '@infra/device';

export type FacingMode = 'user' | 'environment';

interface UseCameraOptions {
    facingMode?: FacingMode;
    enabled?: boolean;
}

interface UseCameraReturn {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isReady: boolean;
    error: string | null;
    triggerStart: (overrideFacingMode?: FacingMode) => void;
}

export function useCamera({ facingMode = 'user', enabled = true }: UseCameraOptions = {}): UseCameraReturn {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const facingModeRef = useRef(facingMode);
    useEffect(() => { facingModeRef.current = facingMode; }, [facingMode]);

    const stopStream = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => { t.stop(); });
        streamRef.current = null;
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsReady(false);
    }, []);

    const triggerStart = useCallback(async (overrideFacingMode?: FacingMode) => {
        stopStream();
        setError(null);
        const mode = overrideFacingMode ?? facingModeRef.current;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: mode,
                    width:  { ideal: isMobile ? 640  : 1280 },
                    height: { ideal: isMobile ? 480  : 720  },
                },
            });

            streamRef.current = stream;

            if (!videoRef.current) return;
            videoRef.current.srcObject = stream;

            const video = videoRef.current;
            const onReady = () => {
                video.play().catch(() => {});
                setIsReady(true);
            };
            if (video.readyState >= 2) {
                onReady();
            } else {
                video.onloadedmetadata = onReady;
            }
        } catch (err) {
            setError('Camera access denied. Please allow camera permissions.');
            console.error('Camera error:', err);
        }
    }, [stopStream]);

    // Sync camera lifecycle with enabled prop — stopStream resets
    // both the MediaStream and isReady state in one atomic operation.
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (!enabled) {
            stopStream();
        }
    }, [enabled, stopStream]);
    /* eslint-enable react-hooks/set-state-in-effect */

    return { videoRef, isReady, error, triggerStart };
}
