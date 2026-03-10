import { useEffect, useRef, useState } from 'react';
import type { ExerciseState } from '../exercises/types';
import { useSoundEffect } from '../hooks/useSoundEffect';

import { FloatyNumbers } from './FloatyNumbers';

interface DashboardProps {
    exerciseState: ExerciseState;
    goalReps: number;
    sessionMode: 'reps' | 'time';
    timeGoal: { minutes: number; seconds: number };
    onStop: () => void;
    onTimerEnd: () => void;
    elapsedTimeRef?: React.MutableRefObject<number>;
    onFlipCamera: () => void;
    facingMode: 'user' | 'environment';
    soundEnabled: boolean;
    onSoundToggle: () => void;
    level: number;
    levelProgressPct: number;
}

function ScoreRing({ score }: { score: number }) {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <svg className="score-ring" viewBox="0 0 100 100" width="100" height="100">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="#e0e0e0" strokeWidth="10" />
            <circle
                cx="50" cy="50" r={radius}
                fill="none"
                stroke={color}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease' }}
            />
            <text x="50" y="57" textAnchor="middle" fontSize="26" fontWeight="900" fill="url(#score-gradient)">
                {score}
            </text>
            <defs>
                <linearGradient id="score-gradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ffb366" />
                    <stop offset="50%" stopColor="#ff9c35" />
                    <stop offset="100%" stopColor="#ff7f00" />
                </linearGradient>
            </defs>
        </svg>
    );
}

function LevelBadge({ level, progressPct }: { level: number, progressPct: number }) {
    return (
        <div className="level-badge">
            <div className="level-badge-ring" style={{ background: `conic-gradient(var(--accent) ${progressPct}%, rgba(255,255,255,0.1) ${progressPct}%)` }}>
                <div className="level-badge-inner">
                    <span className="level-label">LVL</span>
                    <span className="level-number">{level}</span>
                </div>
            </div>
        </div>
    );
}

function GoalProgressBar({ current, goal }: { current: number; goal: number }) {
    const pct = Math.min(100, (current / goal) * 100);
    const done = current >= goal;
    return (
        <div className="stat-card goal-card">
            <span className="stat-label">Goal</span>
            <div className="goal-vertical-track">
                <div
                    className={`goal-vertical-fill ${done ? 'goal-done' : ''}`}
                    style={{ height: `${pct}%` }}
                />
            </div>
            <span className="goal-vertical-count">{current}/{goal}</span>
        </div>
    );
}

export function Dashboard({ exerciseState, goalReps, sessionMode, timeGoal, onStop, onTimerEnd, elapsedTimeRef, onFlipCamera, facingMode, soundEnabled, onSoundToggle, level, levelProgressPct }: DashboardProps) {
    const { repCount, averageScore, lastRepResult, isValidPosition, isCalibrated } = exerciseState;

    // Audio hook (sound toggle is via prop from App)
    const { initAudio, playRepSound, playStartReadySound } = useSoundEffect();
    const prevRepCountRef = useRef(repCount);
    const prevCalibratedRef = useRef(isCalibrated);
    const countdownActiveRef = useRef(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Removed level system logic from here to prevent unmount bugs

    // Debounced invalid-position banner: only show after 2s of invalid position
    const invalidFramesRef = useRef(0);
    const [showInvalidBanner, setShowInvalidBanner] = useState(false);
    
    // Timer state for time-based sessions
    const [timeRemaining, setTimeRemaining] = useState(() => {
        const initialSeconds = timeGoal.minutes * 60 + timeGoal.seconds;
        return sessionMode === 'time' ? initialSeconds : 0;
    });
    const totalSecondsRef = useRef(0);
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

    // Initialize audio context on first interaction
    useEffect(() => {
        if (soundEnabled) initAudio();
    }, [soundEnabled, initAudio]);

    useEffect(() => {
        if (repCount > prevRepCountRef.current) {
            // Play rep sound
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

    // Initialize timer state based on timeGoal
    useEffect(() => {
        if (sessionMode === 'time') {
            const totalSeconds = timeGoal.minutes * 60 + timeGoal.seconds;
            totalSecondsRef.current = totalSeconds;
            setTimeRemaining(totalSeconds);
            // Reset countdown flag so it can restart
            countdownActiveRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }
    }, [sessionMode, timeGoal.minutes, timeGoal.seconds]);

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // Start countdown when calibration completes (only once per session)
    useEffect(() => {
        if (sessionMode !== 'time' || !isCalibrated || countdownActiveRef.current) {
            return;
        }

        // Mark that countdown has started
        countdownActiveRef.current = true;

        // Clear any existing interval
        if (intervalRef.current) clearInterval(intervalRef.current);
        
        intervalRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
                const newTime = prev - 1;
                
                // Update the ref with elapsed time
                if (elapsedTimeRef) {
                    const totalSeconds = totalSecondsRef.current;
                    elapsedTimeRef.current = totalSeconds - newTime;
                }
                
                return newTime <= 0 ? 0 : newTime;
            });
        }, 1000);

    }, [sessionMode, isCalibrated, onStop, elapsedTimeRef]);

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

    return (
        <div className="dashboard">
            <div className="dashboard-top">
                <LevelBadge level={level} progressPct={levelProgressPct} />
                <div className="dashboard-actions">
                    <button
                        className="btn-sound"
                        onClick={onFlipCamera}
                        title={facingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'}
                    >
                        {/* Camera flip icon */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1l2-3h6l2 3h1a2 2 0 0 1 2 2v1" />
                            <circle cx="9" cy="13" r="3" />
                            <path d="M17 15v6M14 18l3-3 3 3" />
                        </svg>
                    </button>
                    <button
                        className={`btn-sound ${soundEnabled ? '' : 'btn-sound-muted'}`}
                        onClick={onSoundToggle}
                        title={soundEnabled ? 'Mute sound' : 'Enable sound'}
                    >
                        {soundEnabled ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <line x1="23" y1="9" x2="17" y2="15"></line>
                                <line x1="17" y1="9" x2="23" y2="15"></line>
                            </svg>
                        )}
                    </button>
                    <button className="btn-stop" onClick={onStop}>■ Stop</button>
                </div>
            </div>

            <div className="stats-row">
                <div className="stat-card" style={{ position: 'relative' }}>
                    <FloatyNumbers repCount={repCount} />
                    <span className="stat-value rep-count">{repCount}</span>
                    <span className="stat-label">Push-ups</span>
                </div>

                <div className="stat-card score-card">
                    <ScoreRing score={averageScore} />
                    <span className="stat-label">Avg Score</span>
                </div>

                {sessionMode === 'time' ? (
                    <div className="stat-card">
                        <span className="timer-display">
                            {String(Math.floor(timeRemaining / 60)).padStart(2, '0')}:
                            {String(timeRemaining % 60).padStart(2, '0')}
                        </span>
                        <span className="stat-label">Time Left</span>
                    </div>
                ) : (
                    <GoalProgressBar current={repCount} goal={goalReps} />
                )}
            </div>

            {/* Anti-cheat feedback banner — debounced, below stats */}
            {showInvalidBanner && (
                <div className="invalid-position-banner">
                    ⚠️ Get back into push-up position — body horizontal, hands on the ground
                </div>
            )}

            {lastRepResult && (
                <div className="last-rep-info">
                    <span className="last-rep-title">Last rep</span>
                    <div className="last-rep-bars">
                        <div className="bar-row">
                            <span>Amplitude</span>
                            <div className="bar-track">
                                <div className="bar-fill" style={{ width: `${lastRepResult.amplitudeScore}%` }} />
                            </div>
                            <span>{lastRepResult.amplitudeScore}</span>
                        </div>
                        <div className="bar-row">
                            <span>Alignment</span>
                            <div className="bar-track">
                                <div className="bar-fill bar-fill-alt" style={{ width: `${lastRepResult.alignmentScore}%` }} />
                            </div>
                            <span>{lastRepResult.alignmentScore}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
