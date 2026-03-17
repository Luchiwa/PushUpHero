/**
 * useDashboardLogic — Encapsulates all Dashboard side-effects:
 * sound triggers, invalid-position banner debouncing, and countdown timer.
 *
 * Keeps Dashboard.tsx as a pure render component.
 */
import { useEffect, useRef, useState } from 'react';
import { useSoundEffect } from '@hooks/useSoundEffect';

interface UseDashboardLogicProps {
    repCount: number;
    isCalibrated: boolean;
    isValidPosition: boolean;
    soundEnabled: boolean;
    sessionMode: 'reps' | 'time';
    timeGoal: { minutes: number; seconds: number };
    elapsedTimeRef?: React.MutableRefObject<number>;
    onTimerEnd: () => void;
}

export function useDashboardLogic({
    repCount,
    isCalibrated,
    isValidPosition,
    soundEnabled,
    sessionMode,
    timeGoal,
    elapsedTimeRef,
    onTimerEnd,
}: UseDashboardLogicProps) {
    const { initAudio, playRepSound, playStartReadySound } = useSoundEffect();
    const prevRepCountRef = useRef(repCount);
    const prevCalibratedRef = useRef(isCalibrated);

    // ── Invalid-position banner (debounced ~2s at 30fps) ─────────
    const invalidFramesRef = useRef(0);
    const [showInvalidBanner, setShowInvalidBanner] = useState(false);

    // Sync invalid-position banner from pose detection data (external system).
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (!isCalibrated) { setShowInvalidBanner(false); return; }
        if (!isValidPosition) {
            invalidFramesRef.current++;
            if (invalidFramesRef.current >= 60) setShowInvalidBanner(true);
        } else {
            invalidFramesRef.current = 0;
            setShowInvalidBanner(false);
        }
    }, [isValidPosition, isCalibrated]);
    /* eslint-enable react-hooks/set-state-in-effect */

    // ── Sound effects ────────────────────────────────────────────

    // Initialize audio context on first interaction
    useEffect(() => {
        if (soundEnabled) initAudio();
    }, [soundEnabled, initAudio]);

    // Play rep sound
    useEffect(() => {
        if (repCount > prevRepCountRef.current) {
            if (soundEnabled) playRepSound();
        }
        prevRepCountRef.current = repCount;
    }, [repCount, playRepSound, soundEnabled]);

    // Play "ready to start" sound when calibration completes
    useEffect(() => {
        if (!prevCalibratedRef.current && isCalibrated && soundEnabled) {
            playStartReadySound();
        }
        prevCalibratedRef.current = isCalibrated;
    }, [isCalibrated, soundEnabled, playStartReadySound]);

    // ── Countdown timer (time-based sessions) ────────────────────
    const countdownActiveRef = useRef(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const totalSecondsRef = useRef(0);

    const [timeRemaining, setTimeRemaining] = useState(() => {
        const initialSeconds = timeGoal.minutes * 60 + timeGoal.seconds;
        return sessionMode === 'time' ? initialSeconds : 0;
    });

    // Re-initialize timer when timeGoal changes (external config sync).
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (sessionMode === 'time') {
            const totalSeconds = timeGoal.minutes * 60 + timeGoal.seconds;
            totalSecondsRef.current = totalSeconds;
            setTimeRemaining(totalSeconds);
            countdownActiveRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }
    }, [sessionMode, timeGoal.minutes, timeGoal.seconds]);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // Start countdown when calibration completes (only once per session)
    useEffect(() => {
        if (sessionMode !== 'time' || !isCalibrated || countdownActiveRef.current) return;

        countdownActiveRef.current = true;
        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
            setTimeRemaining(prev => {
                const newTime = prev - 1;
                if (elapsedTimeRef) {
                    elapsedTimeRef.current = totalSecondsRef.current - newTime;
                }
                return newTime <= 0 ? 0 : newTime;
            });
        }, 1000);
    }, [sessionMode, isCalibrated, elapsedTimeRef]);

    // Trigger stop when countdown reaches 0
    useEffect(() => {
        if (sessionMode === 'time' && timeRemaining === 0 && countdownActiveRef.current) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            onTimerEnd();
        }
    }, [timeRemaining, sessionMode, onTimerEnd]);

    return { showInvalidBanner, timeRemaining };
}
