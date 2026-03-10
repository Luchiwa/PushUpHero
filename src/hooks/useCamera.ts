import { useEffect, useRef, useState } from 'react';

type FacingMode = 'user' | 'environment';

interface UseCameraOptions {
    facingMode?: FacingMode;
}

interface UseCameraReturn {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isReady: boolean;
    error: string | null;
}

export function useCamera({ facingMode = 'user' }: UseCameraOptions = {}): UseCameraReturn {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;
        let cancelled = false;

        async function startCamera() {
            setIsReady(false);
            try {
                // Stop any existing stream before switching
                if (videoRef.current?.srcObject) {
                    (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
                    videoRef.current.srcObject = null;
                }

                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode,
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                });

                if (cancelled) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        if (!cancelled) {
                            videoRef.current?.play();
                            setIsReady(true);
                        }
                    };
                }
            } catch (err) {
                if (!cancelled) {
                    setError('Camera access denied. Please allow camera permissions.');
                    console.error('Camera error:', err);
                }
            }
        }

        startCamera();

        return () => {
            cancelled = true;
            stream?.getTracks().forEach((t) => t.stop());
        };
    }, [facingMode]);

    return { videoRef, isReady, error };
}
